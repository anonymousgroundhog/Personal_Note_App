import type { CalendarEvent, ImportedCalendar } from '../../types/calendar'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function connectGoogleCalendar(): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID) {
    alert('Google Calendar: Set VITE_GOOGLE_CLIENT_ID in your .env file to enable this feature.')
    return null
  }
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('gcal_verifier', verifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })

  const popup = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'google-auth', 'width=500,height=600')
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      try {
        if (popup?.closed) { clearInterval(interval); resolve(null) }
        const url = popup?.location?.href || ''
        if (url.includes('code=')) {
          clearInterval(interval)
          const code = new URL(url).searchParams.get('code')
          popup?.close()
          resolve(code)
        }
      } catch { /* cross-origin, keep waiting */ }
    }, 500)
  })
}

export async function fetchGoogleCalendarEvents(accessToken: string): Promise<ImportedCalendar> {
  const now = new Date()
  const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const yearAhead = new Date(now); yearAhead.setFullYear(yearAhead.getFullYear() + 1)

  const params = new URLSearchParams({
    timeMin: yearAgo.toISOString(),
    timeMax: yearAhead.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  })

  const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await resp.json()

  const events: CalendarEvent[] = (data.items || []).map((item: Record<string, unknown>) => {
    const startObj = item.start as Record<string, string> | undefined
    const endObj = item.end as Record<string, string> | undefined
    const start = startObj?.dateTime || startObj?.date || ''
    const end = endObj?.dateTime || endObj?.date || undefined
    return {
      id: String(item.id || ''),
      title: String(item.summary || 'Untitled'),
      start,
      end,
      allDay: !startObj?.dateTime,
      extendedProps: {
        calendarId: 'google',
        location: item.location ? String(item.location) : undefined,
        source: 'google' as const,
      },
    }
  })

  return {
    id: 'google-primary',
    name: 'Google Calendar',
    source: 'google',
    color: '#4285f4',
    events,
    lastSync: new Date().toISOString(),
  }
}
