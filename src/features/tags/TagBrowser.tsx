import React, { useMemo, useState } from 'react'
import { Tag, FileText, Search } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'

export default function TagBrowser() {
  const { index } = useVaultStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const tagMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const note of index.values()) {
      const tags = (note.frontmatter.tags as string[] | undefined) || []
      for (const tag of tags) {
        const normalTag = tag.toLowerCase().replace(/^#/, '')
        if (!map.has(normalTag)) map.set(normalTag, [])
        map.get(normalTag)!.push(note.path)
      }
    }
    return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length))
  }, [index])

  const filteredTags = useMemo(() => {
    return [...tagMap.entries()].filter(([tag]) =>
      tag.toLowerCase().includes(search.toLowerCase())
    )
  }, [tagMap, search])

  const notesForTag = useMemo(() => {
    if (!selectedTag) return []
    const paths = tagMap.get(selectedTag) || []
    return paths.map(p => index.get(p)).filter(Boolean)
  }, [selectedTag, tagMap, index])

  return (
    <div className="flex-1 flex overflow-hidden bg-white dark:bg-surface-900">
      {/* Tag list */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={16} className="text-accent-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Tags</span>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tags..."
              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {filteredTags.map(([tag, paths]) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                selectedTag === tag
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>#{tag}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedTag === tag ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {paths.length}
              </span>
            </button>
          ))}
          {filteredTags.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No tags found</p>
          )}
        </div>
      </div>

      {/* Notes for selected tag */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {selectedTag ? (
          <>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
              #{selectedTag}
              <span className="ml-2 text-sm font-normal text-gray-500">{notesForTag.length} notes</span>
            </h2>
            <div className="space-y-2">
              {notesForTag.map(note => note && (
                <button
                  key={note.path}
                  onClick={() => { setActiveNote(note.path); setActiveView('notes') }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-accent-500 hover:bg-accent-500/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={14} className="text-accent-500" />
                    <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{note.name}</span>
                    {note.frontmatter.date && (
                      <span className="ml-auto text-xs text-gray-400">{String(note.frontmatter.date)}</span>
                    )}
                  </div>
                  {note.excerpt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{note.excerpt}</p>
                  )}
                  {((note.frontmatter.tags as string[] | undefined) || []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {((note.frontmatter.tags as string[] | undefined) || []).map(t => (
                        <span key={t} className="text-xs px-1.5 bg-accent-500/10 text-accent-500 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Tag size={48} className="opacity-20 mb-3" />
            <p>Select a tag to view notes</p>
          </div>
        )}
      </div>
    </div>
  )
}
