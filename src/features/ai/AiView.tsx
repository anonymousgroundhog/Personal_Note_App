import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bot, Settings, Send, Square, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, CheckCircle2, FileText, X, Plus, RefreshCw, Wand2, Edit3,
} from 'lucide-react'
import { useAiStore } from '../../stores/aiStore'
import { useVaultStore } from '../../stores/vaultStore'

// ── Small markdown-ish renderer for assistant messages ──────────────────────
function MessageContent({ content }: { content: string }) {
  // Split on code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-sm leading-relaxed space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const nl = part.indexOf('\n')
          const lang = nl > 3 ? part.slice(3, nl).trim() : ''
          const code = part.slice(nl + 1, -3)
          return (
            <pre key={i} className="bg-gray-100 dark:bg-surface-700 rounded p-3 text-xs overflow-x-auto font-mono">
              {lang && <span className="text-accent-400 block mb-1 text-[10px] uppercase">{lang}</span>}
              {code}
            </pre>
          )
        }
        // Inline formatting: **bold**, `code`, line breaks
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, j) => {
              if (seg.startsWith('**') && seg.endsWith('**')) {
                return <strong key={j}>{seg.slice(2, -2)}</strong>
              }
              if (seg.startsWith('`') && seg.endsWith('`')) {
                return <code key={j} className="bg-gray-100 dark:bg-surface-700 px-1 py-0.5 rounded text-xs font-mono">{seg.slice(1, -1)}</code>
              }
              return seg
            })}
          </span>
        )
      })}
    </div>
  )
}

// ── Note context selector ────────────────────────────────────────────────────
interface NotePickerProps {
  selected: Set<string>
  onToggle: (path: string) => void
  onClose: () => void
}

