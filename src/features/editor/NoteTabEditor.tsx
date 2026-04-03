import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { Eye, Edit3, Plus, RefreshCw, Tag, Download, Trash2, Bot, Send, Square, Loader2, FileInput, X, AlertCircle, Mic, MicOff, Volume2, VolumeX, Headphones } from 'lucide-react'
import MarkdownEditor, { type MarkdownEditorHandle } from './MarkdownEditor'
import MarkdownPreview from './MarkdownPreview'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { useAiStore } from '../../stores/aiStore'
import { useSpeechInput, useTts } from '../../lib/hooks/useSpeech'
import { parseFrontmatter, buildProcessor } from '../../lib/markdown/processor'
import { exportNoteToPdf, saveToFileSystem } from '../../lib/pdf/export'

type EditorMode = 'edit' | 'preview' | 'split'

// ── Tiny markdown renderer (same as AiView) ──────────────────────────────────
function MsgContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-xs leading-relaxed space-y-1.5">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const nl = part.indexOf('\n')
          const lang = nl > 3 ? part.slice(3, nl).trim() : ''
          const code = part.slice(nl + 1, -3)
          return (
            <pre key={i} className="bg-gray-100 dark:bg-surface-700 rounded p-2 text-[11px] overflow-x-auto font-mono">
              {lang && <span className="text-accent-400 block mb-1 text-[10px] uppercase">{lang}</span>}
              {code}
            </pre>
          )
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, j) => {
              if (seg.startsWith('**') && seg.endsWith('**')) return <strong key={j}>{seg.slice(2, -2)}</strong>
              if (seg.startsWith('`') && seg.endsWith('`')) return <code key={j} className="bg-gray-100 dark:bg-surface-700 px-1 rounded text-[11px] font-mono">{seg.slice(1, -1)}</code>
              return seg
            })}
          </span>
        )
      })}
    </div>
  )
}

// ── Inline AI Panel ──────────────────────────────────────────────────────────
interface AiPanelProps {
  noteContent: string
  onAppendToNote: (text: string) => void
}

