import React, { useState, useMemo, useRef, useEffect } from 'react'
import { FileText, BookOpen, Globe, ClipboardList, BookMarked, Trash2, FolderPlus } from 'lucide-react'
import { useResearchStore } from './researchStore'
import LibraryManager from './LibraryManager'
import type { Reference } from './types'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  selectedLibraryId: string | null
  onSelectLibrary: (libId: string | null) => void
}

const TYPE_ICONS: Record<Reference['type'], React.ReactNode> = {
  journal: <FileText size={14} />,
  conference: <BookMarked size={14} />,
  book: <BookOpen size={14} />,
  chapter: <BookMarked size={14} />,
  webpage: <Globe size={14} />,
  report: <ClipboardList size={14} />,
  thesis: <BookOpen size={14} />,
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

type SortBy = 'title' | 'year' | 'createdAt'
type FilterType = Reference['type'] | 'all'

export default function ReferenceList({ selectedId, onSelect, onAdd, selectedLibraryId, onSelectLibrary }: Props) {
  const { references, libraries, deleteReference, addReferenceToLibrary, removeReferenceFromLibrary } = useResearchStore()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterTag, setFilterTag] = useState('')
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set())
  const [moveToLibraryOpen, setMoveToLibraryOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoveToLibraryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const allTags = useMemo(
    () => [...new Set(references.flatMap((r) => r.tags))].sort(),
    [references]
  )

  const libraryRefIds = useMemo(() => {
    if (!selectedLibraryId) return null
    const lib = libraries.find((l) => l.id === selectedLibraryId)
    return lib ? new Set(lib.referenceIds) : new Set()
  }, [selectedLibraryId, libraries])

  const toggleRefSelection = (refId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedRefs)
    if (newSelected.has(refId)) {
      newSelected.delete(refId)
    } else {
      newSelected.add(refId)
    }
    setSelectedRefs(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedRefs.size === filtered.length) {
      setSelectedRefs(new Set())
    } else {
      setSelectedRefs(new Set(filtered.map((r) => r.id)))
    }
  }

  const handleDeleteSelected = () => {
    for (const refId of selectedRefs) {
      deleteReference(refId)
    }
    setSelectedRefs(new Set())
    setConfirmDelete(false)
  }

  const handleMoveToLibrary = (libId: string) => {
    // Remove from all libraries first if moving between libraries
    for (const refId of selectedRefs) {
      libraries.forEach((lib) => {
        if (lib.referenceIds.includes(refId)) {
          removeReferenceFromLibrary(refId, lib.id)
        }
      })
      addReferenceToLibrary(refId, libId)
    }
    setSelectedRefs(new Set())
    setMoveToLibraryOpen(false)
  }

  const handleAddToLibrary = (libId: string) => {
    for (const refId of selectedRefs) {
      addReferenceToLibrary(refId, libId)
    }
    setSelectedRefs(new Set())
    setMoveToLibraryOpen(false)
  }

  const filtered = useMemo(() => {
    let result = references

    // Filter by library
    if (libraryRefIds) {
      result = result.filter((r) => libraryRefIds.has(r.id))
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.authors.toLowerCase().includes(q) ||
          r.source?.toLowerCase().includes(q) ||
          r.abstract?.toLowerCase().includes(q)
      )
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((r) => r.type === filterType)
    }

    // Tag filter
    if (filterTag) {
      result = result.filter((r) => r.tags.includes(filterTag))
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any = a[sortBy]
      let bVal: any = b[sortBy]

      if (sortBy === 'createdAt') {
        aVal = a.createdAt
        bVal = b.createdAt
      } else if (sortBy === 'year') {
        aVal = a.year ?? 0
        bVal = b.year ?? 0
      } else {
        aVal = a.title.toLowerCase()
        bVal = b.title.toLowerCase()
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [references, search, sortBy, sortDir, filterType, filterTag])

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900 flex flex-col overflow-hidden">
      {/* Library Manager */}
      <LibraryManager selectedLibraryId={selectedLibraryId} onSelectLibrary={onSelectLibrary} onAddReference={onAdd} />

      {/* Multi-select Toolbar */}
      {selectedRefs.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-3 py-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {selectedRefs.size} selected
            </span>
            <button
              onClick={() => setSelectedRefs(new Set())}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                onClick={() => setMoveToLibraryOpen(!moveToLibraryOpen)}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                <FolderPlus size={12} />
                <span>To Library</span>
              </button>

              {moveToLibraryOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-surface-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-10">
                  <div className="max-h-48 overflow-y-auto">
                    {libraries.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">No libraries</p>
                    ) : (
                      libraries.map((lib) => (
                        <button
                          key={lib.id}
                          onClick={() => handleAddToLibrary(lib.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-surface-600 flex items-center gap-2 transition-colors"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: lib.color }}
                          />
                          <span className="text-gray-700 dark:text-gray-300">{lib.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setConfirmDelete(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          </div>

          {confirmDelete && (
            <div className="bg-white dark:bg-surface-700 border border-red-300 dark:border-red-600 rounded p-2 space-y-2">
              <p className="text-xs text-gray-700 dark:text-gray-300">
                Delete {selectedRefs.size} reference(s)? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteSelected}
                  className="flex-1 px-2 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <input
              type="checkbox"
              checked={selectedRefs.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              title="Select all"
              className="cursor-pointer"
            />
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search references..."
            className={`flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500`}
          />
        </div>

        {/* Sort and Filter Controls */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-1">
            <label htmlFor="sort-select" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Sort
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              <option value="createdAt">Date</option>
              <option value="title">Title</option>
              <option value="year">Year</option>
            </select>
            <button
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              className="px-1.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <div className="flex-1 flex items-center gap-1">
            <label htmlFor="type-select" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Type
            </label>
            <select
              id="type-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              <option value="all">All</option>
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div>
            <label htmlFor="tag-select" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-1">
              Tag Filter
            </label>
            <select
              id="tag-select"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Reference List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {references.length === 0
                ? 'No references yet. Click + Add to get started.'
                : 'No references match your search.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((ref) => (
              <button
                key={ref.id}
                onClick={() => onSelect(ref.id)}
                className={`w-full px-3 py-2 text-left transition-colors flex items-start gap-2 ${
                  selectedRefs.has(ref.id)
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : selectedId === ref.id
                      ? 'bg-accent-500 text-white'
                      : 'hover:bg-gray-50 dark:hover:bg-surface-800 text-gray-800 dark:text-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRefs.has(ref.id)}
                  onChange={(e) => toggleRefSelection(ref.id, e as any)}
                  className="flex-shrink-0 mt-1 cursor-pointer"
                />
                <span
                  className={`flex-shrink-0 mt-0.5 ${
                    selectedRefs.has(ref.id)
                      ? 'text-blue-600 dark:text-blue-400'
                      : selectedId === ref.id
                        ? 'text-white'
                        : 'text-gray-500'
                  }`}
                >
                  {TYPE_ICONS[ref.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${
                      selectedRefs.has(ref.id)
                        ? 'text-blue-700 dark:text-blue-400'
                        : selectedId === ref.id
                          ? 'text-white'
                          : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {ref.title}
                  </p>
                  <p
                    className={`text-[10px] truncate ${
                      selectedRefs.has(ref.id)
                        ? 'text-blue-600 dark:text-blue-500'
                        : selectedId === ref.id
                          ? 'text-white/80'
                          : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {ref.authors ? `${ref.authors.split(',')[0].trim()}` : 'Unknown author'}
                    {ref.year && ` (${ref.year})`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
