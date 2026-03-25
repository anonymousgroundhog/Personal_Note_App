import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, BookOpen, AlertCircle, ChevronDown, ChevronUp, Copy, Check, ChevronRight } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'

const GIT_SERVER = 'http://localhost:3001'

// ---- Types from server analysis output ----

interface PacketStats {
  total_packets: number
  total_bytes: number
  duration_seconds: number
  start_time: number
  end_time: number
  packets_per_second: number
  bytes_per_second: number
}

interface ProtocolCount {
  protocol: string
  count: number
  bytes: number
}

interface Conversation {
  src_ip: string
  dst_ip: string
  src_port: number
  dst_port: number
  protocol: string
  packets: number
  bytes: number
}

interface DnsEntry {
  time: number
  src: string
  type: string
  query?: string
  response?: string
  answers?: string[]
}

interface ThreatIndicator {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  description: string
  details: string
}

interface TopologyNode {
  id: string
  label: string
  role: string
  packets_sent: number
  packets_recv: number
}

interface TopologyEdge {
  src: string
  dst: string
  bytes: number
  protocol: string
}

interface PcapResult {
  stats: PacketStats
  protocols: ProtocolCount[]
  top_conversations: Conversation[]
  dns: DnsEntry[]
  tls_sni: string[]
  threats: ThreatIndicator[]
  topology: {
    nodes: TopologyNode[]
    edges: TopologyEdge[]
  }
  arp_table: Record<string, string>
  cleartext_credentials: { protocol: string; src: string; dst: string; snippet: string }[]
}

type ResultTab = 'summary' | 'threats' | 'conversations' | 'dns' | 'network' | 'packets'
type Status = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

// ---- Packet viewer types ----

interface Packet {
  no: number
  time: number
  src: string
  dst: string
  sport: number
  dport: number
  proto: string
  len: number
  info: string
  color: string
  layers: string[]
  fields: Record<string, Record<string, string | number>>
}

// ---- Helpers ----

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

