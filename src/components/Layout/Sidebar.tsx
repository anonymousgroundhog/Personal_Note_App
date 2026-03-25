import React, { useRef, useState, lazy, Suspense } from 'react'
import { FileText, BarChart2, Calendar, Tag, Search, Moon, Sun, FolderOpen, ChevronLeft, ChevronRight, Network, CheckSquare, Github, Workflow, Bot, Zap, Code2, Globe, DollarSign, Shield, MessageSquare, Mic, HelpCircle } from 'lucide-react'
import { useUiStore } from '../../stores/uiStore'
import type { AppView } from '../../stores/uiStore'
import { useVaultStore, isFsApiSupported } from '../../stores/vaultStore'
import FileTree from './FileTree'

const MeetingNoteModal = lazy(() => import('../../features/meeting/MeetingNoteModal'))

const NAV_ITEMS: { view: AppView; icon: React.ReactNode; label: string; section?: string }[] = [
  { view: 'notes',    icon: <FileText size={18} />,   label: 'Notes' },
  { view: 'gantt',    icon: <BarChart2 size={18} />,   label: 'Gantt' },
  { view: 'calendar', icon: <Calendar size={18} />,    label: 'Calendar' },
  { view: 'tags',     icon: <Tag size={18} />,          label: 'Tags' },
  { view: 'graph',    icon: <Network size={18} />,      label: 'Graph' },
  { view: 'tasks',    icon: <CheckSquare size={18} />,  label: 'Tasks' },
  { view: 'sync',     icon: <Github size={18} />,       label: 'Sync' },
  { view: 'diagram',  icon: <Workflow size={18} />,     label: 'Diagrams', section: 'Tools' },
  { view: 'code',     icon: <Code2 size={18} />,        label: 'Code' },
  { view: 'web',      icon: <Globe size={18} />,         label: 'Web' },
  { view: 'gsd',      icon: <Zap size={18} />,          label: 'GSD' },
  { view: 'ai',       icon: <Bot size={18} />,          label: 'AI Chat' },
  { view: 'finance',  icon: <DollarSign size={18} />,     label: 'Finance' },
  { view: 'security', icon: <Shield size={18} />,         label: 'Security' },
  { view: 'communications', icon: <MessageSquare size={18} />, label: 'Communications', section: 'Communications' },
  { view: 'help', icon: <HelpCircle size={18} />, label: 'Help', section: 'Help' },
]

export default function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, toggleSidebar, darkMode, toggleDarkMode, setCommandPaletteOpen } = useUiStore()
  const { rootHandle, fallbackMode, fallbackName, openVault, openVaultFallback, fileTree } = useVaultStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showMeetingModal, setShowMeetingModal] = useState(false)

  const vaultName = rootHandle?.name || (fallbackMode ? fallbackName : null)
  const hasVault = !!(rootHandle || fallbackMode)

  const handleOpenVault = () => {
    if (isFsApiSupported()) {
      openVault()
    } else {
      fileInputRef.current?.click()
    }
  }

  return (
    <div
      className={`flex flex-col h-full bg-gray-100 dark:bg-surface-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-12'}`}
    >
      {/* Hidden fallback file input */}
      <input
        id="vault-file-input"
        ref={fileInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in the standard types
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) {
            openVaultFallback(e.target.files)
          }
          e.target.value = ''
        }}
      />

      {/* Top controls */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        {sidebarOpen && (
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate px-1">
            {vaultName || 'No Vault'}
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
            onClick={handleOpenVault}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <FolderOpen size={14} />
            {hasVault ? 'Change Vault' : 'Open Vault'}
          </button>
          {!isFsApiSupported() && (
            <div className="px-2 space-y-1">
              <p className="text-[10px] text-amber-500 leading-tight">
                Read-only mode — changes won't be saved to disk.
              </p>
              <p className="text-[10px] text-amber-500 leading-tight">
                For full save support:{' '}
                <a
                  href="/rootCA.pem"
                  download="rootCA.pem"
                  className="underline hover:text-amber-400"
                  title="Download and install this CA cert in Chrome to enable full access"
                >
                  download &amp; install the CA cert
                </a>
                , then reload.
              </p>
            </div>
          )}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Search size={14} />
            Search <kbd className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">⌘K</kbd>
          </button>
          <button
            onClick={() => setShowMeetingModal(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Mic size={14} />
            Quick Meeting
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="p-2 space-y-0.5">
        {NAV_ITEMS.map(({ view, icon, label, section }, idx) => (
          <React.Fragment key={view}>
            {section && (
              <div className={`${idx > 0 ? 'mt-2 pt-2 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                {sidebarOpen && (
                  <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {section}
                  </p>
                )}
              </div>
            )}
            <button
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
          </React.Fragment>
        ))}
      </nav>

      {/* File tree */}
      {sidebarOpen && activeView === 'notes' && hasVault && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          <FileTree nodes={fileTree} />
        </div>
      )}

      {/* Bottom controls */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        {!sidebarOpen && (
          <button
            onClick={() => setShowMeetingModal(true)}
            className="w-full flex items-center justify-center p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 mb-1"
            title="Quick Meeting"
          >
            <Mic size={16} />
          </button>
        )}
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Toggle dark mode"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {sidebarOpen && (darkMode ? 'Light mode' : 'Dark mode')}
        </button>
      </div>

      {/* Meeting note modal — rendered outside sidebar flow so it overlays entire app */}
      {showMeetingModal && (
        <Suspense fallback={null}>
          <MeetingNoteModal onClose={() => setShowMeetingModal(false)} />
        </Suspense>
      )}
    </div>
  )
}