function NotePicker({ selected, onToggle, onClose }: NotePickerProps) {
  const { index } = useVaultStore()
  const [search, setSearch] = useState('')

  const entries = Array.from(index.entries())
    .map(([path, note]) => ({ path, note }))
    .filter(({ path, note }) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return note.name.toLowerCase().includes(q) || path.toLowerCase().includes(q)
    })
    .sort((a, b) => a.note.name.localeCompare(b.note.name))
    .slice(0, 50)

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-72 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Add notes as context</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={14} />
        </button>
      </div>
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>
      <div className="overflow-y-auto flex-1">
        {index.size === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No vault open</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No notes found</p>
        ) : (
          entries.map(({ path, note }) => (
            <label key={path} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-surface-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(path)}
                onChange={() => onToggle(path)}
                className="accent-accent-500 flex-shrink-0"
              />
              <FileText size={12} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{note.name}</span>
            </label>
          ))
        )}
      </div>
      {selected.size > 0 && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-accent-500 font-medium flex-shrink-0">
          {selected.size} note{selected.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}

// ── Server settings panel with multiple profiles ──────────────────────────────
function ServerSettingsPanel({ onClose }: { onClose: () => void }) {
  const {
    profiles, activeProfileId, config, setConfig, fetchModels,
    addProfile, updateProfile, deleteProfile, setActiveProfile,
    models, modelsLoading, modelsError,
  } = useAiStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingUrl, setEditingUrl] = useState('')
  const [editingKey, setEditingKey] = useState('')

  const connected = models.length > 0 && !modelsError

  const startAdd = () => {
    setEditingId('__new__')
    setEditingName('')
    setEditingUrl('')
    setEditingKey('')
  }

  const startEdit = (id: string) => {
    const profile = profiles.find(p => p.id === id)
    if (profile) {
      setEditingId(id)
      setEditingName(profile.name)
      setEditingUrl(profile.serverUrl)
      setEditingKey(profile.apiKey)
    }
  }

  const handleTestConnection = async () => {
    if (!editingUrl.trim()) return
    const tempId = editingId === '__new__' ? 'temp' : editingId
    const newConfig = { serverUrl: editingUrl.trim(), apiKey: editingKey.trim(), selectedModel: '' }
    // Temporarily set config to test
    setConfig(newConfig)
    // Fetch models will use the new config
    setTimeout(fetchModels, 0)
  }

  const handleSave = async () => {
    if (!editingName.trim() || !editingUrl.trim()) return

    if (editingId === '__new__') {
      addProfile({
        name: editingName,
        serverUrl: editingUrl.trim(),
        apiKey: editingKey.trim(),
        selectedModel: '',
      })
    } else {
      updateProfile(editingId!, {
        name: editingName,
        serverUrl: editingUrl.trim(),
        apiKey: editingKey.trim(),
      })
      setActiveProfile(editingId!)
    }
    setEditingId(null)
    // Fetch models for the activated/saved profile
    setTimeout(fetchModels, 0)
  }

  const handleDelete = (id: string) => {
    if (confirm(`Delete "${profiles.find(p => p.id === id)?.name}"?`)) {
      deleteProfile(id)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const truncateUrl = (url: string) => {
    if (url.length > 40) return url.slice(0, 37) + '…'
    return url
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
      <div className="p-4 space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">AI Server Profiles</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5">
            <ChevronUp size={16} />
          </button>
        </div>

        {/* Saved servers list */}
        {profiles.length > 0 && editingId === null && (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-surface-700">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Saved Servers</span>
              <button
                onClick={startAdd}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-accent-500 text-white hover:bg-accent-600 transition-colors"
              >
                <Plus size={12} /> Add New
              </button>
            </div>
            {profiles.map(profile => (
              <div
                key={profile.id}
                className={`flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-600 cursor-pointer transition-colors ${
                  activeProfileId === profile.id
                    ? 'bg-accent-50 dark:bg-accent-500/10'
                    : 'hover:bg-gray-50 dark:hover:bg-surface-600'
                }`}
                onClick={() => {
                  if (activeProfileId !== profile.id) {
                    setActiveProfile(profile.id)
                    setTimeout(fetchModels, 0)
                  }
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {activeProfileId === profile.id && (
                    <span className="text-accent-500 flex-shrink-0">●</span>
                  )}
                  {activeProfileId !== profile.id && <span className="w-2 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{profile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{truncateUrl(profile.serverUrl)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      startEdit(profile.id)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(profile.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit form */}
        {editingId !== null && (
          <div className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-surface-700 p-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Profile Name</label>
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                placeholder="e.g. Local Ollama, Remote OpenWebUI"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Server URL</label>
              <input
                type="url"
                value={editingUrl}
                onChange={e => setEditingUrl(e.target.value)}
                placeholder="http://your-server:8080"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">OpenWebUI, Ollama, LM Studio, OpenAI-compatible APIs — not port 3001</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">API Key <span className="font-normal">(optional)</span></label>
              <input
                type="password"
                value={editingKey}
                onChange={e => setEditingKey(e.target.value)}
                placeholder="sk-… or leave blank for local servers"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTestConnection}
                disabled={modelsLoading || !editingUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-600 disabled:opacity-60"
              >
                {modelsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {modelsLoading ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                onClick={handleSave}
                disabled={!editingName.trim() || !editingUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-60"
              >
                Save Profile
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-surface-600"
              >
                Cancel
              </button>
            </div>

            {connected && !modelsLoading && (
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <CheckCircle2 size={13} /> {models.length} model{models.length !== 1 ? 's' : ''} available
              </span>
            )}
            {modelsError && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle size={13} /> {modelsError}
              </span>
            )}
          </div>
        )}

        {/* Add New button when no form is open and no profiles */}
        {profiles.length === 0 && editingId === null && (
          <button
            onClick={startAdd}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-accent-500 hover:text-accent-500 transition-colors"
          >
            <Plus size={16} /> Add Your First AI Server
          </button>
        )}

        {/* Active model select */}
        {activeProfileId && models.length > 0 && editingId === null && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Active Model</label>
            <select
              value={config.selectedModel}
              onChange={e => setConfig({ selectedModel: e.target.value })}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main AiView ──────────────────────────────────────────────────────────────
export default function AiView() {
  const {
    activeProfileId, config, models, modelsLoading,
    messages, streaming, streamingContent,
    sendMessage, improvePrompt, clearChat, abortStream, fetchModels,
  } = useAiStore()
  const { index } = useVaultStore()

  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(!activeProfileId)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [isImproving, setIsImproving] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const connected = config.serverUrl && models.length > 0
  const hasModel = !!config.selectedModel

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  // Fetch models on mount if URL already configured
  useEffect(() => {
    if (config.serverUrl && models.length === 0 && !modelsLoading) {
      fetchModels()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleNote = useCallback((path: string) => {
    setSelectedNotes(prev => {
      const next = new Set(prev)
      if (next.has(path)) { next.delete(path) } else { next.add(path) }
      return next
    })
  }, [])

  const buildContext = useCallback(() => {
    if (selectedNotes.size === 0) return undefined
    const parts: string[] = []
    for (const path of selectedNotes) {
      const note = index.get(path)
      if (!note) continue
      parts.push(`## ${note.name}\n\n${note.body}`)
    }
    return parts.join('\n\n---\n\n')
  }, [selectedNotes, index])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || !connected || !hasModel) return
    setInput('')
    const context = buildContext()
    await sendMessage(text, context)
  }, [input, streaming, connected, hasModel, buildContext, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImprovePrompt = useCallback(async () => {
    const text = input.trim()
    if (!text || isImproving || !connected || !hasModel) return
    setIsImproving(true)
    try {
      const improved = await improvePrompt(text)
      setInput(improved)
    } catch (e) {
      // silently ignore — leave input unchanged
    } finally {
      setIsImproving(false)
    }
  }, [input, isImproving, connected, hasModel, improvePrompt])

  const removeNote = (path: string) => {
    setSelectedNotes(prev => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Bot size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">AI Chat</h1>
        {config.selectedModel && (
          <span className="text-xs px-2 py-0.5 bg-accent-500/10 text-accent-500 rounded-full font-medium">
            {models.find(m => m.id === config.selectedModel)?.name ?? config.selectedModel}
          </span>
        )}
        {!connected && !modelsLoading && config.serverUrl && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> Not connected
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Clear chat"
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            title="Connection settings"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors ${showSettings ? 'bg-accent-500 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-700'}`}
          >
            <Settings size={14} />
            {showSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Connection settings panel */}
      {showSettings && <ServerSettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
            <Bot size={52} className="opacity-20" />
            {!config.serverUrl ? (
              <>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">No server configured</p>
                <p className="text-sm text-center max-w-sm">
                  Click the <strong>settings button</strong> above to connect to an OpenWebUI, Ollama, LM Studio, or any OpenAI-compatible server.
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm"
                >
                  <Settings size={15} /> Configure Connection
                </button>
              </>
            ) : !connected ? (
              <>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">Not connected</p>
                <p className="text-sm text-center max-w-sm">Could not load models from <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{config.serverUrl}</code>. Check the URL and API key, then reconnect.</p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">Ask anything</p>
                <p className="text-sm text-center max-w-sm">
                  You can include notes as context by clicking the <strong>+ Notes</strong> button, then ask questions about their content.
                </p>
              </>
            )}
          </div>
        )}

        {messages.filter(m => m.role !== 'system').map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user'
                ? 'bg-accent-500 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-surface-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <MessageContent content={msg.content} />
              )}
              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Streaming assistant bubble */}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 bg-gray-100 dark:bg-surface-700 text-gray-800 dark:text-gray-100">
              {streamingContent ? (
                <MessageContent content={streamingContent} />
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-gray-400">
                  <Loader2 size={13} className="animate-spin" /> Thinking…
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900">
        {/* Selected notes chips */}
        {selectedNotes.size > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-2.5 pb-0">
            {Array.from(selectedNotes).map(path => {
              const name = index.get(path)?.name ?? path.split('/').pop()?.replace(/\.md$/, '') ?? path
              return (
                <span key={path} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-accent-500/10 text-accent-500 rounded-full text-xs font-medium">
                  <FileText size={10} />
                  {name}
                  <button
                    onClick={() => removeNote(path)}
                    className="ml-0.5 hover:bg-accent-500/20 rounded-full p-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Textarea + actions */}
        <div className="relative px-4 py-3">
          {showNotePicker && (
            <NotePicker
              selected={selectedNotes}
              onToggle={toggleNote}
              onClose={() => setShowNotePicker(false)}
            />
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowNotePicker(v => !v)}
              title="Add notes as context"
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs border transition-colors ${
                showNotePicker || selectedNotes.size > 0
                  ? 'border-accent-500 bg-accent-500/10 text-accent-500'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-accent-500 hover:text-accent-500'
              }`}
            >
              <Plus size={12} />
              Notes
              {selectedNotes.size > 0 && (
                <span className="bg-accent-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                  {selectedNotes.size}
                </span>
              )}
            </button>

            <button
              onClick={handleImprovePrompt}
              disabled={!input.trim() || isImproving || !connected || !hasModel || streaming}
              title="Improve prompt — rewrite your message to be clearer and more effective"
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-accent-500 hover:text-accent-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isImproving
                ? <Loader2 size={12} className="animate-spin" />
                : <Wand2 size={12} />}
              Improve
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !config.serverUrl
                  ? 'Configure a server to start chatting…'
                  : !connected
                    ? 'Connect to a server to start chatting…'
                    : !hasModel
                      ? 'Select a model to start chatting…'
                      : selectedNotes.size > 0
                        ? `Ask about your ${selectedNotes.size} selected note${selectedNotes.size !== 1 ? 's' : ''}… (Enter to send)`
                        : 'Ask anything… (Enter to send, Shift+Enter for new line)'
              }
              disabled={!connected || !hasModel}
              rows={1}
              className="flex-1 resize-none text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            />

            {streaming ? (
              <button
                onClick={abortStream}
                title="Stop generation"
                className="flex-shrink-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !connected || !hasModel}
                title="Send message"
                className="flex-shrink-0 p-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-right">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
