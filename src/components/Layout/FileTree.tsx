import React, { useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react'
import type { FileTreeNode } from '../../types/note'
import { useUiStore } from '../../stores/uiStore'
import { useVaultStore } from '../../stores/vaultStore'
import { todayIso } from '../../lib/fs/pathUtils'

interface Props {
  nodes: FileTreeNode[]
  depth?: number
}

export default function FileTree({ nodes, depth = 0 }: Props) {
  const { setActiveNote, setActiveView } = useUiStore()
  const { createNote, deleteNote } = useVaultStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hovering, setHovering] = useState<string | null>(null)

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const handleCreateNote = async (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation()
    const name = prompt('Note name:')
    if (!name) return
    const path = `${folderPath}/${name.endsWith('.md') ? name : name + '.md'}`
    const today = todayIso()
    const content = `---\ntags: []\ndate: ${today}\n---\n\n# ${name.replace(/\.md$/, '')}\n\n`
    await createNote(path, content)
    setActiveNote(path)
    setActiveView('notes')
  }

  const handleDelete = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    if (!confirm(`Delete "${path.split('/').pop()}"?`)) return
    await deleteNote(path)
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map(node => (
        <li key={node.path}>
          <div
            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer group"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            onMouseEnter={() => setHovering(node.path)}
            onMouseLeave={() => setHovering(null)}
            onClick={() => {
              if (node.type === 'folder') toggle(node.path)
              else {
                setActiveNote(node.path)
                setActiveView('notes')
              }
            }}
            draggable={node.type === 'file'}
            onDragStart={node.type === 'file' ? (e) => {
              e.dataTransfer.setData('text/x-note-path', node.path)
              e.dataTransfer.effectAllowed = 'copy'
            } : undefined}
          >
            {node.type === 'folder' ? (
              <>
                {expanded.has(node.path) ? <ChevronDown size={12} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />}
                {expanded.has(node.path) ? <FolderOpen size={14} className="text-accent-500 flex-shrink-0" /> : <Folder size={14} className="text-accent-500 flex-shrink-0" />}
              </>
            ) : (
              <>
                <span className="w-3 flex-shrink-0" />
                <FileText size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </>
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
              {node.name.replace(/\.md$/, '')}
            </span>
            {hovering === node.path && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {node.type === 'folder' && (
                  <button
                    onClick={(e) => handleCreateNote(e, node.path)}
                    className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500"
                    title="New note"
                  >
                    <Plus size={12} />
                  </button>
                )}
                {node.type === 'file' && (
                  <button
                    onClick={(e) => handleDelete(e, node.path)}
                    className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                    title="Delete note"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
          {node.type === 'folder' && expanded.has(node.path) && node.children && (
            <FileTree nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}
