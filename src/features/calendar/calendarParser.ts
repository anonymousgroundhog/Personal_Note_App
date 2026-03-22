import type { NoteIndex } from '../../types/note'
import type { CalendarEvent } from '../../types/calendar'

let idCounter = 0
function uid() { return `local-${++idCounter}` }

export function parseCalendarEvents(index: Map<string, NoteIndex>): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const note of index.values()) {
    const fm = note.frontmatter

    // Any note with a start or date is surfaced
    const hasStart = !!fm.start
    const hasDate = !!fm.date
    if (!hasStart && !hasDate) continue

    const title = String(fm.title || note.name)
    const source = 'local'

    if (hasStart) {
      events.push({
        id: uid(),
        title,
        start: String(fm.start),
        end: fm.end ? String(fm.end) : undefined,
        allDay: !String(fm.start).includes('T'),
        backgroundColor: colorForType(String(fm.type || '')),
        borderColor: colorForType(String(fm.type || '')),
        extendedProps: {
          notePath: note.path,
          calendarId: String(fm.calendar_id || 'local'),
          location: fm.location ? String(fm.location) : undefined,
          attendees: Array.isArray(fm.attendees) ? fm.attendees : undefined,
          source,
          rrule: fm.rrule ? String(fm.rrule) : undefined,
        },
      })
    } else if (hasDate) {
      events.push({
        id: uid(),
        title,
        start: String(fm.date),
        allDay: true,
        backgroundColor: colorForType(String(fm.type || '')),
        borderColor: colorForType(String(fm.type || '')),
        extendedProps: {
          notePath: note.path,
          calendarId: 'local',
          source,
        },
      })
    }
  }

  return events
}

function colorForType(type: string): string {
  switch (type) {
    case 'meeting': return '#8b5cf6'
    case 'gantt-task':
    case 'task': return '#3b82f6'
    case 'project': return '#10b981'
    case 'daily': return '#6b7280'
    case 'event': return '#f59e0b'
    default: return '#8b5cf6'
  }
}
