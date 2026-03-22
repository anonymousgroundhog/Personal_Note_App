import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Eye, Edit3, Plus, RefreshCw, Tag, Search, FileText, Clock } from 'lucide-react'
import MarkdownEditor from './MarkdownEditor'
import MarkdownPreview from './MarkdownPreview'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { parseFrontmatter } from '../../lib/markdown/processor'
import { todayIso } from '../../lib/fs/pathUtils'

type EditorMode = 'edit' | 'preview' | 'split'

export default function EditorView() {
  const { activeNotePath, setActiveNote } = useUiStore()
  const { readNote, saveNote, createNote, refreshIndex, index } = useVaultStore()
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<EditorMode>('split')
  const [dirty, setDirty] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagPanel, setShowTagPanel] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!activeNotePath) { setContent(''); return }
    readNote(activeNotePath).then(text => {
      setContent(text)
      setDirty(false)
    })
  }, [activeNotePath, readNote])

  const handleChange = useCallback((value: string) => {
    setContent(value)
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (activeNotePath) {
        await saveNote(activeNotePath, value)
        setDirty(false)
      }
    }, 800)
  }, [activeNotePath, saveNote])

  const handleNewNote = async () => {
    const name = prompt('Note name:')
    if (!name) return
    const filename = name.endsWith('.md') ? name : `${name}.md`
    const today = todayIso()
    const template = `---\ntags: []\ndate: ${today}\n---\n\n# ${name.replace(/\.md$/, '')}\n\n`
    await createNote(filename, template)
    setActiveNote(filename)
  }

  const handleAddTag = async () => {
    if (!activeNotePath || !tagInput.trim()) return
    const { frontmatter, body } = parseFrontmatter(content)
    const tags = (frontmatter.tags as string[] || [])
    if (!tags.includes(tagInput.trim())) {
      tags.push(tagInput.trim())
    }
    const newFrontmatter = { ...frontmatter, tags }
    const yaml = Object.entries(newFrontmatter).map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
      }
      return `${k}: ${v}`
    }).join('\n')
    const newContent = `---\n${yaml}\n---\n\n${body}`
    handleChange(newContent)
    setTagInput('')
  }

  const [searchQuery, setSearchQuery] = useState('')

  const suggestions = useMemo(() => {
    const entries = Array.from(index.entries()).map(([path, note]) => ({ path, note }))
    if (!searchQuery.trim()) {
      // Sort by path (alphabetical) and return first 12
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
        // Rank name matches above excerpt matches
        const aName = a.note.name.toLowerCase().includes(q) ? 0 : 1
        const bName = b.note.name.toLowerCase().includes(q) ? 0 : 1
        return aName - bName || a.path.localeCompare(b.path)
      })
      .slice(0, 12)
  }, [index, searchQuery])

  const { frontmatter } = parseFrontmatter(content)
  const tags = (frontmatter.tags as string[] || [])

  if (!activeNotePath) {
    return (
      <div className="flex-1 flex flex-col bg-white dark:bg-surface-900 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <FileText size={18} className="text-accent-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notes</span>
          <div className="ml-auto">
            <button
              onClick={handleNewNote}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors text-sm"
            >
              <Plus size={14} />
              New Note
            </button>
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
                  const tags = (note.frontmatter?.tags as string[] | undefined) || []
                  const name = note.name || path.split('/').pop()?.replace(/\.md$/, '') || path
                  return (
                    <button
                      key={path}
                      onClick={() => setActiveNote(path)}
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
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
          {activeNotePath?.split('/').pop()?.replace(/\.md$/, '')}
          {dirty && <span className="ml-2 text-xs text-gray-400">●</span>}
        </span>
        <div className="flex items-center gap-1">
          {/* Tags */}
          <button
            onClick={() => setShowTagPanel(p => !p)}
            className={`p-1.5 rounded text-sm ${showTagPanel ? 'bg-accent-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title="Tags"
          >
            <Tag size={15} />
          </button>
          {/* Mode buttons */}
          {(['edit', 'split', 'preview'] as EditorMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 rounded text-xs ${mode === m ? 'bg-accent-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            >
              {m === 'edit' ? <Edit3 size={14} /> : m === 'preview' ? <Eye size={14} /> : <span className="font-mono text-xs">⊞</span>}
            </button>
          ))}
          <button
            onClick={() => { refreshIndex(); if (activeNotePath) readNote(activeNotePath).then(setContent) }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleNewNote}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="New note"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Tag panel */}
      {showTagPanel && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          {tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-accent-500/10 text-accent-500 rounded-full text-xs">
              #{tag}
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddTag() }}
            placeholder="Add tag..."
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-28"
          />
        </div>
      )}

      {/* Editor / Preview */}
      <div className="flex-1 flex overflow-hidden">
        {(mode === 'edit' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full'} overflow-hidden`}>
            <MarkdownEditor value={content} onChange={handleChange} />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} overflow-hidden`}>
            <MarkdownPreview content={parseFrontmatter(content).body} />
          </div>
        )}
      </div>
    </div>
  )
}
