import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search, ExternalLink, Loader2, AlertCircle, ChevronRight,
  X, Clock, Globe, ArrowLeft, ArrowRight, RefreshCw, Home,
  Maximize2, Minimize2, PanelRight, PanelRightClose,
} from 'lucide-react'

const SERVER = `http://${window.location.hostname}:3001`
const MIN_BROWSER_W = 320
const DEFAULT_SPLIT = 0.45 // fraction of total width for results panel

interface SearchResult { title: string; url: string; snippet: string }
interface SearchResponse { results: SearchResult[]; query: string; page: number; error?: string }
interface HistoryEntry { query: string; ts: number }

function getHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function toProxy(u: string) { return `${SERVER}/proxy?url=${encodeURIComponent(u)}` }

// ── Inline browser panel ───────────────────────────────────────────────────────

interface BrowserProps {
  url: string
  onClose: () => void
  fullWidth: boolean
  onToggleFullWidth: () => void
}

function InlineBrowser({ url, onClose, fullWidth, onToggleFullWidth }: BrowserProps) {
  const historyStack = useRef<string[]>([url])
  const historyIdx = useRef(0)
  const [realUrl, setRealUrl] = useState(url)
  const [inputUrl, setInputUrl] = useState(url)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const pushNav = (dest: string) => {
    let target = dest.trim()
    // Preserve http:// as-is; only add https:// when no scheme is given
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target
    }
    historyStack.current = historyStack.current.slice(0, historyIdx.current + 1)
    historyStack.current.push(target)
    historyIdx.current = historyStack.current.length - 1
    setRealUrl(target); setInputUrl(target); setLoading(true); setReloadKey(k => k + 1)
  }

  // When the parent changes the initial url (clicking a different result)
  useEffect(() => {
    if (url !== historyStack.current[historyIdx.current]) {
      pushNav(url)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const goBack = () => {
    if (historyIdx.current > 0) {
      historyIdx.current--
      const u = historyStack.current[historyIdx.current]
      setRealUrl(u); setInputUrl(u); setLoading(true); setReloadKey(k => k + 1)
    }
  }
  const goForward = () => {
    if (historyIdx.current < historyStack.current.length - 1) {
      historyIdx.current++
      const u = historyStack.current[historyIdx.current]
      setRealUrl(u); setInputUrl(u); setLoading(true); setReloadKey(k => k + 1)
    }
  }
  const reload = () => { setLoading(true); setReloadKey(k => k + 1) }

  const canBack = historyIdx.current > 0
  const canForward = historyIdx.current < historyStack.current.length - 1

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-900 overflow-hidden">
      {/* Chrome */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 shrink-0">
        <button onClick={goBack} disabled={!canBack} title="Back"
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-500 dark:text-gray-400">
          <ArrowLeft size={14} />
        </button>
        <button onClick={goForward} disabled={!canForward} title="Forward"
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-500 dark:text-gray-400">
          <ArrowRight size={14} />
        </button>
        <button onClick={reload} title="Reload"
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={onClose} title="Back to results"
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
          <Home size={13} />
        </button>

        {/* URL bar */}
        <form className="flex-1 min-w-0" onSubmit={e => { e.preventDefault(); pushNav(inputUrl) }}>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-surface-700 border border-gray-300 dark:border-gray-600 text-xs min-w-0">
            <Globe size={10} className="text-gray-400 shrink-0" />
            <input
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onFocus={e => e.target.select()}
              className="flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-300 font-mono text-xs min-w-0"
              spellCheck={false}
            />
          </div>
        </form>

        {/* Expand / collapse panel */}
        <button onClick={onToggleFullWidth}
          title={fullWidth ? 'Show results panel' : 'Expand browser'}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
          {fullWidth ? <PanelRight size={14} /> : <Maximize2 size={13} />}
        </button>

        {/* Open in real browser */}
        <a href={realUrl} target="_blank" rel="noopener noreferrer" title="Open in new browser tab"
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
          <ExternalLink size={13} />
        </a>

        {/* Close browser panel */}
        <button onClick={onClose} title="Close"
          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500">
          <X size={14} />
        </button>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="h-0.5 bg-gray-100 dark:bg-gray-800 shrink-0 overflow-hidden">
          <div className="h-full bg-accent-500 animate-pulse" style={{ width: '70%' }} />
        </div>
      )}

      <iframe
        key={`${reloadKey}`}
        src={toProxy(realUrl)}
        className="flex-1 w-full border-0"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
        title="Inline browser"
      />
    </div>
  )
}

