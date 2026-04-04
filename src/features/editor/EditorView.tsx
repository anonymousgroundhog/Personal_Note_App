import React, { useState, useMemo, useRef } from 'react'
import { FileText, Plus, Search, Edit3, Clock, X, Network, FileUp } from 'lucide-react'
import NoteTabEditor from './NoteTabEditor'
import GraphView from '../graph/GraphView'
import PdfImport from './PdfImport'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { todayIso } from '../../lib/fs/pathUtils'

export default function EditorView() {
  const { openTabs, activeTabPath, openTab, closeTab, setActiveTab } = useUiStore()
  const { createNote, index } = useVaultStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [subView, setSubView] = useState<'notes' | 'graph'>('notes')
  const [showPdfImport, setShowPdfImport] = useState(false)
  const [newNoteName, setNewNoteName] = useState<string | null>(null)
  const newNoteInputRef = useRef<HTMLInputElement>(null)

  const handleNewNote = () => {
    setNewNoteName('')
    setTimeout(() => newNoteInputRef.current?.focus(), 0)
  }

  const handleNewNoteSubmit = async (name: string) => {
    setNewNoteName(null)
    if (!name.trim()) return
    const filename = name.endsWith('.md') ? name : `${name}.md`
    const today = todayIso()
    const template = `---\ntags: []\ndate: ${today}\n---\n\n# ${name.replace(/\.md$/, '')}\n\n`
    await createNote(filename, template)
    openTab(filename)
  }

  const suggestions = useMemo(() => {
    const entries = Array.from(index.entries()).map(([path, note]) => ({ path, note }))
    if (!searchQuery.trim()) {
      return entries.sort((a, b) => a.path.localeCompare(b.path)).slice(0, 12)
    }
    const q = searchQuery.toLowerCase()
    return entries
      .filter(({ path, note }) =>
        note.name.toLowerCase().includes(q) ||
        path.toLowerCase().includes(q) ||
        (note.excerpt || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aName = a.note.name.toLowerCase().includes(q) ? 0 : 1
        const bName = b.note.name.toLowerCase().includes(q) ? 0 : 1
        return aName - bName || a.path.localeCompare(b.path)
      })
      .slice(0, 12)
  }, [index, searchQuery])

  const SubViewTabs = () => (
    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 px-3 flex-shrink-0">
      <button
        onClick={() => setSubView('notes')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${subView === 'notes' ? 'border-accent-500 text-accent-500 font-medium' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
      >
        <FileText size={14} />
        Notes
      </button>
      <button
        onClick={() => setSubView('graph')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${subView === 'graph' ? 'border-accent-500 text-accent-500 font-medium' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
      >
        <Network size={14} />
        Graph
      </button>
    </div>
  )

  if (subView === 'graph') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
        <SubViewTabs />
        <GraphView />
      </div>
    )
  }

  // Show landing view when no tabs are open
  if (openTabs.length === 0) {
    return (
      <>
      <div className="flex-1 flex flex-col bg-white dark:bg-surface-900 overflow-hidden">
        <SubViewTabs />
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowPdfImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors text-sm"
            >
              <FileUp size={14} />
              Import PDF
            </button>
            {newNoteName !== null ? (
              <form
                onSubmit={e => { e.preventDefault(); handleNewNoteSubmit(newNoteName) }}
                className="flex items-center gap-1"
              >
                <input
                  ref={newNoteInputRef}
                  type="text"
                  value={newNoteName}
                  onChange={e => setNewNoteName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setNewNoteName(null) }}
                  placeholder="Note name…"
                  className="px-2 py-1.5 text-sm border border-accent-500 rounded bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 w-40"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors text-sm"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setNewNoteName(null)}
                  className="px-2 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                onClick={handleNewNote}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors text-sm"
              >
                <Plus size={14} />
                New Note
              </button>
            )}
          </div>
        </div>
        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes by name or content…"
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-400"
            />
          </div>
        </div>
        {/* Suggestions grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {index.size === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <Edit3 size={48} className="opacity-30" />
              <p className="text-base">No vault open</p>
              <p className="text-sm text-center max-w-xs">Open a vault folder from the sidebar to start managing your notes.</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
              <Search size={24} className="opacity-40" />
              <p className="text-sm">No notes match "{searchQuery}"</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                <Clock size={11} />
                {searchQuery ? `${suggestions.length} result${suggestions.length !== 1 ? 's' : ''}` : `${index.size} note${index.size !== 1 ? 's' : ''} — showing ${suggestions.length}`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {suggestions.map(({ path, note }) => {
                  const rawTags = note.frontmatter?.tags
                  const tags: string[] = Array.isArray(rawTags) ? rawTags : rawTags ? [String(rawTags)] : []
                  const name = note.name || path.split('/').pop()?.replace(/\.md$/, '') || path
                  return (
                    <button
                      key={path}
                      onClick={() => openTab(path)}
                      className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-accent-500 hover:bg-accent-500/5 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <FileText size={14} className="text-gray-400 group-hover:text-accent-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate group-hover:text-accent-500">
                            {name}
                          </p>
                          {note.excerpt && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {note.excerpt.slice(0, 100)}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-xs px-1.5 py-0.5 bg-accent-500/10 text-accent-500 rounded-full">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {showPdfImport && <PdfImport onClose={() => setShowPdfImport(false)} />}
      </>
    )
  }

  // Show tabs and editor when notes are open
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      <SubViewTabs />
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-thin flex-shrink-0">
        {openTabs.map(path => {
          const name = path.split('/').pop()?.replace(/\.md$/, '') || path
          const isActive = path === activeTabPath
          return (
            <div
              key={path}
              onClick={() => setActiveTab(path)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t cursor-pointer whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-white dark:bg-surface-900 border-t border-x border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                  : 'bg-gray-50 dark:bg-surface-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700'
              }`}
            >
              <FileText size={14} className="flex-shrink-0" />
              <span className="text-sm max-w-[150px] truncate">{name}</span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  closeTab(path)
                }}
                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 flex-shrink-0"
                title="Close tab"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
        <div className="ml-auto flex-shrink-0">
          <button
            onClick={() => setShowPdfImport(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
            title="Import PDF as note"
          >
            <FileUp size={12} />
            Import PDF
          </button>
        </div>
      </div>

      {/* Editors container */}
      <div className="flex-1 overflow-hidden">
        {openTabs.map(path => (
          <NoteTabEditor key={path} path={path} isActive={path === activeTabPath} />
        ))}
      </div>
      {showPdfImport && <PdfImport onClose={() => setShowPdfImport(false)} />}
    </div>
  )
}
