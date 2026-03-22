import React, { useEffect, useRef, useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, Upload, Link, X, Trash2, Eye, EyeOff } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useCalendarStore } from '../../stores/calendarStore'
import { useUiStore } from '../../stores/uiStore'
import { parseCalendarEvents } from './calendarParser'
import { importIcsFile } from './icsImporter'
import { connectGoogleCalendar } from './googleCalendar'
import { connectOutlookCalendar } from './outlookCalendar'
import type { CalendarEvent } from '../../types/calendar'
import { todayIso } from '../../lib/fs/pathUtils'

// Colors assigned to local calendar IDs
const LOCAL_PALETTE: Record<string, string> = {
  'meeting': '#8b5cf6',
  'gantt-task': '#3b82f6',
  'task': '#3b82f6',
  'project': '#10b981',
  'daily': '#6b7280',
  'event': '#f59e0b',
  'local': '#8b5cf6',
}

function calendarColor(id: string): string {
  return LOCAL_PALETTE[id] ?? '#8b5cf6'
}

export default function CalendarView() {
  const { index, createNote } = useVaultStore()
  const { setLocalEvents, addImportedCalendar, removeImportedCalendar, importedCalendars, getAllEvents, hiddenSources, toggleSource } = useCalendarStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showImportMenu, setShowImportMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync local events whenever index changes
  useEffect(() => {
    const events = parseCalendarEvents(index)
    setLocalEvents(events)
  }, [index, setLocalEvents])

  // Derive unique local calendar IDs from events
  const localCalendarIds = useMemo(() => {
    const events = parseCalendarEvents(index)
    const ids = new Set<string>()
    events.forEach(e => ids.add(e.extendedProps?.calendarId || 'local'))
    return Array.from(ids).sort()
  }, [index])

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
    <div className="flex-1 flex overflow-hidden bg-white dark:bg-surface-900">
      {/* ── Left source panel ── */}
      <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800 overflow-y-auto">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Calendars</span>
        </div>

        {/* Local categories */}
        <div className="px-3 py-2">
          <p className="text-xs text-gray-400 mb-1.5 font-medium">Local</p>
          {localCalendarIds.map(id => {
            const visible = !hiddenSources.has(id)
            const color = calendarColor(id)
            return (
              <button
                key={id}
                onClick={() => toggleSource(id)}
                className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-left group"
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0 transition-opacity"
                  style={{ background: color, opacity: visible ? 1 : 0.25 }}
                />
                <span className={`text-xs flex-1 capitalize truncate ${visible ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 line-through'}`}>
                  {id === 'local' ? 'General' : id}
                </span>
                {visible
                  ? <Eye size={11} className="opacity-0 group-hover:opacity-50 text-gray-400" />
                  : <EyeOff size={11} className="opacity-50 text-gray-400" />}
              </button>
            )
          })}
          {localCalendarIds.length === 0 && (
            <p className="text-xs text-gray-400 italic">No events yet</p>
          )}
        </div>

        {/* Imported calendars */}
        {importedCalendars.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400 mb-1.5 font-medium">Imported</p>
            {importedCalendars.map(cal => {
              const visible = !hiddenSources.has(cal.id)
              return (
                <div key={cal.id} className="flex items-center gap-2 px-1.5 py-1 group">
                  <button
                    onClick={() => toggleSource(cal.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0 transition-opacity"
                      style={{ background: cal.color, opacity: visible ? 1 : 0.25 }}
                    />
                    <span className={`text-xs flex-1 truncate ${visible ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 line-through'}`}>
                      {cal.name}
                    </span>
                  </button>
                  <button
                    onClick={() => removeImportedCalendar(cal.id)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <X size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Import button at bottom of panel */}
        <div className="mt-auto p-3 border-t border-gray-200 dark:border-gray-700 relative">
          <button
            onClick={() => setShowImportMenu(m => !m)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-xs justify-center"
          >
            <Upload size={12} />
            Import Calendar
          </button>
          {showImportMenu && (
            <div className="absolute bottom-14 left-2 right-2 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 z-10">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Upload size={12} />
                Import .ics file
              </button>
              <button
                onClick={handleGoogleConnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Link size={12} className="text-blue-500" />
                Connect Google Calendar
              </button>
              <button
                onClick={handleOutlookConnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Link size={12} className="text-blue-700" />
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

      {/* ── Main calendar area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Calendar size={20} className="text-accent-500" />
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Calendar</h1>
          <span className="text-xs text-gray-400 ml-1">
            {events.length} event{events.length !== 1 ? 's' : ''} visible
          </span>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-auto p-4">
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
