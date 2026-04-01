import React, { useRef, useState } from 'react'
import { FileUp, Copy, Edit2, Trash2, ExternalLink, FolderPlus } from 'lucide-react'
import { useResearchStore } from './researchStore'
import { useVaultStore } from '../../stores/vaultStore'
import { getFileHandle, writeBinaryFile } from '../../lib/fs/fileSystemApi'
import { generateBibtexEntry, generateApa } from './citationUtils'
import PdfViewer from './PdfViewer'
import type { Reference } from './types'

interface Props {
  referenceId: string
  onEdit: (ref: Reference) => void
  onDelete: () => void
}

const TYPE_LABELS: Record<Reference['type'], string> = {
  journal: 'Journal Article',
  conference: 'Conference Paper',
  book: 'Book',
  chapter: 'Book Chapter',
  webpage: 'Webpage',
  report: 'Report',
  thesis: 'Thesis/Dissertation',
}



export default function ReferenceDetail({ referenceId, onEdit, onDelete }: Props) {
  const { getReference, updateReference, getAnnotationsForRef, addAnnotation, deleteAnnotation, libraries, addReferenceToLibrary, removeReferenceFromLibrary } = useResearchStore()
  const { rootHandle, fallbackMode } = useVaultStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAttaching, setIsAttaching] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [showLibraryMenu, setShowLibraryMenu] = useState(false)

  const reference = getReference(referenceId)
  if (!reference) return null

  const refAnnotations = getAnnotationsForRef(reference.id)
  const canAttachPdf = rootHandle && !fallbackMode // Only full FS API mode supports writes

  // Find which libraries contain this reference
  const refLibraries = libraries.filter((lib) => lib.referenceIds.includes(reference.id))

  const handleAttachPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !rootHandle) {
      setAttachError('Vault not available')
      return
    }

    setIsAttaching(true)
    setAttachError(null)
    try {
      const handle = await getFileHandle(rootHandle, `research/pdfs/${reference.id}.pdf`, true)
      const arrayBuffer = await file.arrayBuffer()
      await writeBinaryFile(handle, new Blob([arrayBuffer]))

      updateReference(reference.id, {
        pdfPath: `research/pdfs/${reference.id}.pdf`,
        updatedAt: Date.now(),
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error attaching PDF:', err)
      setAttachError(`Failed to attach PDF: ${errMsg}`)
    } finally {
      setIsAttaching(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Flash effect or toast would go here
    })
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-surface-900">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Title and Type */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{reference.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300">
              {TYPE_LABELS[reference.type]}
            </span>
          </div>
        </div>

        {/* Authors and Year */}
        <div className="space-y-1">
          {reference.authors && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Authors:</span> {reference.authors}
            </p>
          )}
          {reference.year && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Year:</span> {reference.year}
            </p>
          )}
          {reference.source && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Source:</span> {reference.source}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-2">
          {reference.url && (
            <p className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">URL:</span>{' '}
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 dark:text-accent-400 hover:underline inline-flex items-center gap-1"
              >
                {reference.url}
                <ExternalLink size={12} />
              </a>
            </p>
          )}
          {reference.doi && (
            <p className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">DOI:</span>{' '}
              <a
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 dark:text-accent-400 hover:underline inline-flex items-center gap-1"
              >
                https://doi.org/{reference.doi}
                <ExternalLink size={12} />
              </a>
            </p>
          )}
        </div>

        {/* Abstract */}
        {reference.abstract && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Abstract</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{reference.abstract}</p>
          </div>
        )}

        {/* Notes */}
        {reference.notes && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Notes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              {reference.notes}
            </p>
          </div>
        )}

        {/* Tags */}
        {reference.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {reference.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {attachError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
            {attachError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAttachPdf || isAttaching}
            title={!canAttachPdf ? 'Full vault access required to attach PDFs' : 'Attach a PDF file'}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
              !canAttachPdf
                ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-500'
                : 'bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700'
            }`}
          >
            <FileUp size={14} />
            {isAttaching ? 'Attaching...' : reference.pdfPath ? 'Replace PDF' : 'Attach PDF'}
          </button>

          <button
            onClick={() => copyToClipboard(generateBibtexEntry(reference))}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
          >
            <Copy size={14} />
            Copy BibTeX
          </button>

          <button
            onClick={() => copyToClipboard(generateApa(reference))}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
          >
            <Copy size={14} />
            Copy APA
          </button>

          <button
            onClick={() => onEdit(reference)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 rounded hover:bg-accent-200 dark:hover:bg-accent-900/50 transition-colors"
          >
            <Edit2 size={14} />
            Edit
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>

          <div className="relative">
            <button
              onClick={() => setShowLibraryMenu(!showLibraryMenu)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              <FolderPlus size={14} />
              Add to Library
            </button>

            {/* Library dropdown */}
            {showLibraryMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="max-h-48 overflow-y-auto">
                  {libraries.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400">No libraries yet</p>
                  ) : (
                    libraries.map((lib) => {
                      const isInLib = refLibraries.some((l) => l.id === lib.id)
                      return (
                        <button
                          key={lib.id}
                          onClick={() => {
                            if (isInLib) {
                              removeReferenceFromLibrary(reference.id, lib.id)
                            } else {
                              addReferenceToLibrary(reference.id, lib.id)
                            }
                            setShowLibraryMenu(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-surface-700 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lib.color }} />
                            <span className="text-gray-700 dark:text-gray-300 truncate">{lib.name}</span>
                          </div>
                          {isInLib && <span className="text-accent-600 dark:text-accent-400">✓</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PDF Viewer */}
        {reference.pdfPath && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">PDF Viewer</h3>
            <div className="h-[500px] bg-gray-50 dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
              {!rootHandle ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Open a vault to view attached PDF</p>
                </div>
              ) : (
                <PdfViewer
                  pdfPath={reference.pdfPath}
                  referenceId={reference.id}
                  annotations={refAnnotations}
                  onAddAnnotation={addAnnotation}
                  onDeleteAnnotation={deleteAnnotation}
                />
              )}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleAttachPdf}
          className="hidden"
        />
      </div>
    </div>
  )
}
