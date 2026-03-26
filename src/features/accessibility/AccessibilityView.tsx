import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Image as ImageIcon, FileText, Loader2, AlertCircle, Copy, Check, X, Volume2, VolumeX } from 'lucide-react'
import { useAiStore } from '../../stores/aiStore'
import { useTts } from '../../lib/hooks/useSpeech'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const AI_PROXY = `http://${window.location.hostname}:3001`

// ── Types ─────────────────────────────────────────────────────────────────────

type SummaryItem = {
  id: string
  name: string
  type: 'image' | 'pdf'
  dataUrl: string
  summary: string | null
  loading: boolean
  error: string | null
}

type PageResult = {
  id: string
  pageNum: number
  dataUrl: string          // rendered page thumbnail
  description: string | null
  loading: boolean
  error: string | null
}

type ExtractionItem = {
  id: string
  name: string
  pages: PageResult[]
  totalPages: number
  loading: boolean         // true while rendering pages
  error: string | null
}

type ActiveTab = 'summary' | 'extraction'

// ── Shared helpers ────────────────────────────────────────────────────────────

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
  if (parts.length === 0) throw new Error('No readable text found in this PDF. It may be a scanned or image-only document.')
  return parts.join('\n\n')
}

/** Render every page of a PDF to a JPEG data URL. */
async function renderPdfPages(file: File): Promise<{ pageNum: number; dataUrl: string; totalPages: number }[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const totalPages = pdf.numPages
  const pageCount = Math.min(totalPages, 20)
  const results: { pageNum: number; dataUrl: string; totalPages: number }[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const scale = Math.min(900 / viewport.width, 900 / viewport.height, 2)
    const scaled = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(scaled.width)
    canvas.height = Math.round(scaled.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise

    results.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.75), totalPages })
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
    const errJson = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(errJson?.error ?? `HTTP ${res.status}`)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('No response from AI')
  return text
}

function callAiDescribeImage(
  dataUrl: string,
  config: { serverUrl: string; apiKey: string; selectedModel: string },
  prompt?: string,
): Promise<string> {
  return aiPost(config, [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: prompt ?? 'Please describe this image in detail. Include: what is shown, any text visible, colours, layout, and anything else that would be helpful for someone who cannot see it. Be thorough but clear.',
      },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  }])
}