// ── Results panel ──────────────────────────────────────────────────────────────

interface ResultsPanelProps {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  loading: boolean
  error: string | null
  page: number
  lastQuery: string
  history: HistoryEntry[]
  showHistory: boolean
  setShowHistory: (v: boolean) => void
  onSearch: (q: string, pg?: number) => void
  onOpen: (url: string) => void
  onRemoveHistory: (q: string, e: React.MouseEvent) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  browserOpen: boolean
}

function ResultsPanel({
  query, setQuery, results, loading, error, page, lastQuery,
  history, showHistory, setShowHistory, onSearch, onOpen, onRemoveHistory,
  inputRef, browserOpen,
}: ResultsPanelProps) {
  const hasResults = results.length > 0

  const isUrl = (s: string) => /^https?:\/\//i.test(s) || /^[\w.-]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(s)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (isUrl(q)) { onOpen(q.startsWith('http') ? q : 'http://' + q) }
    else onSearch(q)
  }
  const clearSearch = () => { setQuery(''); inputRef.current?.focus() }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-900 overflow-hidden">
      {/* Search bar */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        {!hasResults && !loading && !browserOpen && (
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Globe size={24} className="text-accent-500" />
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Web Search</h1>
            </div>
            <p className="text-xs text-gray-400">Clean results — no ads, no tracking</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="relative">
          <div className="flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-800 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-accent-400 transition-all">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); if (!e.target.value) setShowHistory(false) }}
              onFocus={() => setShowHistory(history.length > 0 && !hasResults)}
              onBlur={() => setTimeout(() => setShowHistory(false), 150)}
              placeholder="Search the web…"
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 min-w-0"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button type="button" onClick={clearSearch} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X size={13} />
              </button>
            )}
            <button type="submit" disabled={!query.trim() || loading}
              className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
            </button>
          </div>

          {/* History dropdown */}
          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">Recent</div>
              {history.slice(0, 6).map(h => (
                <button key={h.query} onMouseDown={() => { setQuery(h.query); onSearch(h.query) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-300 group">
                  <Clock size={11} className="text-gray-400 shrink-0" />
                  <span className="flex-1 truncate text-xs">{h.query}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(h.ts)}</span>
                  <button onMouseDown={e => onRemoveHistory(h.query, e)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"><X size={10} /></button>
                </button>
              ))}
            </div>
          )}
        </form>

        {hasResults && !loading && (
          <div className="mt-1.5 text-xs text-gray-400 px-1">
            "<span className="text-gray-600 dark:text-gray-300">{lastQuery}</span>"
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-xs text-red-700 dark:text-red-300 mb-3">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Search failed</p>
                <p className="mt-0.5 opacity-80">{error}</p>
              </div>
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="space-y-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                  <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded mb-1" />
                  <div className="h-2.5 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              ))}
            </div>
          )}

          {results.map((r, i) => (
            <div key={i} className="mb-5 group">
              <div className="flex items-center gap-1.5 mb-0.5">
                <img src={`https://www.google.com/s2/favicons?domain=${getHostname(r.url)}&sz=16`}
                  className="w-3.5 h-3.5 rounded-sm" alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{getHostname(r.url)}</span>
              </div>

              <h3 onClick={() => onOpen(r.url)}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 leading-snug line-clamp-2 cursor-pointer hover:underline">
                {r.title}
              </h3>

              {r.snippet && (
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5 line-clamp-2">{r.snippet}</p>
              )}

              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[140px]">{getHostname(r.url)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onOpen(r.url)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-700 border border-gray-200 dark:border-gray-700">
                    <Globe size={9} /> Open
                  </button>
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-700 border border-gray-200 dark:border-gray-700">
                    <ExternalLink size={9} /> New tab
                  </a>
                </div>
              </div>
            </div>
          ))}

          {hasResults && !loading && (
            <div className="flex justify-center pt-1 pb-6">
              <button onClick={() => onSearch(lastQuery, page + 1)} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-40">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                More results
              </button>
            </div>
          )}

          {loading && results.length > 0 && (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
          )}

          {!loading && !error && !hasResults && history.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {history.slice(0, 8).map(h => (
                  <button key={h.query} onClick={() => { setQuery(h.query); onSearch(h.query) }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors">
                    <Clock size={10} /> {h.query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Root WebView ───────────────────────────────────────────────────────────────

export default function WebView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [lastQuery, setLastQuery] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('web_search_history') || '[]') } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)
  const [openUrl, setOpenUrl] = useState<string | null>(null)
  const [fullWidth, setFullWidth] = useState(false)

  // Resizable split
  const containerRef = useRef<HTMLDivElement>(null)
  const [splitFraction, setSplitFraction] = useState(DEFAULT_SPLIT)
  const dragging = useRef(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // ── Drag resize ────────────────────────────────────────────────────────────

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const total = rect.width
      const minFrac = MIN_BROWSER_W / total
      const newFrac = Math.min(1 - minFrac, Math.max(0.2, (ev.clientX - rect.left) / total))
      setSplitFraction(newFrac)
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Search ────────────────────────────────────────────────────────────────

  const search = useCallback(async (q: string, pg = 1) => {
    if (!q.trim()) return
    setLoading(true); setError(null); setLastQuery(q); setPage(pg); setShowHistory(false)
    if (pg === 1) setResults([])
    try {
      const res = await fetch(`${SERVER}/search?q=${encodeURIComponent(q)}&page=${pg}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data: SearchResponse = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(pg === 1 ? data.results : prev => [...prev, ...data.results])
      if (pg === 1) {
        setHistory(prev => {
          const next = [{ query: q, ts: Date.now() }, ...prev.filter(h => h.query !== q)].slice(0, 20)
          localStorage.setItem('web_search_history', JSON.stringify(next))
          return next
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const removeHistory = (q: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setHistory(prev => {
      const next = prev.filter(h => h.query !== q)
      localStorage.setItem('web_search_history', JSON.stringify(next))
      return next
    })
  }

  const handleOpen = (url: string) => {
    setOpenUrl(url)
    setFullWidth(false)
  }

  const browserOpen = !!openUrl

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden bg-white dark:bg-surface-900">

      {/* ── Results panel (hidden when fullWidth browser) ── */}
      {!(browserOpen && fullWidth) && (
        <div
          className="flex flex-col shrink-0 overflow-hidden border-r border-gray-200 dark:border-gray-700"
          style={{ width: browserOpen ? `${splitFraction * 100}%` : '100%' }}
        >
          <ResultsPanel
            query={query} setQuery={setQuery}
            results={results} loading={loading} error={error}
            page={page} lastQuery={lastQuery}
            history={history} showHistory={showHistory} setShowHistory={setShowHistory}
            onSearch={search} onOpen={handleOpen} onRemoveHistory={removeHistory}
            inputRef={inputRef} browserOpen={browserOpen}
          />
        </div>
      )}

      {/* ── Drag divider ── */}
      {browserOpen && !fullWidth && (
        <div
          onMouseDown={onDividerMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-accent-400 transition-colors"
          title="Drag to resize"
        />
      )}

      {/* ── Browser panel ── */}
      {browserOpen && (
        <div className="flex-1 overflow-hidden min-w-0">
          <InlineBrowser
            url={openUrl!}
            onClose={() => { setOpenUrl(null); setFullWidth(false) }}
            fullWidth={fullWidth}
            onToggleFullWidth={() => setFullWidth(f => !f)}
          />
        </div>
      )}
    </div>
  )
}
