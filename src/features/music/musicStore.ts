import { create } from 'zustand'

export type PlayerCommand = 'play' | 'pause' | 'next' | 'prev' | null

export interface MusicState {
  isPlaying: boolean
  title: string
  artist: string
  command: PlayerCommand
  setPlaying: (playing: boolean) => void
  setTrack: (title: string, artist: string) => void
  sendCommand: (cmd: PlayerCommand) => void
  clearCommand: () => void
  reset: () => void
}

export const useMusicStore = create<MusicState>((set) => ({
  isPlaying: false,
  title: '',
  artist: '',
  command: null,
  setPlaying: (isPlaying) => set({ isPlaying }),
  setTrack: (title, artist) => set({ title, artist }),
  sendCommand: (command) => set({ command }),
  clearCommand: () => set({ command: null }),
  reset: () => set({ isPlaying: false, title: '', artist: '', command: null }),
}))
