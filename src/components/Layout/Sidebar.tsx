import React from 'react'
import { FileText, BarChart2, Calendar, Tag, Search, Moon, Sun, FolderOpen, ChevronLeft, ChevronRight, Network } from 'lucide-react'
import { useUiStore } from '../../stores/uiStore'
import type { AppView } from '../../stores/uiStore'
import { useVaultStore } from '../../stores/vaultStore'
import FileTree from './FileTree'

const NAV_ITEMS: { view: AppView; icon: React.ReactNode; label: string }[] = [
  { view: 'notes', icon: <FileText size={18} />, label: 'Notes' },
  { view: 'gantt', icon: <BarChart2 size={18} />, label: 'Gantt' },
  { view: 'calendar', icon: <Calendar size={18} />, label: 'Calendar' },
  { view: 'tags', icon: <Tag size={18} />, label: 'Tags' },
  { view: 'graph', icon: <Network size={18} />, label: 'Graph' },
]

export default function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, toggleSidebar, darkMode, toggleDarkMode, setCommandPaletteOpen } = useUiStore()
  const { rootHandle, openVault, fileTree } = useVaultStore()

  return (
    <div
      className={`flex flex-col h-full bg-gray-100 dark:bg-surface-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-12'}`}
    >
      {/* Top controls */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        {sidebarOpen && (
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate px-1">
            {rootHandle?.name || 'No Vault'}
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 ml-auto"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Actions */}
      {sidebarOpen && (
        <div className="p-2 space-y-1">
          <button
            onClick={openVault}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <FolderOpen size={14} />
            Open Vault
          </button>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Search size={14} />
            Search <kbd className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="p-2 space-y-0.5">
        {NAV_ITEMS.map(({ view, icon, label }) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              activeView === view
                ? 'bg-accent-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={!sidebarOpen ? label : undefined}
          >
            {icon}
            {sidebarOpen && label}
          </button>
        ))}
      </nav>

      {/* File tree */}
      {sidebarOpen && activeView === 'notes' && rootHandle && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          <FileTree nodes={fileTree} />
        </div>
      )}

      {/* Bottom controls */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Toggle dark mode"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {sidebarOpen && (darkMode ? 'Light mode' : 'Dark mode')}
        </button>
      </div>
    </div>
  )
}
