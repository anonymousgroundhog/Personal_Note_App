import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, GripVertical, Music, Search, Loader2, ExternalLink, Minus, ChevronDown, Radio, Star, Plus, Trash2, Users, Volume2, VolumeX } from 'lucide-react'
import { useMusicStore } from './musicStore'

// ── YouTube IFrame API types ──────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}
interface YTPlayerOptions {
  height?: string; width?: string; videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: number; target: YTPlayer }) => void
  }
}
interface YTPlayer {
  playVideo(): void; pauseVideo(): void; stopVideo(): void
  nextVideo(): void; previousVideo(): void
  loadPlaylist(opts: { listType: string; list: string; index?: number }): void
  loadVideoById(id: string): void
  getPlayerState(): number
  getVideoData(): { title: string; author: string; video_id: string }
  setVolume(volume: number): void
  getVolume(): number
  destroy(): void
}

interface VideoResult {
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
}

interface ChannelResult {
  channelId: string
  name: string
  handle: string
  avatar: string
  subscriberCount: string
}

interface Channel {
  id: string
  name: string
  query: string   // search query used to browse the channel
  custom?: boolean
}

// ── Suggested channels ────────────────────────────────────────────────────────
const SUGGESTED_CHANNELS: Channel[] = [
  { id: 'lofi-girl',       name: 'Lofi Girl',         query: 'lofi girl live stream' },
  { id: 'chillhop',        name: 'Chillhop Music',     query: 'chillhop music playlist' },
  { id: 'majestic',        name: 'Majestic Casual',    query: 'majestic casual playlist' },
  { id: 'yt-music-mix',    name: 'YT Music Mix',       query: 'youtube music mix playlist' },
  { id: 'jazz-vibes',      name: 'Jazz Vibes',         query: 'jazz vibes playlist relaxing' },
  { id: 'classical',       name: 'Classical Focus',    query: 'classical music focus studying' },
  { id: 'deep-focus',      name: 'Deep Focus',         query: 'deep focus music work concentration' },
  { id: 'synthwave',       name: 'Synthwave / Retro',  query: 'synthwave retro 80s playlist' },
  { id: 'nature-sounds',   name: 'Nature Sounds',      query: 'nature sounds relaxing ambient' },
  { id: 'piano',           name: 'Piano Music',        query: 'relaxing piano music playlist' },
]

const CUSTOM_CHANNELS_KEY = 'music_custom_channels'
function loadCustomChannels(): Channel[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CHANNELS_KEY) || '[]') } catch { return [] }
}
function saveCustomChannels(channels: Channel[]) {
  localStorage.setItem(CUSTOM_CHANNELS_KEY, JSON.stringify(channels))
}

// ── YT API loader ─────────────────────────────────────────────────────────────
function loadYTApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  return new Promise(resolve => {
    if (document.querySelector('script[src*="iframe_api"]')) {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
      return
    }
    window.onYouTubeIframeAPIReady = resolve
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
}

// ── YouTube search via proxy ──────────────────────────────────────────────────
const SERVER = `http://${window.location.hostname}:3001`
async function searchYouTube(query: string): Promise<VideoResult[]> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  const res = await fetch(`${SERVER}/proxy?url=${encodeURIComponent(searchUrl)}`)
  const html = await res.text()
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script/)
  if (!match) return []
  try {
    const data = JSON.parse(match[1])
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? []
    const results: VideoResult[] = []
    for (const item of contents) {
      const vr = item?.videoRenderer
      if (!vr?.videoId) continue
      results.push({
        videoId: vr.videoId,
        title: vr.title?.runs?.[0]?.text ?? 'Unknown',
        channelTitle: vr.ownerText?.runs?.[0]?.text ?? '',
        thumbnail: vr.thumbnail?.thumbnails?.[0]?.url ?? '',
      })
      if (results.length >= 8) break
    }
    return results
  } catch { return [] }
}

