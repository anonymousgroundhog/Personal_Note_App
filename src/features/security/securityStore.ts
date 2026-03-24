import { create } from 'zustand'

export interface CVSSResult {
  baseScore: number
  baseSeverity: string
  temporalScore?: number
  temporalSeverity?: string
  environmentalScore?: number
  environmentalSeverity?: string
  vector: string
}

interface SecurityStore {
  lastCvssResult: CVSSResult | null
  setLastCvssResult: (r: CVSSResult) => void
}

export const useSecurityStore = create<SecurityStore>((set) => ({
  lastCvssResult: null,
  setLastCvssResult: (r) => set({ lastCvssResult: r }),
}))
