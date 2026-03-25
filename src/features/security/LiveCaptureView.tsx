import React, { useState, useRef, useCallback, useEffect } from 'react'
import { AlertTriangle, Play, Square, Download, Trash2, ChevronRight, ChevronDown, RefreshCw, X } from 'lucide-react'

const GIT_SERVER = 'http://localhost:3001'

// ---- Types ----

interface LivePacket {
  no: number
  time: number
  src: string
  dst: string
  sport: number
  dport: number
  proto: string
  len: number
  info: string
}

type CaptureState = 'idle' | 'starting' | 'capturing' | 'stopped'

const PROTO_ROW: Record<string, string> = {
  TCP:  'bg-blue-50   dark:bg-blue-900/20',
  UDP:  'bg-green-50  dark:bg-green-900/20',
  DNS:  'bg-yellow-50 dark:bg-yellow-900/20',
  TLS:  'bg-purple-50 dark:bg-purple-900/20',
  HTTP: 'bg-red-50    dark:bg-red-900/20',
  ARP:  'bg-orange-50 dark:bg-orange-900/20',
  ICMP: 'bg-gray-100  dark:bg-gray-800',
  SSH:  'bg-emerald-50 dark:bg-emerald-900/20',
}

const PROTO_BADGE: Record<string, string> = {
  TCP:  'bg-blue-500',
  UDP:  'bg-green-500',
  DNS:  'bg-yellow-500',
  TLS:  'bg-purple-500',
  HTTP: 'bg-red-500',
  ARP:  'bg-orange-500',
  ICMP: 'bg-gray-400',
  SSH:  'bg-emerald-500',
}

// ---- Legal warning ----

interface LegalWarningProps {
  accepted: boolean
  onAccept: () => void
}

function LegalWarning({ accepted, onAccept }: LegalWarningProps) {
  const [checked, setChecked] = useState(false)
  if (accepted) return null
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      <div className="max-w-xl w-full bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-6 shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-1">
              Legal Warning — Packet Capture
            </h2>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Read carefully before proceeding
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-amber-900 dark:text-amber-200 mb-6">
          <p>
            <span className="font-semibold">Unauthorized packet capture is illegal.</span> Intercepting
            network traffic without explicit permission from the network owner and all users on
            the network may violate:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>The <strong>Computer Fraud and Abuse Act (CFAA)</strong> — United States</li>
            <li>The <strong>Electronic Communications Privacy Act (ECPA)</strong></li>
            <li>The <strong>General Data Protection Regulation (GDPR)</strong> — European Union</li>
            <li>The <strong>Computer Misuse Act</strong> — United Kingdom</li>
            <li>Equivalent laws in your jurisdiction</li>
          </ul>
          <p>
            This tool is intended <span className="font-semibold">only</span> for:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Network administrators monitoring <strong>their own networks</strong></li>
            <li>Security researchers with <strong>written authorization</strong></li>
            <li>CTF competitions and <strong>lab/test environments</strong> you own</li>
            <li>Educational use on <strong>isolated networks</strong> you control</li>
          </ul>
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            You are solely responsible for ensuring you have legal authorization to capture
            traffic on the selected interface. Misuse may result in criminal prosecution.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-amber-500 flex-shrink-0"
          />
          <span className="text-sm text-amber-900 dark:text-amber-200">
            I confirm that I have <strong>legal authorization</strong> to capture traffic on
            the selected network interface, and I accept full responsibility for my actions.
          </span>
        </label>

        <button
          onClick={onAccept}
          disabled={!checked}
          className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:cursor-not-allowed"
        >
          I Understand — Proceed to Live Capture
        </button>
      </div>
    </div>
  )
}

// ---- Stat badge ----

function StatBadge({ label, value, color = 'gray' }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    green:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    red:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    blue:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  }
  return (
    <div className={`px-3 py-1.5 rounded-lg ${colors[color]}`}>
      <div className="text-[10px] uppercase tracking-widest font-semibold opacity-70">{label}</div>
      <div className="text-base font-bold leading-tight">{value}</div>
    </div>
  )
}

// ---- Main component ----

