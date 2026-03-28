import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Mic, MicOff, Copy, BookOpen, Trash2, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react'
import { useAiStore } from '../../stores/aiStore'
import { useVaultStore } from '../../stores/vaultStore'

const SERVER = `http://${window.location.hostname}:3001`

const SUPPORTED_FORMATS = [
  'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav',
  'audio/wave', 'audio/webm', 'audio/ogg', 'audio/flac', 'audio/aac',
  'audio/x-m4a',
]

const LANGUAGES = [
  { code: '', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'nb', label: 'Norwegian' },
]

type RecordingState = 'idle' | 'recording' | 'paused'

export default function AudioToTextView() {
  const { config, models, modelsLoading, fetchModels } = useAiStore()
  const { saveNote } = useVaultStore()

  // File upload state
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Options
  const [language, setLanguage] = useState('')
  const [model, setModel] = useState('whisper-1')

  // Results
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFile = (f: File) => {
    if (!SUPPORTED_FORMATS.includes(f.type) && !f.name.match(/\.(mp3|mp4|m4a|wav|webm|ogg|flac|aac|oga)$/i)) {
      setError(`Unsupported file type: ${f.type || 'unknown'}. Use MP3, MP4, M4A, WAV, WebM, OGG, or FLAC.`)
      return
    }
    setFile(f)
    setError(null)
    setTranscript('')
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // ── Microphone recording ─────────────────────────────────────────────────────

  const startRecording = async () => {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access denied. Please allow microphone access in your browser.')
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

    const mr = new MediaRecorder(stream, { mimeType })
    recordedChunksRef.current = []
    mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(recordedChunksRef.current, { type: mimeType })
      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
      const recorded = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType })
      setFile(recorded)
      setTranscript('')
    }
    mr.start(250)
    mediaRecorderRef.current = mr
    setRecordingState('recording')
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecordingState('idle')
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Transcription ────────────────────────────────────────────────────────────

  const transcribe = useCallback(async () => {
    if (!file) return
    if (!config.serverUrl) {
      setError('No AI server configured. Set up your server URL in AI Chat settings first.')
      return
    }

    setTranscribing(true)
    setError(null)
    setTranscript('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('serverUrl', config.serverUrl)
    if (config.apiKey) formData.append('apiKey', config.apiKey)
    formData.append('model', model)
    if (language) formData.append('language', language)

    try {
      const res = await fetch(`${SERVER}/ai/transcribe`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setTranscript(data.text || '')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTranscribing(false)
    }
  }, [file, config, model, language])

  // ── Output actions ───────────────────────────────────────────────────────────

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveToVault = async () => {
    const name = file ? file.name.replace(/\.[^.]+$/, '') : `transcript-${Date.now()}`
    const date = new Date().toISOString().slice(0, 10)
    const content = `# ${name}\n\n**Date:** ${date}  \n**Source:** ${file?.name ?? 'microphone'}\n\n---\n\n${transcript}\n`
    await saveNote(`${name}.md`, content)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Auto-fetch models when the server is configured and we don't have any yet
  useEffect(() => {
    if (config.serverUrl && models.length === 0) {
      fetchModels()
    }
  }, [config.serverUrl])

  const hasConfig = !!config.serverUrl

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
        <div className="flex items-center gap-3">
          <Mic size={18} className="text-accent-500" />
          <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">Audio to Text</h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">Whisper transcription</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Config warning */}
        {!hasConfig && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              No AI server configured. Go to <strong>AI Chat</strong> and add a server that supports the
              OpenAI-compatible <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">/v1/audio/transcriptions</code> endpoint
              (e.g. OpenAI, LocalAI, or a self-hosted Whisper server).
            </span>
          </div>
        )}

        {/* Two columns: upload + options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Left: file input + mic */}
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Source</h2>

            {/* Drag-drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors p-8 text-center
                ${dragOver
                  ? 'border-accent-400 bg-accent-50 dark:bg-accent-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-accent-400 hover:bg-gray-50 dark:hover:bg-surface-800'
                }`}
            >
              <Upload size={28} className="text-gray-400 dark:text-gray-500" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {file ? (
                  <span className="font-medium text-accent-600 dark:text-accent-400">{file.name}</span>
                ) : (
                  <>
                    <span className="font-medium text-gray-800 dark:text-gray-200">Click to select</span>
                    {' '}or drag & drop an audio file
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">MP3, MP4, M4A, WAV, WebM, OGG, FLAC · Max ~25 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac,.aac"
                onChange={onFileInput}
                className="hidden"
              />
            </div>

            {/* File info */}
            {file && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-surface-800 text-xs text-gray-500 dark:text-gray-400">
                <CheckCircle size={13} className="text-green-500 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 ml-auto">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setTranscript(''); setError(null) }}
                  className="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-surface-700 text-gray-400 hover:text-red-500"
                  title="Remove file"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}

            {/* Microphone */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400">or record</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <div className="flex items-center gap-3">
              {recordingState === 'idle' ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                >
                  <Mic size={14} />
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                  >
                    <MicOff size={14} />
                    Stop
                  </button>
                  <span className="flex items-center gap-1.5 text-sm text-red-500 animate-pulse font-mono">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    {formatTime(recordingTime)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: options */}
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Options</h2>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Model</label>
                  <button
                    onClick={() => fetchModels()}
                    disabled={!hasConfig || modelsLoading}
                    title="Refresh model list"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent-500 disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw size={11} className={modelsLoading ? 'animate-spin' : ''} />
                    {modelsLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
                {models.length > 0 ? (
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-accent-400"
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name || m.id}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="whisper-1"
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-accent-400"
                  />
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {models.length > 0
                    ? `${models.length} model${models.length !== 1 ? 's' : ''} loaded from your AI server.`
                    : 'No models loaded — enter a model name manually (e.g. whisper-1).'}
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-accent-400"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">Hint the source language to improve accuracy (optional).</p>
              </div>

              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
                <p><strong className="text-gray-700 dark:text-gray-300">AI Server:</strong> {config.serverUrl || <span className="text-amber-500">not configured</span>}</p>
                <p>Audio is sent to <code className="bg-gray-200 dark:bg-surface-700 px-0.5 rounded">/v1/audio/transcriptions</code> on your server.</p>
                <p className="text-amber-600 dark:text-amber-400">Requires a Whisper-compatible server (OpenAI, LocalAI, Faster-Whisper). OpenWebUI and Ollama do not support audio transcription.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transcribe button */}
        <div className="flex items-center gap-3">
          <button
            onClick={transcribe}
            disabled={!file || transcribing || !hasConfig}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {transcribing
              ? <><Loader size={14} className="animate-spin" /> Transcribing…</>
              : <><Mic size={14} /> Transcribe</>
            }
          </button>
          {transcribing && (
            <span className="text-xs text-gray-400 animate-pulse">This may take a moment for large files…</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Transcript output */}
        {transcript && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Transcript</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyTranscript}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-surface-800 hover:bg-gray-200 dark:hover:bg-surface-700 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  {copied ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={saveToVault}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-surface-800 hover:bg-gray-200 dark:hover:bg-surface-700 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  {saved ? <CheckCircle size={12} className="text-green-500" /> : <BookOpen size={12} />}
                  {saved ? 'Saved' : 'Save to Vault'}
                </button>
              </div>
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-800 text-sm text-gray-800 dark:text-gray-200 font-sans leading-relaxed resize-y focus:outline-none focus:border-accent-400"
            />
            <p className="text-xs text-gray-400">{transcript.split(/\s+/).filter(Boolean).length} words · {transcript.length} characters · Click the text to edit before saving.</p>
          </div>
        )}
      </div>
    </div>
  )
}
