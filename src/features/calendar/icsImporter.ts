import ICAL from 'ical.js'
import type { CalendarEvent, ImportedCalendar } from '../../types/calendar'

export async function importIcsFile(file: File, calendarName?: string): Promise<ImportedCalendar> {
  const text = await file.text()
  const jcal = ICAL.parse(text)
  const comp = new ICAL.Component(jcal)
  const vevents = comp.getAllSubcomponents('vevent')

  const events: CalendarEvent[] = []

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)
    const id = event.uid || `ics-${Math.random().toString(36).slice(2)}`
    const title = event.summary || 'Untitled'
    const location = event.location || undefined

    if (event.isRecurring()) {
      // Expand recurring events for the next year
      const expand = event.iterator()
      let next = expand.next()
      const limit = new Date()
      limit.setFullYear(limit.getFullYear() + 1)
      let count = 0
      while (next && count < 200) {
        const dtstart = next.toJSDate()
        if (dtstart > limit) break
        const duration = event.duration
        const dtend = new Date(dtstart.getTime() + (duration ? duration.toSeconds() * 1000 : 3600000))
        events.push({
          id: `${id}-${count}`,
          title,
          start: dtstart.toISOString(),
          end: dtend.toISOString(),
          allDay: event.startDate?.isDate ?? false,
          extendedProps: { calendarId: id, location, source: 'ics' },
        })
        next = expand.next()
        count++
      }
    } else {
      const dtstart = event.startDate?.toJSDate()
      const dtend = event.endDate?.toJSDate()
      if (!dtstart) continue
      events.push({
        id,
        title,
        start: dtstart.toISOString(),
        end: dtend?.toISOString(),
        allDay: event.startDate?.isDate ?? false,
        extendedProps: { calendarId: id, location, source: 'ics' },
      })
    }
  }

  const name = calendarName || comp.getFirstPropertyValue('x-wr-calname') || file.name.replace(/\.ics$/i, '')
  return {
    id: `ics-${Date.now()}`,
    name: String(name),
    source: 'ics',
    color: '#f59e0b',
    events,
    lastSync: new Date().toISOString(),
  }
}
