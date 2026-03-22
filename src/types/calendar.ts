export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  allDay?: boolean
  backgroundColor?: string
  borderColor?: string
  extendedProps?: {
    notePath?: string
    calendarId?: string
    location?: string
    attendees?: string[]
    source?: 'local' | 'google' | 'outlook' | 'ics'
    rrule?: string
  }
}

export interface ImportedCalendar {
  id: string
  name: string
  source: 'google' | 'outlook' | 'ics'
  color: string
  events: CalendarEvent[]
  lastSync?: string
}
