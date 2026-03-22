import { create } from 'zustand'

export type AppView = 'notes' | 'gantt' | 'calendar' | 'tags' | 'graph' | 'tasks'

interface UiState {
  activeView: AppView
  activeNotePath: string | null
  sidebarOpen: boolean
  darkMode: boolean
  commandPaletteOpen: boolean
  setActiveView: (view: AppView) => void
  setActiveNote: (path: string | null) => void
  toggleSidebar: () => void
  toggleDarkMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'notes',
  activeNotePath: null,
  sidebarOpen: true,
  darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  commandPaletteOpen: false,

  setActiveView: (activeView) => set({ activeView }),
  setActiveNote: (path) => set({ activeNotePath: path }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    if (next) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
    return { darkMode: next }
  }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}))
