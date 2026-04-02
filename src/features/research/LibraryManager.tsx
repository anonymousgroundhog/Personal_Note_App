import React, { useState, useRef } from 'react'
import { Plus, X, Edit2, Trash2, Download, Upload } from 'lucide-react'
import { useResearchStore } from './researchStore'
import { generateBibtexFile, downloadBibtexFile } from './citationUtils'
import { parseBibtexFile } from './bibtexUtils'
import type { Library } from './types'

interface Props {
  selectedLibraryId: string | null
  onSelectLibrary: (libId: string | null) => void
  onAddReference: () => void
}

const COLORS = ['#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316']

export default function LibraryManager({ selectedLibraryId, onSelectLibrary, onAddReference }: Props) {
  const { libraries, addLibrary, updateLibrary, deleteLibrary, references, addReference } = useResearchStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showNewLibrary, setShowNewLibrary] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importedEntries, setImportedEntries] = useState<any[]>([])
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set())
  const [importError, setImportError] = useState<string | null>(null)

  const handleAddLibrary = () => {
    if (!newName.trim()) return
    addLibrary({
      name: newName,
      color: newColor,
      referenceIds: [],
    })
    setNewName('')
    setNewColor(COLORS[0])
    setShowNewLibrary(false)
  }

  const handleSaveEdit = (libId: string) => {
    if (!editName.trim()) return
    updateLibrary(libId, { name: editName, color: editColor })
    setEditingId(null)
  }

  const handleDeleteLibrary = (libId: string) => {
    deleteLibrary(libId)
    if (selectedLibraryId === libId) {
      onSelectLibrary(null)
    }
  }

  const startEdit = (lib: Library) => {
    setEditingId(lib.id)
    setEditName(lib.name)
    setEditColor(lib.color || COLORS[0])
  }

  const handleExportLibrary = (libId: string | null) => {
    const lib = libId ? libraries.find((l) => l.id === libId) : null
    const refsToExport = libId
      ? references.filter((r) => lib?.referenceIds.includes(r.id))
      : references

    if (refsToExport.length === 0) {
      alert('No references to export')
      return
    }

    const content = generateBibtexFile(refsToExport)
    const filename = lib ? `${lib.name.replace(/\s+/g, '_')}.bib` : 'references.bib'
    downloadBibtexFile(content, filename)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = parseBibtexFile(text)

      if (result.entries.length === 0) {
        setImportError('No valid BibTeX entries found in file')
        return
      }

      setImportedEntries(result.entries)
      setSelectedImports(new Set(result.entries.map((_, idx) => idx)))
      setShowImportModal(true)
      setImportError(result.errors.length > 0 ? `${result.errors.length} entries could not be imported` : null)
    } catch (err) {
      setImportError(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleImportReferences = () => {
    let importedCount = 0

    for (const idx of selectedImports) {
      const entry = importedEntries[idx]
      try {
        addReference({
          title: entry.title,
          authors: entry.authors,
          year: entry.year,
          type: entry.type,
          source: entry.source,
          url: entry.url,
          doi: entry.doi,
          abstract: entry.abstract,
          notes: entry.notes,
          tags: [],
          journal: entry.journal,
          volume: entry.volume,
          issue: entry.issue,
          pages: entry.pages,
          issn: entry.issn,
          booktitle: entry.booktitle,
          address: entry.address,
          publisher: entry.publisher,
          isbn: entry.isbn,
          keywords: entry.keywords,
          language: entry.language,
          accessed: entry.accessDate,
        })
        importedCount++
      } catch (err) {
        console.error('Failed to import entry:', entry, err)
      }
    }

    setShowImportModal(false)
    setImportedEntries([])
    setSelectedImports(new Set())
    alert(`Successfully imported ${importedCount} reference(s)`)
  }

  const toggleImportSelection = (idx: number) => {
    const newSelection = new Set(selectedImports)
    if (newSelection.has(idx)) {
      newSelection.delete(idx)
    } else {
      newSelection.add(idx)
    }
    setSelectedImports(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedImports.size === importedEntries.length) {
      setSelectedImports(new Set())
    } else {
      setSelectedImports(new Set(importedEntries.map((_, idx) => idx)))
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700 p-3 space-y-2">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
          Libraries
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onAddReference}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
            title="Add new reference"
          >
            <Plus size={14} />
            <span>Reference</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Import BibTeX file"
          >
            <Upload size={14} />
            <span>Import</span>
          </button>
          <button
            onClick={() => setShowNewLibrary(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
            title="Create new library"
          >
            <Plus size={14} />
            <span>Library</span>
          </button>
        </div>
      </div>

      {/* All References button */}
      <div className="relative group">
        <button
          onClick={() => onSelectLibrary(null)}
          className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-between ${
            selectedLibraryId === null
              ? 'bg-accent-500 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700'
          }`}
        >
          <span>All References</span>
        </button>
        {selectedLibraryId === null && (
          <button
            onClick={() => handleExportLibrary(null)}
            className="absolute right-2 top-2 p-1 text-white hover:bg-white/20 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Export all references as BibTeX"
          >
            <Download size={12} />
          </button>
        )}
      </div>

      {/* Libraries list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {libraries.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 py-2">No libraries yet</p>
        ) : (
          libraries.map((lib) => {
            const refCount = lib.referenceIds.length
            return (
              <div key={lib.id} className="relative group">
                {editingId === lib.id ? (
                  <div className="p-2 bg-white dark:bg-surface-700 rounded border border-accent-300 dark:border-accent-600 space-y-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                    />
                    <div className="flex gap-1">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-colors ${
                            editColor === color ? 'border-gray-800 dark:border-gray-200' : 'border-gray-300 dark:border-gray-600'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveEdit(lib.id)}
                        className="flex-1 px-2 py-1 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSelectLibrary(lib.id)}
                      className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedLibraryId === lib.id
                          ? 'bg-accent-500 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: lib.color }}
                        />
                        <span className="truncate">{lib.name}</span>
                      </div>
                      <span className={`text-[10px] flex-shrink-0 ${selectedLibraryId === lib.id ? 'text-white/80' : 'text-gray-400'}`}>
                        {refCount}
                      </span>
                    </button>
                    {selectedLibraryId === lib.id && (
                      <button
                        onClick={() => handleExportLibrary(lib.id)}
                        className="absolute right-12 top-2 p-1 text-white hover:bg-white/20 rounded transition-colors"
                        title="Export library as BibTeX"
                      >
                        <Download size={12} />
                      </button>
                    )}
                  </>
                )}

                {editingId !== lib.id && (
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(lib)}
                      className="p-1 text-gray-400 hover:text-accent-600 dark:hover:text-accent-400 bg-white dark:bg-surface-700 rounded hover:bg-gray-100 dark:hover:bg-surface-600"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteLibrary(lib.id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-surface-700 rounded hover:bg-gray-100 dark:hover:bg-surface-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* New library form */}
      {showNewLibrary && (
        <div className="p-2 bg-white dark:bg-surface-700 rounded border border-accent-300 dark:border-accent-600 space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddLibrary()
              if (e.key === 'Escape') setShowNewLibrary(false)
            }}
            placeholder="Library name..."
            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
          <div className="flex gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-colors ${
                  newColor === color ? 'border-gray-800 dark:border-gray-200' : 'border-gray-300 dark:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleAddLibrary}
              className="flex-1 px-2 py-1 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewLibrary(false)}
              className="flex-1 px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".bib,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Import BibTeX References
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Found {importedEntries.length} valid reference(s)
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportedEntries([])
                  setSelectedImports(new Set())
                  setImportError(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {importError && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-700 dark:text-yellow-600">
                  ⚠️ {importError}
                </div>
              )}

              {importedEntries.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedImports.size === importedEntries.length}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Select All ({selectedImports.size}/{importedEntries.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {importedEntries.map((entry, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-surface-700 rounded border border-gray-200 dark:border-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedImports.has(idx)}
                          onChange={() => toggleImportSelection(idx)}
                          className="flex-shrink-0 mt-0.5 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                            {entry.title}
                          </p>
                          <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate">
                            {entry.authors ? `${entry.authors.split(',')[0].trim()}` : 'Unknown'}
                            {entry.year && ` (${entry.year})`}
                          </p>
                          <span className="inline-block text-[10px] mt-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                            {entry.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex gap-2">
              <button
                onClick={handleImportReferences}
                disabled={selectedImports.size === 0}
                className="flex-1 px-3 py-2 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import {selectedImports.size > 0 && `(${selectedImports.size})`}
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportedEntries([])
                  setSelectedImports(new Set())
                  setImportError(null)
                }}
                className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