function AiPanel({ noteContent, onAppendToNote }: AiPanelProps) {
  const {
    config, models, streaming, streamingContent,
    messages, sendMessage, clearChat, abortStream,
  } = useAiStore()

  const [input, setInput] = useState('')
  const [useNoteCtx, setUseNoteCtx] = useState(true)
  const [interimTranscript, setInterimTranscript] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputBeforeSpeechRef = useRef('')

  const connected = !!(config.serverUrl && models.length > 0)
  const hasModel = !!config.selectedModel

  // Speech input
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setInput(prev => {
        const base = inputBeforeSpeechRef.current
        const combined = base ? base + ' ' + text : text
        inputBeforeSpeechRef.current = combined
        return combined
      })
      setInterimTranscript('')
    } else {
      setInterimTranscript(text)
    }
  }, [])

  const { listening, supported: speechSupported, start: startListening, stop: stopListening } = useSpeechInput(handleTranscript)
  const { speakingId, supported: ttsSupported, speak, stop: stopSpeaking } = useTts()

  const toggleMic = useCallback(() => {
    if (listening) {
      stopListening()
      setInterimTranscript('')
    } else {
      inputBeforeSpeechRef.current = input
      startListening()
    }
  }, [listening, input, startListening, stopListening])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
  }, [input])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || !connected || !hasModel) return
    if (listening) { stopListening(); setInterimTranscript('') }
    setInput('')
    inputBeforeSpeechRef.current = ''
    const context = useNoteCtx && noteContent.trim() ? noteContent : undefined
    await sendMessage(text, context)
  }, [input, streaming, connected, hasModel, listening, stopListening, useNoteCtx, noteContent, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const visibleMessages = messages.filter(m => m.role !== 'system')

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-surface-800 border-l border-gray-200 dark:border-gray-700">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Bot size={14} className="text-accent-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-1">AI Assistant</span>
        {config.selectedModel && (
          <span className="text-[10px] px-1.5 py-0.5 bg-accent-500/10 text-accent-500 rounded-full truncate max-w-[100px]">
            {models.find(m => m.id === config.selectedModel)?.name ?? config.selectedModel}
          </span>
        )}
        {speakingId && (
          <button onClick={stopSpeaking} title="Stop speaking"
            className="text-accent-500 hover:text-red-500 p-0.5 rounded animate-pulse">
            <VolumeX size={12} />
          </button>
        )}
        {visibleMessages.length > 0 && (
          <button onClick={clearChat} title="Clear chat"
            className="text-gray-400 hover:text-red-500 p-0.5 rounded">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Note context toggle */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useNoteCtx}
            onChange={e => setUseNoteCtx(e.target.checked)}
            className="accent-accent-500 w-3 h-3"
          />
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Include this note as context</span>
        </label>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {visibleMessages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 py-6">
            <Bot size={28} className="opacity-20" />
            {!config.serverUrl ? (
              <p className="text-[11px] text-center">No AI server configured.<br />Set one up in the <strong>AI Chat</strong> view.</p>
            ) : !connected ? (
              <p className="text-[11px] text-center flex items-center gap-1"><AlertCircle size={11} /> Not connected to AI server</p>
            ) : (
              <p className="text-[11px] text-center">Ask a question about your note,<br />or anything else.</p>
            )}
          </div>
        )}

        {visibleMessages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-full rounded-xl px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-accent-500 text-white text-xs'
                : 'bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
            }`}>
              {msg.role === 'user'
                ? <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                : <MsgContent content={msg.content} />
              }
            </div>
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-1 mt-1">
                {ttsSupported && (
                  <button
                    onClick={() => speak(msg.id, msg.content)}
                    title={speakingId === msg.id ? 'Stop speaking' : 'Read aloud'}
                    className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                      speakingId === msg.id
                        ? 'text-accent-500 bg-accent-500/10 animate-pulse'
                        : 'text-gray-400 hover:text-accent-500 hover:bg-accent-500/10'
                    }`}
                  >
                    {speakingId === msg.id ? <VolumeX size={10} /> : <Volume2 size={10} />}
                    {speakingId === msg.id ? 'Stop' : 'Speak'}
                  </button>
                )}
                <button
                  onClick={() => onAppendToNote('\n\n' + msg.content)}
                  title="Append to note"
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-accent-500 hover:bg-accent-500/10 rounded transition-colors"
                >
                  <FileInput size={10} />
                  Move to note
                </button>
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-full rounded-xl px-3 py-2 bg-white dark:bg-surface-700 border border-gray-200 dark:border-gray-600">
              {streamingContent
                ? <MsgContent content={streamingContent} />
                : <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={11} className="animate-spin" /> Thinking…</span>
              }
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-2">
        <div className="flex items-end gap-1.5">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                inputBeforeSpeechRef.current = e.target.value
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                listening ? 'Listening… speak now'
                : !config.serverUrl ? 'Configure AI server first…'
                : !connected ? 'Not connected…'
                : !hasModel ? 'Select a model…'
                : 'Ask about this note… (Enter to send)'
              }
              disabled={!connected || !hasModel}
              rows={1}
              className={`w-full resize-none text-xs border rounded-lg px-2.5 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 placeholder-gray-400 disabled:opacity-50 overflow-hidden transition-colors ${
                listening ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400/30' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {listening && interimTranscript && (
              <p className="absolute bottom-full mb-1 left-0 right-0 text-[10px] text-gray-400 italic px-1 truncate pointer-events-none">
                {interimTranscript}
              </p>
            )}
          </div>

          {speechSupported && (
            <button
              onClick={toggleMic}
              title={listening ? 'Stop listening' : 'Speak your message'}
              className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                listening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-500 hover:border-red-400 hover:text-red-500'
              }`}
            >
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          )}

          {streaming ? (
            <button onClick={abortStream}
              className="flex-shrink-0 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              title="Stop">
              <Square size={13} />
            </button>
          ) : (
            <button onClick={handleSend}
              disabled={!input.trim() || !connected || !hasModel}
              className="flex-shrink-0 p-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg disabled:opacity-40"
              title="Send">
              <Send size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  path: string
  isActive: boolean
}

export default function NoteTabEditor({ path, isActive }: Props) {
  const { readNote, saveNote, refreshIndex, deleteNote, index, saveAttachment } = useVaultStore()
  const { closeTab } = useUiStore()
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<EditorMode>('split')
  const [dirty, setDirty] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [tagSuggestionIdx, setTagSuggestionIdx] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const editorRef = useRef<MarkdownEditorHandle>(null)

  // Dictation — inserts speech directly at editor cursor position
  const [dictationInterim, setDictationInterim] = useState('')
  const handleDictationTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      editorRef.current?.insertAtCursor(text)
      setDictationInterim('')
    } else {
      setDictationInterim(text)
    }
  }, [])
  const { listening: dictating, supported: dictationSupported, start: startDictation, stop: stopDictation } = useSpeechInput(handleDictationTranscript)
  const toggleDictation = useCallback(() => {
    if (dictating) { stopDictation(); setDictationInterim('') }
    else startDictation()
  }, [dictating, startDictation, stopDictation])

  // Attachment helpers — save file, then insert markdown link at cursor
  const isEditMode = mode === 'edit' || mode === 'split'
  const insertAttachment = useCallback(async (file: File) => {
    const relPath = await saveAttachment(file)
    if (!relPath) return
    const isImage = file.type.startsWith('image/')
    const md = isImage ? `![${file.name}](${relPath})` : `[${file.name}](${relPath})`
    editorRef.current?.insertOnNewLine(md)
  }, [saveAttachment])

  const handleEditorDrop = useCallback((e: React.DragEvent) => {
    if (!isEditMode) return
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => insertAttachment(f))
  }, [isEditMode, insertAttachment])

  // Paste images from clipboard
  useEffect(() => {
    if (!isActive || (mode !== 'edit' && mode !== 'split')) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            insertAttachment(file)
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isActive, mode, insertAttachment])

  useEffect(() => {
    if (!isActive) return
    readNote(path).then(text => {
      setContent(text)
      setDirty(false)
    })
  }, [path, isActive, readNote])

  const handleChange = useCallback((value: string) => {
    setContent(value)
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await saveNote(path, value)
      setDirty(false)
    }, 800)
  }, [path, saveNote])

  const handleAddTag = useCallback(async (override?: string) => {
    const value = (override ?? tagInput).trim()
    if (!value) return
    const { frontmatter, body } = parseFrontmatter(content)
    const tags = (frontmatter.tags as string[] || [])
    if (!tags.includes(value)) {
      tags.push(value)
    }
    const newFrontmatter = { ...frontmatter, tags }
    const yaml = Object.entries(newFrontmatter).map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
      }
      return `${k}: ${v}`
    }).join('\n')
    const newContent = `---\n${yaml}\n---\n\n${body}`
    handleChange(newContent)
    setTagInput('')
    setShowTagSuggestions(false)
    setTagSuggestionIdx(0)
  }, [tagInput, content, handleChange])

  const handleRemoveTag = useCallback(async (tagToRemove: string) => {
    const { frontmatter, body } = parseFrontmatter(content)
    const tags = ((frontmatter.tags as string[] || [])).filter(t => t !== tagToRemove)
    const newFrontmatter = { ...frontmatter, tags }
    const yaml = Object.entries(newFrontmatter).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
      return `${k}: ${v}`
    }).join('\n')
    handleChange(`---\n${yaml}\n---\n\n${body}`)
  }, [content, handleChange])

  const handleExportPdf = useCallback(async () => {
    if (!content) return
    setIsExporting(true)
    try {
      const noteName = path.split('/').pop()?.replace(/\.md$/, '') || 'note'

      const tempContainer = document.createElement('div')
      tempContainer.style.display = 'none'
      document.body.appendChild(tempContainer)

      try {
        const root = ReactDOM.createRoot(tempContainer)
        root.render(<MarkdownPreview content={content} />)
        await new Promise(resolve => setTimeout(resolve, 100))
        const htmlContent = tempContainer.innerHTML
        await exportNoteToPdf(noteName, htmlContent, saveToFileSystem)
        root.unmount()
      } finally {
        document.body.removeChild(tempContainer)
      }
    } catch (error) {
      console.error('Failed to export PDF:', error)
      alert('Failed to export PDF. ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }, [path, content])

  const handleDelete = useCallback(async () => {
    const noteName = path.split('/').pop()?.replace(/\.md$/, '') || 'note'
    if (!confirm(`Are you sure you want to delete "${noteName}"? This cannot be undone.`)) {
      return
    }
    try {
      await deleteNote(path)
      await refreshIndex()
      closeTab(path)
    } catch (error) {
      console.error('Failed to delete note:', error)
      alert('Failed to delete note. ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }, [path, deleteNote, refreshIndex, closeTab])

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showTagSuggestions || filteredTagSuggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); handleAddTag() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTagSuggestionIdx(i => Math.min(i + 1, filteredTagSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setTagSuggestionIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      handleAddTag(filteredTagSuggestions[tagSuggestionIdx])
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false)
    }
  }

  const allVaultTags = useMemo(() => {
    const freq = new Map<string, number>()
    for (const note of index.values()) {
      const t = note.frontmatter?.tags as string[] | undefined
      if (Array.isArray(t)) t.forEach(tag => freq.set(tag, (freq.get(tag) ?? 0) + 1))
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  }, [index])

  const filteredTagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase()
    if (!q) return allVaultTags.slice(0, 8)
    return allVaultTags.filter(t => t.toLowerCase().includes(q) && t.toLowerCase() !== q).slice(0, 8)
  }, [allVaultTags, tagInput])

  const handleAppendToNote = useCallback((text: string) => {
    handleChange(content + text)
  }, [content, handleChange])

  // Note TTS — reads the note body aloud
  const { speakingId: noteSpeakingId, supported: noteTtsSupported, speak: speakNote, stop: stopNoteReading } = useTts()
  const handleReadNote = useCallback(() => {
    const { body } = parseFrontmatter(content)
    speakNote('note-' + path, body)
  }, [content, path, speakNote])
  const isReadingNote = noteSpeakingId === 'note-' + path

  const { frontmatter } = parseFrontmatter(content)
  const tags = (frontmatter.tags as string[] || [])

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isActive ? '' : 'hidden'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
          {path.split('/').pop()?.replace(/\.md$/, '')}
          {dirty && <span className="ml-2 text-xs text-gray-400">●</span>}
        </span>
        <div className="flex items-center gap-1">
          {/* AI Panel */}
          <button
            onClick={() => setShowAiPanel(p => !p)}
            className={`p-1.5 rounded text-sm ${showAiPanel ? 'bg-accent-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title="AI Assistant"
          >
            <Bot size={15} />
          </button>
          {/* Read note aloud */}
          {noteTtsSupported && (
            <button
              onClick={isReadingNote ? stopNoteReading : handleReadNote}
              className={`p-1.5 rounded text-sm transition-colors ${
                isReadingNote
                  ? 'bg-accent-500/10 text-accent-500 animate-pulse'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title={isReadingNote ? 'Stop reading' : 'Read note aloud'}
            >
              {isReadingNote ? <VolumeX size={15} /> : <Headphones size={15} />}
            </button>
          )}
          {/* Dictation */}
          {dictationSupported && (
            <button
              onClick={toggleDictation}
              title={dictating ? 'Stop dictating' : 'Dictate into note at cursor'}
              className={`p-1.5 rounded text-sm transition-colors ${
                dictating
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {dictating ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
          {/* Tags */}
          <button
            onClick={() => setShowTagPanel(p => !p)}
            className={`p-1.5 rounded text-sm ${showTagPanel ? 'bg-accent-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title="Tags"
          >
            <Tag size={15} />
          </button>
          {/* Mode buttons */}
          {(['edit', 'split', 'preview'] as EditorMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 rounded text-xs ${mode === m ? 'bg-accent-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            >
              {m === 'edit' ? <Edit3 size={14} /> : m === 'preview' ? <Eye size={14} /> : <span className="font-mono text-xs">⊞</span>}
            </button>
          ))}
          <button
            onClick={() => { refreshIndex(); readNote(path).then(setContent) }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export as PDF"
          >
            <Download size={15} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 transition-colors"
            title="Delete note"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Tag panel */}
      {showTagPanel && (
        <div className="px-4 py-1.5 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-accent-500/10 text-accent-500 rounded-full text-xs group">
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:bg-accent-500/20 rounded-full p-0.5 opacity-60 hover:opacity-100"
                  title={`Remove #${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <div className="relative">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value)
                  setShowTagSuggestions(true)
                  setTagSuggestionIdx(0)
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag…"
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-32"
              />
              {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-0.5 bg-white dark:bg-surface-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 min-w-36 py-0.5">
                  {filteredTagSuggestions.map((tag, i) => (
                    <button
                      key={tag}
                      onMouseDown={e => { e.preventDefault(); handleAddTag(tag) }}
                      className={`w-full text-left px-3 py-1 text-xs flex items-center gap-1.5 ${
                        i === tagSuggestionIdx
                          ? 'bg-accent-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600'
                      }`}
                    >
                      <Tag size={9} />
                      {tag}
                    </button>
                  ))}
                  {tagInput.trim() && !allVaultTags.some(t => t.toLowerCase() === tagInput.trim().toLowerCase()) && (
                    <button
                      onMouseDown={e => { e.preventDefault(); handleAddTag() }}
                      className="w-full text-left px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-600 border-t border-gray-100 dark:border-gray-600 flex items-center gap-1.5"
                    >
                      <Plus size={9} />
                      Create "{tagInput.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor / Preview + AI Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor/Preview pane */}
        <div
          className={`flex flex-1 overflow-hidden ${showAiPanel ? 'w-0' : ''}`}
          onDrop={handleEditorDrop}
          onDragOver={e => { if (isEditMode) e.preventDefault() }}
        >
          {(mode === 'edit' || mode === 'split') && (
            <div className={`${mode === 'split' ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full'} flex flex-col overflow-hidden`}>
              {dictating && dictationInterim && (
                <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 italic truncate flex-shrink-0">
                  {dictationInterim}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor ref={editorRef} value={content} onChange={handleChange} />
              </div>
            </div>
          )}
          {(mode === 'preview' || mode === 'split') && (
            <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} overflow-hidden`}>
              <MarkdownPreview content={parseFrontmatter(content).body} />
            </div>
          )}
        </div>
        {/* AI Panel */}
        {showAiPanel && (
          <div className="w-80 flex-shrink-0 overflow-hidden">
            <AiPanel noteContent={content} onAppendToNote={handleAppendToNote} />
          </div>
        )}
      </div>

    </div>
  )
}