function callAiSummarisePdf(
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary')

  // Summary tab state
  const [summaryItems, setSummaryItems] = useState<SummaryItem[]>([])
  const [summaryDragging, setSummaryDragging] = useState(false)

  // Extraction tab state
  const [extractItems, setExtractItems] = useState<ExtractionItem[]>([])
  const [extractDragging, setExtractDragging] = useState(false)

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { speakingId, supported: ttsSupported, speak, stop: stopSpeaking } = useTts()
  const aiReady = !!(config.serverUrl && config.selectedModel)

  // ── Summary tab logic ───────────────────────────────────────────────────────

  const processSummaryFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isImage && !isPdf) return

    const id = crypto.randomUUID()
    const type: 'image' | 'pdf' = isImage ? 'image' : 'pdf'
    setSummaryItems(prev => [...prev, { id, name: file.name, type, dataUrl: '', summary: null, loading: true, error: null }])

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setSummaryItems(prev => prev.map(it => it.id === id ? { ...it, dataUrl } : it))

      if (!aiReady) {
        setSummaryItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: 'No AI model configured. Go to AI Chat settings to set up a server.' } : it))
        return
      }

      const summary = isImage
        ? await callAiDescribeImage(dataUrl, config)
        : await callAiSummarisePdf(await extractPdfText(file), config)

      setSummaryItems(prev => prev.map(it => it.id === id ? { ...it, summary, loading: false } : it))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSummaryItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: msg } : it))
    }
  }, [config, aiReady])

  // ── Extraction tab logic ────────────────────────────────────────────────────

  const processExtractionFile = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return

    const id = crypto.randomUUID()
    setExtractItems(prev => [...prev, { id, name: file.name, pages: [], totalPages: 0, loading: true, error: null }])

    try {
      // Render all pages to canvas first
      const rendered = await renderPdfPages(file)
      const totalPages = rendered[0]?.totalPages ?? rendered.length

      const pages: PageResult[] = rendered.map(({ pageNum, dataUrl }) => ({
        id: crypto.randomUUID(),
        pageNum,
        dataUrl,
        description: null,
        loading: aiReady,
        error: aiReady ? null : 'No AI model configured',
      }))

      setExtractItems(prev => prev.map(it => it.id === id ? { ...it, pages, totalPages, loading: false } : it))

      if (!aiReady) return

      const pagePrompt = 'You are an accessibility assistant reviewing a PDF page. Describe everything visible: all text, figures, charts, diagrams, images, tables, captions, and layout. Be thorough so someone who cannot see the page understands its full content.'

      // Send pages to AI one at a time — results appear progressively
      for (const pg of pages) {
        try {
          const description = await callAiDescribeImage(pg.dataUrl, config, pagePrompt)
          setExtractItems(prev => prev.map(it => {
            if (it.id !== id) return it
            return { ...it, pages: it.pages.map(p => p.id === pg.id ? { ...p, description, loading: false } : p) }
          }))
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          setExtractItems(prev => prev.map(it => {
            if (it.id !== id) return it
            return { ...it, pages: it.pages.map(p => p.id === pg.id ? { ...p, loading: false, error } : p) }
          }))
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExtractItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: msg } : it))
    }
  }, [config, aiReady])

  // ── Paste handler (active tab determines which processor runs) ──────────────

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const clipItems = Array.from(e.clipboardData?.items ?? [])
    const files = clipItems
      .filter(it => it.kind === 'file' && (it.type.startsWith('image/') || it.type === 'application/pdf'))
      .map(it => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (activeTab === 'summary') files.forEach(f => processSummaryFile(f))
    else files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf')).forEach(f => processExtractionFile(f))
  }, [activeTab, processSummaryFile, processExtractionFile])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // ── Shared UI helpers ───────────────────────────────────────────────────────

  const handleCopy = (copyId: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(copyId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function SpeakCopyBar({ ttsId, text, label }: { ttsId: string; text: string; label: string }) {
    return (
      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
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

  function DropZone({ onFiles, accept, hint }: { onFiles: (f: File[]) => void; accept: string; hint: string }) {
    const [dragging, setDragging] = useState(false)
    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) onFiles(Array.from(e.dataTransfer.files)) }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors p-10 mb-6 cursor-pointer ${
          dragging
            ? 'border-accent-500 bg-accent-500/5'
            : 'border-gray-300 dark:border-gray-600 hover:border-accent-400 dark:hover:border-accent-500 bg-gray-50 dark:bg-surface-800'
        }`}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = accept
          input.multiple = true
          input.onchange = () => { if (input.files) onFiles(Array.from(input.files)) }
          input.click()
        }}
      >
        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
          <ImageIcon size={28} /><Upload size={22} /><FileText size={28} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          <span className="font-medium text-accent-500">Click to browse</span>, drag & drop, or paste
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Accessibility</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            AI-powered descriptions and summaries for images and PDF documents
          </p>
        </div>
        {!aiReady && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle size={13} />
            Configure an AI model in AI Chat settings to enable summaries
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 px-4 flex-shrink-0">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-accent-500 text-accent-500 font-medium'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FileText size={14} />
          Summary
        </button>
        <button
          onClick={() => setActiveTab('extraction')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
            activeTab === 'extraction'
              ? 'border-accent-500 text-accent-500 font-medium'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ImageIcon size={14} />
          PDF Image Extraction
        </button>
      </div>

      {/* ── Summary tab ────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="flex-1 overflow-y-auto p-6">
          <DropZone
            accept="image/*,.pdf"
            hint="Supports images (PNG, JPG, GIF, WebP) and PDF files"
            onFiles={files => files.forEach(f => processSummaryFile(f))}
          />

          {summaryItems.length > 0 && (
            <div className="space-y-4">
              {summaryItems.map(item => (
                <div key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
                    {item.type === 'image' ? <ImageIcon size={15} className="text-accent-500 flex-shrink-0" /> : <FileText size={15} className="text-accent-500 flex-shrink-0" />}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{item.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">{item.type === 'image' ? 'Image' : 'PDF'}</span>
                    <button onClick={() => { if (speakingId === item.id) stopSpeaking(); setSummaryItems(prev => prev.filter(it => it.id !== item.id)) }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Remove">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row">
                    {item.dataUrl && item.type === 'image' && (
                      <div className="sm:w-48 flex-shrink-0 p-3 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700 flex items-start justify-center">
                        <img src={item.dataUrl} alt={item.name} className="max-h-40 max-w-full rounded object-contain" />
                      </div>
                    )}
                    {item.type === 'pdf' && (
                      <div className="sm:w-48 flex-shrink-0 p-3 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 text-gray-400">
                        <FileText size={36} className="opacity-40" /><span className="text-xs">PDF document</span>
                      </div>
                    )}
                    <div className="flex-1 p-4">
                      {item.loading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 size={15} className="animate-spin" />
                          {item.type === 'image' ? 'Analysing image…' : 'Extracting & summarising PDF…'}
                        </div>
                      )}
                      {item.error && (
                        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /><span>{item.error}</span>
                        </div>
                      )}
                      {item.summary && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              {item.type === 'image' ? 'Image Description' : 'Document Summary'}
                            </p>
                            <SpeakCopyBar ttsId={item.id} text={item.summary} label={item.type === 'image' ? 'description' : 'summary'} />
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {summaryItems.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4">
              No files yet. Drop an image or PDF above to get an AI-generated description or summary.
            </p>
          )}
        </div>
      )}

      {/* ── PDF Image Extraction tab ────────────────────────────────────────── */}
      {activeTab === 'extraction' && (
        <div className="flex-1 overflow-y-auto p-6">
          <DropZone
            accept=".pdf,application/pdf"
            hint="PDF files only — each page is rendered and described individually"
            onFiles={files => files.forEach(f => processExtractionFile(f))}
          />

          {extractItems.length > 0 && (
            <div className="space-y-6">
              {extractItems.map(item => (
                <div key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
                    <FileText size={15} className="text-accent-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{item.name}</span>
                    {!item.loading && item.pages.length > 0 && (
                      <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                        {item.pages.length}{item.totalPages > item.pages.length ? ` of ${item.totalPages}` : ''} pages
                      </span>
                    )}
                    <button
                      onClick={() => {
                        item.pages.forEach(p => { if (speakingId === `${item.id}-${p.id}`) stopSpeaking() })
                        setExtractItems(prev => prev.filter(it => it.id !== item.id))
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Rendering spinner */}
                  {item.loading && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 size={15} className="animate-spin" />
                      Rendering PDF pages…
                    </div>
                  )}
                  {item.error && (
                    <div className="flex items-start gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /><span>{item.error}</span>
                    </div>
                  )}

                  {/* Page grid */}
                  {item.pages.length > 0 && (
                    <div className="p-4 space-y-4">
                      {item.pages.map(pg => (
                        <div key={pg.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-gray-700">
                          {/* Thumbnail */}
                          <div className="sm:w-40 flex-shrink-0 flex flex-col items-center gap-1">
                            <img
                              src={pg.dataUrl}
                              alt={`Page ${pg.pageNum}`}
                              className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white object-contain max-h-56"
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
                                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />{pg.error}
                              </div>
                            )}
                            {pg.description && (
                              <>
                                <div className="flex items-center gap-1 mb-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Page {pg.pageNum} description</p>
                                  <SpeakCopyBar ttsId={`${item.id}-${pg.id}`} text={pg.description} label="page" />
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{pg.description}</p>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {extractItems.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4">
              No PDFs yet. Drop a PDF above — each page will be rendered and described by the AI.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
