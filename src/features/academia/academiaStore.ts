import { create } from 'zustand'
import type { AcademicYear, AcademicActivity, AcademicCategory, ActivityStatus, ActivityType, CategorySummary, YearSummary } from './types'

const STORAGE_KEY = 'academia_data_v1'

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function load(): { years: AcademicYear[]; activities: AcademicActivity[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { years: [], activities: [] }
}

function persist(state: { years: AcademicYear[]; activities: AcademicActivity[] }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

interface AcademiaState {
  years: AcademicYear[]
  activities: AcademicActivity[]

  addYear: (label: string, startDate: string, endDate: string) => AcademicYear
  updateYear: (id: string, partial: Partial<Pick<AcademicYear, 'label' | 'startDate' | 'endDate'>>) => void
  deleteYear: (id: string) => void

  addActivity: (fields: {
    yearId: string
    category: AcademicCategory
    type: ActivityType | null
    title: string
    description: string
    date: string
    status: ActivityStatus
    tags: string[]
  }) => AcademicActivity
  updateActivity: (id: string, partial: Partial<AcademicActivity>) => void
  deleteActivity: (id: string) => void

  getYearSummary: (yearId: string) => YearSummary | null
  getAllSummaries: () => YearSummary[]
}

const initial = load()

export const useAcademiaStore = create<AcademiaState>((set, get) => ({
  ...initial,

  addYear: (label, startDate, endDate) => {
    const year: AcademicYear = { id: uid(), label, startDate, endDate, createdAt: Date.now() }
    set(s => {
      const next = { years: [...s.years, year], activities: s.activities }
      persist(next)
      return next
    })
    return year
  },

  updateYear: (id, partial) =>
    set(s => {
      const next = { years: s.years.map(y => y.id === id ? { ...y, ...partial } : y), activities: s.activities }
      persist(next)
      return next
    }),

  deleteYear: (id) =>
    set(s => {
      const next = {
        years: s.years.filter(y => y.id !== id),
        activities: s.activities.filter(a => a.yearId !== id),
      }
      persist(next)
      return next
    }),

  addActivity: (fields) => {
    const now = Date.now()
    const activity: AcademicActivity = { id: uid(), createdAt: now, updatedAt: now, ...fields }
    set(s => {
      const next = { years: s.years, activities: [...s.activities, activity] }
      persist(next)
      return next
    })
    return activity
  },

  updateActivity: (id, partial) =>
    set(s => {
      const next = {
        years: s.years,
        activities: s.activities.map(a => a.id === id ? { ...a, ...partial, updatedAt: Date.now() } : a),
      }
      persist(next)
      return next
    }),

  deleteActivity: (id) =>
    set(s => {
      const next = { years: s.years, activities: s.activities.filter(a => a.id !== id) }
      persist(next)
      return next
    }),

  getYearSummary: (yearId) => {
    const { years, activities } = get()
    const year = years.find(y => y.id === yearId)
    if (!year) return null
    const acts = activities.filter(a => a.yearId === yearId)
    const summarize = (cat: AcademicCategory): CategorySummary => {
      const sub = acts.filter(a => a.category === cat)
      return {
        category: cat,
        total: sub.length,
        completed: sub.filter(a => a.status === 'completed').length,
        inProgress: sub.filter(a => a.status === 'in-progress').length,
        planned: sub.filter(a => a.status === 'planned').length,
      }
    }
    return {
      year,
      teaching: summarize('teaching'),
      research: summarize('research'),
      service: summarize('service'),
      total: acts.length,
    }
  },

  getAllSummaries: () => {
    const { years } = get()
    return years
      .slice()
      .sort((a, b) => b.label.localeCompare(a.label))
      .map(y => get().getYearSummary(y.id)!)
      .filter(Boolean)
  },
}))
