import { create } from 'zustand'

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error'

export interface SyncLogEntry {
  time: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

interface SyncState {
  status: SyncStatus
  setStatus: (s: SyncStatus) => void

  progress: number
  setProgress: (p: number) => void

  log: SyncLogEntry[]
  addLog: (level: SyncLogEntry['level'], message: string) => void
  clearLog: () => void

  lastSyncAt: string | null
  setLastSyncAt: (t: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),

  progress: 0,
  setProgress: (progress) => set({ progress }),

  log: [],
  addLog: (level, message) => set(s => ({
    log: [...s.log.slice(-499), { time: new Date().toLocaleTimeString(), level, message }],
  })),
  clearLog: () => set({ log: [] }),

  lastSyncAt: null,
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}))
