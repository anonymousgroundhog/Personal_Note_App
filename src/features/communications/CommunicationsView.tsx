import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, Send, RefreshCw, Hash, Plus, Trash2,
  AlertCircle, Loader, ExternalLink, Lock, Edit2, Check, Clock,
  ChevronDown, LogOut, Volume2, Server, HelpCircle, ChevronRight, X, Key, Star,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookEntry {
  id: string        // internal UUID (not Discord webhook id)
  name: string      // user-assigned label
  url: string       // full Discord webhook URL
  webhookId: string // extracted from URL
  token: string     // extracted from URL
  channelId?: string
  guildId?: string
  guildName?: string
  channelName?: string
}

interface WebhookMessage {
  id: string
  content: string
  timestamp: string
  author: {
    id: string
    username: string
    avatar: string | null
    bot?: boolean
  }
  attachments: Array<{
    id: string
    filename: string
    url: string
    content_type?: string
    width?: number
    height?: number
  }>
}

interface ScheduledMessage {
  id: string
  webhookId: string       // WebhookEntry.id (internal UUID)
  webhookName: string
  discordWebhookId: string
  discordToken: string
  content: string
  scheduledFor: string    // ISO string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  error?: string
}

interface BotGuild {
  id: string
  name: string
  icon: string | null
}

interface BotChannel {
  id: string
  name: string
  type: number   // 0=text, 2=voice, 4=category, 5=announcement
  parent_id: string | null
  position: number
  topic?: string | null
}

