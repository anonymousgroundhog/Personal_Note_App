import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Mic, MicOff, Square, Play, Pause, Clock, FileText,
  CheckCircle2, AlertCircle, Loader2, Users, RotateCcw,
} from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { useMeetingStore } from '../../stores/meetingStore'
import { getFileHandle, writeBinaryFile } from '../../lib/fs/fileSystemApi'

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'meeting'
}

function nowIso() {
  return new Date().toISOString()
}

function formatDateForFrontmatter(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

// ── Types ──────────────────────────────────────────────────────────────────────

type RecordState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped'
type SaveState   = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MeetingNoteModal({ onClose }: Props) {
  const { rootHandle, fallbackMode, createNote, saveNote, refreshIndex } = useVaultStore()
  const { setActiveView, openTab } = useUiStore()
  const { draft, setTitle, setAttendees, setAgenda, setBodyNotes, clearDraft } = useMeetingStore()

  const vaultOpen = !!(rootHandle || fallbackMode)
  const fsApiAvailable = !!rootHandle  // binary file write requires FileSystem Access API

  // ── Form state ──────────────────────────────────────────────────────────────
  const { title, attendees, agenda, bodyNotes } = draft

  // ── Audio state ─────────────────────────────────────────────────────────────
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)           // total recorded seconds
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]   = useState<string | null>(null)
  const [micError, setMicError]   = useState('')
  const [audioMimeType, setAudioMimeType] = useState('audio/webm')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<BlobEvent['data'][]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef     = useRef<number>(0)    // epoch ms when last started/resumed
  const accruedRef       = useRef<number>(0)    // seconds accrued before last pause

  // ── Save state ──────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const [savedPath, setSavedPath] = useState('')

  // ── Timer ───────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(accruedRef.current + delta)
    }, 500)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    accruedRef.current = elapsed
  }, [elapsed])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Close on Escape ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Recording controls ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setMicError('')
    setRecordState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : ''
      setAudioMimeType(mimeType || 'audio/webm')

      chunksRef.current = []
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mr

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      mr.start(1000)  // collect data every 1s
      accruedRef.current = 0
      setElapsed(0)
      startTimer()
      setRecordState('recording')
    } catch (e) {
      setMicError(e instanceof Error ? e.message : 'Microphone access denied')
      setRecordState('idle')
    }
  }, [startTimer])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      stopTimer()
      setRecordState('paused')
    }
  }, [stopTimer])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      startTimer()
      setRecordState('recording')
    }
  }, [startTimer])

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
    setRecordState('stopped')
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!vaultOpen || !title.trim()) return
    setSaveState('saving')
    setSaveError('')

    const now = new Date()
    const slug = slugify(title)
    const dateStr = formatDateForFrontmatter(now)
    const folder = `Meetings`
    const notePath = `${folder}/${slug}.md`

    try {
      // If there's audio and the FS API is available, save the audio file
      let audioFileName = ''
      let audioEmbedLine = ''

      if (audioBlob && fsApiAvailable && rootHandle) {
        const ext = audioMimeType.includes('ogg') ? 'ogg' : 'webm'
        audioFileName = `${slug}-recording.${ext}`
        const audioPath = `${folder}/${audioFileName}`
        const audioHandle = await getFileHandle(rootHandle, audioPath, true)
        await writeBinaryFile(audioHandle, audioBlob)
        audioEmbedLine = `\n## Recording\n\n![Meeting Recording](${audioFileName})\n`
      }

      // Build the markdown note
      const attendeeList = attendees
        .split(/[\n,]+/)
        .map(a => a.trim())
        .filter(Boolean)
        .map(a => `  - ${a}`)
        .join('\n')

      const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${dateStr}"
tags:
  - meeting
  - notes
${attendeeList ? `attendees:\n${attendeeList}` : ''}
---

# ${title}

**Date:** ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
**Time:** ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
${attendees.trim() ? `**Attendees:** ${attendees.split(/[\n,]+/).map(a => a.trim()).filter(Boolean).join(', ')}  ` : ''}
${audioFileName ? `**Recording:** [${audioFileName}](${audioFileName})  ` : ''}
${audioBlob ? `**Duration:** ${formatDuration(elapsed)}  ` : ''}

---
${agenda.trim() ? `\n## Agenda\n\n${agenda.trim()}\n` : ''}
## Notes

${bodyNotes.trim() || '_Notes captured during meeting._'}
${audioEmbedLine}
## Action Items

- [ ]

---

*Generated by Meeting Quick Capture — ${nowIso()}*
`

      await createNote(notePath, markdown)
      await refreshIndex()
      setSavedPath(notePath)
      setSaveState('saved')
      clearDraft()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveState('error')
    }
  }, [vaultOpen, title, attendees, agenda, bodyNotes, audioBlob, audioMimeType, elapsed, fsApiAvailable, rootHandle, createNote, refreshIndex, clearDraft])

  const openNote = useCallback(() => {
    if (!savedPath) return
    openTab(savedPath)
    setActiveView('notes')
    onClose()
  }, [savedPath, openTab, setActiveView, onClose])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isRecording = recordState === 'recording'
  const isPaused    = recordState === 'paused'
  const isStopped   = recordState === 'stopped'
  const hasAudio    = !!audioBlob
  const canSave     = vaultOpen && title.trim() && saveState !== 'saving' && saveState !== 'saved'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
            <FileText size={16} className="text-accent-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quick Meeting Capture</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Saved to <code className="bg-gray-100 dark:bg-surface-700 px-1 rounded">Meetings/</code> in your vault</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* No vault warning */}
          {!vaultOpen && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm">
              <AlertCircle size={14} className="shrink-0" />
              Open a vault first — notes will be saved there.
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
              Meeting Title <span className="text-red-400">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Weekly Standup, Client Review…"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-400"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
              <Users size={11} /> Attendees <span className="font-normal normal-case tracking-normal">(comma or newline separated)</span>
            </label>
            <input
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="Alice, Bob, Carol…"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-400"
            />
          </div>

          {/* Agenda */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
              Agenda
            </label>
            <textarea
              value={agenda}
              onChange={e => setAgenda(e.target.value)}
              placeholder="Topics to cover…"
              rows={2}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-400 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              value={bodyNotes}
              onChange={e => setBodyNotes(e.target.value)}
              placeholder="Key points, decisions, context…"
              rows={4}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-400 resize-y"
            />
          </div>

          {/* ── Audio recording ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-surface-700 flex items-center gap-2">
              <Mic size={14} className="text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Audio Recording</span>
              {(isRecording || isPaused) && (
                <span className="ml-auto flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
                  <Clock size={12} className={isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
                  {formatDuration(elapsed)}
                </span>
              )}
              {isStopped && elapsed > 0 && (
                <span className="ml-auto font-mono text-xs text-gray-500 dark:text-gray-400">
                  {formatDuration(elapsed)} recorded
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              {micError && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  <AlertCircle size={12} className="shrink-0" /> {micError}
                </div>
              )}

              {!fsApiAvailable && recordState !== 'idle' && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs">
                  <AlertCircle size={12} className="shrink-0" />
                  Audio file embedding requires the File System Access API (Chrome/Edge). Recording will play back in-browser only.
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {recordState === 'idle' && (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
                  >
                    <Mic size={13} /> Start Recording
                  </button>
                )}

                {recordState === 'requesting' && (
                  <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-300 dark:bg-surface-600 text-gray-500 cursor-not-allowed">
                    <Loader2 size={13} className="animate-spin" /> Requesting mic…
                  </button>
                )}

                {isRecording && (
                  <>
                    <button
                      onClick={pauseRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                    >
                      <Pause size={13} /> Pause
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                    >
                      <Square size={13} fill="currentColor" /> Stop
                    </button>
                  </>
                )}

                {isPaused && (
                  <>
                    <button
                      onClick={resumeRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
                    >
                      <Play size={13} fill="currentColor" /> Resume
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                    >
                      <Square size={13} fill="currentColor" /> Stop
                    </button>
                  </>
                )}

                {/* Recording indicator */}
                {isRecording && (
                  <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Recording…
                  </span>
                )}
              </div>

              {/* Playback */}
              {hasAudio && audioUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Preview recording:</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={audioUrl} className="w-full h-10" style={{ colorScheme: 'light' }} />
                  {!fsApiAvailable && (
                    <p className="text-[10px] text-gray-400">
                      Audio recorded — will not be embedded in the note (requires File System Access API).
                    </p>
                  )}
                  {fsApiAvailable && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Will be saved alongside the note and embedded.
                    </p>
                  )}
                </div>
              )}

              {recordState === 'idle' && !hasAudio && (
                <p className="text-xs text-gray-400">
                  Optional — start a recording to capture audio alongside your notes.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex items-center gap-3">

          {saveState === 'saved' ? (
            <>
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Saved!</span>
              <button
                onClick={openNote}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition-colors"
              >
                <FileText size={14} /> Open Note
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              {saveState === 'error' && (
                <span className="text-xs text-red-500 flex items-center gap-1 truncate">
                  <AlertCircle size={12} /> {saveError}
                </span>
              )}
              <button
                onClick={() => {
                  if (confirm('Clear all draft data? This cannot be undone.')) {
                    clearDraft()
                  }
                }}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
                title="Clear draft"
              >
                <RotateCcw size={16} />
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveState === 'saving'
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : <><FileText size={14} /> Save Note{hasAudio && fsApiAvailable ? ' + Audio' : ''}</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
