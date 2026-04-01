import React, { useRef, useState, lazy, Suspense } from 'react'
import { FileText, Tag, Search, Moon, Sun, FolderOpen, ChevronLeft, ChevronRight, Github, Workflow, Bot, Zap, Code2, Globe, DollarSign, Shield, MessageSquare, Mic, HelpCircle, Music, SkipBack, SkipForward, Play, Pause, Accessibility, BookMarked, X, Pickaxe, SlidersHorizontal, Eye, EyeOff, GraduationCap, BookOpen, Settings, GitCompare } from 'lucide-react'
import { useUiStore } from '../../stores/uiStore'
import type { AppView } from '../../stores/uiStore'
import { useVaultStore, isFsApiSupported } from '../../stores/vaultStore'
import FileTree from './FileTree'
import MusicPlayer from '../../features/music/MusicPlayer'
import { useMusicStore } from '../../features/music/musicStore'
import GlobalSettingsModal from '../GlobalSettingsModal'

const MeetingNoteModal = lazy(() => import('../../features/meeting/MeetingNoteModal'))

function NoteMethodsPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'zettelkasten' | 'systems'>('zettelkasten')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BookMarked size={18} className="text-accent-500" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Note-Taking Methods</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5">
          {(['zettelkasten', 'systems'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? 'border-accent-500 text-accent-600 dark:text-accent-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'zettelkasten' ? 'Zettelkasten' : 'Other Systems'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {activeTab === 'zettelkasten' ? (
            <>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">What is Zettelkasten?</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Zettelkasten (German for "slip-box") is a personal knowledge management method developed by sociologist Niklas Luhmann, who used it to write over 70 books and 400 scholarly articles. The system treats each idea as an atomic note that links to other notes, forming a web of knowledge rather than a hierarchy.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Core Principles</h3>
                <div className="space-y-2">
                  {[
                    { title: 'Atomic notes', desc: 'Each note contains exactly one idea. This forces clarity and makes notes reusable across many contexts.' },
                    { title: 'Unique IDs', desc: 'Every note has a unique identifier (originally a number like 21/3a) so it can be referenced precisely from other notes.' },
                    { title: 'Links over hierarchy', desc: 'Notes connect to each other via links rather than being filed into folders. Ideas that relate across topics stay connected.' },
                    { title: 'Your own words', desc: 'Notes are always written in your own words, never copied text. This forces understanding before capture.' },
                    { title: 'Fleeting → Literature → Permanent', desc: 'Quick captures become processed literature notes, which become permanent notes in your own voice.' },
                  ].map(p => (
                    <div key={p.title} className="bg-gray-50 dark:bg-surface-700 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
                      <p className="font-medium text-gray-700 dark:text-gray-200 mb-0.5">{p.title}</p>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-xs">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">How This App Relates</h3>
                <div className="bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800/40 rounded-lg p-3 space-y-2">
                  {[
                    { icon: '🔗', text: 'Wiki-links ([[Note Title]]) let you connect notes just like Zettelkasten links.' },
                    { icon: '🏷️', text: 'Tags act as entry points into idea clusters — use the Tags view to navigate by theme.' },
                    { icon: '📁', text: 'Your vault folder maps to the slip-box. Keep it flat or lightly structured.' },
                    { icon: '🔍', text: 'Command palette (⌘K) lets you quickly find and jump between notes by title.' },
                    { icon: '📊', text: 'Diagram view can visualize the link graph of your notes if you export connections.' },
                  ].map(item => (
                    <div key={item.icon} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="mt-0.5">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Getting Started</h3>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  <li>Create a <strong>fleeting note</strong> for any quick thought or idea you want to capture.</li>
                  <li>Later, process it into a <strong>permanent note</strong> — one idea, your own words, with a descriptive title.</li>
                  <li>Ask: "what other notes does this relate to?" and add <code className="bg-gray-100 dark:bg-surface-700 px-1 rounded">[[links]]</code> to them.</li>
                  <li>Add relevant tags so the note surfaces in thematic clusters.</li>
                  <li>Delete or discard fleeting notes once processed.</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-xs">
                Different note-taking methods suit different needs. Here's an overview of popular systems and when to use each.
              </p>
              <div className="space-y-3">
                {[
                  {
                    name: 'GTD (Getting Things Done)',
                    author: 'David Allen',
                    summary: 'A productivity system focused on capturing all tasks and commitments into a trusted external system so your mind is free to think. Notes serve as inboxes, project references, and next-action lists.',
                    use: 'Best for: task management, reducing mental overhead, professional project tracking.',
                    appFeature: 'Use the GSD view for GTD-style task capture and next-action tracking.',
                  },
                  {
                    name: 'PARA Method',
                    author: 'Tiago Forte',
                    summary: 'Organizes all information into four categories: Projects (active goals), Areas (ongoing responsibilities), Resources (reference material), Archives (inactive items). Notes live in whichever bucket fits their purpose.',
                    use: 'Best for: people who want clear folder organization and a place for everything.',
                    appFeature: 'Create top-level folders in your vault for Projects/, Areas/, Resources/, Archives/.',
                  },
                  {
                    name: 'Cornell Notes',
                    author: 'Walter Pauk, Cornell University',
                    summary: 'A structured page layout: a narrow left column for cues/questions, a wide right column for notes, and a summary at the bottom. Designed for lecture and study contexts to aid review.',
                    use: 'Best for: students, structured learning, material you will review later.',
                    appFeature: 'Use a markdown table or callout blocks to replicate the Cornell layout.',
                  },
                  {
                    name: 'Evergreen Notes',
                    author: 'Andy Matuschak',
                    summary: 'Similar to Zettelkasten but emphasizes that notes should be continuously revised and refined over time. Notes are titled as complete assertions ("Spaced repetition helps long-term retention") rather than topics.',
                    use: 'Best for: researchers and writers who want ideas to compound over years.',
                    appFeature: 'Use descriptive assertion-style titles and wiki-links to keep notes interconnected.',
                  },
                  {
                    name: 'Bullet Journal (BuJo)',
                    author: 'Ryder Carroll',
                    summary: 'An analog rapid-logging system using bullets, dashes, and dots to distinguish tasks, events, and notes. Relies on daily logs, monthly logs, and future logs combined in one notebook.',
                    use: 'Best for: daily planning, habit tracking, people who like structured journaling.',
                    appFeature: 'Use the Calendar view for event logs; markdown checklists for daily task rapid-logging.',
                  },
                  {
                    name: 'Mind Mapping',
                    author: 'Tony Buzan (popularized)',
                    summary: 'A visual diagram starting from a central topic with branches for related ideas. Captures non-linear thinking and helps with brainstorming, planning, and learning overview.',
                    use: 'Best for: brainstorming, visual thinkers, project planning overviews.',
                    appFeature: 'Use the Diagram view to build mind maps and flowcharts visually.',
                  },
                  {
                    name: 'Second Brain / Building a Second Brain',
                    author: 'Tiago Forte',
                    summary: 'A broader philosophy for using digital tools to offload memory and thinking. Combines PARA organization with progressive summarization (highlighting → bold → summary) to distill information over time.',
                    use: 'Best for: knowledge workers who consume a lot of content and want to retrieve it later.',
                    appFeature: 'Use this app as your second brain: capture in notes, organize with PARA folders and tags, link ideas with wiki-links.',
                  },
                ].map(sys => (
                  <div key={sys.name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{sys.name}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">by {sys.author}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{sys.summary}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic mb-1.5">{sys.use}</p>
                    <div className="flex items-start gap-1.5 text-[11px] text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/20 rounded px-2 py-1.5">
                      <span className="shrink-0 mt-0.5">💡</span>
                      <span>{sys.appFeature}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const NAV_ITEMS: { view: AppView; icon: React.ReactNode; label: string; section: string }[] = [
  { view: 'notes',    icon: <FileText size={18} />,   label: 'Notes',           section: 'Core' },
  { view: 'tags',     icon: <Tag size={18} />,          label: 'Tags',            section: 'Core' },
  { view: 'sync',     icon: <Github size={18} />,       label: 'Sync',            section: 'Core' },
  { view: 'diagram',  icon: <Workflow size={18} />,     label: 'Diagrams',        section: 'Tools' },
  { view: 'code',     icon: <Code2 size={18} />,        label: 'Code',            section: 'Tools' },
  { view: 'web',      icon: <Globe size={18} />,         label: 'Web',             section: 'Tools' },
  { view: 'gsd',      icon: <Zap size={18} />,          label: 'GSD',             section: 'Tools' },
  { view: 'ai',       icon: <Bot size={18} />,          label: 'AI Chat',         section: 'Tools' },
  { view: 'audio-to-text', icon: <Mic size={18} />,     label: 'Audio to Text',   section: 'Tools' },
  { view: 'security', icon: <Shield size={18} />,       label: 'Security',        section: 'Tools' },
  { view: 'minecraft', icon: <Pickaxe size={18} />,     label: 'Minecraft',       section: 'Tools' },
  { view: 'vault-snapshot', icon: <GitCompare size={18} />, label: 'Snapshot',        section: 'Tools' },
  { view: 'finance',  icon: <DollarSign size={18} />,   label: 'Finance Tracker', section: 'Finances' },
  { view: 'communications', icon: <MessageSquare size={18} />, label: 'Communications', section: 'Communications' },
  { view: 'accessibility', icon: <Accessibility size={18} />, label: 'Accessibility',  section: 'Accessibility' },
  { view: 'academia', icon: <GraduationCap size={18} />, label: 'Teaching, Research & Service', section: 'Academia Related' },
  { view: 'research', icon: <BookOpen size={18} />, label: 'Research References', section: 'Academia Related' },
  { view: 'help', icon: <HelpCircle size={18} />,       label: 'Help',            section: 'Help' },
]

// Sections in display order; 'Core' has no visible header by default
const NAV_SECTIONS = ['Core', 'Tools', 'Finances', 'Communications', 'Accessibility', 'Academia Related', 'Help'] as const

function CustomizeSidebarPanel({ onClose }: { onClose: () => void }) {
  const { hiddenNavItems, toggleNavItemVisibility } = useUiStore()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-accent-500" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Customize Sidebar</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
        <p className="px-5 pt-3 pb-1 text-xs text-gray-500 dark:text-gray-400">Toggle which items appear in the sidebar navigation. Hidden items can always be re-enabled here.</p>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map(({ view, icon, label }) => {
            const isHidden = hiddenNavItems.includes(view)
            const isProtected = view === 'notes'
            return (
              <button
                key={view}
                onClick={() => !isProtected && toggleNavItemVisibility(view)}
                disabled={isProtected}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isProtected
                    ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500'
                    : isHidden
                    ? 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-700'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-700'
                }`}
              >
                <span className={isHidden ? 'opacity-40' : ''}>{icon}</span>
                <span className={`flex-1 text-left ${isHidden ? 'line-through opacity-50' : ''}`}>{label}</span>
                {isProtected ? (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">always visible</span>
                ) : isHidden ? (
                  <EyeOff size={15} className="text-gray-400" />
                ) : (
                  <Eye size={15} className="text-accent-500" />
                )}
              </button>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, toggleSidebar, darkMode, toggleDarkMode, setCommandPaletteOpen, hiddenNavItems, collapsedSections, toggleSection } = useUiStore()
  const { rootHandle, fallbackMode, fallbackName, openVault, openVaultFallback, fileTree } = useVaultStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showMusicPlayer, setShowMusicPlayer] = useState(false)
  const [showNoteMethods, setShowNoteMethods] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { isPlaying, title, artist, sendCommand } = useMusicStore()
  const hasTrack = !!(title)

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
        {NAV_SECTIONS.map((section, sIdx) => {
          const sectionItems = NAV_ITEMS.filter(item => item.section === section && !hiddenNavItems.includes(item.view))
          if (sectionItems.length === 0) return null
          const isCollapsed = collapsedSections.includes(section)
          return (
            <React.Fragment key={section}>
              {/* Section header */}
              {sIdx > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  {sidebarOpen ? (
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center gap-1 px-2 pb-0.5 group"
                      title={isCollapsed ? `Expand ${section}` : `Collapse ${section}`}
                    >
                      <p className="flex-1 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                        {section}
                      </p>
                      <ChevronRight
                        size={11}
                        className={`text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center justify-center py-0.5 group"
                      title={isCollapsed ? `Expand ${section}` : `Collapse ${section}`}
                    >
                      <ChevronRight
                        size={11}
                        className={`text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                  )}
                </div>
              )}
              {/* Section items */}
              {!isCollapsed && sectionItems.map(({ view, icon, label }) => (
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
            </React.Fragment>
          )
        })}
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
        {/* Music mini-player — shown when a track is loaded */}
        {hasTrack && sidebarOpen && (
          <div className="mb-1 px-1 py-1.5 rounded-lg bg-gray-200 dark:bg-surface-700">
            {/* Track info */}
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <Music size={11} className={`flex-shrink-0 ${isPlaying ? 'text-red-500' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200 truncate leading-tight">{title}</p>
                {artist && <p className="text-[9px] text-gray-400 truncate leading-tight">{artist}</p>}
              </div>
            </div>
            {/* Controls */}
            <div className="flex items-center justify-center gap-0.5">
              <button onClick={() => sendCommand('prev')} title="Previous"
                className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-surface-600 text-gray-500 dark:text-gray-400">
                <SkipBack size={13} />
              </button>
              <button onClick={() => sendCommand(isPlaying ? 'pause' : 'play')} title={isPlaying ? 'Pause' : 'Play'}
                className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white mx-1">
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button onClick={() => sendCommand('next')} title="Next"
                className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-surface-600 text-gray-500 dark:text-gray-400">
                <SkipForward size={13} />
              </button>
            </div>
          </div>
        )}
        {hasTrack && !sidebarOpen && (
          <button onClick={() => sendCommand(isPlaying ? 'pause' : 'play')} title={isPlaying ? 'Pause' : 'Play'}
            className={`w-full flex items-center justify-center p-2 rounded mb-1 ${isPlaying ? 'text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
        )}
        <button
          onClick={() => setShowMusicPlayer(m => !m)}
          className={`flex items-center gap-2 px-2 py-1.5 w-full rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 mb-1 transition-colors ${showMusicPlayer ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
          title="Music Player"
        >
          <Music size={16} />
          {sidebarOpen && 'Music'}
        </button>
        <button
          onClick={() => setShowNoteMethods(true)}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 mb-1 transition-colors text-gray-600 dark:text-gray-400"
          title="Note-taking methods"
        >
          <BookMarked size={16} />
          {sidebarOpen && 'Note Methods'}
        </button>
        <button
          onClick={() => setShowCustomize(true)}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 mb-1 transition-colors text-gray-600 dark:text-gray-400"
          title="Customize sidebar"
        >
          <SlidersHorizontal size={16} />
          {sidebarOpen && 'Customize'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 mb-1 transition-colors text-gray-600 dark:text-gray-400"
          title="Global settings"
        >
          <Settings size={16} />
          {sidebarOpen && 'Settings'}
        </button>
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

      {/* Music player — floating overlay */}
      {showMusicPlayer && (
        <MusicPlayer onClose={() => setShowMusicPlayer(false)} />
      )}

      {/* Note-taking methods panel — floating overlay */}
      {showNoteMethods && (
        <NoteMethodsPanel onClose={() => setShowNoteMethods(false)} />
      )}

      {/* Customize sidebar panel */}
      {showCustomize && (
        <CustomizeSidebarPanel onClose={() => setShowCustomize(false)} />
      )}

      {/* Global settings modal */}
      {showSettings && (
        <GlobalSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
