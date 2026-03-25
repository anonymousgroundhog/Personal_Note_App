import React, { useState, useCallback } from 'react'
import {
  Search, Globe, User, ShieldCheck, Loader2, AlertCircle,
  ChevronDown, ChevronRight, Copy, CheckCircle2, FileText, X, BookOpen,
} from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'

const SERVER = 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────────

type OsintTab = 'domain' | 'crtsh' | 'username'

interface GeoIP {
  ip: string
  city: string
  region: string
  country: string
  org: string
  asn: string
}

interface DomainResult {
  target: string
  whois: string
  dns_A: string
  dns_AAAA: string
  dns_MX: string
  dns_NS: string
  dns_TXT: string
  dns_CNAME: string
  dns_SOA: string
  rdns: string
  geoip: GeoIP[]
}

interface CrtshResult {
  domain: string
  subdomains: string[]
  count: number
}

interface UsernameCheck {
  name: string
  url: string
  status: number
  found: boolean
  unknown: boolean
}

interface UsernameResult {
  username: string
  results: UsernameCheck[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { copyText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-surface-800 text-left hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
      </button>
      {open && <div className="p-4 bg-white dark:bg-surface-900">{children}</div>}
    </div>
  )
}

// ── Markdown generators ────────────────────────────────────────────────────────

function domainResultToMarkdown(r: DomainResult): string {
  const ts = new Date().toISOString()
  const dns = [
    r.dns_A      && `- **A:**     ${r.dns_A.replace(/\n/g, ', ')}`,
    r.dns_AAAA   && `- **AAAA:**  ${r.dns_AAAA.replace(/\n/g, ', ')}`,
    r.dns_MX     && `- **MX:**    \n${r.dns_MX.split('\n').map(l => `  - ${l}`).join('\n')}`,
    r.dns_NS     && `- **NS:**    \n${r.dns_NS.split('\n').map(l => `  - ${l}`).join('\n')}`,
    r.dns_TXT    && `- **TXT:**   \n${r.dns_TXT.split('\n').map(l => `  - ${l}`).join('\n')}`,
    r.dns_CNAME  && `- **CNAME:** ${r.dns_CNAME.replace(/\n/g, ', ')}`,
    r.dns_SOA    && `- **SOA:**   ${r.dns_SOA.replace(/\n/g, ' ')}`,
    r.rdns       && `- **rDNS:**  ${r.rdns}`,
  ].filter(Boolean).join('\n')

  const geo = r.geoip.length
    ? r.geoip.map(g => `| ${g.ip} | ${g.city || '—'} | ${g.region || '—'} | ${g.country || '—'} | ${g.org || '—'} | ${g.asn || '—'} |`).join('\n')
    : '_No geolocation data_'

  return `---
tags:
  - osint
  - domain-recon
target: "${r.target}"
date: "${ts}"
---

# OSINT: Domain Recon — ${r.target}

> Collected: ${ts}

## DNS Records

${dns || '_No DNS records found_'}

## IP Geolocation

| IP | City | Region | Country | Org | ASN |
|----|------|--------|---------|-----|-----|
${geo}

## WHOIS

\`\`\`
${r.whois}
\`\`\`
`
}

function crtshResultToMarkdown(r: CrtshResult): string {
  const ts = new Date().toISOString()
  return `---
tags:
  - osint
  - subdomain-enum
target: "${r.domain}"
date: "${ts}"
---

# OSINT: Subdomain Enumeration — ${r.domain}

> Source: Certificate Transparency (crt.sh)
> Collected: ${ts}
> Total: **${r.count}** unique subdomains

## Subdomains

${r.subdomains.map(s => `- \`${s}\``).join('\n') || '_None found_'}
`
}

function usernameResultToMarkdown(r: UsernameResult): string {
  const ts = new Date().toISOString()
  const found = r.results.filter(p => p.found)
  const notFound = r.results.filter(p => !p.found && !p.unknown)
  const unknown = r.results.filter(p => p.unknown)

  return `---
tags:
  - osint
  - username-search
target: "${r.username}"
date: "${ts}"
---

# OSINT: Username Search — ${r.username}

> Collected: ${ts}

## Found (${found.length})

${found.length ? found.map(p => `- [${p.name}](${p.url})`).join('\n') : '_None_'}

## Not Found (${notFound.length})

${notFound.length ? notFound.map(p => `- ${p.name}`).join('\n') : '_None_'}

## Unknown / Error (${unknown.length})

