# Personal Note App

A local-first markdown note-taking app with Obsidian-style editing, Gantt chart project tracking, full calendar view with Google/Outlook import, and built-in Android security analysis tools (Soot compiler and Jimple code analyzer).

## Features

- **Markdown Notes** — Full markdown editing with live preview, wiki-links `[[Note Name]]`, callouts `>[!info]`, GFM tables and task lists
- **Tagging** — Tag notes via frontmatter; browse and filter by tag
- **Command Palette** — `Ctrl+K` / `Cmd+K` to fuzzy-search all notes
- **Gantt Charts** — Visual project timelines from notes with `type: gantt-task` frontmatter; single-project and all-projects views; create tasks from the UI
- **Calendar** — Day, Week, Month views powered by FullCalendar; events sourced from note frontmatter `start:`/`end:`/`date:` fields
- **ICS Import** — Import `.ics` files exported from Google Calendar, Outlook, or any calendar app
- **Google Calendar** — Connect via OAuth2 PKCE (requires setup — see below)
- **Outlook Calendar** — Connect via Microsoft OAuth2 PKCE (requires setup — see below)
- **Graph View** — Visual network of wiki-link connections between notes
- **Tasks View** — Aggregated checklist of all `- [ ]` items across the vault
- **Gantt subtask collapse** — Click the ▶/▼ toggle on any parent task to show/hide its subtasks
- **Tag autocomplete** — Typing in the tag panel suggests existing vault tags with keyboard navigation
- **AI Chat** — Connect to any OpenAI-compatible server (OpenWebUI, Ollama, LM Studio); select a model and query with note context injected
- **GSD (Getting Stuff Done)** — Inbox, Next Actions, Projects, Waiting For, Someday/Maybe, Done tabs; imports from Gantt; weekly review dashboard
- **Diagrams** — Mermaid-based diagram editor
- **Soot Compiler** — Analyze Android APKs by compiling them to Jimple intermediate representation
- **Jimple Analyzer** — Extract and analyze APIs, strings, classes, and libraries from compiled code
- **Jimple Code Viewer** — View decompiled Jimple code for analyzed classes with syntax highlighting
- **LAN access** — Serve over HTTPS to other machines on your network (see below)
- **Dark / Light mode**
- **Local-first** — All data lives in your markdown files; no database, no server

---

## Getting Started: Complete Setup Guide

This guide will walk you through installing everything you need to run the Personal Note App. Even if you're not technical, just follow the steps for your operating system.

### Step 1: Install Java

The app includes Android analysis tools that require Java. Follow the instructions for your operating system:

