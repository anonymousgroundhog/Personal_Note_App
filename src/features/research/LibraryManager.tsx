import React, { useState } from 'react'
import { Plus, X, Edit2, Trash2, Download } from 'lucide-react'
import { useResearchStore } from './researchStore'
import { generateBibtexFile, downloadBibtexFile } from './citationUtils'
import type { Library } from './types'

interface Props {
  selectedLibraryId: string | null
  onSelectLibrary: (libId: string | null) => void
  onAddReference: () => void
}

const COLORS = ['#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316']

export default function LibraryManager({ selectedLibraryId, onSelectLibrary, onAddReference }: Props) {
  const { libraries, addLibrary, updateLibrary, deleteLibrary, references } = useResearchStore()
  const [showNewLibrary, setShowNewLibrary] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

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

  return (
    <div className="bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-1">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-widest flex-1">
          Libraries
        </div>
        <button
          onClick={onAddReference}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
          title="Add new reference"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => setShowNewLibrary(true)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
          title="Create library"
        >
          <Plus size={14} />
        </button>
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
    </div>
  )
}
