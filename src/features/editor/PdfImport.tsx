import React, { useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'
import { FileUp, X, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ScanText } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { todayIso } from '../../lib/fs/pathUtils'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface Props {
  onClose: () => void
}

interface PageText {
  pageNum: number
  lines: string[]
  usedOcr: boolean
}

interface ProgressState {
  current: number
  total: number
  label: string
}

// ── Render a PDF page to an ImageData via OffscreenCanvas ────────────────────

async function renderPageToBlob(page: pdfjsLib.PDFPageProxy, scale = 2): Promise<Blob> {
  const viewport = page.getViewport({ scale })
  const canvas = new OffscreenCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  // OffscreenCanvasRenderingContext2D is compatible with pdfjs at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (page.render as any)({ canvasContext: ctx, viewport }).promise
  return canvas.convertToBlob({ type: 'image/png' })
}

// ── Extract text items from a page using pdfjs native text layer ─────────────

async function extractNativeText(page: pdfjsLib.PDFPageProxy): Promise<string[]> {
  const content = await page.getTextContent()
  const lineMap = new Map<number, string[]>()

  for (const item of content.items) {
    if (!('str' in item)) continue
    const str = item.str
    if (!str.trim()) continue
    const transform = (item as { transform: number[] }).transform
    const y = Math.round(transform[5] / 2) * 2
    if (!lineMap.has(y)) lineMap.set(y, [])
    lineMap.get(y)!.push(str)
  }

  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
  return sortedYs.map(y => lineMap.get(y)!.join(' ').trim()).filter(Boolean)
}

// ── OCR a page image using Tesseract ─────────────────────────────────────────

async function ocrPage(
  blob: Blob,
  worker: Awaited<ReturnType<typeof createWorker>>,
): Promise<string[]> {
  const url = URL.createObjectURL(blob)
  try {
    const { data } = await worker.recognize(url)
    // Split on newlines, collapse blank lines, trim each line
    return data.text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ── Full extraction pipeline ──────────────────────────────────────────────────

async function extractAllPages(
  file: File,
  onProgress: (p: ProgressState) => void,
): Promise<{ pages: PageText[]; numPages: number; ocrUsed: boolean }> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const numPages = pdf.numPages

  if (numPages === 0) {
    pdf.destroy()
    return { pages: [], numPages: 0, ocrUsed: false }
  }

  // First pass: gather native text for every page
  onProgress({ current: 0, total: numPages, label: 'Reading text layer…' })
  const nativeTexts: string[][] = []
  for (let i = 1; i <= numPages; i++) {
    onProgress({ current: i - 1, total: numPages, label: `Reading page ${i} of ${numPages}…` })
    const page = await pdf.getPage(i)
    nativeTexts.push(await extractNativeText(page))
  }

  // Decide per-page whether OCR is needed:
  // A page needs OCR if it has fewer than 20 meaningful characters of native text
  const needsOcr = nativeTexts.map(lines => {
    const charCount = lines.join('').replace(/\s/g, '').length
    return charCount < 20
  })

  const anyNeedsOcr = needsOcr.some(Boolean)
  let tesseractWorker: Awaited<ReturnType<typeof createWorker>> | null = null

  if (anyNeedsOcr) {
    onProgress({ current: 0, total: numPages, label: 'Initialising OCR engine…' })
    tesseractWorker = await createWorker('eng', undefined, {
      logger: () => {},
    })
  }

  // Second pass: OCR pages that need it
  const pages: PageText[] = []
  let ocrPageCount = 0
  const ocrTotal = needsOcr.filter(Boolean).length

  for (let i = 1; i <= numPages; i++) {
    const pageIdx = i - 1
    if (needsOcr[pageIdx] && tesseractWorker) {
      ocrPageCount++
      onProgress({
        current: ocrPageCount - 1,
        total: ocrTotal,
        label: `OCR page ${i} of ${numPages} (${ocrPageCount}/${ocrTotal})…`,
      })
      const page = await pdf.getPage(i)
      let ocrLines: string[] = []
      try {
        const blob = await renderPageToBlob(page)
        ocrLines = await ocrPage(blob, tesseractWorker)
      } catch {
        // If OCR fails on a page, fall back to native (even if empty)
        ocrLines = nativeTexts[pageIdx]
      }
      pages.push({ pageNum: i, lines: ocrLines, usedOcr: true })
    } else {
      pages.push({ pageNum: i, lines: nativeTexts[pageIdx], usedOcr: false })
    }
  }

  if (tesseractWorker) await tesseractWorker.terminate()
  pdf.destroy()

  return { pages, numPages, ocrUsed: anyNeedsOcr }
}

// ── Text-to-markdown conversion heuristics ───────────────────────────────────

function isLikelyHeading(line: string, allLines: string[]): 'h1' | 'h2' | 'h3' | null {
  const trimmed = line.trim()
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount === 0 || wordCount > 10) return null
  if (trimmed.endsWith('.') || trimmed.endsWith(',') || trimmed.endsWith(';')) return null

  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)
  const isTitleCase = trimmed.split(/\s+/).every(w => !w[0] || w[0] === w[0].toUpperCase())

  if (isAllCaps && wordCount <= 6) return 'h2'
  if (isTitleCase && wordCount <= 4 && allLines.indexOf(line) < 5) return 'h1'
  if (isTitleCase && wordCount <= 6) return 'h3'
  return null
}