export default function LiveCaptureView() {
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [interfaces, setInterfaces] = useState<string[]>([])
  const [iface, setIface] = useState('any')
  const [bpfFilter, setBpfFilter] = useState('')
  const [snaplen, setSnaplen] = useState(65535)
  const [maxDisplay, setMaxDisplay] = useState(2000)
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [packets, setPackets] = useState<LivePacket[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pcapFile, setPcapFile] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string[]>([])
  const [displayFilter, setDisplayFilter] = useState('')
  const [selectedNo, setSelectedNo] = useState<number | null>(null)
  const [protoStats, setProtoStats] = useState<Record<string, number>>({})
  const [elapsed, setElapsed] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [permissionError, setPermissionError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Load interfaces
  useEffect(() => {
    fetch(`${GIT_SERVER}/security/pcap/interfaces`)
      .then(r => r.json())
      .then(d => { if (d.interfaces) setInterfaces(d.interfaces) })
      .catch(() => setInterfaces(['any', 'enp3s0', 'wlp0s20f3']))
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [packets, autoScroll])

  const addStatus = useCallback((msg: string) => {
    setStatusMsg(p => [...p.slice(-29), msg])
  }, [])

  const startCapture = useCallback(async () => {
    setPackets([])
    setProtoStats({})
    setElapsed(0)
    setSelectedNo(null)
    setStatusMsg([])
    setCaptureState('starting')
    startTimeRef.current = Date.now()

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${GIT_SERVER}/security/pcap/capture/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iface, filter: bpfFilter, snaplen }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Failed to start' }))
        throw new Error(e.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buf = ''
      let pktCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'started') {
              setSessionId(ev.sessionId)
              setPcapFile(ev.pcapFile)
              setCaptureState('capturing')
              addStatus(`Capture started on ${iface}`)
            } else if (ev.type === 'packet') {
              pktCount++
              const pkt: LivePacket = { ...ev, no: pktCount }
              setPackets(prev => {
                const next = [...prev, pkt]
                return next.length > maxDisplay ? next.slice(-maxDisplay) : next
              })
              setProtoStats(prev => ({ ...prev, [pkt.proto]: (prev[pkt.proto] ?? 0) + 1 }))
            } else if (ev.type === 'info') {
              addStatus(ev.message)
            } else if (ev.type === 'permission_error') {
              setPermissionError(true)
              addStatus(`⚠ ${ev.message}`)
            } else if (ev.type === 'error') {
              addStatus(`⚠ ${ev.message}`)
            } else if (ev.type === 'stopped') {
              addStatus(`Capture stopped — ${ev.packetCount ?? pktCount} packets`)
              setCaptureState('stopped')
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addStatus(`Error: ${(err as Error).message}`)
      }
      setCaptureState('stopped')
    }

    if (timerRef.current) clearInterval(timerRef.current)
  }, [iface, bpfFilter, snaplen, maxDisplay, addStatus])

  const stopCapture = useCallback(async () => {
    abortRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
    if (sessionId) {
      try {
        await fetch(`${GIT_SERVER}/security/pcap/capture/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
      } catch { /* ignore */ }
    }
    setCaptureState('stopped')
  }, [sessionId])

  const downloadPcap = useCallback(() => {
    if (!sessionId) return
    const a = document.createElement('a')
    a.href = `${GIT_SERVER}/security/pcap/capture/download?sessionId=${sessionId}`
    a.download = `capture-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.pcap`
    a.click()
  }, [sessionId])

  const clearCapture = () => {
    setPackets([])
    setProtoStats({})
    setSessionId(null)
    setPcapFile(null)
    setElapsed(0)
    setStatusMsg([])
    setCaptureState('idle')
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const isCapturing = captureState === 'capturing' || captureState === 'starting'

  const filteredPackets = displayFilter
    ? packets.filter(p => {
        const q = displayFilter.toLowerCase()
        return `${p.src} ${p.dst} ${p.sport} ${p.dport} ${p.proto} ${p.info}`.toLowerCase().includes(q)
      })
    : packets

  // ---- Render ----

  if (!legalAccepted) {
    return <LegalWarning accepted={false} onAccept={() => setLegalAccepted(true)} />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Legal reminder banner */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
        <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
        <p className="text-[10px] text-amber-700 dark:text-amber-400">
          <strong>Reminder:</strong> Only capture traffic on networks you own or have explicit written authorization to monitor.
          Unauthorized interception is a criminal offense.
        </p>
      </div>

      {/* Permission error banner */}
      {permissionError && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-300 dark:border-red-700">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
              Permission denied — tcpdump cannot capture on this interface
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">
              tcpdump needs <code className="font-mono bg-red-100 dark:bg-red-800 px-1 rounded">CAP_NET_RAW</code> to capture packets.
              Run the following command once in a terminal to grant it:
            </p>
            <code className="block text-xs font-mono bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-3 py-2 rounded select-all">
              sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/tcpdump
            </code>
            <p className="text-[10px] text-red-500 dark:text-red-400 mt-1">
              Then restart the git server and try again. This grants tcpdump packet capture capability without needing sudo each time.
            </p>
          </div>
          <button onClick={() => setPermissionError(false)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-1 gap-3 p-3 overflow-hidden">
        {/* Left panel: controls */}
        <div className="flex-shrink-0 w-64 flex flex-col gap-3 overflow-y-auto scrollbar-thin">
          {/* Interface */}
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Capture Settings</h3>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Interface</label>
              <select
                value={iface}
                onChange={e => setIface(e.target.value)}
                disabled={isCapturing}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
              >
                {interfaces.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                BPF Capture Filter
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <input
                value={bpfFilter}
                onChange={e => setBpfFilter(e.target.value)}
                disabled={isCapturing}
                placeholder="e.g. tcp port 80"
                className="w-full text-xs font-mono border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 disabled:opacity-50"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Applied by tcpdump before capture</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Snap Length</label>
              <select
                value={snaplen}
                onChange={e => setSnaplen(parseInt(e.target.value))}
                disabled={isCapturing}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
              >
                <option value={65535}>65535 (full)</option>
                <option value={1500}>1500 (MTU)</option>
                <option value={512}>512 bytes</option>
                <option value={128}>128 bytes</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Max displayed packets</label>
              <select
                value={maxDisplay}
                onChange={e => setMaxDisplay(parseInt(e.target.value))}
                disabled={isCapturing}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
              >
                <option value={500}>500</option>
                <option value={1000}>1,000</option>
                <option value={2000}>2,000</option>
                <option value={5000}>5,000</option>
              </select>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-2">
            {!isCapturing ? (
              <button
                onClick={startCapture}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
              >
                <Play size={14} />
                Start Capture
              </button>
            ) : (
              <button
                onClick={stopCapture}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                <Square size={14} />
                Stop Capture
              </button>
            )}

            {captureState === 'stopped' && sessionId && (
              <button
                onClick={downloadPcap}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
              >
                <Download size={14} />
                Save as .pcap
              </button>
            )}

            {(captureState === 'stopped' || packets.length > 0) && (
              <button
                onClick={clearCapture}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </div>

          {/* Stats */}
          {packets.length > 0 && (
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Statistics</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatBadge label="Packets" value={packets.length.toLocaleString()} color={isCapturing ? 'green' : 'gray'} />
                <StatBadge label="Elapsed" value={formatElapsed(elapsed)} color={isCapturing ? 'green' : 'gray'} />
              </div>
              {/* Protocol breakdown mini-bars */}
              <div className="space-y-1 mt-1">
                {Object.entries(protoStats)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([proto, cnt]) => {
                    const pct = (cnt / packets.length) * 100
                    return (
                      <div key={proto} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PROTO_BADGE[proto] ?? 'bg-gray-400'}`} />
                        <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 w-10">{proto}</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-8 text-right">{cnt}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Status log */}
          {statusMsg.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 overflow-hidden">
              <div className="px-3 py-1 border-b border-gray-700 bg-gray-800">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Log</span>
              </div>
              <div className="p-2 space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin">
                {statusMsg.map((m, i) => (
                  <p key={i} className="text-[10px] font-mono text-gray-300">{m}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: packet table */}
        <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-surface-800 min-w-0">
          {/* Display filter + auto-scroll */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
            <div className="flex-1 flex items-center gap-1 bg-white dark:bg-surface-700 border border-gray-300 dark:border-gray-600 rounded px-2">
              <span className="text-xs text-gray-400 font-mono">display:</span>
              <input
                value={displayFilter}
                onChange={e => setDisplayFilter(e.target.value)}
                placeholder="filter displayed packets…"
                className="flex-1 py-1 text-xs font-mono bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                className="accent-emerald-500"
              />
              Auto-scroll
            </label>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {filteredPackets.length.toLocaleString()}{displayFilter ? ` / ${packets.length.toLocaleString()}` : ''} pkts
            </span>
            {isCapturing && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* Column headers */}
          <div
            className="grid text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-surface-700 border-b border-gray-200 dark:border-gray-600 px-2 py-1 flex-shrink-0"
            style={{ gridTemplateColumns: '3.5rem 6rem 12rem 12rem 4.5rem 1fr' }}
          >
            <span>No.</span>
            <span>Time</span>
            <span>Source</span>
            <span>Destination</span>
            <span>Proto</span>
            <span>Info</span>
          </div>

          {/* Packet rows */}
          <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin">
            {packets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                {captureState === 'idle' || captureState === 'stopped' ? (
                  <>
                    <RefreshCw size={28} className="opacity-30" />
                    <p className="text-sm">{captureState === 'stopped' ? 'Capture stopped' : 'Press Start Capture to begin'}</p>
                  </>
                ) : (
                  <>
                    <span className="text-3xl animate-pulse">📡</span>
                    <p className="text-sm">Waiting for packets…</p>
                  </>
                )}
              </div>
            ) : (
              filteredPackets.map(pkt => {
                const rowColor = PROTO_ROW[pkt.proto] ?? ''
                const isSelected = pkt.no === selectedNo
                return (
                  <div key={pkt.no}>
                    <button
                      onClick={() => setSelectedNo(isSelected ? null : pkt.no)}
                      className={`w-full grid text-left text-[11px] font-mono px-2 py-0.5 border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                        isSelected ? 'bg-blue-200 dark:bg-blue-800/50' : rowColor
                      }`}
                      style={{ gridTemplateColumns: '3.5rem 6rem 12rem 12rem 4.5rem 1fr' }}
                    >
                      <span className="text-gray-400">{pkt.no}</span>
                      <span className="text-gray-500">{pkt.time.toFixed(6)}</span>
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {pkt.src}{pkt.sport ? `:${pkt.sport}` : ''}
                      </span>
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {pkt.dst}{pkt.dport ? `:${pkt.dport}` : ''}
                      </span>
                      <span className={`font-semibold ${
                        pkt.proto === 'TCP'  ? 'text-blue-600 dark:text-blue-400' :
                        pkt.proto === 'UDP'  ? 'text-green-600 dark:text-green-400' :
                        pkt.proto === 'DNS'  ? 'text-yellow-600 dark:text-yellow-400' :
                        pkt.proto === 'TLS'  ? 'text-purple-600 dark:text-purple-400' :
                        pkt.proto === 'HTTP' ? 'text-red-600 dark:text-red-400' :
                        pkt.proto === 'ARP'  ? 'text-orange-600 dark:text-orange-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>{pkt.proto}</span>
                      <span className="truncate text-gray-600 dark:text-gray-400">{pkt.info}</span>
                    </button>

                    {isSelected && (
                      <LivePacketDetail pkt={pkt} />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Bottom bar */}
          {packets.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {filteredPackets.length.toLocaleString()} displayed
                {displayFilter && ` (filtered from ${packets.length.toLocaleString()})`}
                {packets.length >= maxDisplay && (
                  <span className="ml-2 text-amber-500">⚠ Capped at {maxDisplay.toLocaleString()} — oldest dropped</span>
                )}
              </span>
              {pcapFile && captureState === 'stopped' && (
                <span className="text-indigo-500 truncate max-w-xs" title={pcapFile}>
                  Saved: {pcapFile.split('/').pop()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Inline packet detail for live packets (parsed from text, no scapy fields) ----

function LivePacketDetail({ pkt }: { pkt: LivePacket }) {
  const [open, setOpen] = useState(true)
  const rows: [string, string | number][] = [
    ['No.',        pkt.no],
    ['Time',       pkt.time.toFixed(6) + 's'],
    ['Source',     pkt.src + (pkt.sport ? `:${pkt.sport}` : '')],
    ['Destination',pkt.dst + (pkt.dport ? `:${pkt.dport}` : '')],
    ['Protocol',   pkt.proto],
    ['Info',       pkt.info],
  ]
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-900 px-4 py-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Packet Details
      </button>
      {open && (
        <div className="space-y-0.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11px] font-mono">
              <span className="text-gray-400 w-24 flex-shrink-0">{k}:</span>
              <span className="text-gray-700 dark:text-gray-300 break-all">{String(v)}</span>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 mt-1 italic">
            Full layer decode available after saving and re-opening in the Analyzer tab.
          </p>
        </div>
      )}
    </div>
  )
}
