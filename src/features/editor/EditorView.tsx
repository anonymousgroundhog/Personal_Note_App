import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Eye, Edit3, Plus, RefreshCw, Tag } from 'lucide-react'
import MarkdownEditor from './MarkdownEditor'
import MarkdownPreview from './MarkdownPreview'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { parseFrontmatter } from '../../lib/markdown/processor'
import { todayIso } from '../../lib/fs/pathUtils'

type EditorMode = 'edit' | 'preview' | 'split'

export default function EditorView() {
  const { activeNotePath, setActiveNote } = useUiStore()
  const { readNote, saveNote, createNote, refreshIndex } = useVaultStore()
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

  const { frontmatter } = parseFrontmatter(content)
  const tags = (frontmatter.tags as string[] || [])

  if (!activeNotePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white dark:bg-surface-900 text-gray-400">
        <Edit3 size={48} className="opacity-30" />
        <p className="text-lg">No note selected</p>
        <button
          onClick={handleNewNote}
          className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
        >
          <Plus size={16} />
          New Note
        </button>
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
