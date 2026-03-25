import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Image as ImageIcon, FileText, Loader2, AlertCircle, Copy, Check, X, Volume2, VolumeX } from 'lucide-react'
import { useAiStore } from '../../stores/aiStore'
import { useTts } from '../../lib/hooks/useSpeech'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const AI_PROXY = `http://${window.location.hostname}:3001`

// ── Types ─────────────────────────────────────────────────────────────────────

type PdfPage = {
  id: string
  pageNum: number
  dataUrl: string       // rendered page screenshot
  description: string | null
  loading: boolean
  error: string | null
}

type FileItem = {
  id: string
  name: string
  type: 'image' | 'pdf'
  dataUrl: string
  pdfText?: string
  pdfPages?: PdfPage[]
  summary: string | null
  loading: boolean
  error: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const pageCount = Math.min(pdf.numPages, 30)
  const parts: string[] = []
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (pageText) parts.push(`[Page ${i}]\n${pageText}`)
  }
  return parts.join('\n\n')
}

/**
 * Render each page of the PDF to a canvas and return a data URL per page.
 * This captures everything visible: photos, vector figures, charts, diagrams,
 * captions — anything the PDF renderer would show.
 * Scale is chosen so the long edge is ≤ 1200 px (good quality, reasonable size).
 */
async function renderPdfPages(file: File): Promise<{ pageNum: number; dataUrl: string }[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const pageCount = Math.min(pdf.numPages, 20) // cap at 20 pages
  const results: { pageNum: number; dataUrl: string }[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })

    // Scale so the longest dimension is at most 900 px — keeps base64 payload small
    const maxDim = 900
    const scale = Math.min(maxDim / viewport.width, maxDim / viewport.height, 2)
    const scaled = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(scaled.width)
    canvas.height = Math.round(scaled.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    // White background (PDFs are transparent by default)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise

    // JPEG at 75% quality — good enough for AI vision, keeps payload under ~150KB/page
    results.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.75) })
  }

  return results
}

