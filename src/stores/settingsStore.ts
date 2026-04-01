import { create } from 'zustand'

export interface GitConfig {
  userName: string
  userEmail: string
}

interface SettingsState {
  gitConfig: GitConfig
  setGitConfig: (config: GitConfig) => void
  getGitConfig: () => GitConfig
}

function loadGitConfig(): GitConfig {
  try {
    const stored = localStorage.getItem('gitConfig')
    return stored ? JSON.parse(stored) : { userName: '', userEmail: '' }
  } catch {
    return { userName: '', userEmail: '' }
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  gitConfig: loadGitConfig(),

  setGitConfig: (gitConfig) => {
    localStorage.setItem('gitConfig', JSON.stringify(gitConfig))
    set({ gitConfig })
  },

  getGitConfig: () => get().gitConfig,
}))