${unknown.length ? unknown.map(p => `- ${p.name} (HTTP ${p.status || 'timeout'})`).join('\n') : '_None_'}
`
}

// ── Import-to-Note modal ───────────────────────────────────────────────────────

interface ImportModalProps {
  content: string
  defaultName: string
  onClose: () => void
}

function ImportModal({ content, defaultName, onClose }: ImportModalProps) {
  const { index, createNote, saveNote, readNote, refreshIndex, rootHandle, fallbackMode } = useVaultStore()
  const vaultOpen = rootHandle !== null || fallbackMode

  const [mode, setMode] = useState<'new' | 'append'>('new')
  const [newName, setNewName] = useState(defaultName)
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

  const handleSave = async () => {
    if (!vaultOpen) { setError('Open a vault first'); return }
    setSaving(true)
    setError('')
    try {
      if (mode === 'new') {
        const filename = newName.trim().replace(/\.md$/i, '')
        if (!filename) { setError('Enter a file name'); setSaving(false); return }
        await createNote(`OSINT/${filename}.md`, content)
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-emerald-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">Import to Note</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!vaultOpen && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <AlertCircle size={14} /> Open a vault first to save notes.
            </div>
          )}

          {/* Mode tabs */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'new' ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
            >
              New Note
            </button>
            <button
              onClick={() => setMode('append')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'append' ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'}`}
            >
              Append to Existing
            </button>
          </div>

          {mode === 'new' ? (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                File name <span className="font-normal text-gray-400">(saved under OSINT/)</span>
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="domain-recon-example.com"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Search and select a note</label>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter notes…"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
              />
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {notes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No notes found</p>
                )}
                {notes.map(({ path, name }) => (
                  <button
                    key={path}
                    onClick={() => setSelectedPath(path)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                      selectedPath === path
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'
                    }`}
                  >
                    <FileText size={12} className="shrink-0 text-gray-400" />
                    <span className="truncate">{name}</span>
                    <span className="text-xs text-gray-400 truncate ml-auto shrink-0 max-w-[120px]">{path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle size={13} /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !vaultOpen || saved}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            {saved
              ? <><CheckCircle2 size={14} /> Saved!</>
              : saving
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><BookOpen size={14} /> Save to Note</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Domain tab ─────────────────────────────────────────────────────────────────

function DomainTab() {
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DomainResult | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const lookup = useCallback(async () => {
    const t = target.trim()
    if (!t) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${SERVER}/osint/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: t }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }, [target])

  const dnsRows = result ? [
    { type: 'A',     value: result.dns_A },
    { type: 'AAAA',  value: result.dns_AAAA },
    { type: 'MX',    value: result.dns_MX },
    { type: 'NS',    value: result.dns_NS },
    { type: 'TXT',   value: result.dns_TXT },
    { type: 'CNAME', value: result.dns_CNAME },
    { type: 'SOA',   value: result.dns_SOA },
    { type: 'rDNS',  value: result.rdns },
  ].filter(r => r.value) : []

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <input
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && lookup()}
          placeholder="example.com or 8.8.8.8"
          className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={lookup}
          disabled={loading || !target.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Looking up…' : 'Lookup'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {result && (
        <>
          {/* Import button */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Results for <code className="bg-gray-100 dark:bg-surface-700 px-1.5 py-0.5 rounded text-xs">{result.target}</code>
            </span>
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
            >
              <BookOpen size={12} /> Import to Note
            </button>
          </div>

          <div className="space-y-3">
            {/* DNS */}
            {dnsRows.length > 0 && (
              <Section title="DNS Records">
                <div className="space-y-2">
                  {dnsRows.map(({ type, value }) => (
                    <div key={type} className="flex gap-3 text-sm">
                      <span className="w-14 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 pt-0.5">{type}</span>
                      <div className="flex-1 min-w-0">
                        {value.split('\n').map((line, i) => (
                          <div key={i} className="flex items-start gap-1 group">
                            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono break-all">{line}</code>
                            <span className="opacity-0 group-hover:opacity-100 shrink-0">
                              <CopyButton text={line} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* GeoIP */}
            {result.geoip.length > 0 && (
              <Section title="IP Geolocation">
                <div className="space-y-2">
                  {result.geoip.map(g => (
                    <div key={g.ip} className="p-3 bg-gray-50 dark:bg-surface-800 rounded-lg text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">IP</span>
                      <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{g.ip}</span>
                      {g.city && <><span className="text-gray-500 dark:text-gray-400 text-xs">City</span><span className="text-xs text-gray-800 dark:text-gray-200">{g.city}, {g.region}</span></>}
                      {g.country && <><span className="text-gray-500 dark:text-gray-400 text-xs">Country</span><span className="text-xs text-gray-800 dark:text-gray-200">{g.country}</span></>}
                      {g.org && <><span className="text-gray-500 dark:text-gray-400 text-xs">Org</span><span className="text-xs text-gray-800 dark:text-gray-200 truncate">{g.org}</span></>}
                      {g.asn && <><span className="text-gray-500 dark:text-gray-400 text-xs">ASN</span><span className="text-xs text-gray-800 dark:text-gray-200">{g.asn}</span></>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* WHOIS */}
            {result.whois && (
              <Section title="WHOIS" defaultOpen={false}>
                <div className="flex justify-end mb-2">
                  <CopyButton text={result.whois} />
                </div>
                <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-80 overflow-y-auto bg-gray-50 dark:bg-surface-800 p-3 rounded-lg">
                  {result.whois}
                </pre>
              </Section>
            )}
          </div>

          {importing && (
            <ImportModal
              content={domainResultToMarkdown(result)}
              defaultName={`domain-recon-${result.target}`}
              onClose={() => setImporting(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Certificate Transparency tab ───────────────────────────────────────────────

function CrtshTab() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CrtshResult | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState('')

  const lookup = useCallback(async () => {
    const d = domain.trim()
    if (!d) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${SERVER}/osint/crtsh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }, [domain])

  const filtered = result
    ? result.subdomains.filter(s => !filter || s.includes(filter.toLowerCase()))
    : []

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        Queries <strong>crt.sh</strong> (Certificate Transparency logs) to enumerate subdomains that have had TLS certificates issued. No API key required.
      </div>

      <div className="flex gap-2">
        <input
          value={domain}
          onChange={e => setDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && lookup()}
          placeholder="example.com"
          className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={lookup}
          disabled={loading || !domain.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{result.count}</span> subdomains found for <code className="bg-gray-100 dark:bg-surface-700 px-1.5 py-0.5 rounded text-xs">{result.domain}</code>
            </span>
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
            >
              <BookOpen size={12} /> Import to Note
            </button>
          </div>

          {result.count > 0 && (
            <div className="space-y-2">
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter subdomains…"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} shown</span>
                  <CopyButton text={filtered.join('\n')} />
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                  {filtered.map(s => (
                    <div key={s} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-surface-800 group">
                      <code className="text-xs font-mono text-gray-800 dark:text-gray-200">{s}</code>
                      <span className="opacity-0 group-hover:opacity-100">
                        <CopyButton text={s} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {importing && (
            <ImportModal
              content={crtshResultToMarkdown(result)}
              defaultName={`subdomains-${result.domain}`}
              onClose={() => setImporting(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Username tab ───────────────────────────────────────────────────────────────

function UsernameTab() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UsernameResult | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const search = useCallback(async () => {
    const u = username.trim()
    if (!u) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${SERVER}/osint/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [username])

  const found    = result?.results.filter(p => p.found) ?? []
  const notFound = result?.results.filter(p => !p.found && !p.unknown) ?? []
  const unknown  = result?.results.filter(p => p.unknown) ?? []

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        Checks public profile URLs across {18} platforms using HTTP requests. Only publicly accessible profile pages are checked — no credentials or API keys required.
      </div>

      <div className="flex gap-2">
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && search()}
          placeholder="johndoe"
          className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={search}
          disabled={loading || !username.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Results for <code className="bg-gray-100 dark:bg-surface-700 px-1.5 py-0.5 rounded text-xs">{result.username}</code>
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">{found.length} found</span>
              <span className="ml-2 text-gray-400">/ {result.results.length} checked</span>
            </span>
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
            >
              <BookOpen size={12} /> Import to Note
            </button>
          </div>

          {/* Found */}
          {found.length > 0 && (
            <Section title={`Found (${found.length})`}>
              <div className="space-y-1.5">
                {found.map(p => (
                  <div key={p.name} className="flex items-center gap-3 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-28 shrink-0">{p.name}</span>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline truncate flex-1"
                    >
                      {p.url}
                    </a>
                    <CopyButton text={p.url} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Not found */}
          {notFound.length > 0 && (
            <Section title={`Not Found (${notFound.length})`} defaultOpen={false}>
              <div className="flex flex-wrap gap-2">
                {notFound.map(p => (
                  <span key={p.name} className="px-2.5 py-1 bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400 rounded-full text-xs">
                    {p.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Unknown */}
          {unknown.length > 0 && (
            <Section title={`Unknown / Timeout (${unknown.length})`} defaultOpen={false}>
              <div className="flex flex-wrap gap-2">
                {unknown.map(p => (
                  <span key={p.name} className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-xs" title={`HTTP ${p.status || 'timeout'}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {importing && (
            <ImportModal
              content={usernameResultToMarkdown(result)}
              defaultName={`username-search-${result.username}`}
              onClose={() => setImporting(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

const TABS: { id: OsintTab; label: string; icon: React.ReactNode }[] = [
  { id: 'domain',   label: 'Domain / IP',    icon: <Globe size={14} /> },
  { id: 'crtsh',    label: 'Subdomains',     icon: <ShieldCheck size={14} /> },
  { id: 'username', label: 'Username Search', icon: <User size={14} /> },
]

export default function OsintView() {
  const [activeTab, setActiveTab] = useState<OsintTab>('domain')

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-surface-800">
        <Search size={16} className="text-emerald-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">OSINT Tools</h2>
        <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">Passive Recon</span>

        {/* Tabs */}
        <div className="ml-4 flex items-center gap-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto">
        {activeTab === 'domain'   && <DomainTab />}
        {activeTab === 'crtsh'    && <CrtshTab />}
        {activeTab === 'username' && <UsernameTab />}
      </div>
    </div>
  )
}
