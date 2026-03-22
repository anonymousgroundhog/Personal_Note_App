import { create } from 'zustand'

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error'

export interface SyncLogEntry {
  time: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface RepoInfo {
  owner: string
  repo: string
  fullName: string
  defaultBranch: string
  isNew: boolean
}

interface SyncState {
  // Auth
  token: string
  setToken: (token: string) => void

  // Repo config
  repoInfo: RepoInfo | null
  setRepoInfo: (info: RepoInfo | null) => void

  // Branch
  branches: string[]
  setBranches: (branches: string[]) => void
  selectedBranch: string
  setSelectedBranch: (branch: string) => void

  // Sync state
  status: SyncStatus
  setStatus: (status: SyncStatus) => void
  progress: number          // 0–100
  setProgress: (p: number) => void
  log: SyncLogEntry[]
  addLog: (level: SyncLogEntry['level'], message: string) => void
  clearLog: () => void

  // Last sync
  lastSyncAt: string | null
  setLastSyncAt: (t: string | null) => void
}

function loadToken(): string {
  try { return localStorage.getItem('gh_sync_token') ?? '' } catch { return '' }
}

function saveToken(t: string) {
  try { localStorage.setItem('gh_sync_token', t) } catch { /* noop */ }
}

export const useSyncStore = create<SyncState>((set) => ({
  token: loadToken(),
  setToken: (token) => { saveToken(token); set({ token }) },

  repoInfo: null,
  setRepoInfo: (repoInfo) => set({ repoInfo }),

  branches: [],
  setBranches: (branches) => set({ branches }),
  selectedBranch: 'main',
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),

  status: 'idle',
  setStatus: (status) => set({ status }),
  progress: 0,
  setProgress: (progress) => set({ progress }),

  log: [],
  addLog: (level, message) => set(s => ({
    log: [...s.log.slice(-199), { time: new Date().toLocaleTimeString(), level, message }],
  })),
  clearLog: () => set({ log: [] }),

  lastSyncAt: null,
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}))
