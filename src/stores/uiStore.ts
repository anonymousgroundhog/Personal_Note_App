import { create } from 'zustand'

export type AppView = 'notes' | 'calendar' | 'tags' | 'sync' | 'diagram' | 'ai' | 'gsd' | 'code' | 'web' | 'finance' | 'security' | 'communications' | 'help' | 'accessibility'

interface UiState {
  activeView: AppView
  openTabs: string[]
  activeTabPath: string | null
  sidebarOpen: boolean
  darkMode: boolean
  commandPaletteOpen: boolean
  setActiveView: (view: AppView) => void
  openTab: (path: string) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  setActiveNote: (path: string | null) => void
  toggleSidebar: () => void
  toggleDarkMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
  // Getter for backward compat
  activeNotePath: string | null
}

export const useUiStore = create<UiState>((set, get) => ({
  activeView: 'notes',
  openTabs: [],
  activeTabPath: null,
  sidebarOpen: true,
  darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  commandPaletteOpen: false,

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

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    if (next) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
    return { darkMode: next }
  }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}))
