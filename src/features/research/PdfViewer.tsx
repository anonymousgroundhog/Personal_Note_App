import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2, MapPin, X, Maximize2, Minimize2 } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useVaultStore } from '../../stores/vaultStore'
import { getFileHandle } from '../../lib/fs/fileSystemApi'
import type { PdfAnnotation } from './types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface Props {
  pdfPath: string
  referenceId: string
  annotations: PdfAnnotation[]
  onAddAnnotation: (ann: Omit<PdfAnnotation, 'id' | 'createdAt'>) => void
  onDeleteAnnotation: (id: string) => void
}

type ToolType = 'none' | 'highlight' | 'note'

export default function PdfViewer({
  pdfPath,
  referenceId,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
}: Props) {
  const { rootHandle } = useVaultStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [activeTool, setActiveTool] = useState<ToolType>('none')
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [tempRect, setTempRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [highlightColor, setHighlightColor] = useState('#ffeb3b')
  const [pendingNotePos, setPendingNotePos] = useState<{ x: number; y: number } | null>(null)
  const [noteText, setNoteText] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Load PDF
  useEffect(() => {
    if (!rootHandle || !pdfPath) return

    setIsLoading(true)
    setLoadError(null)

    const loadPdf = async () => {
      try {
        const handle = await getFileHandle(rootHandle, pdfPath, false)
        const file = await handle.getFile()
        const arrayBuffer = await file.arrayBuffer()
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setCurrentPage(1)
      } catch (err) {
        setLoadError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadPdf()
  }, [rootHandle, pdfPath])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentPage(Math.max(1, currentPage - 1))
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentPage(Math.min(numPages, currentPage + 1))
      }
    }

    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen, currentPage, numPages])

  // Render page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    setIsLoading(true)
    let cancelled = false

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current!
        canvas.width = viewport.width
        canvas.height = viewport.height

        const context = canvas.getContext('2d')
        if (!context) return

        await page.render({ canvasContext: context, viewport }).promise

        if (!cancelled) {
          // Set CSS dimensions to match viewport
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error rendering page:', err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    renderPage()

    return () => {
      cancelled = true
    }
  }, [pdfDoc, currentPage, scale])

  // Mouse handlers
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current || activeTool === 'none') return

    const rect = overlayRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (activeTool === 'highlight') {
      setDragStart({ x, y })
      setTempRect({ x, y, width: 0, height: 0 })
    } else if (activeTool === 'note') {
      setPendingNotePos({ x, y })
      setNoteText('')
    }
  }

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current || !dragStart || activeTool !== 'highlight') return

    const rect = overlayRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const width = x - dragStart.x
    const height = y - dragStart.y

    setTempRect({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(width),
      height: Math.abs(height),
    })
  }

  const handleOverlayMouseUp = () => {
    if (!dragStart || !tempRect || activeTool !== 'highlight') return

    // Save annotation
    onAddAnnotation({
      referenceId,
      page: currentPage,
      type: 'highlight',
      x: tempRect.x,
      y: tempRect.y,
      width: tempRect.width,
      height: tempRect.height,
      text: '',
      color: highlightColor,
    })

    setDragStart(null)
    setTempRect(null)
  }

  const handleSaveNote = () => {
    if (!pendingNotePos) return

    onAddAnnotation({
      referenceId,
      page: currentPage,
      type: 'note',
      x: pendingNotePos.x,
      y: pendingNotePos.y,
      text: noteText,
      color: '#333333',
    })

    setPendingNotePos(null)
    setNoteText('')
  }

  const pageAnnotations = annotations.filter((a) => a.page === currentPage)

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-surface-800 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">
            {isLoading ? 'Loading...' : `Page ${currentPage} / ${numPages}`}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-2">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.25))}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 rounded transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[35px]">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(3.0, scale + 0.25))}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 rounded transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-2">
          <button
            onClick={() => {
              setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')
            }}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'highlight'
                ? 'bg-yellow-200 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700'
            }`}
            title="Highlight tool"
          >
            <span className="w-4 h-4 bg-current rounded-sm" />
          </button>
          <button
            onClick={() => {
              setActiveTool(activeTool === 'note' ? 'none' : 'note')
            }}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'note'
                ? 'bg-blue-200 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700'
            }`}
            title="Note tool"
          >
            <MapPin size={16} />
          </button>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
            title="Highlight color"
          />
          <button
            onClick={() => {
              const pageAnnots = pageAnnotations
              pageAnnots.forEach((a) => onDeleteAnnotation(a.id))
            }}
            disabled={pageAnnotations.length === 0}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            title="Clear page annotations"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 rounded transition-colors"
            title="Expand fullscreen (Esc to exit)"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Canvas and overlay */}
      <div ref={scrollContainerRef} className="relative bg-white dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto flex-1 max-h-[500px]">
        <canvas
          ref={canvasRef}
          className="mx-auto my-auto block"
        />

        {/* Annotation overlay */}
        <div
          ref={overlayRef}
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
          onMouseLeave={handleOverlayMouseUp}
          className={`absolute inset-0 ${activeTool === 'none' ? 'pointer-events-none' : ''}`}
        >
          {/* Temp rectangle while dragging */}
          {tempRect && (
            <div
              style={{
                position: 'absolute',
                left: `${tempRect.x * 100}%`,
                top: `${tempRect.y * 100}%`,
                width: `${tempRect.width * 100}%`,
                height: `${tempRect.height * 100}%`,
                backgroundColor: highlightColor,
                opacity: 0.4,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Saved annotations */}
          {pageAnnotations.map((ann) => (
            <div key={ann.id} className="group">
              {ann.type === 'highlight' && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${ann.x * 100}%`,
                    top: `${ann.y * 100}%`,
                    width: `${(ann.width ?? 0) * 100}%`,
                    height: `${(ann.height ?? 0) * 100}%`,
                    backgroundColor: ann.color,
                    opacity: 0.4,
                    cursor: 'pointer',
                  }}
                  className="group-hover:ring-2 group-hover:ring-gray-800 dark:group-hover:ring-gray-200 transition-all"
                >
                  <button
                    onClick={() => onDeleteAnnotation(ann.id)}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs -mr-2.5 -mt-2.5 transition-opacity hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}

              {ann.type === 'note' && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${ann.x * 100}%`,
                    top: `${ann.y * 100}%`,
                  }}
                  className="group"
                >
                  <MapPin size={18} className="text-blue-600 dark:text-blue-400 cursor-pointer -ml-2.5 -mt-2.5" />
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 text-xs min-w-[150px] opacity-0 group-hover:opacity-100 pointer-events-auto transition-opacity z-10">
                    <p className="text-gray-700 dark:text-gray-300 mb-2">{ann.text}</p>
                    <button
                      onClick={() => onDeleteAnnotation(ann.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Note prompt */}
          {pendingNotePos && (
            <div
              style={{
                position: 'absolute',
                left: `${pendingNotePos.x * 100}%`,
                top: `${pendingNotePos.y * 100}%`,
              }}
              className="z-20 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-3 w-[200px]">
                <textarea
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add note..."
                  className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none mb-2"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNote}
                    className="flex-1 px-2 py-1 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setPendingNotePos(null)}
                    className="flex-1 px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gray-900 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-medium text-gray-200 min-w-[80px]">
                Page {currentPage} / {numPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage >= numPages}
                className="p-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                <ChevronRight size={20} />
              </button>
              <span className="text-xs text-gray-400 ml-2">Use arrow keys to navigate</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-sm font-medium text-gray-200 min-w-[50px]">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(Math.min(3.0, scale + 0.25))}
                className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors ml-2"
                title="Exit fullscreen (Esc)"
              >
                <Minimize2 size={20} />
              </button>
            </div>
          </div>

          {/* PDF Content - Scrollable */}
          <div className="flex-1 overflow-auto bg-black flex items-center justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="mx-auto block"
              />

              {/* Annotation overlay in fullscreen */}
              <div
                ref={overlayRef}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onMouseLeave={handleOverlayMouseUp}
                className={`absolute inset-0 ${activeTool === 'none' ? 'pointer-events-none' : ''}`}
              >
                {/* Temp rectangle while dragging */}
                {tempRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${tempRect.x * 100}%`,
                      top: `${tempRect.y * 100}%`,
                      width: `${tempRect.width * 100}%`,
                      height: `${tempRect.height * 100}%`,
                      backgroundColor: highlightColor,
                      opacity: 0.4,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Saved annotations */}
                {pageAnnotations.map((ann) => (
                  <div key={ann.id} className="group">
                    {ann.type === 'highlight' && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${ann.x * 100}%`,
                          top: `${ann.y * 100}%`,
                          width: `${(ann.width ?? 0) * 100}%`,
                          height: `${(ann.height ?? 0) * 100}%`,
                          backgroundColor: ann.color,
                          opacity: 0.4,
                          cursor: 'pointer',
                        }}
                        className="group-hover:ring-2 group-hover:ring-white transition-all"
                      >
                        <button
                          onClick={() => onDeleteAnnotation(ann.id)}
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs -mr-2.5 -mt-2.5 transition-opacity hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {ann.type === 'note' && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${ann.x * 100}%`,
                          top: `${ann.y * 100}%`,
                        }}
                        className="group"
                      >
                        <MapPin size={20} className="text-blue-400 cursor-pointer -ml-2.5 -mt-2.5" />
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg p-2 text-xs min-w-[150px] opacity-0 group-hover:opacity-100 pointer-events-auto transition-opacity z-10">
                          <p className="text-gray-300 mb-2">{ann.text}</p>
                          <button
                            onClick={() => onDeleteAnnotation(ann.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Note prompt */}
                {pendingNotePos && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${pendingNotePos.x * 100}%`,
                      top: `${pendingNotePos.y * 100}%`,
                    }}
                    className="z-20 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg p-3 w-[200px]">
                      <textarea
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add note..."
                        className="w-full text-xs border border-gray-600 rounded px-2 py-1.5 bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none mb-2"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNote}
                          className="flex-1 px-2 py-1 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setPendingNotePos(null)}
                          className="flex-1 px-2 py-1 text-xs font-medium border border-gray-600 text-gray-400 rounded hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