function formatDuration(secs: number): string {
  if (secs < 60) return secs.toFixed(1) + 's'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}m ${s}s`
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
  high:     'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  medium:   'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
  low:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  info:     'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high:     'bg-orange-500 text-white',
  medium:   'bg-yellow-500 text-white',
  low:      'bg-blue-500 text-white',
  info:     'bg-gray-400 text-white',
}

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
  info:     '⚪',
}

const ROLE_ICON: Record<string, string> = {
  gateway:   '🌐',
  dns_server:'🔍',
  server:    '🖥️',
  client:    '💻',
  unknown:   '❓',
}

// ---- Export to Note modal ----

interface ExportModalProps {
  result: PcapResult
  fileName: string
  onClose: () => void
}

function buildNoteContent(result: PcapResult, fileName: string): string {
  const now = new Date().toISOString().slice(0, 10)
  const threatCount = result.threats.filter(t => t.severity === 'critical' || t.severity === 'high').length
  const lines: string[] = []

  lines.push(`---`)
  lines.push(`title: PCAP Analysis — ${fileName}`)
  lines.push(`date: ${now}`)
  lines.push(`tags: [security, pcap, network-analysis]`)
  lines.push(`---`)
  lines.push(``)
  lines.push(`# PCAP Analysis: ${fileName}`)
  lines.push(``)
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Packets | ${result.stats.total_packets.toLocaleString()} |`)
  lines.push(`| Total Bytes | ${formatBytes(result.stats.total_bytes)} |`)
  lines.push(`| Duration | ${formatDuration(result.stats.duration_seconds)} |`)
  lines.push(`| Pkt/sec | ${result.stats.packets_per_second.toFixed(1)} |`)
  lines.push(`| Threats Found | ${result.threats.length} (${threatCount} critical/high) |`)
  lines.push(``)

  if (result.threats.length > 0) {
    lines.push(`## Threats Detected`)
    lines.push(``)
    for (const t of result.threats) {
      lines.push(`### ${SEVERITY_ICON[t.severity]} [${t.severity.toUpperCase()}] ${t.category}`)
      lines.push(``)
      lines.push(`**${t.description}**`)
      lines.push(``)
      lines.push(t.details)
      lines.push(``)
    }
  }

  if (result.protocols.length > 0) {
    lines.push(`## Protocol Breakdown`)
    lines.push(``)
    lines.push(`| Protocol | Packets | Bytes |`)
    lines.push(`|----------|---------|-------|`)
    for (const p of result.protocols.slice(0, 15)) {
      lines.push(`| ${p.protocol} | ${p.count.toLocaleString()} | ${formatBytes(p.bytes)} |`)
    }
    lines.push(``)
  }

  if (result.top_conversations.length > 0) {
    lines.push(`## Top Conversations`)
    lines.push(``)
    lines.push(`| Source | Destination | Protocol | Packets | Bytes |`)
    lines.push(`|--------|-------------|----------|---------|-------|`)
    for (const c of result.top_conversations.slice(0, 20)) {
      const src = c.src_port ? `${c.src_ip}:${c.src_port}` : c.src_ip
      const dst = c.dst_port ? `${c.dst_ip}:${c.dst_port}` : c.dst_ip
      lines.push(`| ${src} | ${dst} | ${c.protocol} | ${c.packets} | ${formatBytes(c.bytes)} |`)
    }
    lines.push(``)
  }

  if (result.dns.length > 0) {
    const queries = result.dns.filter(d => d.type === 'query' && d.query)
    lines.push(`## DNS Activity`)
    lines.push(``)
    lines.push(`${queries.length} DNS queries observed.`)
    lines.push(``)
    if (queries.length > 0) {
      lines.push(`| Query | Source |`)
      lines.push(`|-------|--------|`)
      for (const d of queries.slice(0, 30)) {
        lines.push(`| ${d.query} | ${d.src} |`)
      }
      lines.push(``)
    }
    if (result.tls_sni.length > 0) {
      lines.push(`### TLS SNI Observed`)
      lines.push(``)
      for (const sni of result.tls_sni) {
        lines.push(`- ${sni}`)
      }
      lines.push(``)
    }
  }

  if (result.topology.nodes.length > 0) {
    lines.push(`## Network Topology`)
    lines.push(``)
    lines.push(`| Host | Role | Pkts Sent | Pkts Recv |`)
    lines.push(`|------|------|-----------|-----------|`)
    for (const n of result.topology.nodes) {
      lines.push(`| ${n.label} | ${n.role} | ${n.packets_sent} | ${n.packets_recv} |`)
    }
    lines.push(``)
  }

  if (Object.keys(result.arp_table).length > 0) {
    lines.push(`## ARP Table`)
    lines.push(``)
    lines.push(`| IP | MAC |`)
    lines.push(`|----|-----|`)
    for (const [ip, mac] of Object.entries(result.arp_table)) {
      lines.push(`| ${ip} | ${mac} |`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}

// ---- Packet Viewer ----

const PROTO_COLORS: Record<string, string> = {
  TCP:   'bg-blue-50   dark:bg-blue-900/20',
  UDP:   'bg-green-50  dark:bg-green-900/20',
  DNS:   'bg-yellow-50 dark:bg-yellow-900/20',
  TLS:   'bg-purple-50 dark:bg-purple-900/20',
  HTTP:  'bg-red-50    dark:bg-red-900/20',
  ARP:   'bg-orange-50 dark:bg-orange-900/20',
  ICMP:  'bg-gray-50   dark:bg-gray-800',
  SSH:   'bg-emerald-50 dark:bg-emerald-900/20',
}

function PacketDetail({ pkt }: { pkt: Packet }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900">
      {/* Layer tree */}
      <div className="p-3 space-y-1 border-b border-gray-200 dark:border-gray-700">
        {Object.entries(pkt.fields).map(([layer, fields]) => (
          <div key={layer}>
            <button
              onClick={() => setOpen(o => ({ ...o, [layer]: !o[layer] }))}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-500 w-full text-left"
            >
              {open[layer] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {layer} Layer
            </button>
            {open[layer] && (
              <div className="ml-4 mt-1 space-y-0.5">
                {Object.entries(fields).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-[11px] font-mono">
                    <span className="text-gray-500 dark:text-gray-400 min-w-[80px]">{k}:</span>
                    <span className="text-gray-800 dark:text-gray-200 break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Hex dump */}
      {pkt.fields['Raw'] && (
        <div className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Hex Dump (first 64 bytes)</p>
          <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-400 break-all whitespace-pre-wrap leading-relaxed">
            {(String(pkt.fields['Raw'].hex)).match(/.{1,2}/g)?.join(' ')}
          </pre>
          {pkt.fields['Raw'].text && (
            <pre className="mt-1 text-[10px] font-mono text-gray-500 dark:text-gray-500 break-all whitespace-pre-wrap">
              {String(pkt.fields['Raw'].text).replace(/[^\x20-\x7e]/g, '.')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

interface PacketViewerProps {
  tmpPath: string
}

function PacketViewer({ tmpPath }: PacketViewerProps) {
  const [packets, setPackets] = useState<Packet[]>([])
  const [total, setTotal] = useState(0)
  const [totalUnfiltered, setTotalUnfiltered] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [pendingFilter, setPendingFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedNo, setSelectedNo] = useState<number | null>(null)
  const PAGE = 500
  const abortRef = useRef<AbortController | null>(null)

  const fetchPackets = useCallback(async (f: string, off: number) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${GIT_SERVER}/security/pcap/packets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmpPath, filter: f, offset: off, limit: PAGE }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(e.error)
      }
      const data = await res.json() as { packets: Packet[]; total: number; total_unfiltered: number }
      setPackets(data.packets)
      setTotal(data.total)
      setTotalUnfiltered(data.total_unfiltered)
      setSelectedNo(null)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [tmpPath])

  // Load on mount
  useEffect(() => { fetchPackets('', 0) }, [fetchPackets])

  const applyFilter = () => {
    setFilter(pendingFilter)
    setOffset(0)
    fetchPackets(pendingFilter, 0)
  }

  const clearFilter = () => {
    setPendingFilter('')
    setFilter('')
    setOffset(0)
    fetchPackets('', 0)
  }

  const goPage = (dir: 1 | -1) => {
    const newOff = Math.max(0, offset + dir * PAGE)
    setOffset(newOff)
    fetchPackets(filter, newOff)
  }

  const selectedPkt = packets.find(p => p.no === selectedNo) ?? null

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
        <div className="flex-1 flex items-center gap-1 bg-white dark:bg-surface-700 border border-gray-300 dark:border-gray-600 rounded px-2">
          <span className="text-xs text-gray-400 font-mono">filter:</span>
          <input
            value={pendingFilter}
            onChange={e => setPendingFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilter()}
            placeholder="ip, port, protocol, hostname…"
            className="flex-1 py-1.5 text-xs font-mono bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none"
          />
          {pendingFilter && (
            <button onClick={clearFilter} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={applyFilter}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50"
        >
          Apply
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {loading ? 'Loading…' : filter
            ? `${total.toLocaleString()} / ${totalUnfiltered.toLocaleString()} pkts`
            : `${totalUnfiltered.toLocaleString()} pkts`
          }
        </span>
      </div>

      {error && <p className="text-xs text-red-500 px-3 py-2">{error}</p>}

      {/* Packet list + detail pane split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Packet list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
          {/* Column headers */}
          <div className="sticky top-0 z-10 grid text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-surface-700 border-b border-gray-200 dark:border-gray-600 px-2 py-1" style={{ gridTemplateColumns: '3.5rem 5rem 11rem 11rem 4.5rem 4rem 1fr' }}>
            <span>No.</span><span>Time</span><span>Source</span><span>Destination</span><span>Proto</span><span>Len</span><span>Info</span>
          </div>

          {loading && packets.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading packets…</div>
          ) : packets.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">No packets match filter</div>
          ) : (
            packets.map(pkt => {
              const rowColor = PROTO_COLORS[pkt.proto] ?? ''
              const isSelected = pkt.no === selectedNo
              return (
                <div key={pkt.no}>
                  <button
                    onClick={() => setSelectedNo(isSelected ? null : pkt.no)}
                    className={`w-full grid text-left text-[11px] font-mono px-2 py-0.5 border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                      isSelected ? 'bg-blue-200 dark:bg-blue-800/50' : rowColor
                    }`}
                    style={{ gridTemplateColumns: '3.5rem 5rem 11rem 11rem 4.5rem 4rem 1fr' }}
                  >
                    <span className="text-gray-400">{pkt.no}</span>
                    <span className="text-gray-500">{pkt.time.toFixed(6)}</span>
                    <span className="truncate text-gray-700 dark:text-gray-300">{pkt.src}{pkt.sport ? `:${pkt.sport}` : ''}</span>
                    <span className="truncate text-gray-700 dark:text-gray-300">{pkt.dst}{pkt.dport ? `:${pkt.dport}` : ''}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{pkt.proto}</span>
                    <span className="text-gray-500">{pkt.len}</span>
                    <span className="truncate text-gray-600 dark:text-gray-400">{pkt.info}</span>
                  </button>
                  {isSelected && <PacketDetail pkt={pkt} />}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {total > PAGE && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
          <button
            onClick={() => goPage(-1)}
            disabled={offset === 0 || loading}
            className="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-300"
          >← Prev</button>
          <span className="text-xs text-gray-500">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total.toLocaleString()}
          </span>
          <button
            onClick={() => goPage(1)}
            disabled={offset + PAGE >= total || loading}
            className="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-300"
          >Next →</button>
        </div>
      )}
    </div>
  )
}

function ExportModal({ result, fileName, onClose }: ExportModalProps) {
  const { index, createNote, saveNote, readNote, refreshIndex, rootHandle, fallbackMode } = useVaultStore()
  const vaultOpen = rootHandle !== null || fallbackMode

  const [mode, setMode] = useState<'new' | 'append'>('new')
  const [newName, setNewName] = useState(`pcap-${fileName.replace(/\.pcap(ng)?$/i, '').replace(/[^a-z0-9_-]/gi, '-')}`)
  const [selectedPath, setSelectedPath] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const notes = Array.from(index.entries())
    .map(([path, note]) => ({ path, name: note.name }))
    .filter(({ name, path }) => {
      const q = search.toLowerCase()
      return !q || name.toLowerCase().includes(q) || path.toLowerCase().includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const content = buildNoteContent(result, fileName)

  const handleSave = async () => {
    if (!vaultOpen) { setError('Open a vault first'); return }
    setSaving(true)
    setError('')
    try {
      if (mode === 'new') {
        const filename = newName.trim().replace(/\.md$/i, '')
        if (!filename) { setError('Enter a file name'); setSaving(false); return }
        await createNote(`Security/PCAP/${filename}.md`, content)
        await refreshIndex()
      } else {
        if (!selectedPath) { setError('Select a note'); setSaving(false); return }
        const existing = await readNote(selectedPath)
        await saveNote(selectedPath, existing + '\n\n---\n\n' + content)
      }
      setSaved(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-emerald-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">Export Analysis to Note</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {!vaultOpen && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <AlertCircle size={14} /> Open a vault first to save notes.
            </div>
          )}

          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'new' ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
            >New Note</button>
            <button
              onClick={() => setMode('append')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'append' ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
            >Append to Existing</button>
          </div>

          {mode === 'new' ? (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                File name <span className="font-normal text-gray-400">(saved under Security/PCAP/)</span>
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="pcap-analysis"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="max-h-40 overflow-y-auto scrollbar-thin border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {notes.length === 0
                  ? <p className="p-3 text-sm text-gray-400">No notes found</p>
                  : notes.map(({ path, name }) => (
                    <button
                      key={path}
                      onClick={() => setSelectedPath(path)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedPath === path ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
                    >
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{path}</div>
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || saved || !vaultOpen}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              saved ? 'bg-green-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white'
            } disabled:cursor-not-allowed`}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Topology SVG ----

function TopologyMap({ nodes, edges }: { nodes: TopologyNode[]; edges: TopologyEdge[] }) {
  if (nodes.length === 0) return (
    <div className="flex items-center justify-center h-48 text-sm text-gray-400">No topology data</div>
  )

  // Simple circular layout
  const cx = 300, cy = 220, radius = 160
  const positions: Record<string, { x: number; y: number }> = {}
  const gateways = nodes.filter(n => n.role === 'gateway')
  const rest = nodes.filter(n => n.role !== 'gateway')

  // Put gateways in center-ish, rest in circle
  if (gateways.length > 0) {
    gateways.forEach((n, i) => {
      positions[n.id] = { x: cx - (gateways.length - 1) * 40 + i * 80, y: cy }
    })
  }
  rest.forEach((n, i) => {
    const angle = rest.length > 1 ? (2 * Math.PI * i) / rest.length - Math.PI / 2 : 0
    positions[n.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  })

  const maxBytes = edges.reduce((m, e) => Math.max(m, e.bytes ?? 0), 1)

  return (
    <svg viewBox="0 0 600 440" className="w-full h-full" style={{ maxHeight: 440 }}>
      {/* Edges */}
      {edges.slice(0, 40).map((e, i) => {
        const a = positions[e.src], b = positions[e.dst]
        if (!a || !b) return null
        const thickness = Math.max(1, (e.bytes / maxBytes) * 6)
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#6366f1"
            strokeWidth={thickness}
            strokeOpacity={0.3}
          />
        )
      })}
      {/* Nodes */}
      {nodes.map(n => {
        const pos = positions[n.id]
        if (!pos) return null
        const isGateway = n.role === 'gateway'
        return (
          <g key={n.id}>
            <circle
              cx={pos.x} cy={pos.y}
              r={isGateway ? 22 : 16}
              fill={isGateway ? '#6366f1' : '#10b981'}
              fillOpacity={0.85}
            />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={isGateway ? 14 : 10} fill="white">
              {ROLE_ICON[n.role] || '❓'}
            </text>
            <text x={pos.x} y={pos.y + (isGateway ? 32 : 26)} textAnchor="middle" fontSize={9} fill="#6b7280">
              {n.label.length > 15 ? n.label.slice(0, 14) + '…' : n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---- Main View ----

export default function PcapAnalyzerView() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<string[]>([])
  const [result, setResult] = useState<PcapResult | null>(null)
  const [tmpPath, setTmpPath] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ResultTab>('summary')
  const [showExport, setShowExport] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [dnsFilter, setDnsFilter] = useState('')
  const [threatFilter, setThreatFilter] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const addProgress = useCallback((msg: string) => {
    setProgress(p => [...p.slice(-49), msg])
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleAnalyze = async () => {
    if (!file) return
    setResult(null)
    setProgress([])
    setStatus('uploading')
    addProgress('Uploading PCAP...')

    abortRef.current = new AbortController()

    try {
      // 1. Upload
      const uploadRes = await fetch(`${GIT_SERVER}/security/pcap/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
        },
        body: file,
        signal: abortRef.current.signal,
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || `Upload HTTP ${uploadRes.status}`)
      }
      const { tmpPath: tp } = await uploadRes.json() as { tmpPath: string }
      setTmpPath(tp)
      addProgress(`Upload complete → ${tp}`)

      // 2. Analyze (SSE)
      setStatus('analyzing')
      addProgress('Starting analysis...')

      const analyzeRes = await fetch(`${GIT_SERVER}/security/pcap/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmpPath: tp, fileName: file.name }),
        signal: abortRef.current.signal,
      })
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(err.error || `Analysis HTTP ${analyzeRes.status}`)
      }

      const reader = analyzeRes.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'progress') {
              addProgress(event.message)
            } else if (event.type === 'result') {
              // Map Python script output shape → frontend PcapResult shape
              const raw = event.data ?? {}
              const s = raw.summary ?? {}
              const topo = raw.topology ?? {}
              // Convert proto_counts object → sorted array
              const protoObj: Record<string, number> = s.proto_counts ?? {}
              const protocols = Object.entries(protoObj)
                .map(([protocol, count]) => ({ protocol, count: count as number, bytes: 0 }))
                .sort((a, b) => b.count - a.count)
              // Remap conversations: {src,dst,sport,dport,proto,pkts,bytes} → frontend shape
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const top_conversations = (raw.conversations ?? []).map((c: any) => ({
                src_ip: c.src ?? c.src_ip ?? '',
                dst_ip: c.dst ?? c.dst_ip ?? '',
                src_port: c.sport ?? c.src_port ?? 0,
                dst_port: c.dport ?? c.dst_port ?? 0,
                protocol: c.proto ?? c.protocol ?? '?',
                packets: c.pkts ?? c.packets ?? 0,
                bytes: c.bytes ?? 0,
              }))
              // Remap DNS: {name, queries, resolved} → {type:'query', src:'', query, answers}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const dns = (raw.dns ?? []).map((d: any) => ({
                time: 0,
                src: d.src ?? '',
                type: d.type ?? 'query',
                query: d.name ?? d.query ?? '',
                answers: d.resolved ?? d.answers ?? [],
              }))
              // Remap topology nodes: {ip,role,sent_pkts,recv_pkts,hostname} → frontend shape
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const nodes = (topo.nodes ?? []).map((n: any) => ({
                id: n.ip ?? n.id ?? '',
                label: n.hostname ? `${n.ip} (${n.hostname})` : (n.ip ?? n.label ?? ''),
                role: n.role ?? 'unknown',
                packets_sent: n.sent_pkts ?? n.packets_sent ?? 0,
                packets_recv: n.recv_pkts ?? n.packets_recv ?? 0,
              }))
              // Remap topology edges: {src,dst,bytes} → frontend shape
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const topoEdges = (topo.edges ?? []).map((e: any) => ({
                src: e.src ?? '',
                dst: e.dst ?? '',
                bytes: e.bytes ?? 0,
                protocol: e.proto ?? e.protocol ?? '',
              }))
              // Remap threats: {severity,category,title,detail} → {severity,category,description,details}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const threats = (raw.threats ?? []).map((t: any) => ({
                severity: t.severity ?? 'info',
                category: t.category ?? 'Unknown',
                description: t.title ?? t.description ?? '',
                details: t.detail ?? t.details ?? '',
              }))
              const d: PcapResult = {
                stats: {
                  total_packets:     s.total_packets ?? 0,
                  total_bytes:       s.total_bytes ?? 0,
                  duration_seconds:  s.duration_secs ?? 0,
                  start_time:        s.start_time ?? 0,
                  end_time:          s.end_time ?? 0,
                  packets_per_second: (s.duration_secs ?? 0) > 0 ? (s.total_packets ?? 0) / s.duration_secs : 0,
                  bytes_per_second:   (s.duration_secs ?? 0) > 0 ? (s.total_bytes ?? 0) / s.duration_secs : 0,
                },
                protocols,
                top_conversations,
                dns,
                tls_sni:               raw.tls_hosts ?? [],
                threats,
                topology:              { nodes, edges: topoEdges },
                arp_table:             topo.arp_table ?? {},
                cleartext_credentials: raw.cleartext_credentials ?? [],
              }
              setResult(d)
            } else if (event.type === 'done') {
              setStatus('done')
            } else if (event.type === 'error') {
              addProgress(`Error: ${event.message}`)
              setStatus('error')
            }
          } catch { /* ignore parse errors */ }
        }
      }
      if (status !== 'error') setStatus('done')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('idle')
      } else {
        addProgress(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
        setStatus('error')
      }
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setStatus('idle')
  }

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const threats = result?.threats ?? []
  const filteredThreats = threatFilter === 'all' ? threats : threats.filter(t => t.severity === threatFilter)
  const filteredDns = (result?.dns ?? []).filter(d => {
    if (!dnsFilter) return true
    const q = dnsFilter.toLowerCase()
    return (d.query ?? '').toLowerCase().includes(q) || (d.response ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left panel: upload + controls */}
        <div className="flex-shrink-0 w-72 flex flex-col gap-3 overflow-y-auto scrollbar-thin">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors bg-gray-50 dark:bg-surface-800"
          >
            <Upload size={24} className="text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Drop a .pcap / .pcapng file here<br />
              <span className="text-xs text-gray-400">or click to browse</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pcap,.pcapng,.cap"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Selected file info */}
          {file && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">{file.name}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatBytes(file.size)}</p>
                </div>
                <button onClick={() => { setFile(null); setResult(null); setStatus('idle') }} className="text-emerald-400 hover:text-emerald-600">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={status === 'uploading' || status === 'analyzing' ? handleCancel : handleAnalyze}
            disabled={!file && status === 'idle'}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'uploading' || status === 'analyzing'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:cursor-not-allowed'
            }`}
          >
            {status === 'uploading' ? '⏳ Uploading… (Cancel)' : status === 'analyzing' ? '⏳ Analyzing… (Cancel)' : '▶ Analyze'}
          </button>

          {result && (
            <button
              onClick={() => setShowExport(true)}
              className="w-full py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen size={14} /> Export to Note
            </button>
          )}

          {/* Progress log */}
          {progress.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-gray-700 bg-gray-800">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Log</span>
              </div>
              <div className="max-h-48 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
                {progress.map((msg, i) => (
                  <p key={i} className="text-[10px] font-mono text-gray-300 leading-relaxed">{msg}</p>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Node Legend</p>
            <div className="space-y-1">
              {Object.entries(ROLE_ICON).filter(([k]) => k !== 'unknown').map(([role, icon]) => (
                <div key={role} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span>{icon}</span>
                  <span className="capitalize">{role.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel: results */}
        {result ? (
          <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-surface-800 min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 flex-wrap">
              {([
                ['summary', `Summary`],
                ['threats', `Threats (${threats.length})`],
                ['conversations', `Flows (${result.top_conversations.length})`],
                ['dns', `DNS (${result.dns.filter(d => d.type === 'query').length})`],
                ['network', `Network (${result.topology.nodes.length})`],
                ['packets', `📡 Packets`],
              ] as [ResultTab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={`flex-1 overflow-y-auto scrollbar-thin p-4 ${activeTab === 'packets' ? 'hidden' : ''}`}>
              {/* ---- SUMMARY ---- */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Total Packets', value: result.stats.total_packets.toLocaleString() },
                      { label: 'Total Data', value: formatBytes(result.stats.total_bytes) },
                      { label: 'Duration', value: formatDuration(result.stats.duration_seconds) },
                      { label: 'Pkt/sec', value: result.stats.packets_per_second.toFixed(1) },
                      { label: 'Unique Hosts', value: result.topology.nodes.length.toString() },
                      { label: 'Threats', value: threats.length.toString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Threat summary bar */}
                  {threats.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Threat Severity</p>
                      <div className="flex gap-2 flex-wrap">
                        {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
                          const cnt = threats.filter(t => t.severity === sev).length
                          if (!cnt) return null
                          return (
                            <span key={sev} className={`px-2 py-1 rounded text-xs font-semibold ${SEVERITY_BADGE[sev]}`}>
                              {sev.toUpperCase()} × {cnt}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Protocol breakdown */}
                  {result.protocols.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Protocol Breakdown</p>
                      <div className="space-y-1">
                        {result.protocols.slice(0, 12).map((p, i) => {
                          const pct = result.stats.total_packets > 0 ? (p.count / result.stats.total_packets) * 100 : 0
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-20 truncate">{p.protocol}</span>
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-emerald-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-14 text-right">{p.count.toLocaleString()}</span>
                              <span className="text-xs text-gray-400 w-14 text-right">{formatBytes(p.bytes)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* TLS SNI */}
                  {result.tls_sni.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">TLS SNI ({result.tls_sni.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {result.tls_sni.slice(0, 30).map((sni, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-mono">
                            {sni}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cleartext creds */}
                  {result.cleartext_credentials.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">⚠ Cleartext Credentials Detected</p>
                      <div className="space-y-2">
                        {result.cleartext_credentials.map((c, i) => (
                          <div key={i} className="p-2 rounded border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-red-700 dark:text-red-300">{c.protocol}</span>
                              <span className="text-xs text-gray-500">{c.src} → {c.dst}</span>
                            </div>
                            <code className="text-xs font-mono text-red-700 dark:text-red-300 break-all">{c.snippet}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---- THREATS ---- */}
              {activeTab === 'threats' && (
                <div className="space-y-3">
                  {/* Filter */}
                  <div className="flex gap-1 flex-wrap">
                    {['all', 'critical', 'high', 'medium', 'low', 'info'].map(sev => (
                      <button
                        key={sev}
                        onClick={() => setThreatFilter(sev)}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors capitalize ${
                          threatFilter === sev
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  {filteredThreats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <span className="text-4xl mb-2">✅</span>
                      <p className="text-sm">{threats.length === 0 ? 'No threats detected' : 'No threats match this filter'}</p>
                    </div>
                  ) : (
                    filteredThreats.map((t, i) => (
                      <ThreatCard key={i} threat={t} />
                    ))
                  )}
                </div>
              )}

              {/* ---- CONVERSATIONS ---- */}
              {activeTab === 'conversations' && (
                <div className="space-y-2">
                  {result.top_conversations.length === 0 ? (
                    <p className="text-sm text-gray-400">No conversations recorded</p>
                  ) : (
                    result.top_conversations.map((c, i) => (
                      <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-200 truncate">
                              {c.src_ip}{c.src_port ? `:${c.src_port}` : ''}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-200 truncate">
                              {c.dst_ip}{c.dst_port ? `:${c.dst_port}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                              {c.protocol}
                            </span>
                            <span className="text-xs text-gray-500">{c.packets} pkts</span>
                            <span className="text-xs text-gray-500">{formatBytes(c.bytes)}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{formatBytes(c.bytes)}</div>
                          <div className="text-[10px] text-gray-400">rank #{i + 1}</div>
                        </div>
                        <button
                          onClick={() => handleCopy(`${c.src_ip}:${c.src_port} → ${c.dst_ip}:${c.dst_port} [${c.protocol}] ${c.packets}pkts ${formatBytes(c.bytes)}`, i)}
                          className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          {copiedIdx === i ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ---- DNS ---- */}
              {activeTab === 'dns' && (
                <div className="space-y-3">
                  <input
                    value={dnsFilter}
                    onChange={e => setDnsFilter(e.target.value)}
                    placeholder="Filter DNS entries..."
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {filteredDns.length === 0 ? (
                    <p className="text-sm text-gray-400">No DNS entries found</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredDns.slice(0, 200).map((d, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-surface-700">
                          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.type === 'query' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
                            {d.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            {d.query && <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{d.query}</p>}
                            {d.answers && d.answers.length > 0 && (
                              <p className="text-[10px] text-gray-500 truncate">{d.answers.join(', ')}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{d.src}</span>
                          <button onClick={() => handleCopy(d.query ?? d.response ?? '', i + 1000)} className="flex-shrink-0 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                            {copiedIdx === i + 1000 ? <Check size={10} className="text-green-500" /> : <Copy size={10} className="text-gray-400" />}
                          </button>
                        </div>
                      ))}
                      {filteredDns.length > 200 && (
                        <p className="text-xs text-gray-400 text-center py-2">Showing first 200 of {filteredDns.length}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ---- NETWORK MAP ---- */}
              {activeTab === 'network' && (
                <div className="space-y-4">
                  {/* SVG topology */}
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 overflow-hidden" style={{ minHeight: 300 }}>
                    <TopologyMap nodes={result.topology.nodes} edges={result.topology.edges} />
                  </div>

                  {/* Node table */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hosts ({result.topology.nodes.length})</p>
                    <div className="space-y-1">
                      {result.topology.nodes.map((n, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 text-xs">
                          <span>{ROLE_ICON[n.role] || '❓'}</span>
                          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300 flex-1">{n.label}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 capitalize">{n.role.replace('_', ' ')}</span>
                          <span className="text-gray-400">↑{n.packets_sent} ↓{n.packets_recv}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ARP table */}
                  {Object.keys(result.arp_table).length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">ARP Table</p>
                      <div className="space-y-1">
                        {Object.entries(result.arp_table).map(([ip, mac]) => (
                          <div key={ip} className="flex items-center gap-3 p-2 rounded border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 text-xs">
                            <span className="font-mono text-gray-700 dark:text-gray-300 w-32">{ip}</span>
                            <span className="font-mono text-gray-500 dark:text-gray-400">{mac}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ---- PACKETS (full-height, manages own scroll) ---- */}
            {activeTab === 'packets' && tmpPath && (
              <div className="flex-1 overflow-hidden">
                <PacketViewer tmpPath={tmpPath} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-800 gap-3">
            {status === 'uploading' || status === 'analyzing' ? (
              <>
                <div className="text-4xl animate-pulse">🔬</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {status === 'uploading' ? 'Uploading PCAP...' : 'Analyzing packets...'}
                </p>
              </>
            ) : (
              <>
                <span className="text-5xl">📡</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Upload a PCAP file to analyze</p>
                <p className="text-xs text-gray-400">Supports .pcap and .pcapng</p>
              </>
            )}
          </div>
        )}
      </div>

      {showExport && result && file && (
        <ExportModal result={result} fileName={file.name} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}

// ---- Threat card with expandable details ----

function ThreatCard({ threat }: { threat: ThreatIndicator }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`rounded-lg border p-3 ${SEVERITY_STYLES[threat.severity]}`}>
      <button className="w-full flex items-start gap-3 text-left" onClick={() => setExpanded(e => !e)}>
        <span className="text-base">{SEVERITY_ICON[threat.severity]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_BADGE[threat.severity]}`}>
              {threat.severity}
            </span>
            <span className="text-xs font-semibold truncate">{threat.category}</span>
          </div>
          <p className="text-xs">{threat.description}</p>
        </div>
        {expanded ? <ChevronUp size={14} className="flex-shrink-0 mt-0.5" /> : <ChevronDown size={14} className="flex-shrink-0 mt-0.5" />}
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-current/20">
          <p className="text-xs whitespace-pre-wrap font-mono opacity-80">{threat.details}</p>
        </div>
      )}
    </div>
  )
}
