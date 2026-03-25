import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { Eye, Edit3, Plus, RefreshCw, Tag, Download, Trash2 } from 'lucide-react'
import MarkdownEditor from './MarkdownEditor'
import MarkdownPreview from './MarkdownPreview'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { parseFrontmatter, buildProcessor } from '../../lib/markdown/processor'
import { exportNoteToPdf, saveToFileSystem } from '../../lib/pdf/export'

type EditorMode = 'edit' | 'preview' | 'split'

interface Props {
  path: string
  isActive: boolean
}

export default function NoteTabEditor({ path, isActive }: Props) {
  const { readNote, saveNote, refreshIndex, deleteNote, index } = useVaultStore()
  const { closeTab } = useUiStore()
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<EditorMode>('split')
  const [dirty, setDirty] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [tagSuggestionIdx, setTagSuggestionIdx] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!isActive) return
    readNote(path).then(text => {
      setContent(text)
      setDirty(false)
    })
  }, [path, isActive, readNote])

  const handleChange = useCallback((value: string) => {
    setContent(value)
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await saveNote(path, value)
      setDirty(false)
    }, 800)
  }, [path, saveNote])

  const handleAddTag = useCallback(async (override?: string) => {
    const value = (override ?? tagInput).trim()
    if (!value) return
    const { frontmatter, body } = parseFrontmatter(content)
    const tags = (frontmatter.tags as string[] || [])
    if (!tags.includes(value)) {
      tags.push(value)
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
    setShowTagSuggestions(false)
    setTagSuggestionIdx(0)
  }, [tagInput, content, handleChange])

  const handleRemoveTag = useCallback(async (tagToRemove: string) => {
    const { frontmatter, body } = parseFrontmatter(content)
    const tags = ((frontmatter.tags as string[] || [])).filter(t => t !== tagToRemove)
    const newFrontmatter = { ...frontmatter, tags }
    const yaml = Object.entries(newFrontmatter).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
      return `${k}: ${v}`
    }).join('\n')
    handleChange(`---\n${yaml}\n---\n\n${body}`)
  }, [content, handleChange])

  const handleExportPdf = useCallback(async () => {
    if (!content) return
    setIsExporting(true)
    try {
      const noteName = path.split('/').pop()?.replace(/\.md$/, '') || 'note'

      const tempContainer = document.createElement('div')
      tempContainer.style.display = 'none'
      document.body.appendChild(tempContainer)

      try {
        const root = ReactDOM.createRoot(tempContainer)
        root.render(<MarkdownPreview content={content} />)
        await new Promise(resolve => setTimeout(resolve, 100))
        const htmlContent = tempContainer.innerHTML
        await exportNoteToPdf(noteName, htmlContent, saveToFileSystem)
        root.unmount()
      } finally {
        document.body.removeChild(tempContainer)
      }
    } catch (error) {
      console.error('Failed to export PDF:', error)
      alert('Failed to export PDF. ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }, [path, content])

  const handleDelete = useCallback(async () => {
    const noteName = path.split('/').pop()?.replace(/\.md$/, '') || 'note'
    if (!confirm(`Are you sure you want to delete "${noteName}"? This cannot be undone.`)) {
      return
    }
    try {
      await deleteNote(path)
      await refreshIndex()
      closeTab(path)
    } catch (error) {
      console.error('Failed to delete note:', error)
      alert('Failed to delete note. ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }, [path, deleteNote, refreshIndex, closeTab])

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showTagSuggestions || filteredTagSuggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); handleAddTag() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTagSuggestionIdx(i => Math.min(i + 1, filteredTagSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setTagSuggestionIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      handleAddTag(filteredTagSuggestions[tagSuggestionIdx])
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false)
    }
  }

  const allVaultTags = useMemo(() => {
    const freq = new Map<string, number>()
    for (const note of index.values()) {
      const t = note.frontmatter?.tags as string[] | undefined
      if (Array.isArray(t)) t.forEach(tag => freq.set(tag, (freq.get(tag) ?? 0) + 1))
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  }, [index])

  const filteredTagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase()
    if (!q) return allVaultTags.slice(0, 8)
    return allVaultTags.filter(t => t.toLowerCase().includes(q) && t.toLowerCase() !== q).slice(0, 8)
  }, [allVaultTags, tagInput])

  const { frontmatter } = parseFrontmatter(content)
  const tags = (frontmatter.tags as string[] || [])

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isActive ? '' : 'hidden'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
          {path.split('/').pop()?.replace(/\.md$/, '')}
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
            onClick={() => { refreshIndex(); readNote(path).then(setContent) }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export as PDF"
          >
            <Download size={15} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 transition-colors"
            title="Delete note"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Tag panel */}
      {showTagPanel && (
        <div className="px-4 py-1.5 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-accent-500/10 text-accent-500 rounded-full text-xs group">
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:bg-accent-500/20 rounded-full p-0.5 opacity-60 hover:opacity-100"
                  title={`Remove #${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <div className="relative">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value)
                  setShowTagSuggestions(true)
                  setTagSuggestionIdx(0)
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag…"
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-32"
              />
              {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-0.5 bg-white dark:bg-surface-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 min-w-36 py-0.5">
                  {filteredTagSuggestions.map((tag, i) => (
                    <button
                      key={tag}
                      onMouseDown={e => { e.preventDefault(); handleAddTag(tag) }}
                      className={`w-full text-left px-3 py-1 text-xs flex items-center gap-1.5 ${
                        i === tagSuggestionIdx
                          ? 'bg-accent-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600'
                      }`}
                    >
                      <Tag size={9} />
                      {tag}
                    </button>
                  ))}
                  {tagInput.trim() && !allVaultTags.some(t => t.toLowerCase() === tagInput.trim().toLowerCase()) && (
                    <button
                      onMouseDown={e => { e.preventDefault(); handleAddTag() }}
                      className="w-full text-left px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-600 border-t border-gray-100 dark:border-gray-600 flex items-center gap-1.5"
                    >
                      <Plus size={9} />
                      Create "{tagInput.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
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