async function aiPost(
  config: { serverUrl: string; apiKey: string; selectedModel: string },
  messages: object[],
): Promise<string> {
  const res = await fetch(`${AI_PROXY}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      model: config.selectedModel,
      stream: false,
      messages,
    }),
  })
  if (!res.ok) {
    // Try to get the descriptive error from the proxy
    const errJson = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(errJson?.error ?? `HTTP ${res.status}`)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('No response from AI')
  return text
}

async function callAiDescribeImage(
  dataUrl: string,
  config: { serverUrl: string; apiKey: string; selectedModel: string },
  prompt?: string,
): Promise<string> {
  return aiPost(config, [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt ?? 'Please describe this image in detail. Include: what is shown, any text visible, colours, layout, and anything else that would be helpful for someone who cannot see it. Be thorough but clear.',
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ])
}

async function callAiSummarisePdf(
  pdfText: string,
  config: { serverUrl: string; apiKey: string; selectedModel: string },
): Promise<string> {
  return aiPost(config, [
    {
      role: 'system',
      content: 'You are an accessibility assistant. Summarise documents clearly and concisely so they are easy to understand for everyone.',
    },
    {
      role: 'user',
      content: `Please summarise the following PDF document. Include the main topics, key points, and any important details. Make it accessible and easy to understand.\n\n${pdfText.slice(0, 12000)}`,
    },
  ])
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccessibilityView() {
  const { config } = useAiStore()
  const [items, setItems] = useState<FileItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const { speakingId, supported: ttsSupported, speak, stop: stopSpeaking } = useTts()

  const aiReady = !!(config.serverUrl && config.selectedModel)

  const processFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isImage && !isPdf) return

    const id = crypto.randomUUID()
    const type: 'image' | 'pdf' = isImage ? 'image' : 'pdf'

    setItems(prev => [...prev, { id, name: file.name, type, dataUrl: '', summary: null, loading: true, error: null }])

    try {
      if (isImage) {
        const dataUrl = await readFileAsDataUrl(file)
        setItems(prev => prev.map(it => it.id === id ? { ...it, dataUrl } : it))

        if (!aiReady) {
          setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: 'No AI model configured. Go to AI Chat settings to set up a server.' } : it))
          return
        }

        const summary = await callAiDescribeImage(dataUrl, config)
        setItems(prev => prev.map(it => it.id === id ? { ...it, summary, loading: false } : it))

      } else {
        // PDF: render all pages + extract text in parallel
        const fileDataUrl = await readFileAsDataUrl(file)
        setItems(prev => prev.map(it => it.id === id ? { ...it, dataUrl: fileDataUrl } : it))

        const [pdfText, renderedPages] = await Promise.all([
          extractPdfText(file).catch(() => ''),
          renderPdfPages(file),
        ])

        // Build placeholder PdfPage entries — one per rendered page
        const pdfPages: PdfPage[] = renderedPages.map(({ pageNum, dataUrl: pageDataUrl }) => ({
          id: crypto.randomUUID(),
          pageNum,
          dataUrl: pageDataUrl,
          description: null,
          loading: aiReady,
          error: aiReady ? null : 'No AI model configured',
        }))

        setItems(prev => prev.map(it => it.id === id ? { ...it, pdfText, pdfPages, dataUrl: fileDataUrl } : it))

        if (!aiReady) {
          setItems(prev => prev.map(it => it.id === id ? {
            ...it,
            loading: false,
            error: 'No AI model configured. Go to AI Chat settings to set up a server.',
          } : it))
          return
        }

        const pagePrompt = 'Describe everything visible on this PDF page for an accessibility reader. Include: all text content, any figures, charts, diagrams or images and what they show, tables and their data, captions, headings, and layout. Be thorough.'

        // Mark top-level loading done — pages show their own individual loading state
        setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false } : it))

        // Text summary — non-fatal, pages proceed regardless
        if (pdfText) {
          try {
            const resolvedSummary = await callAiSummarisePdf(pdfText, config)
            setItems(prev => prev.map(it => it.id === id ? { ...it, summary: resolvedSummary } : it))
          } catch {
            // Summary failed — not shown, pages still proceed
          }
        }

        // Describe each page sequentially — results appear progressively
        for (const pg of pdfPages) {
          try {
            const description = await callAiDescribeImage(pg.dataUrl, config, pagePrompt)
            setItems(prev => prev.map(it => {
              if (it.id !== id) return it
              return {
                ...it,
                pdfPages: (it.pdfPages ?? []).map(p =>
                  p.id === pg.id ? { ...p, description, loading: false } : p
                ),
              }
            }))
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            setItems(prev => prev.map(it => {
              if (it.id !== id) return it
              return {
                ...it,
                pdfPages: (it.pdfPages ?? []).map(p =>
                  p.id === pg.id ? { ...p, loading: false, error } : p
                ),
              }
            }))
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: msg } : it))
    }
  }, [config, aiReady])

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(f => processFile(f))
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const clipItems = Array.from(e.clipboardData?.items ?? [])
    const files = clipItems
      .filter(it => it.kind === 'file' && (it.type.startsWith('image/') || it.type === 'application/pdf'))
      .map(it => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) handleFiles(files)
  }, [handleFiles])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const handleCopy = (copyId: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(copyId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const removeItem = (id: string) => {
    if (speakingId === id || speakingId?.startsWith(id + '-pg-')) stopSpeaking()
    setItems(prev => prev.filter(it => it.id !== id))
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function SpeakCopyBar({ ttsId, text, label }: { ttsId: string; text: string; label: string }) {
    return (
      <div className="flex items-center gap-1 ml-auto">
        {ttsSupported && (
          <button
            onClick={() => speak(ttsId, text)}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
              speakingId === ttsId
                ? 'bg-accent-500/10 text-accent-500 animate-pulse'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
            title={speakingId === ttsId ? 'Stop reading' : `Read ${label} aloud`}
          >
            {speakingId === ttsId ? <VolumeX size={12} /> : <Volume2 size={12} />}
            {speakingId === ttsId ? 'Stop' : 'Read'}
          </button>
        )}
        <button
          onClick={() => handleCopy(ttsId, text)}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          title="Copy to clipboard"
        >
          {copiedId === ttsId ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copiedId === ttsId ? 'Copied' : 'Copy'}
        </button>
      </div>
    )
  }

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Accessibility</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Drop or paste an image or PDF — AI will describe every page including figures, charts and diagrams
          </p>
        </div>
        {!aiReady && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle size={13} />
            Configure an AI model in AI Chat settings to enable summaries
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors p-10 mb-6 cursor-pointer ${
            dragging
              ? 'border-accent-500 bg-accent-500/5'
              : 'border-gray-300 dark:border-gray-600 hover:border-accent-400 dark:hover:border-accent-500 bg-gray-50 dark:bg-surface-800'
          }`}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*,.pdf'
            input.multiple = true
            input.onchange = () => { if (input.files) handleFiles(input.files) }
            input.click()
          }}
        >
          <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
            <ImageIcon size={28} />
            <Upload size={22} />
            <FileText size={28} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            <span className="font-medium text-accent-500">Click to browse</span>, drag & drop, or paste
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Supports images (PNG, JPG, GIF, WebP) and PDF files</p>
        </div>

        {/* Results */}
        {items.length > 0 && (
          <div className="space-y-6">
            {items.map(item => (
              <div key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
                  {item.type === 'image'
                    ? <ImageIcon size={15} className="text-accent-500 flex-shrink-0" />
                    : <FileText size={15} className="text-accent-500 flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{item.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {item.type === 'image' ? 'Image' : 'PDF'}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Loading / error */}
                {item.loading && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 size={15} className="animate-spin" />
                    {item.type === 'image' ? 'Analysing image…' : 'Rendering pages & analysing with AI…'}
                  </div>
                )}
                {item.error && (
                  <div className="flex items-start gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{item.error}</span>
                  </div>
                )}

                {/* ── Standalone image ── */}
                {item.type === 'image' && item.dataUrl && item.summary && (
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-48 flex-shrink-0 p-3 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700 flex items-start justify-center">
                      <img src={item.dataUrl} alt={item.name} className="max-h-40 max-w-full rounded object-contain" />
                    </div>
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Image Description</p>
                        <SpeakCopyBar ttsId={item.id} text={item.summary} label="description" />
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.summary}</p>
                    </div>
                  </div>
                )}

                {/* ── PDF: document summary ── */}
                {item.type === 'pdf' && item.summary && (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Document Summary</p>
                      <SpeakCopyBar ttsId={item.id} text={item.summary} label="summary" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.summary}</p>
                  </div>
                )}

                {/* ── PDF: page-by-page descriptions ── */}
                {item.type === 'pdf' && item.pdfPages && item.pdfPages.length > 0 && (
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                      Page Descriptions ({item.pdfPages.length} {item.pdfPages.length === 1 ? 'page' : 'pages'})
                    </p>
                    <div className="space-y-4">
                      {item.pdfPages.map((pg) => (
                        <div key={pg.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-gray-700">
                          {/* Page thumbnail */}
                          <div className="sm:w-40 flex-shrink-0 flex flex-col items-center gap-1">
                            <img
                              src={pg.dataUrl}
                              alt={`Page ${pg.pageNum}`}
                              className="max-h-52 w-full rounded object-contain border border-gray-200 dark:border-gray-600 bg-white"
                            />
                            <span className="text-[10px] text-gray-400">Page {pg.pageNum}</span>
                          </div>
                          {/* Description */}
                          <div className="flex-1 min-w-0">
                            {pg.loading && (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Loader2 size={12} className="animate-spin" />
                                Analysing page {pg.pageNum}…
                              </div>
                            )}
                            {pg.error && (
                              <div className="flex items-start gap-1 text-xs text-red-500">
                                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                {pg.error}
                              </div>
                            )}
                            {pg.description && (
                              <>
                                <div className="flex items-center gap-1 mb-1">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Page {pg.pageNum}</p>
                                  <SpeakCopyBar ttsId={`${item.id}-pg-${pg.id}`} text={pg.description} label="page" />
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{pg.description}</p>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4">
            <p>No files yet. Drop an image or PDF above to get an AI-generated description or summary.</p>
          </div>
        )}
      </div>
    </div>
  )
}