// Search for channels using YouTube's channel filter (sp=EgIQAg%3D%3D)
async function searchChannels(query: string): Promise<ChannelResult[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`
  const res = await fetch(`${SERVER}/proxy?url=${encodeURIComponent(url)}`)
  const html = await res.text()
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script/)
  if (!match) return []
  try {
    const data = JSON.parse(match[1])
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? []
    const results: ChannelResult[] = []
    for (const item of contents) {
      const cr = item?.channelRenderer
      if (!cr?.channelId) continue
      results.push({
        channelId: cr.channelId,
        name: cr.title?.simpleText ?? cr.title?.runs?.[0]?.text ?? 'Unknown',
        handle: cr.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ?? '',
        avatar: cr.thumbnail?.thumbnails?.slice(-1)[0]?.url ?? '',
        subscriberCount: cr.videoCountText?.simpleText ?? cr.subscriberCountText?.simpleText ?? '',
      })
      if (results.length >= 8) break
    }
    return results
  } catch { return [] }
}

// Fetch a channel's uploads page and return its videos
async function browseChannelById(channelId: string): Promise<VideoResult[]> {
  const url = `https://www.youtube.com/channel/${channelId}/videos`
  const res = await fetch(`${SERVER}/proxy?url=${encodeURIComponent(url)}`)
  const html = await res.text()
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script/)
  if (!match) return []
  try {
    const data = JSON.parse(match[1])
    // Channel videos tab grid
    const tabs: unknown[] =
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? []
    let items: unknown[] = []
    for (const tab of tabs) {
      const t = tab as Record<string, unknown>
      const tabRenderer = t?.tabRenderer as Record<string, unknown> | undefined
      if (!tabRenderer) continue
      const content = tabRenderer?.content as Record<string, unknown> | undefined
      const sectionList = content?.sectionListRenderer as Record<string, unknown> | undefined
      const sectionContents = sectionList?.contents as unknown[] | undefined
      if (!sectionContents) continue
      for (const section of sectionContents) {
        const s = section as Record<string, unknown>
        const itemSection = s?.itemSectionRenderer as Record<string, unknown> | undefined
        const iContents = itemSection?.contents as unknown[] | undefined
        if (!iContents) continue
        for (const ic of iContents) {
          const icObj = ic as Record<string, unknown>
          const grid = icObj?.gridRenderer as Record<string, unknown> | undefined
          const richGrid = icObj?.richGridRenderer as Record<string, unknown> | undefined
          const gridItems = (grid?.items ?? richGrid?.contents) as unknown[] | undefined
          if (gridItems) { items = gridItems; break }
        }
        if (items.length) break
      }
      if (items.length) break
    }
    const results: VideoResult[] = []
    for (const item of items) {
      const i = item as Record<string, unknown>
      const gv = (i?.gridVideoRenderer ?? i?.richItemRenderer) as Record<string, unknown> | undefined
      // richItemRenderer wraps content
      const vr = (gv?.content as Record<string, unknown> | undefined)?.richGridMediaRenderer
        ? undefined
        : (gv?.content as Record<string, unknown> | undefined) ?? gv
      const videoId = (vr as Record<string, unknown> | undefined)?.videoId as string | undefined
      if (!videoId) continue
      const v = vr as Record<string, unknown>
      const titleRuns = (v?.title as Record<string, unknown> | undefined)?.runs as { text: string }[] | undefined
      const thumbs = ((v?.thumbnail as Record<string, unknown> | undefined)?.thumbnails) as { url: string }[] | undefined
      results.push({
        videoId,
        title: titleRuns?.[0]?.text ?? 'Unknown',
        channelTitle: '',
        thumbnail: thumbs?.[0]?.url ?? '',
      })
      if (results.length >= 12) break
    }
    return results
  } catch { return [] }
}