#### **Windows**
1. Go to [oracle.com/java/technologies/downloads/](https://www.oracle.com/java/technologies/downloads/)
2. Click **Java 21** (or the latest LTS version)
3. Under "Windows", click the download link for **x64 Installer** (the `.exe` file)
4. Run the downloaded `.exe` file and follow the installation wizard
5. Click **Next** through all steps and complete the installation
6. Open Command Prompt (press `Win + R`, type `cmd`, press Enter)
7. Verify installation by typing: `java -version` and pressing Enter
8. You should see something like `java version "21.0.x"`

#### **macOS**
1. Open **Terminal** (find it in Applications → Utilities, or press `Cmd + Space` and type "Terminal")
2. If you have Homebrew installed, run:
   ```bash
   brew install openjdk@21
   ```
3. If you don't have Homebrew, install it first by pasting this into Terminal:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
4. After Homebrew installs, run the Java command above
5. Verify by typing: `java -version`

#### **Linux (Ubuntu/Debian)**
1. Open Terminal
2. Run these commands:
   ```bash
   sudo apt update
   sudo apt install openjdk-21-jdk
   ```
3. Verify by typing: `java -version`

#### **Linux (Fedora/RHEL)**
1. Open Terminal
2. Run:
   ```bash
   sudo dnf install java-21-openjdk
   ```
3. Verify by typing: `java -version`

---

### Step 2: Install Node.js

The app is built with Node.js. Follow the instructions for your operating system:

#### **Windows**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS** version (green button, currently v20 or higher)
3. Run the installer and click **Next** through all steps
4. When asked "Install native modules", leave it checked and continue
5. Complete the installation
6. Open a new Command Prompt window
7. Verify by typing: `node --version` and pressing Enter
8. You should see `v20.x.x` or higher

#### **macOS**
1. Open Terminal
2. If you have Homebrew, run:
   ```bash
   brew install node
   ```
3. If not, install Homebrew first (see Java section above), then run the command
4. Verify by typing: `node --version`

#### **Linux (Ubuntu/Debian)**
1. Open Terminal
2. Run:
   ```bash
   sudo apt update
   sudo apt install nodejs npm
   ```
3. Verify by typing: `node --version`

#### **Linux (Fedora/RHEL)**
1. Open Terminal
2. Run:
   ```bash
   sudo dnf install nodejs npm
   ```
3. Verify by typing: `node --version`

---

### Step 3: Install apktool (for Android APK analysis)

apktool is used to decompile Android apps. Follow the instructions for your operating system:

#### **Windows**
1. Create a folder for apktool: right-click on Desktop or your Documents folder → **New** → **Folder** → name it `apktool`
2. Go to [github.com/iBotPeaches/Apktool/releases](https://github.com/iBotPeaches/Apktool/releases)
3. Download `apktool_version.jar` (the .jar file, not the installer)
4. Also download `apktool.bat` from the same release
5. Save both files to your `apktool` folder
6. Add apktool to your PATH:
   - Press `Win + R`, type `sysdm.cpl`, press Enter
   - Click the **Advanced** tab, then **Environment Variables**
   - Under "User variables", click **New**
   - Variable name: `PATH`
   - Variable value: `C:\path\to\your\apktool\folder` (replace with the actual folder path)
   - Click **OK** on all dialogs
7. Open a new Command Prompt and verify by typing: `apktool --version`

#### **macOS**
1. Open Terminal
2. Install Homebrew if you haven't (see Java section)
3. Run:
   ```bash
   brew install apktool
   ```
4. Verify by typing: `apktool --version`

#### **Linux (Ubuntu/Debian)**
1. Open Terminal
2. Run:
   ```bash
   sudo apt update
   sudo apt install apktool
   ```
3. Verify by typing: `apktool --version`

#### **Linux (Fedora/RHEL)**
1. Open Terminal
2. Run:
   ```bash
   sudo dnf install apktool
   ```
3. Verify by typing: `apktool --version`

---

### Step 4: Download and Install the Personal Note App

1. Go to the repository on GitHub and click the green **Code** button
2. Click **Download ZIP** and save it to your computer
3. Extract/unzip the folder to a location you'll remember (e.g., `~/Documents/personal-note-app` or `C:\Users\YourName\Documents\personal-note-app`)
4. Open Terminal (Mac/Linux) or Command Prompt (Windows)
5. Navigate to the app folder:
   - **Windows**: `cd C:\Users\YourName\Documents\personal-note-app`
   - **Mac/Linux**: `cd ~/Documents/personal-note-app`
6. Run:
   ```bash
   npm install
   ```
   This will download and install all the dependencies (this takes a few minutes)

---

### Step 5: Start the App

1. In the same Terminal/Command Prompt window, run:
   ```bash
   npm run dev
   ```
2. You should see output like:
   ```
   ➜  Local:   https://localhost:5173/
   ```
3. Open your web browser and go to `https://localhost:5173`
4. Your browser may show a security warning about the certificate — this is normal for local development. Click **Advanced** or **Proceed** to continue
5. Click **Open Vault Folder** and select a folder where you want to store your notes

**Done!** You can now use the Personal Note App.

---

### Common Issues

**"java: command not found" or "java --version" doesn't work**
- Java didn't install correctly. Restart your computer and try the verification command again.
- On Windows, you may need to restart Command Prompt after installation.

**"node: command not found" or "npm: command not found"**
- Node.js didn't install correctly. Restart your computer and try again.
- On Windows, restart Command Prompt after installation.

**"npm install" is very slow**
- This is normal — it's downloading many dependencies. Be patient and let it finish.

**"Cannot find module" errors when running `npm run dev`**
- Run `npm install` again to ensure all dependencies are installed.

**Browser shows HTTPS certificate warning**
- This is expected for local development. Click **Advanced** and proceed — it's safe.

**"Chrome blocks opening certain sensitive directories"**
- Store your notes in a subfolder (e.g., `~/Documents/Notes` instead of `~/Documents`)

---

### Verify Your Setup

After installation, verify everything is working by running these commands:

```bash
java -version          # Should show Java 21 or higher
node --version         # Should show v20 or higher
npm --version          # Should show v10 or higher
apktool --version      # Should show the apktool version
```

All commands should return version numbers without errors. If any fail, re-read the installation section for that tool.

---

## Using the App

### Opening Your Notes Folder

When you first start the app, click **Open Vault Folder** to select where your notes live:

1. **On Chrome/Edge (Windows)**: A file browser opens — navigate to your notes folder and click **Open**
2. **On Safari/Firefox**: You'll see a file picker — navigate and select your notes folder
3. The app will load your notes and you can start editing

> **Tip:** Store your notes in a regular folder like `~/Documents/Notes`. The app will create a file called `.vault-config.json` in that folder to remember your selection.

---

## Advanced Features

### LAN access (access the app from other devices on your network)

The app runs over HTTPS locally so that the File System Access API (which allows full read/write access to your notes) works correctly.

**To access the app from another device on your network:**

1. Find your computer's IP address on your network:
   - **Windows**: Open Command Prompt and type `ipconfig`. Look for "IPv4 Address" (e.g., `192.168.1.100`)
   - **Mac/Linux**: Open Terminal and type `ifconfig`. Look for `inet` (e.g., `192.168.1.100`)

2. On the host machine, the dev server already runs on all network interfaces when you run `npm run dev`

3. From another device on the same network, open your browser and go to:
   ```
   https://192.168.1.100:5173
   ```
   (Replace `192.168.1.100` with your actual IP)

4. Your browser will show a security warning — this is normal. Click **Advanced → Proceed** or **Accept Risk and Continue**

5. Click the **"download & install the CA cert"** link in the app sidebar to trust the certificate so you don't see the warning again

6. After installing the certificate on the remote device, reload the page — the warning is gone

> **Note:** The app uses self-signed certificates for local development. This is secure for your local network — data never leaves your computer.

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
| Graph | Cytoscape.js |
| Diagrams | Mermaid |
| TLS (dev) | mkcert |
