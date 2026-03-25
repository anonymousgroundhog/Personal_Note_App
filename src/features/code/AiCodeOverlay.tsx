import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Bot, Send, Square, Loader2, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, ShieldAlert,
} from 'lucide-react'
import { useAiStore } from '../../stores/aiStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  /** The current file's code — passed as context */
  code: string
  language: string
  fileName: string
  onClose: () => void
  /** Lifted state so history survives overlay close/reopen */
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}

// ── Guardrail system prompt ────────────────────────────────────────────────────
// This prompt is always injected and cannot be overridden by student input.

function buildSystemPrompt(language: string, fileName: string): string {
  return `You are a coding tutor helping students learn ${language} programming. The student is working on a file called "${fileName}".

STRICT GUARDRAILS — you must follow these at all times, no exceptions:
1. NEVER provide complete, working, copy-paste-ready solutions. Do not write full functions, full classes, or complete fixes for the student.
2. NEVER fix bugs directly. Instead, describe what kind of bug it is (logic error, off-by-one, wrong method, etc.) and ask guiding questions.
3. Guide with questions, hints, analogies, and small illustrative snippets (max 3-4 lines) that demonstrate a concept — never the student's own code solved.
4. When explaining a concept, use a different simple example, not the student's actual code.
5. If a student explicitly asks you to "write the code", "give me the answer", or "just fix it", firmly but kindly decline and redirect them to think through the problem step by step.
6. Encourage the student to reason out loud. Ask "What do you think this line does?", "What would happen if…?", "Have you tried adding a print statement to see the value of X?"
7. Celebrate progress and effort. Be warm, supportive, and patient.
8. You may explain language concepts, syntax, standard library functions, and best practices freely — just never apply them directly to solve the student's assignment.

Your role is to build the student's understanding, not to do their work for them.`
}

// ── Small markdown renderer (same pattern as AiView) ──────────────────────────

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-sm leading-relaxed space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const nl = part.indexOf('\n')
          const lang = nl > 3 ? part.slice(3, nl).trim() : ''
          const code = part.slice(nl + 1, -3)
          return (
            <pre key={i} className="bg-[#2d2d2d] rounded p-3 text-xs overflow-x-auto font-mono text-[#d4d4d4]">
              {lang && <span className="text-[#569cd6] block mb-1 text-[10px] uppercase">{lang}</span>}
              {code}
            </pre>
          )
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, j) => {
              if (seg.startsWith('**') && seg.endsWith('**'))
                return <strong key={j} className="text-white">{seg.slice(2, -2)}</strong>
              if (seg.startsWith('`') && seg.endsWith('`'))
                return <code key={j} className="bg-[#2d2d2d] px-1 py-0.5 rounded text-xs font-mono text-[#ce9178]">{seg.slice(1, -1)}</code>
              return seg
            })}
          </span>
        )
      })}
    </div>
  )
}

// ── Connection panel (self-contained, same logic as AiView's ConnectionPanel) ──

