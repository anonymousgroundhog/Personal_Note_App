import React, { useState, useEffect } from 'react'
import { ChevronRight, FolderOpen, Home, Loader, X, Check } from 'lucide-react'

interface DirectoryEntry {
  name: string
  path: string
  type: 'dir' | 'file'
}

interface DirectoryBrowserProps {
  onSelect: (path: string) => void
  onCancel: () => void
  initialPath?: string
}

const GIT_SERVER = 'http://localhost:3001'

export function DirectoryBrowser({ onSelect, onCancel, initialPath }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDirectory(currentPath)
  }, [currentPath])

  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError('')
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : ''
      const res = await fetch(`${GIT_SERVER}/browse/ls${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load directory' }))
        throw new Error((err as { error?: string }).error ?? 'Failed to load directory')
      }
      const data = await res.json() as { path: string; entries: DirectoryEntry[] }
      setCurrentPath(data.path)
      setEntries(data.entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const goToParent = () => {
    const parts = currentPath.split('/').filter(Boolean)
    if (parts.length === 0) return
    parts.pop()
    const parent = '/' + parts.join('/')
    setCurrentPath(parent)
  }

  const enterDirectory = (path: string) => {
    setCurrentPath(path)
  }

  const pathSegments = currentPath.split('/').filter(Boolean)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl w-96 max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Select Vault Folder</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Path display with breadcrumbs */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 flex-wrap mb-2">
            <button
              onClick={() => setCurrentPath('/')}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Home size={14} /> /
            </button>
            {pathSegments.map((seg, idx) => {
              const path = '/' + pathSegments.slice(0, idx + 1).join('/')
              return (
                <React.Fragment key={path}>
                  <ChevronRight size={12} className="text-gray-400" />
                  <button
                    onClick={() => setCurrentPath(path)}
                    className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                  >
                    {seg}
                  </button>
                </React.Fragment>
              )
            })}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
            {currentPath || '/'}
          </div>
        </div>

        {/* Directory listing */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader size={16} className="animate-spin mr-2" />
              Loading…
            </div>
          ) : error ? (
            <div className="p-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">Empty directory</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {entries
                .filter(e => e.type === 'dir')
                .map(entry => (
                  <button
                    key={entry.path}
                    onClick={() => enterDirectory(entry.path)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <FolderOpen size={14} className="text-blue-500 flex-shrink-0" />
                    <span className="truncate">{entry.name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => goToParent()}
            disabled={currentPath === '/' || !currentPath}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            disabled={!currentPath}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={14} /> Select
          </button>
        </div>
      </div>
    </div>
  )
}
