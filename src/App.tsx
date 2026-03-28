import React, { useEffect } from 'react'
import Sidebar from './components/Layout/Sidebar'
import EditorView from './features/editor/EditorView'
import TagBrowser from './features/tags/TagBrowser'
import SyncView from './features/sync/SyncView'
import DiagramEditor from './features/diagram/DiagramEditor'
import AiView from './features/ai/AiView'
import GsdView from './features/gsd/GsdView'
import CodeEditor from './features/code/CodeEditor'
import WebView from './features/web/WebView'
import FinanceView from './features/finance/FinanceView'
import SecurityView from './features/security/SecurityView'
import CommunicationsView from './features/communications/CommunicationsView'
import HelpView from './features/help/HelpView'
import AccessibilityView from './features/accessibility/AccessibilityView'
import AudioToTextView from './features/audio/AudioToTextView'
import MinecraftView from './features/minecraft/MinecraftView'
import CommandPalette from './features/search/CommandPalette'
import { useUiStore } from './stores/uiStore'
import { useVaultStore, isFsApiSupported } from './stores/vaultStore'
import { FolderOpen } from 'lucide-react'

function WelcomeScreen() {
  const { openVault } = useVaultStore()
  const fsSupported = isFsApiSupported()
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
      {!fsSupported && (
        <div className="max-w-sm text-center px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          Your browser doesn't support the File System API. You can still open a folder — notes will be loaded read-only. For full save support, use Chrome or Edge.
        </div>
      )}
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
  const { rootHandle, fallbackMode } = useVaultStore()
  const hasVault = !!(rootHandle || fallbackMode)

  useEffect(() => {
    if (darkMode) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }, [darkMode])

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-surface-900">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden h-full">
        {activeView === 'sync' ? (
          <SyncView />
        ) : activeView === 'diagram' ? (
          <DiagramEditor />
        ) : activeView === 'ai' ? (
          <AiView />
        ) : activeView === 'gsd' ? (
          <GsdView />
        ) : activeView === 'code' ? (
          <CodeEditor />
        ) : activeView === 'web' ? (
          <WebView />
        ) : activeView === 'finance' ? (
          <FinanceView />
        ) : activeView === 'security' ? (
          <SecurityView />
        ) : activeView === 'communications' ? (
          <CommunicationsView />
        ) : activeView === 'accessibility' ? (
          <AccessibilityView />
        ) : activeView === 'audio-to-text' ? (
          <AudioToTextView />
        ) : activeView === 'minecraft' ? (
          <MinecraftView />
        ) : activeView === 'help' ? (
          <HelpView />
        ) : !hasVault ? (
          <WelcomeScreen />
        ) : (
          <>
            {activeView === 'notes' && <EditorView />}
            {activeView === 'tags' && <TagBrowser />}
            </>
        )}
      </main>
      <CommandPalette />
    </div>
  )
}
