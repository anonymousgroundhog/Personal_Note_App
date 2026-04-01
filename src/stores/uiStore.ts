import { create } from 'zustand'

export type AppView = 'notes' | 'tags' | 'sync' | 'repos' | 'diagram' | 'ai' | 'gsd' | 'code' | 'web' | 'finance' | 'security' | 'communications' | 'help' | 'accessibility' | 'audio-to-text' | 'minecraft' | 'academia' | 'research' | 'vault-snapshot'

interface UiState {
  activeView: AppView
  openTabs: string[]
  activeTabPath: string | null
  sidebarOpen: boolean
  darkMode: boolean
  commandPaletteOpen: boolean
  hiddenNavItems: AppView[]
  collapsedSections: string[]
  hiddenPanels: string[]
  setActiveView: (view: AppView) => void
  openTab: (path: string) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  setActiveNote: (path: string | null) => void
  toggleSidebar: () => void
  toggleDarkMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleNavItemVisibility: (view: AppView) => void
  toggleSection: (section: string) => void
  setPanelHidden: (panelId: string, hidden: boolean) => void
  resetPanels: (namespace: string) => void
  // Getter for backward compat
  activeNotePath: string | null
}

function loadCollapsedSections(): string[] {
  try {
    const stored = localStorage.getItem('collapsedSections')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function loadHiddenNavItems(): AppView[] {
  try {
    const stored = localStorage.getItem('hiddenNavItems')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function loadHiddenPanels(): string[] {
  try {
    const stored = localStorage.getItem('hiddenPanels')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  activeView: 'notes',
  openTabs: [],
  activeTabPath: null,
  sidebarOpen: true,
  darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  commandPaletteOpen: false,
  hiddenNavItems: loadHiddenNavItems(),
  collapsedSections: loadCollapsedSections(),
  hiddenPanels: loadHiddenPanels(),

  get activeNotePath() {
    return get().activeTabPath
  },

  setActiveView: (activeView) => set({ activeView }),

  openTab: (path) => set((state) => {
    if (state.openTabs.includes(path)) {
      // Already open, just focus it
      return { activeTabPath: path }
    }
    // New tab, add to list and focus
    return {
      openTabs: [...state.openTabs, path],
      activeTabPath: path
    }
  }),

  closeTab: (path) => set((state) => {
    const index = state.openTabs.indexOf(path)
    if (index === -1) return state // Tab not found

    const newTabs = state.openTabs.filter((_, i) => i !== index)
    let newActive = state.activeTabPath

    if (state.activeTabPath === path) {
      // Closed tab was active, focus adjacent
      if (index > 0) {
        newActive = state.openTabs[index - 1]
      } else if (index < state.openTabs.length - 1) {
        newActive = state.openTabs[index + 1]
      } else {
        newActive = null
      }
    }

    return {
      openTabs: newTabs,
      activeTabPath: newActive
    }
  }),

  setActiveTab: (path) => set((state) => {
    if (state.openTabs.includes(path)) {
      return { activeTabPath: path }
    }
    return state
  }),

  setActiveNote: (path) => set((state) => {
    if (path === null) {
      return { activeTabPath: null }
    }
    if (state.openTabs.includes(path)) {
      return { activeTabPath: path }
    }
    return {
      openTabs: [...state.openTabs, path],
      activeTabPath: path
    }
  }),

  toggleNavItemVisibility: (view) => set((s) => {
    const next = s.hiddenNavItems.includes(view)
      ? s.hiddenNavItems.filter(v => v !== view)
      : [...s.hiddenNavItems, view]
    localStorage.setItem('hiddenNavItems', JSON.stringify(next))
    // If the active view is being hidden, switch to notes
    const newActiveView = next.includes(s.activeView) && s.activeView !== 'notes' ? 'notes' : s.activeView
    return { hiddenNavItems: next, activeView: newActiveView }
  }),

  toggleSection: (section) => set((s) => {
    const next = s.collapsedSections.includes(section)
      ? s.collapsedSections.filter(sec => sec !== section)
      : [...s.collapsedSections, section]
    localStorage.setItem('collapsedSections', JSON.stringify(next))
    return { collapsedSections: next }
  }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    if (next) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
    return { darkMode: next }
  }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

  setPanelHidden: (panelId, hidden) => set((s) => {
    const next = hidden
      ? s.hiddenPanels.includes(panelId)
        ? s.hiddenPanels
        : [...s.hiddenPanels, panelId]
      : s.hiddenPanels.filter(id => id !== panelId)
    localStorage.setItem('hiddenPanels', JSON.stringify(next))
    return { hiddenPanels: next }
  }),

  resetPanels: (namespace) => set((s) => {
    const prefix = `${namespace}:`
    const next = s.hiddenPanels.filter(id => !id.startsWith(prefix))
    localStorage.setItem('hiddenPanels', JSON.stringify(next))
    return { hiddenPanels: next }
  }),
}))
