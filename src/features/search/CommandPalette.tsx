import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, FileText, X } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'

export default function CommandPalette() {
  const { index } = useVaultStore()
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveNote, setActiveView } = useUiStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandPaletteOpen])

  const results = useMemo(() => {
    if (!query.trim()) {
      return [...index.values()].slice(0, 10)
    }
    const q = query.toLowerCase()
    return [...index.values()]
      .filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        (n.frontmatter.tags as string[] | undefined)?.some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 20)
  }, [query, index])

  const handleSelect = (path: string) => {
    setActiveNote(path)
    setActiveView('notes')
    setCommandPaletteOpen(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return
      if (e.key === 'Escape') setCommandPaletteOpen(false)
      if (e.key === 'ArrowDown') setSelected(s => Math.min(s + 1, results.length - 1))
      if (e.key === 'ArrowUp') setSelected(s => Math.max(s - 1, 0))
      if (e.key === 'Enter' && results[selected]) handleSelect(results[selected].path)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, results, selected])

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  if (!commandPaletteOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-24 z-50"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search notes..."
            className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none"
          />
          <button onClick={() => setCommandPaletteOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {results.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No notes found</p>
          ) : (
            results.map((note, i) => (
              <button
                key={note.path}
                onClick={() => handleSelect(note.path)}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                  i === selected ? 'bg-accent-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FileText size={14} className="text-accent-500 mt-0.5 flex-shrink-0" />
                <div className="overflow-hidden">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{note.name}</div>
                  {note.excerpt && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{note.excerpt}</div>
                  )}
                  {((note.frontmatter.tags as string[] | undefined) || []).length > 0 && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {((note.frontmatter.tags as string[] | undefined) || []).slice(0, 4).map(t => (
                        <span key={t} className="text-xs text-accent-500 opacity-70">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                  {note.path.split('/').slice(0, -1).join('/')}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">↵</kbd> Open</span>
          <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
