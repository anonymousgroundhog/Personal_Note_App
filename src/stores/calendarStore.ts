import { create } from 'zustand'
import type { CalendarEvent, ImportedCalendar } from '../types/calendar'

interface CalendarState {
  localEvents: CalendarEvent[]
  importedCalendars: ImportedCalendar[]
  hiddenSources: Set<string>
  setLocalEvents: (events: CalendarEvent[]) => void
  addImportedCalendar: (cal: ImportedCalendar) => void
  removeImportedCalendar: (id: string) => void
  toggleSource: (sourceId: string) => void
  isSourceVisible: (sourceId: string) => boolean
  getAllEvents: () => CalendarEvent[]
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  localEvents: [],
  importedCalendars: [],
  hiddenSources: new Set(),

  setLocalEvents: (localEvents) => set({ localEvents }),

  addImportedCalendar: (cal) =>
    set((s) => ({ importedCalendars: [...s.importedCalendars.filter(c => c.id !== cal.id), cal] })),

  removeImportedCalendar: (id) =>
    set((s) => ({ importedCalendars: s.importedCalendars.filter(c => c.id !== id) })),

  toggleSource: (sourceId) =>
    set((s) => {
      const next = new Set(s.hiddenSources)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return { hiddenSources: next }
    }),

  isSourceVisible: (sourceId) => !get().hiddenSources.has(sourceId),

  getAllEvents: () => {
    const { localEvents, importedCalendars, hiddenSources } = get()
    const visibleLocal = localEvents.filter(e => {
      const calId = e.extendedProps?.calendarId || 'local'
      return !hiddenSources.has(calId)
    })
    const imported = importedCalendars
      .filter(c => !hiddenSources.has(c.id))
      .flatMap(c =>
        c.events.map(e => ({
          ...e,
          backgroundColor: c.color,
          borderColor: c.color,
        }))
      )
    return [...visibleLocal, ...imported]
  },
}))