interface BotMessage {
  id: string
  content: string
  timestamp: string
  edited_timestamp: string | null
  channel_id: string
  author: {
    id: string
    username: string
    discriminator: string
    avatar: string | null
    global_name?: string | null
    bot?: boolean
  }
  attachments: Array<{
    id: string
    filename: string
    url: string
    content_type?: string
    width?: number
    height?: number
  }>
  referenced_message?: BotMessage | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCORD_API = '/discord'
const STORAGE_KEY = 'discord_webhooks_v2'
const SCHEDULED_KEY = 'discord_scheduled_messages'
const BOT_TOKEN_KEY = 'discord_bot_token'
const BOT_SAVED_TOKENS_KEY = 'discord_bot_saved_tokens'

interface SavedBotToken {
  id: string
  name: string
  token: string
  savedAt: string
  botUsername?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseWebhookUrl(url: string): { webhookId: string; token: string } | null {
  const m = url.match(/discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([^/?#]+)/)
  if (!m) return null
  return { webhookId: m[1], token: m[2] }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function loadWebhooks(): WebhookEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveWebhooks(list: WebhookEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function loadSavedTokens(): SavedBotToken[] {
  try { return JSON.parse(localStorage.getItem(BOT_SAVED_TOKENS_KEY) || '[]') } catch { return [] }
}

function persistSavedTokens(list: SavedBotToken[]) {
  localStorage.setItem(BOT_SAVED_TOKENS_KEY, JSON.stringify(list))
}

function loadScheduled(): ScheduledMessage[] {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULED_KEY) || '[]')
  } catch {
    return []
  }
}

function saveScheduled(list: ScheduledMessage[]) {
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(list))
}

function formatScheduledTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Returns a datetime-local input value for "now + offsetMinutes"
function defaultScheduleValue(offsetMinutes = 60): string {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000)
  // datetime-local needs "YYYY-MM-DDTHH:MM"
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Proxy GET through local server to avoid CORS (used for webhook validation only)
async function proxyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DISCORD_API}/${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// Bot token REST helpers — use x-bot-token to avoid Vite proxy stripping Authorization
async function botGet<T>(path: string, token: string): Promise<T> {
  const url = `${DISCORD_API}/${path}`
  console.log(`[botGet] → ${url}`)
  const res = await fetch(url, {
    headers: { 'x-bot-token': token },
  })
  console.log(`[botGet] ← ${res.status} ${url}`)
  if (!res.ok) {
    const body = await res.text()
    console.error(`[botGet] error body:`, body)
    const err = JSON.parse(body || '{}') as { message?: string }
    throw new Error(err.message || `HTTP ${res.status}: ${body}`)
  }
  return res.json()
}

async function botPost<T>(path: string, token: string, body: object): Promise<T> {
  const res = await fetch(`${DISCORD_API}/${path}`, {
    method: 'POST',
    headers: { 'x-bot-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// POST a webhook message through the local proxy (avoids CORS)
async function proxyWebhookPost(webhookId: string, webhookToken: string, body: object): Promise<WebhookMessage> {
  const res = await fetch(`${DISCORD_API}/webhooks/${webhookId}/${webhookToken}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(({ msg, prevMsg }: { msg: WebhookMessage; prevMsg?: WebhookMessage }) => {
  const sameAuthor = prevMsg?.author.id === msg.author.id &&
    new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 5 * 60 * 1000

  const avatarSrc = msg.author.avatar
    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`

  return (
    <div className={`flex gap-3 px-4 group hover:bg-gray-50 dark:hover:bg-white/5 py-0.5 ${sameAuthor ? '' : 'mt-3'}`}>
      <div className="w-9 flex-shrink-0 pt-0.5">
        {!sameAuthor && (
          <img
            src={avatarSrc}
            alt={msg.author.username}
            className="w-9 h-9 rounded-full"
            onError={e => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {!sameAuthor && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {msg.author.username}
              {msg.author.bot && (
                <span className="ml-1.5 px-1 py-0.5 text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded font-medium">BOT</span>
              )}
            </span>
            <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
          </div>
        )}

        {msg.content && (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
            {msg.content}
          </p>
        )}

        {msg.attachments.map(att => (
          <div key={att.id} className="mt-1">
            {att.content_type?.startsWith('image/') ? (
              <img
                src={att.url}
                alt={att.filename}
                className="max-w-sm max-h-64 rounded-lg border border-gray-200 dark:border-gray-700 object-cover"
              />
            ) : (
              <a href={att.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-500 hover:underline">
                <ExternalLink size={11} /> {att.filename}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

// ─── Add Webhook dialog ───────────────────────────────────────────────────────

function AddWebhookForm({ onAdd }: { onAdd: (entry: WebhookEntry) => void; onCancel: () => void }) {
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = urlInput.trim()
    const parsed = parseWebhookUrl(url)
    if (!parsed) {
      setError('Invalid webhook URL. Expected: https://discord.com/api/webhooks/{id}/{token}')
      return
    }

    setValidating(true)
    setError('')
    try {
      const info = await proxyGet<{
        id: string; name: string; channel_id: string; guild_id: string;
        guild?: { name: string }; source_channel?: { name: string }
      }>(`webhooks/${parsed.webhookId}/${parsed.token}`)

      const entry: WebhookEntry = {
        id: crypto.randomUUID(),
        name: nameInput.trim() || info.name || `Webhook ${parsed.webhookId.slice(-4)}`,
        url,
        webhookId: parsed.webhookId,
        token: parsed.token,
        channelId: info.channel_id,
        guildId: info.guild_id,
        guildName: info.guild?.name,
        channelName: info.source_channel?.name,
      }
      onAdd(entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate webhook')
    } finally {
      setValidating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-surface-800">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Add Webhook</p>
      <input
        type="url"
        value={urlInput}
        onChange={e => setUrlInput(e.target.value)}
        placeholder="https://discord.com/api/webhooks/…"
        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        autoFocus
      />
      <input
        type="text"
        value={nameInput}
        onChange={e => setNameInput(e.target.value)}
        placeholder="Label (optional)"
        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {error && (
        <p className="text-[10px] text-red-500 flex items-start gap-1">
          <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!urlInput.trim() || validating}
        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
      >
        {validating ? <Loader size={11} className="animate-spin" /> : <Plus size={11} />}
        {validating ? 'Validating…' : 'Add Webhook'}
      </button>
    </form>
  )
}

// ─── Scheduler hook — fires pending messages when their time arrives ──────────

function useScheduler(
  onFired: (msg: ScheduledMessage, result: 'sent' | 'failed', error?: string) => void,
) {
  useEffect(() => {
    const tick = async () => {
      const list = loadScheduled()
      const now = Date.now()
      const due = list.filter(m => m.status === 'pending' && new Date(m.scheduledFor).getTime() <= now)
      if (due.length === 0) return

      for (const msg of due) {
        try {
          await proxyWebhookPost(msg.discordWebhookId, msg.discordToken, { content: msg.content })
          onFired(msg, 'sent')
        } catch (err) {
          onFired(msg, 'failed', err instanceof Error ? err.message : 'Unknown error')
        }
      }
    }

    tick()
    const interval = setInterval(tick, 15000) // check every 15 s
    return () => clearInterval(interval)
  }, [onFired])
}

// ─── Scheduled messages panel ─────────────────────────────────────────────────

function SchedulePanel({
  webhooks,
  scheduled,
  onAdd,
  onRemove,
}: {
  webhooks: WebhookEntry[]
  scheduled: ScheduledMessage[]
  onAdd: (msg: ScheduledMessage) => void
  onRemove: (id: string) => void
}) {
  const [content, setContent] = useState('')
  const [webhookId, setWebhookId] = useState(webhooks[0]?.id ?? '')
  const [scheduleFor, setScheduleFor] = useState(defaultScheduleValue)
  const [error, setError] = useState('')

  // Keep webhookId in sync when webhooks list changes
  useEffect(() => {
    if (!webhookId && webhooks.length > 0) setWebhookId(webhooks[0].id)
  }, [webhooks])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const wh = webhooks.find(w => w.id === webhookId)
    if (!wh) { setError('Select a webhook'); return }
    if (!content.trim()) { setError('Message cannot be empty'); return }
    const ts = new Date(scheduleFor).getTime()
    if (isNaN(ts) || ts <= Date.now()) { setError('Scheduled time must be in the future'); return }

    const entry: ScheduledMessage = {
      id: crypto.randomUUID(),
      webhookId: wh.id,
      webhookName: wh.name,
      discordWebhookId: wh.webhookId,
      discordToken: wh.token,
      content: content.trim(),
      scheduledFor: new Date(scheduleFor).toISOString(),
      status: 'pending',
    }
    onAdd(entry)
    setContent('')
    setScheduleFor(defaultScheduleValue())
    setError('')
  }

  const pending = scheduled.filter(m => m.status === 'pending').sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  )
  const history = scheduled.filter(m => m.status !== 'pending').sort(
    (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compose form */}
      <form onSubmit={handleAdd} className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
          <Clock size={13} /> Schedule a Message
        </p>

        {webhooks.length === 0 ? (
          <p className="text-xs text-gray-400">Add a webhook first to schedule messages.</p>
        ) : (
          <>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook</label>
              <select
                value={webhookId}
                onChange={e => setWebhookId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {webhooks.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}{wh.channelName ? ` → #${wh.channelName}` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Message</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Type your message…"
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Send at</label>
              <input
                type="datetime-local"
                value={scheduleFor}
                onChange={e => setScheduleFor(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <p className="text-[10px] text-red-500 flex items-start gap-1">
                <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />{error}
              </p>
            )}

            <button
              type="submit"
              disabled={!content.trim() || !scheduleFor}
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
            >
              <Clock size={11} /> Schedule Message
            </button>
          </>
        )}
      </form>

      {/* Pending queue */}
      <div className="flex-1 overflow-y-auto">
        {pending.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Pending ({pending.length})
            </p>
            {pending.map(msg => (
              <ScheduledRow key={msg.id} msg={msg} onRemove={onRemove} />
            ))}
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              History
            </p>
            {history.map(msg => (
              <ScheduledRow key={msg.id} msg={msg} onRemove={onRemove} />
            ))}
          </div>
        )}

        {pending.length === 0 && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600 gap-2">
            <Clock size={32} strokeWidth={1} />
            <p className="text-sm">No scheduled messages</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScheduledRow({ msg, onRemove }: { msg: ScheduledMessage; onRemove: (id: string) => void }) {
  const statusColor = msg.status === 'sent'
    ? 'text-green-600 dark:text-green-400'
    : msg.status === 'failed'
      ? 'text-red-500'
      : 'text-indigo-500'

  const statusLabel = msg.status === 'sent' ? 'Sent' : msg.status === 'failed' ? 'Failed' : 'Pending'

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 group">
      <Clock size={13} className={`mt-0.5 flex-shrink-0 ${statusColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-800 dark:text-gray-200 break-words line-clamp-2">{msg.content}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-gray-400">{msg.webhookName}</span>
          <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[10px] text-gray-400">{formatScheduledTime(msg.scheduledFor)}</span>
          <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
          {msg.error && (
            <span className="text-[10px] text-red-400 truncate max-w-[120px]" title={msg.error}>{msg.error}</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(msg.id)}
        title="Remove"
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Discord webhook panel ────────────────────────────────────────────────────

function DiscordPanel() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>(loadWebhooks)
  const [selected, setSelected] = useState<WebhookEntry | null>(null)
  // Messages are session-only: webhooks can't read channel history, only send.
  // We track messages sent this session so the user gets feedback after sending.
  const [messages, setMessages] = useState<WebhookMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'schedule'>('chat')
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>(loadScheduled)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Persist webhooks whenever list changes
  useEffect(() => {
    saveWebhooks(webhooks)
  }, [webhooks])

  // Persist scheduled messages whenever list changes
  useEffect(() => {
    saveScheduled(scheduled)
  }, [scheduled])

  // Scheduler — fires due messages
  const handleSchedulerFired = React.useCallback((msg: ScheduledMessage, result: 'sent' | 'failed', err?: string) => {
    setScheduled(prev => prev.map(m =>
      m.id === msg.id
        ? { ...m, status: result, sentAt: new Date().toISOString(), ...(err ? { error: err } : {}) }
        : m
    ))
  }, [])
  useScheduler(handleSchedulerFired)

  // Clear messages when switching webhooks
  useEffect(() => {
    setMessages([])
    setError('')
  }, [selected?.id])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !selected || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setError('')
    try {
      const sent = await proxyWebhookPost(selected.webhookId, selected.token, { content })
      setMessages(prev => [...prev, sent])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAddWebhook = (entry: WebhookEntry) => {
    setWebhooks(prev => [...prev, entry])
    setSelected(entry)
    setShowAddForm(false)
  }

  const handleRemoveWebhook = (id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const handleRename = (id: string) => {
    const wh = webhooks.find(w => w.id === id)
    if (!wh) return
    setEditingId(id)
    setEditingName(wh.name)
  }

  const commitRename = (id: string) => {
    const name = editingName.trim()
    if (name) {
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, name } : w))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, name } : prev)
    }
    setEditingId(null)
    setEditingName('')
  }

  // Group messages by date for dividers
  const grouped: Array<{ date: string; msgs: WebhookMessage[] }> = []
  messages.forEach(msg => {
    const date = formatDate(msg.timestamp)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.msgs.push(msg)
    else grouped.push({ date, msgs: [msg] })
  })

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Webhook sidebar ── */}
      <div className="w-52 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Webhooks</span>
          <button
            onClick={() => setShowAddForm(v => !v)}
            title="Add webhook"
            className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {showAddForm && (
          <AddWebhookForm
            onAdd={handleAddWebhook}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {webhooks.length === 0 && !showAddForm && (
            <div className="px-2 py-4 text-center">
              <p className="text-[11px] text-gray-400 dark:text-gray-500">No webhooks yet.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-[11px] text-indigo-500 hover:underline"
              >
                Add your first webhook
              </button>
            </div>
          )}

          {webhooks.map(wh => (
            <div
              key={wh.id}
              className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                selected?.id === wh.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => setSelected(wh)}
            >
              <Hash size={12} className="flex-shrink-0 opacity-70" />

              {editingId === wh.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(wh.id)
                    if (e.key === 'Escape') { setEditingId(null) }
                  }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 min-w-0 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-indigo-400 rounded px-1 outline-none"
                />
              ) : (
                <span className="flex-1 min-w-0 text-xs truncate">{wh.name}</span>
              )}

              {editingId === wh.id ? (
                <button
                  onClick={e => { e.stopPropagation(); commitRename(wh.id) }}
                  className="flex-shrink-0 opacity-80 hover:opacity-100"
                >
                  <Check size={11} />
                </button>
              ) : (
                <div className="flex-shrink-0 hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); handleRename(wh.id) }}
                    title="Rename"
                    className={`p-0.5 rounded ${selected?.id === wh.id ? 'hover:bg-indigo-700' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleRemoveWebhook(wh.id) }}
                    title="Remove"
                    className={`p-0.5 rounded ${selected?.id === wh.id ? 'hover:bg-indigo-700' : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400'}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {selected && (
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500 space-y-0.5">
            {selected.guildName && <p className="truncate">Server: {selected.guildName}</p>}
            {selected.channelName && <p className="truncate">Channel: #{selected.channelName}</p>}
            {selected.channelId && !selected.channelName && <p className="truncate">Channel: {selected.channelId}</p>}
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-surface-900">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <MessageSquare size={13} /> Chat
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Clock size={13} /> Scheduled
            {scheduled.filter(m => m.status === 'pending').length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full font-semibold">
                {scheduled.filter(m => m.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Schedule tab */}
        {activeTab === 'schedule' && (
          <SchedulePanel
            webhooks={webhooks}
            scheduled={scheduled}
            onAdd={msg => setScheduled(prev => [...prev, msg])}
            onRemove={id => setScheduled(prev => prev.filter(m => m.id !== id))}
          />
        )}

        {/* Chat tab */}
        {activeTab === 'chat' && (!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-3">
            <MessageSquare size={40} strokeWidth={1} />
            <p className="text-sm">{webhooks.length === 0 ? 'Add a webhook to get started' : 'Select a webhook'}</p>
            {webhooks.length === 0 && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus size={12} /> Add Webhook
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <Hash size={16} className="text-gray-400" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">{selected.name}</span>
              {selected.channelName && (
                <span className="text-xs text-gray-400 ml-1">→ #{selected.channelName}</span>
              )}
            </div>

            {/* Session-only notice */}
            <div className="flex items-start gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 flex-shrink-0">
              <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                Webhooks are send-only — Discord does not allow reading channel history via webhook tokens.
                Messages sent this session are shown below.
              </p>
            </div>

            {/* Error bar */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex-shrink-0">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
            )}

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto py-2"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-12">
                  <Hash size={32} strokeWidth={1} />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs">Send the first message below</p>
                </div>
              ) : (
                grouped.map(group => (
                  <React.Fragment key={group.date}>
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-[10px] text-gray-400 font-medium">{group.date}</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                    {group.msgs.map((msg, i) => {
                      const globalIdx = messages.indexOf(msg)
                      return (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          prevMsg={globalIdx > 0 ? messages[globalIdx - 1] : undefined}
                        />
                      )
                    })}
                  </React.Fragment>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex-shrink-0">
              <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message via ${selected.name}`}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none max-h-32 leading-relaxed"
                  style={{ minHeight: '24px' }}
                  onInput={e => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = `${Math.min(t.scrollHeight, 128)}px`
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
                  title="Send (Enter)"
                >
                  {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 pl-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        ))}
      </div>
    </div>
  )
}

// ─── Bot help modal ───────────────────────────────────────────────────────────

const HELP_STEPS = [
  {
    number: 1,
    title: 'Create a Discord Application',
    color: 'bg-indigo-500',
    steps: [
      'Go to discord.com/developers/applications',
      'Click "New Application" in the top-right corner',
      'Give it a name (e.g. "Note App Bot") and click Create',
      'You are now on the application\'s General Information page',
    ],
    note: null,
  },
  {
    number: 2,
    title: 'Create a Bot User',
    color: 'bg-violet-500',
    steps: [
      'In the left sidebar click "Bot"',
      'Click "Add Bot" then "Yes, do it!"',
      'Under the bot\'s username, click "Reset Token" and copy the token',
      'Store this token somewhere safe — you only see it once',
    ],
    note: 'Never share your bot token. Anyone with it can control your bot.',
  },
  {
    number: 3,
    title: 'Enable Required Intents',
    color: 'bg-blue-500',
    steps: [
      'Still on the Bot page, scroll down to "Privileged Gateway Intents"',
      'Enable "Server Members Intent"',
      'Enable "Message Content Intent"',
      'Click "Save Changes"',
    ],
    note: 'Without Message Content Intent the bot receives empty message bodies.',
  },
  {
    number: 4,
    title: 'Generate an Invite Link',
    color: 'bg-cyan-500',
    steps: [
      'In the left sidebar click "OAuth2" → "URL Generator"',
      'Under Scopes, check "bot"',
      'Under Bot Permissions, check: Read Messages/View Channels, Send Messages, Read Message History',
      'Copy the generated URL at the bottom of the page',
    ],
    note: 'Do NOT use Server Settings → Integrations to add the bot — that does not grant server membership.',
  },
  {
    number: 5,
    title: 'Invite the Bot to Your Server',
    color: 'bg-teal-500',
    steps: [
      'Open the copied OAuth2 URL in your browser',
      'Select the server you want to add the bot to from the dropdown',
      'Click "Authorize" and complete the CAPTCHA if prompted',
      'The bot will now appear in your server\'s member list',
    ],
    note: 'You must have "Manage Server" permission on the target server.',
  },
  {
    number: 6,
    title: 'Connect in Note App',
    color: 'bg-green-500',
    steps: [
      'Switch to the "Discord Bot" tab in Communications',
      'Paste your bot token into the token field and click Connect',
      'Your servers will appear in the left sidebar dropdown',
      'Select a server, then a channel, and start chatting',
    ],
    note: null,
  },
]

function BotHelpModal({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState<number | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <HelpCircle size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Discord Bot Setup Guide</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Complete walkthrough from creating an app to sending messages</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {HELP_STEPS.map((s, i) => (
              <React.Fragment key={s.number}>
                <button
                  onClick={() => setActiveStep(activeStep === s.number ? null : s.number)}
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                    activeStep === s.number
                      ? `${s.color} text-white shadow-md scale-110`
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={s.title}
                >
                  {s.number}
                </button>
                {i < HELP_STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 px-0.5">
            {HELP_STEPS.map(s => (
              <span key={s.number} className="text-[9px] text-gray-400 dark:text-gray-500 text-center" style={{ width: '14%' }}>
                {s.title.split(' ').slice(0, 2).join(' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Steps list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {HELP_STEPS.map(s => (
            <div key={s.number} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveStep(activeStep === s.number ? null : s.number)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
              >
                <div className={`w-7 h-7 rounded-full ${s.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {s.number}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{s.title}</span>
                <ChevronRight size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${activeStep === s.number ? 'rotate-90' : ''}`} />
              </button>

              {activeStep === s.number && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50">
                  <ol className="mt-3 space-y-2">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className={`mt-0.5 w-5 h-5 rounded-full ${s.color} bg-opacity-15 dark:bg-opacity-20 flex items-center justify-center text-[10px] font-semibold flex-shrink-0`}
                          style={{ backgroundColor: undefined }}
                        >
                          <span className="text-gray-600 dark:text-gray-300">{i + 1}</span>
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {s.note && (
                    <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">{s.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-gray-400">
            Need more help? Visit{' '}
            <a href="https://discord.com/developers/docs/intro" target="_blank" rel="noopener noreferrer"
              className="text-indigo-500 hover:underline">
              discord.com/developers/docs
            </a>
          </p>
          <button onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bot token setup screen ───────────────────────────────────────────────────

function BotTokenSetup({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState('')
  const [nameValue, setNameValue] = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [savedTokens, setSavedTokens] = useState<SavedBotToken[]>(loadSavedTokens)
  const [showToken, setShowToken] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = value.trim()
    if (!t) return
    setTesting(true)
    setError('')
    try {
      const me = await botGet<{ id: string; username: string }>('users/@me', t)
      localStorage.setItem(BOT_TOKEN_KEY, t)

      // Auto-save with provided name (or bot username as fallback)
      const label = nameValue.trim() || me.username || 'My Bot'
      const existing = savedTokens.find(s => s.token === t)
      if (!existing) {
        const entry: SavedBotToken = {
          id: crypto.randomUUID(),
          name: label,
          token: t,
          savedAt: new Date().toISOString(),
          botUsername: me.username,
        }
        const updated = [...savedTokens, entry]
        setSavedTokens(updated)
        persistSavedTokens(updated)
      }

      onSave(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid token')
    } finally {
      setTesting(false)
    }
  }

  const handleLoad = (saved: SavedBotToken) => {
    localStorage.setItem(BOT_TOKEN_KEY, saved.token)
    onSave(saved.token)
  }

  const handleDelete = (id: string) => {
    const updated = savedTokens.filter(s => s.id !== id)
    setSavedTokens(updated)
    persistSavedTokens(updated)
  }

  const commitRename = (id: string) => {
    const name = editingName.trim()
    if (name) {
      const updated = savedTokens.map(s => s.id === id ? { ...s, name } : s)
      setSavedTokens(updated)
      persistSavedTokens(updated)
    }
    setEditingId(null)
    setEditingName('')
  }

  return (
    <>
      {showHelp && <BotHelpModal onClose={() => setShowHelp(false)} />}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Saved tokens sidebar ── */}
        <div className="w-56 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700">
            <Key size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Saved Tokens</span>
            <span className="ml-auto text-[10px] text-gray-400">{savedTokens.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {savedTokens.length === 0 ? (
              <p className="px-2 py-4 text-[11px] text-gray-400 dark:text-gray-500 text-center leading-snug">
                No saved tokens yet.<br />Tokens are saved automatically when you connect.
              </p>
            ) : (
              savedTokens.map(saved => (
                <div key={saved.id}
                  className="group flex items-start gap-1.5 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <Star size={11} className="mt-0.5 flex-shrink-0 text-indigo-400" />
                  <div className="flex-1 min-w-0">
                    {editingId === saved.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(saved.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => commitRename(saved.id)}
                        className="w-full text-xs bg-white dark:bg-gray-800 border border-indigo-400 rounded px-1 py-0.5 outline-none text-gray-800 dark:text-gray-200"
                      />
                    ) : (
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{saved.name}</p>
                    )}
                    {saved.botUsername && (
                      <p className="text-[10px] text-gray-400 truncate">@{saved.botUsername}</p>
                    )}
                    <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">
                      {new Date(saved.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleLoad(saved)}
                      title="Use this token"
                      className="p-1 rounded text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => { setEditingId(saved.id); setEditingName(saved.name) }}
                      title="Rename"
                      className="p-1 rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => handleDelete(saved.id)}
                      title="Delete"
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Main connect form ── */}
        <div className="flex-1 flex items-center justify-center p-8 relative overflow-y-auto">
          {/* Help button top-right */}
          <button
            onClick={() => setShowHelp(true)}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700 transition-colors"
          >
            <HelpCircle size={13} /> Setup Guide
          </button>

          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🤖</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Connect Discord Bot</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enter your bot token to browse servers, read messages, and chat in real time.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Label <span className="text-gray-400 font-normal">(optional — used for the saved tokens list)</span>
                </label>
                <input
                  type="text"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  placeholder="e.g. My Dev Bot"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Bot Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="Paste your bot token here"
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <Lock size={14} /> : <Key size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs">
                  <AlertCircle size={12} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!value.trim() || testing}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {testing && <Loader size={14} className="animate-spin" />}
                {testing ? 'Connecting…' : 'Connect & Save'}
              </button>
            </form>

            <button
              onClick={() => setShowHelp(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              <HelpCircle size={15} />
              New here? View the step-by-step setup guide
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Discord Gateway hook ─────────────────────────────────────────────────────
// Uses the well-known gateway URL directly — avoids an extra REST call that
// contributes to rate limiting. Implements exponential backoff on reconnects.

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json'

function useBotGateway(
  token: string | null,
  onMessage: (msg: BotMessage) => void,
  onReady: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seqRef = useRef<number | null>(null)
  const retryRef = useRef(0) // backoff attempt count
  const onMessageRef = useRef(onMessage)
  const onReadyRef = useRef(onReady)
  onMessageRef.current = onMessage
  onReadyRef.current = onReady

  useEffect(() => {
    if (!token) return
    let alive = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!alive) return
      try {
        const ws = new WebSocket(GATEWAY_URL)
        wsRef.current = ws

        ws.onopen = () => { retryRef.current = 0 }

        ws.onmessage = (ev) => {
          const { op, d, s, t } = JSON.parse(ev.data)
          if (s != null) seqRef.current = s

          if (op === 10) {
            // HELLO — start heartbeat then IDENTIFY
            const interval = d.heartbeat_interval
            // Send first heartbeat after a jittered delay as Discord recommends
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ op: 1, d: seqRef.current }))
            }, Math.floor(Math.random() * interval))

            heartbeatRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ op: 1, d: seqRef.current }))
            }, interval)

            ws.send(JSON.stringify({
              op: 2,
              d: {
                token,
                intents: (1 << 0) | (1 << 9) | (1 << 15), // GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT
                properties: { os: 'linux', browser: 'note-app', device: 'note-app' },
              },
            }))
          }

          if (op === 0 && t === 'READY') onReadyRef.current()
          if (op === 0 && t === 'MESSAGE_CREATE') onMessageRef.current(d as BotMessage)

          // op 7 = server wants reconnect, op 9 = invalid session
          if (op === 7 || op === 9) {
            ws.close(1000, 'reconnect requested')
          }
        }

        ws.onclose = () => {
          if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
          if (!alive) return
          // Exponential backoff: 2s, 4s, 8s, 16s, capped at 60s
          const delay = Math.min(2000 * Math.pow(2, retryRef.current), 60000)
          retryRef.current = Math.min(retryRef.current + 1, 5)
          retryTimer = setTimeout(connect, delay)
        }

        ws.onerror = () => ws.close()
      } catch {
        if (!alive) return
        const delay = Math.min(2000 * Math.pow(2, retryRef.current), 60000)
        retryRef.current = Math.min(retryRef.current + 1, 5)
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      alive = false
      if (retryTimer) clearTimeout(retryTimer)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      wsRef.current?.close(1000, 'unmount')
    }
  }, [token])
}

// ─── Bot message bubble ───────────────────────────────────────────────────────

const BotMessageBubble = React.memo(({ msg, prevMsg }: { msg: BotMessage; prevMsg?: BotMessage }) => {
  const sameAuthor = prevMsg?.author.id === msg.author.id &&
    new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 5 * 60 * 1000

  const avatarSrc = msg.author.avatar
    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`

  return (
    <div className={`flex gap-3 px-4 group hover:bg-gray-50 dark:hover:bg-white/5 py-0.5 ${sameAuthor ? '' : 'mt-3'}`}>
      <div className="w-9 flex-shrink-0 pt-0.5">
        {!sameAuthor && (
          <img src={avatarSrc} alt={msg.author.username} className="w-9 h-9 rounded-full"
            onError={e => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {!sameAuthor && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {msg.author.global_name || msg.author.username}
              {msg.author.bot && (
                <span className="ml-1.5 px-1 py-0.5 text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded font-medium">BOT</span>
              )}
            </span>
            <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
          </div>
        )}
        {msg.referenced_message && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 mb-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
            <img src={msg.referenced_message.author.avatar
              ? `https://cdn.discordapp.com/avatars/${msg.referenced_message.author.id}/${msg.referenced_message.author.avatar}.png?size=32`
              : 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt="" className="w-3.5 h-3.5 rounded-full" />
            <span className="font-medium">{msg.referenced_message.author.global_name || msg.referenced_message.author.username}</span>
            <span className="truncate max-w-[200px]">{msg.referenced_message.content}</span>
          </div>
        )}
        {msg.content && (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
        )}
        {msg.attachments.map(att => (
          <div key={att.id} className="mt-1">
            {att.content_type?.startsWith('image/') ? (
              <img src={att.url} alt={att.filename}
                className="max-w-sm max-h-64 rounded-lg border border-gray-200 dark:border-gray-700 object-cover" />
            ) : (
              <a href={att.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-500 hover:underline">
                <ExternalLink size={11} /> {att.filename}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

// ─── Bot panel ────────────────────────────────────────────────────────────────

function BotPanel() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(BOT_TOKEN_KEY))
  const [botAppId, setBotAppId] = useState<string | null>(() => localStorage.getItem('discord_bot_app_id'))
  const [guilds, setGuilds] = useState<BotGuild[]>([])
  const [selectedGuild, setSelectedGuild] = useState<BotGuild | null>(null)
  const [guildOpen, setGuildOpen] = useState(false)
  const [channels, setChannels] = useState<BotChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<BotChannel | null>(null)
  const [messages, setMessages] = useState<BotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [gatewayReady, setGatewayReady] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const selectedChannelRef = useRef(selectedChannel)
  selectedChannelRef.current = selectedChannel

  // Gateway real-time messages
  const handleGatewayMessage = useCallback((msg: BotMessage) => {
    if (selectedChannelRef.current?.id === msg.channel_id) {
      setMessages(prev => [...prev, msg])
    }
  }, [])
  const handleGatewayReady = useCallback(() => setGatewayReady(true), [])
  useBotGateway(token, handleGatewayMessage, handleGatewayReady)

  // Load bot's own user info (for app ID → invite URL) + guilds
  useEffect(() => {
    if (!token) return
    setError('')

    // Fetch app ID if we don't have it yet
    if (!botAppId) {
      botGet<{ id: string }>('users/@me', token)
        .then(me => {
          localStorage.setItem('discord_bot_app_id', me.id)
          setBotAppId(me.id)
        })
        .catch(() => {}) // non-fatal
    }

    botGet<unknown>('users/@me/guilds', token)
      .then(raw => {
        const list = raw as BotGuild[]
        if (!Array.isArray(list)) {
          setError(`Unexpected response: ${JSON.stringify(raw).slice(0, 200)}`)
          return
        }
        setGuilds(list)
      })
      .catch(err => setError(err.message))
  }, [token])

  // Load channels when guild selected
  useEffect(() => {
    if (!token || !selectedGuild) return
    setChannels([])
    setSelectedChannel(null)
    setMessages([])
    setError('')
    botGet<BotChannel[]>(`guilds/${selectedGuild.id}/channels`, token)
      .then(list => {
        if (!Array.isArray(list)) throw new Error('Could not load channels — bot may not be in this server')
        setChannels(list.sort((a, b) => a.position - b.position))
      })
      .catch(err => setError(err.message))
  }, [selectedGuild?.id])

  // Load messages when channel selected
  useEffect(() => {
    if (!token || !selectedChannel) { setMessages([]); return }
    setLoading(true)
    setHasMore(true)
    setError('')
    botGet<BotMessage[]>(`channels/${selectedChannel.id}/messages?limit=50`, token)
      .then(msgs => {
        setMessages([...msgs].reverse())
        setHasMore(msgs.length === 50)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedChannel?.id])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Infinite scroll upward
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el || loadingMore || !hasMore || !selectedChannel || !token) return
    if (el.scrollTop > 80) return
    const oldest = messages[0]
    if (!oldest) return
    setLoadingMore(true)
    botGet<BotMessage[]>(`channels/${selectedChannel.id}/messages?limit=50&before=${oldest.id}`, token)
      .then(older => {
        if (older.length === 0) { setHasMore(false); return }
        setMessages(prev => [...[...older].reverse(), ...prev])
        setHasMore(older.length === 50)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [messages, loadingMore, hasMore, selectedChannel, token])

  const handleSend = async () => {
    if (!input.trim() || !selectedChannel || !token || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setError('')
    try {
      await botPost(`channels/${selectedChannel.id}/messages`, token, { content })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleLogout = () => {
    localStorage.removeItem(BOT_TOKEN_KEY)
    localStorage.removeItem('discord_bot_app_id')
    setToken(null)
    setBotAppId(null)
    setGuilds([])
    setSelectedGuild(null)
    setChannels([])
    setSelectedChannel(null)
    setMessages([])
    setGatewayReady(false)
  }

  if (!token) return <BotTokenSetup onSave={setToken} />

  // Group channels by category

  const categories = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position)
  const uncategorized = channels.filter(c => c.type !== 4 && !c.parent_id && (c.type === 0 || c.type === 5))
  const textChannelTypes = new Set([0, 5])

  return (
    <>
      {showHelp && <BotHelpModal onClose={() => setShowHelp(false)} />}
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-52 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
        {/* Guild picker */}
        <div className="relative border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setGuildOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Server size={14} className="flex-shrink-0 text-gray-400" />
              <span className="truncate">{selectedGuild?.name ?? 'Select server'}</span>
            </div>
            <ChevronDown size={13} className={`flex-shrink-0 transition-transform ${guildOpen ? 'rotate-180' : ''}`} />
          </button>
          {guildOpen && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-lg max-h-64 overflow-y-auto">
              {guilds.map(g => (
                <button key={g.id}
                  onClick={() => { setSelectedGuild(g); setGuildOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${selectedGuild?.id === g.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  {g.icon
                    ? <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32`} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                    : <div className="w-5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-800 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-indigo-600 dark:text-indigo-300">{g.name[0]}</div>
                  }
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-2">
          {error && !selectedChannel && (
            <p className="px-3 py-3 text-[11px] text-red-500 leading-snug">{error}</p>
          )}
          {!selectedGuild ? (
            guilds.length === 0 ? (
              <div className="px-3 py-4 space-y-3">
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                  No servers found. The bot must be invited via OAuth2 — adding it through Server Settings → Integrations is not enough.
                </p>
                {botAppId ? (
                  <a
                    href={`https://discord.com/oauth2/authorize?client_id=${botAppId}&permissions=68608&scope=bot`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    <ExternalLink size={11} /> Invite Bot to Server
                  </a>
                ) : (
                  <p className="text-[11px] text-gray-400">Loading invite link…</p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-snug">
                  After inviting, click the refresh button or disconnect and reconnect.
                </p>
                <button
                  onClick={() => {
                    if (!token) return
                    setError('')
                    botGet<unknown>('users/@me/guilds', token)
                      .then(raw => {
                        const list = raw as BotGuild[]
                        if (Array.isArray(list)) setGuilds(list)
                      })
                      .catch(err => setError(err.message))
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw size={11} /> Refresh Server List
                </button>
              </div>
            ) : (
              <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">Select a server above</p>
            )
          ) : (
            <>
              {uncategorized.map(ch => (
                <ChannelButton key={ch.id} channel={ch} selected={selectedChannel?.id === ch.id}
                  onClick={() => setSelectedChannel(ch)} />
              ))}
              {categories.map(cat => {
                const children = channels.filter(c => c.parent_id === cat.id && textChannelTypes.has(c.type))
                  .sort((a, b) => a.position - b.position)
                if (children.length === 0) return null
                return (
                  <div key={cat.id} className="mt-2">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
                      {cat.name}
                    </p>
                    {children.map(ch => (
                      <ChannelButton key={ch.id} channel={ch} selected={selectedChannel?.id === ch.id}
                        onClick={() => setSelectedChannel(ch)} />
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Bottom: gateway status + actions */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gatewayReady ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'}`} />
            <span className="text-[10px] text-gray-400">{gatewayReady ? 'Connected' : 'Connecting…'}</span>
          </div>
          <button onClick={() => setShowHelp(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors">
            <HelpCircle size={12} /> Setup Guide
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
            <LogOut size={12} /> Disconnect
          </button>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
        {!selectedChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2">
            <Hash size={40} strokeWidth={1} />
            <p className="text-sm">{selectedGuild ? 'Select a channel' : 'Select a server first'}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <Hash size={16} className="text-gray-400" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">{selectedChannel.name}</span>
              {selectedChannel.topic && (
                <span className="text-xs text-gray-400 truncate max-w-xs ml-2">{selectedChannel.topic}</span>
              )}
              <button onClick={() => {
                if (!token || !selectedChannel) return
                setLoading(true)
                botGet<BotMessage[]>(`channels/${selectedChannel.id}/messages?limit=50`, token)
                  .then(msgs => { setMessages([...msgs].reverse()); setHasMore(msgs.length === 50) })
                  .catch(err => setError(err.message))
                  .finally(() => setLoading(false))
              }} title="Refresh" className="ml-auto p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Error bar */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex-shrink-0">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2">
              {loadingMore && (
                <div className="flex justify-center py-2"><Loader size={14} className="animate-spin text-gray-400" /></div>
              )}
              {!hasMore && messages.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 mb-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[10px] text-gray-400">Beginning of #{selectedChannel.name}</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader size={20} className="animate-spin text-indigo-400" />
                </div>
              ) : (
                messages.map((msg, i) => (
                  <BotMessageBubble key={msg.id} msg={msg} prevMsg={messages[i - 1]} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex-shrink-0">
              <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${selectedChannel.name}`}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none max-h-32 leading-relaxed"
                  style={{ minHeight: '24px' }}
                  onInput={e => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = `${Math.min(t.scrollHeight, 128)}px`
                  }}
                />
                <button onClick={handleSend} disabled={!input.trim() || sending}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
                  title="Send (Enter)">
                  {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 pl-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}

function ChannelButton({ channel, selected, onClick }: { channel: BotChannel; selected: boolean; onClick: () => void }) {
  const isVoice = channel.type === 2
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors mx-1 ${
        selected
          ? 'bg-indigo-600 text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
      }`}
    >
      {isVoice ? <Volume2 size={12} className="flex-shrink-0 opacity-60" /> : <Hash size={12} className="flex-shrink-0 opacity-60" />}
      <span className="truncate">{channel.name}</span>
    </button>
  )
}

// ─── Teams panel ──────────────────────────────────────────────────────────────

function TeamsPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`flex flex-col h-full relative ${expanded ? 'fixed inset-0 z-50 bg-white dark:bg-surface-900' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <span>💬</span> Microsoft Teams
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => { setLoading(true); setReloadKey(k => k + 1) }}
            title="Reload" className="p-1.5 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setExpanded(v => !v)} title={expanded ? 'Restore' : 'Expand'}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {expanded ? <Lock size={14} /> : <ExternalLink size={14} />}
          </button>
          <a href="https://teams.microsoft.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <ExternalLink size={12} /> Open in browser
          </a>
        </div>
      </div>
      <div className="flex items-start gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex-shrink-0">
        <AlertCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-snug">
          Teams requires sign-in. If the chat doesn't load, use <strong>Open in browser</strong> to sign in first, then reload here.
          Some organisations block Teams in embedded frames.
        </p>
      </div>
      {loading && (
        <div className="h-0.5 bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
        </div>
      )}
      <iframe key={reloadKey} ref={iframeRef} src="https://teams.microsoft.com" title="Microsoft Teams"
        className="flex-1 w-full border-0"
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        onLoad={() => setLoading(false)} />
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

type CommTool = 'discord' | 'bot' | 'teams'

export default function CommunicationsView() {
  const [activeTool, setActiveTool] = useState<CommTool>('discord')

  const tools: { id: CommTool; label: string; icon: string; activeClass: string }[] = [
    { id: 'discord', label: 'Webhooks',          icon: '🔗', activeClass: 'bg-indigo-600 text-white' },
    { id: 'bot',     label: 'Discord Bot',        icon: '🤖', activeClass: 'bg-indigo-600 text-white' },
    { id: 'teams',   label: 'Microsoft Teams',    icon: '💬', activeClass: 'bg-blue-600 text-white' },
  ]

  const inactiveClass = 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex-shrink-0">
        <MessageSquare size={20} className="text-indigo-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Communications</h1>
        <div className="ml-4 flex items-center gap-0.5">
          {tools.map(tool => (
            <button key={tool.id} onClick={() => setActiveTool(tool.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTool === tool.id ? tool.activeClass : inactiveClass
              }`}>
              <span>{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 flex ${activeTool === 'discord' ? '' : 'hidden'}`}>
          <DiscordPanel />
        </div>
        <div className={`absolute inset-0 flex ${activeTool === 'bot' ? '' : 'hidden'}`}>
          <BotPanel />
        </div>
        <div className={`absolute inset-0 ${activeTool === 'teams' ? 'block' : 'hidden'}`}>
          <TeamsPanel />
        </div>
      </div>
    </div>
  )
}
