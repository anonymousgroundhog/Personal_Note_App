import React, { useEffect } from 'react'
import Sidebar from './components/Layout/Sidebar'
import EditorView from './features/editor/EditorView'
import GanttView from './features/gantt/GanttView'
import CalendarView from './features/calendar/CalendarView'
import TagBrowser from './features/tags/TagBrowser'
import GraphView from './features/graph/GraphView'
import CommandPalette from './features/search/CommandPalette'
import { useUiStore } from './stores/uiStore'
import { useVaultStore } from './stores/vaultStore'
import { FolderOpen } from 'lucide-react'

function WelcomeScreen() {
  const { openVault } = useVaultStore()
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-white dark:bg-surface-900 text-gray-600 dark:text-gray-400">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Personal Note App</h1>
        <p className="text-gray-500 dark:text-gray-400">Obsidian-style notes with Gantt charts and calendar views</p>
      </div>
      <button
        onClick={openVault}
        className="flex items-center gap-3 px-6 py-3 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors text-lg font-medium shadow-lg"
      >
        <FolderOpen size={22} />
        Open Vault Folder
      </button>
      <div className="text-sm text-gray-400 max-w-sm text-center">
        Select a folder containing your markdown notes. All .md files will be indexed automatically.
      </div>
      <div className="grid grid-cols-3 gap-4 max-w-lg mt-4">
        {[
          { icon: '📝', title: 'Markdown Notes', desc: 'Full markdown with wiki-links and callouts' },
          { icon: '📊', title: 'Gantt Charts', desc: 'Visualize project timelines from your notes' },
          { icon: '📅', title: 'Calendar', desc: 'Day/Week/Month views + Google & Outlook import' },
        ].map(f => (
          <div key={f.title} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-2xl mb-1">{f.icon}</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{f.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const { activeView, darkMode } = useUiStore()
  const { rootHandle } = useVaultStore()

  useEffect(() => {
    if (darkMode) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }, [darkMode])

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-surface-900">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        {!rootHandle ? (
          <WelcomeScreen />
        ) : (
          <>
            {activeView === 'notes' && <EditorView />}
            {activeView === 'gantt' && <GanttView />}
            {activeView === 'calendar' && <CalendarView />}
            {activeView === 'tags' && <TagBrowser />}
            {activeView === 'graph' && <GraphView />}
          </>
        )}
      </main>
      <CommandPalette />
    </div>
  )
}