function isLikelyListItem(line: string): string | null {
  const trimmed = line.trim()
  if (/^[•\-\*○▪◦▸►▶→✓✗✘·]+\s+/.test(trimmed)) {
    return trimmed.replace(/^[•\-\*○▪◦▸►▶→✓✗✘·]+\s+/, '').trim()
  }
  if (/^\d+[\.\)]\s+/.test(trimmed)) {
    const match = trimmed.match(/^\d+[\.\)]\s+(.+)/)
    return match ? `1. ${match[1]}` : null
  }
  return null
}

function convertToMarkdown(pages: PageText[]): string {
  const mdParts: string[] = []

  for (const { pageNum, lines } of pages) {
    if (pages.length > 1) {
      mdParts.push(`\n---\n*Page ${pageNum}*\n`)
    }

    let prevWasHeading = false
    let inList = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (!trimmed) {
        if (inList) inList = false
        mdParts.push('')
        continue
      }

      const listContent = isLikelyListItem(trimmed)
      if (listContent) {
        inList = true
        prevWasHeading = false
        mdParts.push(`- ${listContent.replace(/^1\.\s+/, '')}`)
        continue
      }

      if (inList) {
        inList = false
        mdParts.push('')
      }

      const headingLevel = isLikelyHeading(trimmed, lines)
      if (headingLevel) {
        if (!prevWasHeading && mdParts.length > 0) mdParts.push('')
        const hashes = headingLevel === 'h1' ? '#' : headingLevel === 'h2' ? '##' : '###'
        mdParts.push(`${hashes} ${trimmed}`)
        prevWasHeading = true
        continue
      }

      prevWasHeading = false
      mdParts.push(trimmed)
    }
  }

  const cleaned: string[] = []
  let blankCount = 0
  for (const line of mdParts) {
    if (line === '') {
      blankCount++
      if (blankCount <= 2) cleaned.push(line)
    } else {
      blankCount = 0
      cleaned.push(line)
    }
  }

  return cleaned.join('\n').trim()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PdfImport({ onClose }: Props) {
  const { rootHandle, fallbackMode, createNote } = useVaultStore()
  const { openTab } = useUiStore()
  const hasVault = !!(rootHandle || fallbackMode)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'pick' | 'processing' | 'preview' | 'saving'>('pick')
  const [error, setError] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [noteName, setNoteName] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [pageCount, setPageCount] = useState(0)
  const [ocrUsed, setOcrUsed] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  const processPdf = useCallback(async (file: File) => {
    setStep('processing')
    setError(null)
    setPdfFile(file)
    setProgress(null)

    try {
      const { pages, numPages, ocrUsed: usedOcr } = await extractAllPages(
        file,
        (p) => setProgress(p),
      )
      setPageCount(numPages)
      setOcrUsed(usedOcr)

      if (numPages === 0) {
        setError('This PDF appears to be empty (0 pages).')
        setStep('pick')
        return
      }

      // Even after OCR, a page may yield nothing (e.g. blank page or pure diagram)
      // That's fine — we still proceed; we just warn if the entire doc is empty
      const totalChars = pages.reduce((sum, p) => sum + p.lines.join('').length, 0)
      if (totalChars === 0) {
        setError(
          `No text could be extracted from this PDF (${numPages} page${numPages !== 1 ? 's' : ''}), ` +
          'even after OCR. It may contain only graphics or non-Latin text not supported by the OCR engine.',
        )
        setStep('pick')
        return
      }

      const md = convertToMarkdown(pages)
      const baseName = file.name.replace(/\.pdf$/i, '')
      setMarkdown(md)
      setNoteName(baseName)
      setStep('preview')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('password')) {
        setError('This PDF is password-protected. Please unlock it before importing.')
      } else if (msg.toLowerCase().includes('invalid pdf')) {
        setError('This file does not appear to be a valid PDF.')
      } else {
        setError(`Failed to process PDF: ${msg}`)
      }
      setStep('pick')
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.')
      return
    }
    processPdf(file)
  }, [processPdf])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please drop a PDF file.')
      return
    }
    processPdf(file)
  }, [processPdf])

  const handleInsert = useCallback(async () => {
    if (!markdown || !noteName) return
    setStep('saving')
    try {
      const safeName = noteName.replace(/[/\\:*?"<>|]/g, '-').trim() || 'imported-pdf'
      const today = todayIso()
      const originalFilename = pdfFile?.name ?? ''
      const frontmatter = [
        '---',
        `tags: [imported, pdf${ocrUsed ? ', ocr' : ''}]`,
        `date: ${today}`,
        originalFilename ? `source: "${originalFilename}"` : '',
        '---',
      ].filter(Boolean).join('\n')
      const content = `${frontmatter}\n\n# ${safeName}\n\n${markdown}\n`
      const filePath = `${safeName}.md`
      await createNote(filePath, content)
      openTab(filePath)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Failed to save note: ${msg}`)
      setStep('preview')
    }
  }, [markdown, noteName, pdfFile, ocrUsed, createNote, openTab, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileUp size={18} className="text-accent-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">Import PDF as Note</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* No vault warning */}
          {!hasVault && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">No vault open</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Please open a vault folder first. The imported note will be saved there.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Pick step */}
          {step === 'pick' && (
            <div>
              <label
                htmlFor="pdf-file-input"
                className="flex flex-col items-center justify-center gap-3 w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-accent-500 hover:bg-accent-500/5 transition-colors"
              >
                <FileUp size={36} className="text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to select a PDF, or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">Supports text-based and scanned PDFs</p>
                </div>
              </label>
              <input
                id="pdf-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">What to expect:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Text-based PDFs are extracted directly — fast and accurate.</li>
                  <li>Scanned image PDFs are automatically processed with OCR (may take a moment).</li>
                  <li>Headings, lists, and paragraphs are detected heuristically — results vary by PDF.</li>
                  <li>Tables and complex layouts may not convert perfectly.</li>
                  <li>You can edit the markdown after import.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center h-48 gap-4">
              {progress?.label.includes('OCR') ? (
                <ScanText size={36} className="text-accent-500 animate-pulse" />
              ) : (
                <Loader2 size={36} className="animate-spin text-accent-500" />
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {progress?.label ?? 'Processing PDF…'}
              </p>
              {progress && progress.total > 0 && (
                <div className="w-64 space-y-1.5">
                  <div className="h-2 bg-gray-200 dark:bg-surface-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-gray-400">
                    {progress.current} / {progress.total}
                  </p>
                </div>
              )}
              {progress?.label.includes('OCR') && (
                <p className="text-xs text-gray-400 max-w-xs text-center">
                  OCR is running on scanned pages — this may take a moment depending on page count.
                </p>
              )}
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Info bar */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-300">
                <CheckCircle size={16} className="flex-shrink-0" />
                <span>
                  Extracted {pageCount} page{pageCount !== 1 ? 's' : ''} from <strong>{pdfFile?.name}</strong>
                  {ocrUsed && <span> using OCR <ScanText size={11} className="inline mb-0.5 mx-0.5" /></span>}.
                  {' '}Review and edit below before importing.
                </span>
              </div>

              {/* Note name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note name</label>
                <input
                  type="text"
                  value={noteName}
                  onChange={e => setNoteName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="Note filename (without .md)"
                />
              </div>

              {/* Preview toggle */}
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Markdown content</label>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-accent-500 transition-colors"
                >
                  {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showPreview ? 'Hide' : 'Show'} preview
                </button>
              </div>

              {showPreview && (
                <textarea
                  value={markdown}
                  onChange={e => setMarkdown(e.target.value)}
                  className="w-full h-64 px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
                  spellCheck={false}
                />
              )}
            </div>
          )}

          {/* Saving */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-500 dark:text-gray-400">
              <Loader2 size={28} className="animate-spin text-accent-500" />
              <p className="text-sm">Saving note to vault…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          {step === 'preview' && (
            <button
              onClick={() => { setStep('pick'); setError(null) }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
          >
            Cancel
          </button>
          {step === 'preview' && (
            <button
              onClick={handleInsert}
              disabled={!hasVault || !noteName.trim()}
              className="px-4 py-2 text-sm bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Import as Note
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