// ── VideoRow ──────────────────────────────────────────────────────────────────
function VideoRow({ r, onPlay }: { r: VideoResult; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-800 text-left group transition-colors"
    >
      {r.thumbnail
        ? <img src={r.thumbnail} alt="" className="w-12 h-9 object-cover rounded flex-shrink-0 bg-gray-200" />
        : <div className="w-12 h-9 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center"><Music size={14} className="text-gray-400" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-800 dark:text-gray-200 font-medium line-clamp-2 leading-snug group-hover:text-red-500 transition-colors">{r.title}</p>
        {r.channelTitle && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{r.channelTitle}</p>}
      </div>
      <a href={`https://youtube.com/watch?v=${r.videoId}`} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 flex-shrink-0"
        title="Open on YouTube"
      >
        <ExternalLink size={11} />
      </a>
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
type Tab = 'search' | 'channels'

interface Props { onClose: () => void }

export default function MusicPlayer({ onClose }: Props) {
  const { setPlaying, setTrack, reset, command, clearCommand } = useMusicStore()

  const [tab, setTab] = useState<Tab>('search')
  const [minimized, setMinimized] = useState(false)

  // Search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VideoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Channels — saved list + browsing
  const [customChannels, setCustomChannels] = useState<Channel[]>(loadCustomChannels)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelQuery, setNewChannelQuery] = useState('')
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelVideos, setChannelVideos] = useState<VideoResult[]>([])
  const [channelSearching, setChannelSearching] = useState(false)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)

  // Channel search (find channels by name)
  const [channelSearchQuery, setChannelSearchQuery] = useState('')
  const [channelSearchResults, setChannelSearchResults] = useState<ChannelResult[]>([])
  const [channelSearching2, setChannelSearching2] = useState(false)
  const [channelSearchError, setChannelSearchError] = useState('')
  // When browsing a found channel (has a real channelId)
  const [browsingChannel, setBrowsingChannel] = useState<ChannelResult | null>(null)
  const [browsingVideos, setBrowsingVideos] = useState<VideoResult[]>([])
  const [browsingLoading, setBrowsingLoading] = useState(false)

  // Queue
  const [queue, setQueue] = useState<VideoResult[]>([])
  const [queueIndex, setQueueIndex] = useState(-1)

  // Volume
  const [volume, setVolume] = useState(100)

  // Player
  const [apiReady, setApiReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const playerElRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef = useRef<VideoResult[]>([])
  const queueIndexRef = useRef(-1)

  // Drag
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: window.innerWidth - 360, y: 60 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Keep refs in sync with state for use in command handler
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { queueIndexRef.current = queueIndex }, [queueIndex])

  // ── YT API init ─────────────────────────────────────────────────────────────
  useEffect(() => { loadYTApi().then(() => setApiReady(true)) }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      if (!playerRef.current) return
      try {
        const state = playerRef.current.getPlayerState()
        setPlaying(state === window.YT.PlayerState.PLAYING)
        const data = playerRef.current.getVideoData()
        if (data?.title) setTrack(data.title, data.author ?? '')
      } catch { /* not ready */ }
    }, 1500)
  }, [setPlaying, setTrack])

  useEffect(() => {
    if (!apiReady || !playerElRef.current) return
    const player = new window.YT.Player(playerElRef.current, {
      height: '0', width: '0',
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onReady: () => { playerRef.current = player; setPlayerReady(true); startPolling() },
        onStateChange: (e) => {
          setPlaying(e.data === window.YT.PlayerState.PLAYING)
          try {
            const d = player.getVideoData()
            if (d?.title) setTrack(d.title, d.author ?? '')
          } catch { /* ignore */ }
        },
      },
    })
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      try { player.destroy() } catch { /* ignore */ }
      reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady])

  // ── Commands from sidebar ───────────────────────────────────────────────────
  useEffect(() => {
    if (!command || !playerRef.current) return
    try {
      if (command === 'play')  playerRef.current.playVideo()
      if (command === 'pause') playerRef.current.pauseVideo()
      if (command === 'next') {
        const q = queueRef.current
        const idx = queueIndexRef.current
        if (q.length > 0 && idx < q.length - 1) {
          const next = q[idx + 1]
          playerRef.current.loadVideoById(next.videoId)
          setTrack(next.title, next.channelTitle)
          setPlaying(true)
          queueIndexRef.current = idx + 1
          setQueueIndex(idx + 1)
        }
      }
      if (command === 'prev') {
        const q = queueRef.current
        const idx = queueIndexRef.current
        if (q.length > 0 && idx > 0) {
          const prev = q[idx - 1]
          playerRef.current.loadVideoById(prev.videoId)
          setTrack(prev.title, prev.channelTitle)
          setPlaying(true)
          queueIndexRef.current = idx - 1
          setQueueIndex(idx - 1)
        }
      }
    } catch { /* ignore */ }
    clearCommand()
  }, [command, clearCommand, setTrack, setPlaying])

  // ── Volume ──────────────────────────────────────────────────────────────────
  const handleVolumeChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val))
    setVolume(clamped)
    try { playerRef.current?.setVolume(clamped) } catch { /* ignore */ }
  }, [])

  // Sync volume to player once it's ready
  useEffect(() => {
    if (!playerReady) return
    try { playerRef.current?.setVolume(volume) } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerReady])

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true); setSearchError('')
    try {
      const res = await searchYouTube(query)
      setResults(res)
      if (res.length === 0) setSearchError('No results found')
    } catch { setSearchError('Search failed — is the proxy server running?') }
    finally { setSearching(false) }
  }

  const playVideo = (videoId: string, title: string, channel: string, fromQueue?: VideoResult[]) => {
    if (!playerRef.current) return
    playerRef.current.loadVideoById(videoId)
    setTrack(title, channel)
    setPlaying(true)
    if (fromQueue) {
      const idx = fromQueue.findIndex(v => v.videoId === videoId)
      queueRef.current = fromQueue
      queueIndexRef.current = idx
      setQueue(fromQueue)
      setQueueIndex(idx)
    }
  }

  // ── Channels ────────────────────────────────────────────────────────────────
  const browseChannel = async (ch: Channel) => {
    setActiveChannel(ch)
    setChannelSearching(true)
    setChannelVideos([])
    try {
      const res = await searchYouTube(ch.query)
      setChannelVideos(res)
    } catch { /* silent */ }
    finally { setChannelSearching(false) }
  }

  const handleChannelSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelSearchQuery.trim()) return
    setChannelSearching2(true)
    setChannelSearchError('')
    setChannelSearchResults([])
    setBrowsingChannel(null)
    try {
      const res = await searchChannels(channelSearchQuery)
      setChannelSearchResults(res)
      if (res.length === 0) setChannelSearchError('No channels found')
    } catch { setChannelSearchError('Search failed — is the proxy server running?') }
    finally { setChannelSearching2(false) }
  }

  const openChannelById = async (ch: ChannelResult) => {
    setBrowsingChannel(ch)
    setBrowsingLoading(true)
    setBrowsingVideos([])
    try {
      const res = await browseChannelById(ch.channelId)
      setBrowsingVideos(res)
    } catch { /* silent */ }
    finally { setBrowsingLoading(false) }
  }

  const backFromBrowsing = () => {
    setBrowsingChannel(null)
    setBrowsingVideos([])
  }

  const addCustomChannel = () => {
    if (!newChannelName.trim() || !newChannelQuery.trim()) return
    const ch: Channel = {
      id: `custom-${Date.now()}`,
      name: newChannelName.trim(),
      query: newChannelQuery.trim(),
      custom: true,
    }
    const updated = [...customChannels, ch]
    setCustomChannels(updated)
    saveCustomChannels(updated)
    setNewChannelName('')
    setNewChannelQuery('')
    setAddingChannel(false)
  }

  const removeCustomChannel = (id: string) => {
    const updated = customChannels.filter(c => c.id !== id)
    setCustomChannels(updated)
    saveCustomChannels(updated)
    if (activeChannel?.id === id) setActiveChannel(null)
  }

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, form')) return
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 340, ev.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dragOffset.current.y)),
      })
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const allChannels = [...SUGGESTED_CHANNELS, ...customChannels]

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 200, width: 340 }}
      className="flex flex-col shadow-2xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900"
    >
      {/* Hidden YT player */}
      <div ref={playerElRef} className="hidden" />

      {/* Title bar */}
      <div
        onMouseDown={onDragStart}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 select-none cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="text-gray-400 flex-shrink-0" />
        <Music size={14} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1">Music Player</span>
        {!playerReady && apiReady && <Loader2 size={12} className="animate-spin text-gray-400" />}
        {playerReady && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleVolumeChange(volume === 0 ? 100 : 0)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={e => handleVolumeChange(Number(e.target.value))}
              className="w-16 h-1 accent-red-500 cursor-pointer"
              title={`Volume: ${volume}%`}
            />
          </div>
        )}
        <button
          onClick={() => setMinimized(m => !m)}
          title={minimized ? 'Expand' : 'Minimise'}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {minimized ? <ChevronDown size={13} /> : <Minus size={13} />}
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            {([['search', <Search size={11} />, 'Search'], ['channels', <Radio size={11} />, 'Channels']] as const).map(([t, icon, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs border-b-2 transition-colors flex-1 justify-center ${
                  tab === t
                    ? 'border-red-500 text-red-500 font-medium'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* ── Search tab ── */}
          {tab === 'search' && (
            <>
              <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800">
                    <Search size={11} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search YouTube…"
                      className="flex-1 bg-transparent outline-none text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching || !query.trim()}
                    className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1"
                  >
                    {searching ? <Loader2 size={11} className="animate-spin" /> : 'Go'}
                  </button>
                </form>
                {searchError && <p className="text-[10px] text-red-400 mt-1.5 px-1">{searchError}</p>}
              </div>

              {results.length > 0 ? (
                <div className="overflow-y-auto max-h-72 divide-y divide-gray-100 dark:divide-gray-800">
                  {results.map(r => (
                    <button
                      key={r.videoId}
                      onClick={() => playVideo(r.videoId, r.title, r.channelTitle, results)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-800 text-left group transition-colors"
                    >
                      {r.thumbnail
                        ? <img src={r.thumbnail} alt="" className="w-12 h-9 object-cover rounded flex-shrink-0 bg-gray-200" />
                        : <div className="w-12 h-9 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center"><Music size={14} className="text-gray-400" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800 dark:text-gray-200 font-medium line-clamp-2 leading-snug group-hover:text-red-500 transition-colors">{r.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{r.channelTitle}</p>
                      </div>
                      <a href={`https://youtube.com/watch?v=${r.videoId}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 flex-shrink-0"
                        title="Open on YouTube"
                      >
                        <ExternalLink size={11} />
                      </a>
                    </button>
                  ))}
                </div>
              ) : (
                !searching && (
                  <div className="px-4 py-6 text-center">
                    <Music size={28} className="text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Search for a song or artist</p>
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">or browse channels →</p>
                  </div>
                )
              )}
            </>
          )}

          {/* ── Channels tab ── */}
          {tab === 'channels' && (
            <div className="flex flex-col overflow-hidden">

              {/* ── Drill-in: browsing a found channel's uploads ── */}
              {browsingChannel ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-surface-800 flex-shrink-0">
                    <button onClick={backFromBrowsing}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500" title="Back">
                      <ChevronDown size={13} className="rotate-90" />
                    </button>
                    {browsingChannel.avatar
                      ? <img src={browsingChannel.avatar} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                      : <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0 flex items-center justify-center"><Users size={10} className="text-red-500" /></div>
                    }
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">{browsingChannel.name}</span>
                    {browsingLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
                  </div>
                  <div className="overflow-y-auto max-h-72 divide-y divide-gray-100 dark:divide-gray-800">
                    {browsingVideos.map(r => (
                      <VideoRow key={r.videoId} r={r} onPlay={() => playVideo(r.videoId, r.title, browsingChannel.name, browsingVideos)} />
                    ))}
                    {!browsingLoading && browsingVideos.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-6">No videos found</p>
                    )}
                  </div>
                </>

              /* ── Drill-in: browsing a saved/suggested channel ── */
              ) : activeChannel ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-surface-800 flex-shrink-0">
                    <button onClick={() => { setActiveChannel(null); setChannelVideos([]) }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500" title="Back">
                      <ChevronDown size={13} className="rotate-90" />
                    </button>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">{activeChannel.name}</span>
                    {channelSearching && <Loader2 size={12} className="animate-spin text-gray-400" />}
                  </div>
                  <div className="overflow-y-auto max-h-72 divide-y divide-gray-100 dark:divide-gray-800">
                    {channelVideos.map(r => (
                      <VideoRow key={r.videoId} r={r} onPlay={() => playVideo(r.videoId, r.title, r.channelTitle, channelVideos)} />
                    ))}
                    {!channelSearching && channelVideos.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-6">No results</p>
                    )}
                  </div>
                </>

              /* ── Default: channel search + saved list ── */
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                  {/* Channel search bar */}
                  <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                    <form onSubmit={handleChannelSearch} className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800">
                        <Users size={11} className="text-gray-400 flex-shrink-0" />
                        <input
                          value={channelSearchQuery}
                          onChange={e => setChannelSearchQuery(e.target.value)}
                          placeholder="Find a channel…"
                          className="flex-1 bg-transparent outline-none text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400"
                        />
                      </div>
                      <button type="submit" disabled={channelSearching2 || !channelSearchQuery.trim()}
                        className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1">
                        {channelSearching2 ? <Loader2 size={11} className="animate-spin" /> : 'Find'}
                      </button>
                    </form>
                    {channelSearchError && <p className="text-[10px] text-red-400 mt-1.5 px-1">{channelSearchError}</p>}
                  </div>

                  {/* Channel search results */}
                  {channelSearchResults.length > 0 && (
                    <>
                      <div className="px-3 pt-2.5 pb-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Search size={9} /> Results
                        </p>
                      </div>
                      {channelSearchResults.map(ch => (
                        <button key={ch.channelId} onClick={() => openChannelById(ch)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-800 text-left transition-colors group">
                          {ch.avatar
                            ? <img src={ch.avatar} alt="" className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-200 object-cover" />
                            : <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0 flex items-center justify-center"><Users size={13} className="text-red-500" /></div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate group-hover:text-red-500 transition-colors">{ch.name}</p>
                            {ch.subscriberCount && <p className="text-[10px] text-gray-400 truncate">{ch.subscriberCount}</p>}
                          </div>
                          <ChevronDown size={11} className="text-gray-300 rotate-[-90deg] flex-shrink-0" />
                        </button>
                      ))}
                      <div className="border-t border-gray-100 dark:border-gray-800 mt-1" />
                    </>
                  )}

                  {/* Suggested channels */}
                  <div className="px-3 pt-2.5 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Star size={9} /> Suggested
                    </p>
                  </div>
                  {SUGGESTED_CHANNELS.map(ch => (
                    <button key={ch.id} onClick={() => browseChannel(ch)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-800 text-left transition-colors group">
                      <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <Music size={12} className="text-red-500" />
                      </div>
                      <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 group-hover:text-red-500 transition-colors">{ch.name}</span>
                      <ChevronDown size={11} className="text-gray-300 rotate-[-90deg]" />
                    </button>
                  ))}

                  {/* Custom channels */}
                  {customChannels.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-1 border-t border-gray-100 dark:border-gray-800 mt-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">My Channels</p>
                      </div>
                      {customChannels.map(ch => (
                        <button key={ch.id} onClick={() => browseChannel(ch)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-800 text-left transition-colors group">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <Music size={12} className="text-blue-500" />
                          </div>
                          <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 group-hover:text-red-500 transition-colors truncate">{ch.name}</span>
                          <button onClick={e => { e.stopPropagation(); removeCustomChannel(ch.id) }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 flex-shrink-0"
                            title="Remove channel">
                            <Trash2 size={11} />
                          </button>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Add custom channel */}
                  <div className="px-3 pt-2 pb-3 border-t border-gray-100 dark:border-gray-800 mt-1">
                    {!addingChannel ? (
                      <button onClick={() => setAddingChannel(true)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 transition-colors">
                        <Plus size={11} /> Add custom channel
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                          placeholder="Channel name (e.g. Chill Beats)"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none focus:border-red-400" />
                        <input value={newChannelQuery} onChange={e => setNewChannelQuery(e.target.value)}
                          placeholder="Search query (e.g. chill beats playlist)"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none focus:border-red-400" />
                        <div className="flex gap-1.5">
                          <button onClick={addCustomChannel}
                            disabled={!newChannelName.trim() || !newChannelQuery.trim()}
                            className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-40">
                            Add
                          </button>
                          <button onClick={() => { setAddingChannel(false); setNewChannelName(''); setNewChannelQuery('') }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-800">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