function ConnectionPanel() {
  const { config, setConfig, fetchModels, models, modelsLoading, modelsError } = useAiStore()
  const [url, setUrl] = useState(config.serverUrl)
  const [key, setKey] = useState(config.apiKey)

  const handleConnect = () => {
    setConfig({ serverUrl: url.trim(), apiKey: key.trim(), selectedModel: '' })
    fetchModels()
  }

  const isConnected = models.length > 0 && !modelsError

  return (
    <div className="p-4 space-y-3 border-b border-[#3c3c3c]" style={{ background: '#252526' }}>
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle size={13} className="text-[#f14c4c]" />
        <span className="text-xs font-semibold text-[#cccccc]">Connect to an AI server to use the tutor</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-medium text-[#858585] block mb-1">Server URL</label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="http://your-server:8080"
            className="w-full text-xs border border-[#454545] rounded px-2 py-1.5 bg-[#1e1e1e] text-[#cccccc] outline-none focus:border-[#007acc]"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-[#858585] block mb-1">API Key <span className="font-normal">(optional)</span></label>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-… or leave blank"
            className="w-full text-xs border border-[#454545] rounded px-2 py-1.5 bg-[#1e1e1e] text-[#cccccc] outline-none focus:border-[#007acc]"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleConnect}
          disabled={modelsLoading || !url.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-60"
          style={{ background: '#007acc' }}
        >
          {modelsLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {modelsLoading ? 'Connecting…' : 'Connect'}
        </button>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-[#4ec94e] font-medium">
            <CheckCircle2 size={12} /> {models.length} model{models.length !== 1 ? 's' : ''} available
          </span>
        )}
        {modelsError && (
          <span className="flex items-center gap-1 text-xs text-[#f14c4c]">
            <AlertCircle size={12} /> {modelsError}
          </span>
        )}
      </div>
      {models.length > 0 && (
        <div>
          <label className="text-[10px] font-medium text-[#858585] block mb-1">Active Model</label>
          <select
            value={config.selectedModel}
            onChange={e => setConfig({ selectedModel: e.target.value })}
            className="text-xs border border-[#454545] rounded px-2 py-1.5 bg-[#1e1e1e] text-[#cccccc] outline-none focus:border-[#007acc] max-w-xs"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Main overlay ───────────────────────────────────────────────────────────────

const AI_PROXY = `http://${window.location.hostname}:3001`

export default function AiCodeOverlay({ code, language, fileName, onClose, messages, setMessages }: Props) {
  const { config, models } = useAiStore()

  const connected = !!config.serverUrl && models.length > 0
  const hasModel = !!config.selectedModel
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showConnection, setShowConnection] = useState(!connected)
  const [includeCode, setIncludeCode] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const accumulatedRef = useRef('')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  // Show connection panel when disconnected
  useEffect(() => {
    if (!connected) setShowConnection(true)
  }, [connected])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || !connected || !hasModel) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingContent('')

    const systemPrompt = buildSystemPrompt(language, fileName)

    // Build API messages
    const apiMessages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Optionally prepend the current code as context
    if (includeCode && code.trim()) {
      apiMessages.push({
        role: 'system',
        content: `The student's current code in ${fileName} (${language}):\n\`\`\`${language}\n${code}\n\`\`\`\n\nRemember the guardrails: guide and hint, never solve.`,
      })
    }

    // Prior conversation (last 20)
    const history = [...messages, userMsg].slice(-20)
    history.forEach(m => apiMessages.push({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()
    accumulatedRef.current = ''

    try {
      const res = await fetch(`${AI_PROXY}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          serverUrl: config.serverUrl,
          apiKey: config.apiKey,
          model: config.selectedModel,
          messages: apiMessages,
          stream: true,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Stream the response
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload)
            const delta = parsed?.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              accumulatedRef.current += delta
              setStreamingContent(accumulatedRef.current)
            }
          } catch { /* skip */ }
        }
      }

      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: accumulatedRef.current }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        if (accumulatedRef.current) {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: accumulatedRef.current }])
        }
      } else {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }])
      }
    } finally {
      setStreaming(false)
      setStreamingContent('')
      abortRef.current = null
    }
  }, [input, streaming, connected, hasModel, messages, code, language, fileName, includeCode, config])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const abort = () => abortRef.current?.abort()

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Side panel */}
      <div
        className="flex flex-col h-full w-full max-w-md shadow-2xl"
        style={{ background: '#1e1e1e', borderLeft: '1px solid #3c3c3c' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 shrink-0" style={{ height: 44, background: '#252526', borderBottom: '1px solid #3c3c3c' }}>
          <Bot size={16} className="text-[#569cd6]" />
          <span className="text-sm font-semibold text-[#cccccc]">AI Coding Tutor</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono text-[#cccccc]" style={{ background: '#3c3c3c' }}>
            {fileName}
          </span>

          {/* Guardrail badge */}
          <div
            className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: '#1e3a1e', color: '#4ec94e' }}
            title="Guardrails active: the AI will guide you without giving direct answers"
          >
            <ShieldAlert size={10} /> Guided mode
          </div>

          {/* Connection toggle */}
          <button
            onClick={() => setShowConnection(v => !v)}
            title="Connection settings"
            className="p-1 rounded text-[#858585] hover:text-white ml-1"
            style={{ background: showConnection ? '#094771' : undefined }}
          >
            {showConnection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Close */}
          <button onClick={onClose} className="p-1 rounded text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Connection panel */}
        {showConnection && <ConnectionPanel />}

        {/* Not connected notice */}
        {!connected && !showConnection && (
          <div
            className="flex items-center gap-2 px-4 py-2 text-xs text-[#f14c4c] shrink-0 cursor-pointer hover:bg-[#2a2d2e]"
            style={{ borderBottom: '1px solid #3c3c3c' }}
            onClick={() => setShowConnection(true)}
          >
            <AlertCircle size={12} /> Not connected — click to configure
          </div>
        )}

        {/* Code context toggle */}
        {connected && (
          <div
            className="flex items-center gap-2 px-4 py-1.5 shrink-0 text-[11px]"
            style={{ background: '#252526', borderBottom: '1px solid #3c3c3c' }}
          >
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#858585] hover:text-[#cccccc]">
              <input
                type="checkbox"
                checked={includeCode}
                onChange={e => setIncludeCode(e.target.checked)}
                className="accent-[#007acc]"
              />
              Share current code with tutor
            </label>
            {includeCode && code.trim() && (
              <span className="text-[#4ec94e]" style={{ marginLeft: 'auto' }}>
                ✓ {code.split('\n').length} lines shared
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#424242 transparent' }}>
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555]">
              <Bot size={40} className="opacity-30" />
              {!connected ? (
                <p className="text-xs text-center max-w-xs">
                  Connect to an AI server above to start chatting with your coding tutor.
                </p>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-xs text-[#858585]">Ask a question about your code or a concept.</p>
                  <div className="text-left space-y-1 mt-3">
                    {[
                      'Why is my loop not stopping?',
                      'What does this error mean?',
                      'How does recursion work?',
                      'What\'s wrong with my logic here?',
                    ].map(hint => (
                      <button
                        key={hint}
                        onClick={() => setInput(hint)}
                        className="block w-full text-left text-xs px-3 py-1.5 rounded hover:bg-[#2a2d2e] text-[#858585] hover:text-[#cccccc] transition-colors"
                        style={{ border: '1px solid #3c3c3c' }}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: '#094771' }}>
                  <Bot size={13} className="text-[#569cd6]" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'rounded-br-sm text-[#cccccc]'
                    : 'rounded-bl-sm text-[#cccccc]'
                }`}
                style={{ background: msg.role === 'user' ? '#094771' : '#252526' }}
              >
                {msg.role === 'assistant' ? <MessageContent content={msg.content} /> : msg.content}
              </div>
            </div>
          ))}

          {/* Streaming bubble */}
          {streaming && (
            <div className="flex gap-2 justify-start">
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: '#094771' }}>
                <Bot size={13} className="text-[#569cd6]" />
              </div>
              <div className="max-w-[85%] rounded-xl rounded-bl-sm px-3 py-2 text-sm text-[#cccccc]" style={{ background: '#252526' }}>
                {streamingContent
                  ? <MessageContent content={streamingContent} />
                  : <Loader2 size={14} className="animate-spin text-[#569cd6]" />}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid #3c3c3c', background: '#1e1e1e' }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !connected
                  ? 'Connect to a server first…'
                  : !hasModel
                    ? 'Select a model first…'
                    : 'Ask a question about your code… (Enter to send)'
              }
              disabled={!connected || !hasModel}
              rows={1}
              className="flex-1 resize-none text-sm rounded-xl px-3 py-2 outline-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#252526',
                border: '1px solid #3c3c3c',
                color: '#d4d4d4',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#007acc' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#3c3c3c' }}
            />
            {streaming ? (
              <button
                onClick={abort}
                title="Stop"
                className="shrink-0 p-2 rounded-xl text-white"
                style={{ background: '#f14c4c' }}
              >
                <Square size={15} />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !connected || !hasModel}
                title="Send"
                className="shrink-0 p-2 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#007acc' }}
              >
                <Send size={15} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px]" style={{ color: '#555' }}>
              Enter to send · Shift+Enter for new line · Esc to close
            </p>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] hover:text-[#cccccc] transition-colors"
                style={{ color: '#555' }}
              >
                Clear chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
