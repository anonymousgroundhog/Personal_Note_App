# Personal Note App

A local-first markdown note-taking app with Obsidian-style editing, Gantt chart project tracking, and a full calendar view with Google/Outlook import.

## Features

- **Markdown Notes** — Full markdown editing with live preview, wiki-links `[[Note Name]]`, callouts `>[!info]`, GFM tables and task lists
- **Tagging** — Tag notes via frontmatter; browse and filter by tag
- **Command Palette** — `Ctrl+K` / `Cmd+K` to fuzzy-search all notes
- **Gantt Charts** — Visual project timelines from notes with `type: gantt-task` frontmatter; single-project and all-projects views; create tasks from the UI
- **Calendar** — Day, Week, Month views powered by FullCalendar; events sourced from note frontmatter `start:`/`end:`/`date:` fields
- **ICS Import** — Import `.ics` files exported from Google Calendar, Outlook, or any calendar app
- **Google Calendar** — Connect via OAuth2 PKCE (requires setup — see below)
- **Outlook Calendar** — Connect via Microsoft OAuth2 PKCE (requires setup — see below)
- **Dark / Light mode**
- **Local-first** — All data lives in your markdown files; no database, no server

## Getting Started

### Requirements

- Chrome or Edge (requires [File System Access API](https://caniuse.com/native-filesystem-api))
- Node.js 18+

### Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and click **Open Vault Folder** to select your notes directory.

## Note Frontmatter Reference

All data lives in YAML frontmatter at the top of each `.md` file.

### Standard Note
```yaml
---
tags:
  - research
  - meeting
date: 2026-03-22
---
```

### Calendar Event / Meeting
```yaml
---
tags:
  - meeting
type: meeting
title: "Sprint Planning"
start: "2026-03-22T10:00:00"
end: "2026-03-22T11:00:00"
date: "2026-03-22"
location: "Zoom"
attendees:
  - Alice
  - Bob
---
```
Any note with `start:` + `end:` appears in the Calendar view. Clicking it opens the note.

### Gantt Task
```yaml
---
tags:
  - gantt-task
type: gantt-task
project: "My Project"
task_id: "task-001"
title: "Design mockups"
start: "2026-03-15"
end: "2026-04-01"
progress: 60
depends_on:
  - "task-000"
priority: high
status: in-progress
---
```

### Project
```yaml
---
tags:
  - project
type: project
project_id: "my-project"
title: "My Project"
start: "2026-01-01"
deadline: "2026-12-31"
status: active
---
```

### Recurring Event (ICS-style rrule)
```yaml
---
type: event
title: "Team Standup"
start: "2026-01-05T09:00:00"
end: "2026-01-05T09:15:00"
rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
---
```

## Templates

See `templates/` folder for ready-to-use templates:
- `daily-note.md` — Daily journal
- `meeting.md` — Meeting notes with calendar frontmatter
- `gantt-task.md` — Gantt chart task
- `project.md` — Project container note

## Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → APIs & Services → Enable "Google Calendar API"
3. OAuth consent screen → External → Add scopes: `calendar.readonly`
4. Credentials → Create OAuth 2.0 Client ID → Web application
5. Add `http://localhost:5173` to Authorized redirect URIs
6. Copy the Client ID and create `.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

## Outlook / Microsoft Calendar Setup

1. Go to [Azure Portal](https://portal.azure.com/) → Azure Active Directory → App registrations
2. New registration → Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
3. Add Redirect URI: `http://localhost:5173` (Single-page application)
4. API permissions → Add `Calendars.Read` (Microsoft Graph, Delegated)
5. Copy the Application (client) ID and add to `.env.local`:
   ```
   VITE_OUTLOOK_CLIENT_ID=your-azure-app-client-id
   ```

## Building for Production

```bash
npm run build
```

Output is in `dist/`. Serve it with any static file server.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| State | Zustand 5 |
| Styling | Tailwind CSS 3 |
| Editor | CodeMirror 6 |
| Markdown | unified + remark + rehype |
| Gantt | frappe-gantt |
| Calendar | FullCalendar 6 |
| ICS parsing | ical.js |
