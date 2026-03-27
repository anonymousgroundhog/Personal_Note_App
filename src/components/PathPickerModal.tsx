import React, { useState, useEffect } from 'react'
import { X, Folder, File, ChevronRight, Home } from 'lucide-react'

interface Entry {
  name: string
  path: string
  type: 'dir' | 'file'
}

interface PathPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (path: string) => void
  startPath?: string
  title?: string
  /** If true, only directories are selectable. If false, files are also selectable. */
  dirOnly?: boolean
  /** File extension filter e.g. '.apk' */
  fileFilter?: string
}

// Host home directory mounted into the container by docker-compose
const HOST_HOME = '/root/host-home'

export default function PathPickerModal({
  isOpen,
  onClose,
  onSelect,
  startPath = HOST_HOME,
  title = 'Select Path',
  dirOnly = true,
  fileFilter,
}: PathPickerModalProps) {
  const [currentPath, setCurrentPath] = useState(startPath)
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      navigate(startPath)
    }
  }, [isOpen, startPath])

  const navigate = async (path: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`http://localhost:3001/browse/ls?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error(`Cannot read directory: ${path}`)
      const data = await res.json()
      setCurrentPath(data.path)
      const filtered = (data.entries as Entry[]).filter(e => {
        if (e.type === 'dir') return true
        if (dirOnly) return false
        if (fileFilter) return e.name.endsWith(fileFilter)
        return true
      })
      setEntries(filtered)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const goUp = () => {
    // Don't navigate above /host-home
    if (currentPath === HOST_HOME) return
    const parent = currentPath.split('/').slice(0, -1).join('/') || HOST_HOME
    navigate(parent)
  }

  if (!isOpen) return null

  // Build breadcrumb parts, treating /host-home as the root shown to the user
  const relativePath = currentPath.startsWith(HOST_HOME)
    ? currentPath.slice(HOST_HOME.length) || '/'
    : currentPath
  const parts = relativePath.split('/').filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
        style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 shrink-0 overflow-x-auto">
          <button onClick={() => navigate(HOST_HOME)} className="hover:text-blue-500 shrink-0 flex items-center gap-1">
            <Home size={12} />
            <span>~</span>
          </button>
          {parts.map((part, i) => {
            const path = HOST_HOME + '/' + parts.slice(0, i + 1).join('/')
            return (
              <React.Fragment key={path}>
                <ChevronRight size={10} className="shrink-0" />
                <button onClick={() => navigate(path)} className="hover:text-blue-500 shrink-0 truncate max-w-[120px]">
                  {part}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Entries */}
        <div className="overflow-y-auto flex-1 py-1">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
          )}
          {error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}
          {!loading && !error && currentPath !== HOST_HOME && (
            <button
              onClick={goUp}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-700"
            >
              <Folder size={14} className="text-yellow-500 shrink-0" />
              ..
            </button>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Empty directory</div>
          )}
          {!loading && entries.map(entry => (
            <button
              key={entry.path}
              onClick={() => entry.type === 'dir' ? navigate(entry.path) : onSelect(entry.path)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-surface-700"
            >
              {entry.type === 'dir'
                ? <Folder size={14} className="text-yellow-500 shrink-0" />
                : <File size={14} className="text-gray-400 shrink-0" />}
              <span className="truncate text-gray-800 dark:text-gray-200">{entry.name}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 truncate font-mono">{currentPath}</span>
          {dirOnly && (
            <button
              onClick={() => onSelect(currentPath)}
              className="shrink-0 px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Select This Folder
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
