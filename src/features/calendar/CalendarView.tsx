import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, Upload, Link, X, Trash2 } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useCalendarStore } from '../../stores/calendarStore'
import { useUiStore } from '../../stores/uiStore'
import { parseCalendarEvents } from './calendarParser'
import { importIcsFile } from './icsImporter'
import { connectGoogleCalendar } from './googleCalendar'
import { connectOutlookCalendar } from './outlookCalendar'
import type { CalendarEvent } from '../../types/calendar'
import { todayIso } from '../../lib/fs/pathUtils'

export default function CalendarView() {
  const { index, createNote } = useVaultStore()
  const { setLocalEvents, addImportedCalendar, removeImportedCalendar, importedCalendars, getAllEvents } = useCalendarStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showImportMenu, setShowImportMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync local events whenever index changes
  useEffect(() => {
    const events = parseCalendarEvents(index)
    setLocalEvents(events)
  }, [index, setLocalEvents])

  const handleEventClick = (info: { event: { id: string; title: string; startStr: string; endStr: string; extendedProps: Record<string, unknown> } }) => {
    const ev: CalendarEvent = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      extendedProps: info.event.extendedProps as CalendarEvent['extendedProps'],
    }
    setSelectedEvent(ev)
  }

  const handleDateClick = async (info: { dateStr: string }) => {
    const name = prompt('New event/note name:')
    if (!name) return
    const filename = `Events/${name.replace(/\s+/g, '-')}.md`
    const content = `---
tags:
  - event
type: event
title: "${name}"
start: "${info.dateStr}T09:00:00"
end: "${info.dateStr}T10:00:00"
date: "${info.dateStr}"
---

# ${name}

`
    await createNote(filename, content)
    setActiveNote(filename)
    setActiveView('notes')
  }

  const handleIcsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const cal = await importIcsFile(file)
    addImportedCalendar(cal)
    setShowImportMenu(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGoogleConnect = async () => {
    const code = await connectGoogleCalendar()
    if (!code) return
    // For local use, you'd exchange the code for a token via a proxy or CORS-enabled endpoint
    // Since we can't have a client secret in browser, this shows the pattern
    // In production: exchange code server-side or use Google Identity Services library
    alert('Google auth code received. For full integration, configure VITE_GOOGLE_CLIENT_ID and a token exchange endpoint. See README for setup instructions.')
    setShowImportMenu(false)
  }

  const handleOutlookConnect = async () => {
    const code = await connectOutlookCalendar()
    if (!code) return
    alert('Outlook auth code received. For full integration, configure VITE_OUTLOOK_CLIENT_ID. See README for setup instructions.')
    setShowImportMenu(false)
  }

  const events = getAllEvents()

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Calendar size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Calendar</h1>
        <div className="ml-auto flex items-center gap-2 relative">
          {/* Imported calendars list */}
          {importedCalendars.map(cal => (
            <div key={cal.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ background: cal.color + '22', color: cal.color }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cal.color, display: 'inline-block' }} />
              {cal.name}
              <button onClick={() => removeImportedCalendar(cal.id)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowImportMenu(m => !m)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm"
          >
            <Upload size={14} />
            Import Calendar
          </button>
          {showImportMenu && (
            <div className="absolute top-10 right-0 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-10 min-w-48">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Upload size={14} />
                Import .ics file
              </button>
              <button
                onClick={handleGoogleConnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Link size={14} className="text-blue-500" />
                Connect Google Calendar
              </button>
              <button
                onClick={handleOutlookConnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Link size={14} className="text-blue-700" />
                Connect Outlook Calendar
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics"
            onChange={handleIcsImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto p-4 dark">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          editable={false}
          selectable={true}
          height="100%"
        />
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{selectedEvent.title}</h2>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p><span className="font-medium">Start:</span> {new Date(selectedEvent.start).toLocaleString()}</p>
              {selectedEvent.end && <p><span className="font-medium">End:</span> {new Date(selectedEvent.end).toLocaleString()}</p>}
              {selectedEvent.extendedProps?.location && <p><span className="font-medium">Location:</span> {selectedEvent.extendedProps.location}</p>}
              {selectedEvent.extendedProps?.source && <p><span className="font-medium">Source:</span> {selectedEvent.extendedProps.source}</p>}
            </div>
            {selectedEvent.extendedProps?.notePath && (
              <button
                onClick={() => {
                  setActiveNote(selectedEvent.extendedProps!.notePath!)
                  setActiveView('notes')
                  setSelectedEvent(null)
                }}
                className="mt-4 w-full px-3 py-2 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm"
              >
                Open Note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
