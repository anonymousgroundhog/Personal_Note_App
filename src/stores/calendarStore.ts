import { create } from 'zustand'
import type { CalendarEvent, ImportedCalendar } from '../types/calendar'

interface CalendarState {
  localEvents: CalendarEvent[]
  importedCalendars: ImportedCalendar[]
  setLocalEvents: (events: CalendarEvent[]) => void
  addImportedCalendar: (cal: ImportedCalendar) => void
  removeImportedCalendar: (id: string) => void
  getAllEvents: () => CalendarEvent[]
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  localEvents: [],
  importedCalendars: [],

  setLocalEvents: (localEvents) => set({ localEvents }),

  addImportedCalendar: (cal) =>
    set((s) => ({ importedCalendars: [...s.importedCalendars.filter(c => c.id !== cal.id), cal] })),

  removeImportedCalendar: (id) =>
    set((s) => ({ importedCalendars: s.importedCalendars.filter(c => c.id !== id) })),

  getAllEvents: () => {
    const { localEvents, importedCalendars } = get()
    const imported = importedCalendars.flatMap(c =>
      c.events.map(e => ({
        ...e,
        backgroundColor: c.color,
        borderColor: c.color,
      }))
    )
    return [...localEvents, ...imported]
  },
}))
