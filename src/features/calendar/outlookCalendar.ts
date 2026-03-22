import type { CalendarEvent, ImportedCalendar } from '../../types/calendar'

const OUTLOOK_CLIENT_ID = import.meta.env.VITE_OUTLOOK_CLIENT_ID || ''
const REDIRECT_URI = window.location.origin
const SCOPES = 'https://graph.microsoft.com/Calendars.Read offline_access'

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function connectOutlookCalendar(): Promise<string | null> {
  if (!OUTLOOK_CLIENT_ID) {
    alert('Outlook Calendar: Set VITE_OUTLOOK_CLIENT_ID in your .env file to enable this feature.')
    return null
  }
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('outlook_verifier', verifier)

  const params = new URLSearchParams({
    client_id: OUTLOOK_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  })

  const popup = window.open(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`,
    'outlook-auth',
    'width=500,height=600'
  )

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
      } catch { /* cross-origin */ }
    }, 500)
  })
}

export async function fetchOutlookCalendarEvents(accessToken: string): Promise<ImportedCalendar> {
  const now = new Date()
  const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const yearAhead = new Date(now); yearAhead.setFullYear(yearAhead.getFullYear() + 1)

  const params = new URLSearchParams({
    startDateTime: yearAgo.toISOString(),
    endDateTime: yearAhead.toISOString(),
    $top: '500',
    $orderby: 'start/dateTime',
  })

  const resp = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await resp.json()

  const events: CalendarEvent[] = (data.value || []).map((item: Record<string, unknown>) => {
    const startObj = item.start as Record<string, string> | undefined
    const endObj = item.end as Record<string, string> | undefined
    const start = startObj?.dateTime ? `${startObj.dateTime}Z` : ''
    const end = endObj?.dateTime ? `${endObj.dateTime}Z` : undefined
    return {
      id: String(item.id || ''),
      title: String(item.subject || 'Untitled'),
      start,
      end,
      allDay: !!item.isAllDay,
      extendedProps: {
        calendarId: 'outlook',
        location: item.location ? String((item.location as Record<string, string>).displayName || '') : undefined,
        source: 'outlook' as const,
      },
    }
  })

  return {
    id: 'outlook-primary',
    name: 'Outlook Calendar',
    source: 'outlook',
    color: '#0078d4',
    events,
    lastSync: new Date().toISOString(),
  }
}
