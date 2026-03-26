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

## 🚀 Standalone Desktop Application

The Personal Note App is now available as a **standalone desktop application** for Windows, macOS, and Linux!

### Quick Start (Desktop App)

**Windows:**
```cmd
build-electron.bat
```

**macOS/Linux:**
```bash
chmod +x build-electron.sh
./build-electron.sh
```

Your packaged app will be in `dist-app/`. See [STANDALONE_README.md](./STANDALONE_README.md) for full details.

### Development Mode
```bash
npm install
npm run dev:electron
```

This launches the app with hot-reload for development.

### Features of Desktop App
- ✅ Native Windows, macOS, and Linux application
- ✅ Professional installers for each platform
- ✅ Secure Electron IPC communication
- ✅ Native file dialogs and app menu
- ✅ All Note App features included
- ✅ Git integration built-in

### Output Formats
After building, you'll have:
- **Windows**: NSIS installer + portable EXE
- **macOS**: DMG installer + ZIP archive
- **Linux**: AppImage + DEB package

For more details on building and distribution, see:
- 📘 [STANDALONE_README.md](./STANDALONE_README.md) — Feature overview and quick start
- 🚀 [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Commands and troubleshooting

---

## Getting Started: Complete Setup Guide

This guide will walk you through installing everything you need to run the Personal Note App. Even if you're not technical, just follow the steps for your operating system.

### What You're Installing (and Why)

| Tool | Purpose | Required? |
|---|---|---|
| **Java** | Powers the Soot compiler for Android bytecode analysis | ✅ Yes |
| **Node.js + npm** | Runs the Personal Note App | ✅ Yes |
| **apktool** | Decompiles Android APK files for analysis | ✅ Yes |
| **Android Studio** | Provides the Android SDK and development tools | ⚠️ Recommended |
| **Android SDK Platforms** | Contains Android system files for different versions (needed for APK analysis) | ⚠️ Recommended |
| **Android SDK Tools** | Command-line tools like `adb` for device communication and analysis | ⚠️ Recommended |

**Minimum Setup:** Java, Node.js, apktool (basic analysis only)
**Recommended Setup:** Everything above (full analysis features)

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

The app requires **Node.js v20**. The recommended way to install and manage Node.js versions is with [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager), which lets you switch versions easily and avoids permission issues.

#### **Windows**
1. Install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) — download and run the `nvm-setup.exe` installer
2. Open a new Command Prompt and run:
   ```cmd
   nvm install 20
   nvm use 20
   ```
3. Verify by typing: `node --version`
4. You should see `v20.x.x`

> **Alternative (no nvm):** Go to [nodejs.org](https://nodejs.org/), download the **v20 LTS** installer, run it, and click **Next** through all steps. When asked "Install native modules", leave it checked.

#### **macOS**
1. Open Terminal and install nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
   ```
2. Close and reopen Terminal, then run:
   ```bash
   nvm install 20
   nvm use 20
   ```
3. Verify by typing: `node --version`

> **Alternative (Homebrew):** `brew install node@20 && brew link node@20`

#### **Linux (Ubuntu/Debian)**
1. Open Terminal and install nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
   ```
2. Close and reopen Terminal, then run:
   ```bash
   nvm install 20
   nvm use 20
   ```
3. Verify by typing: `node --version`

> **Alternative (apt):** The system package may be an older version. Use the NodeSource repo for v20:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt install -y nodejs
> ```

#### **Linux (Fedora/RHEL)**
1. Open Terminal and install nvm (same as Ubuntu above), then:
   ```bash
   nvm install 20
   nvm use 20
   ```
2. Verify by typing: `node --version`

> **Alternative (dnf):**
> ```bash
> sudo dnf module enable nodejs:20
> sudo dnf install nodejs npm
> ```

#### **Pinning the version (optional but recommended)**
After installing, create a `.nvmrc` file in the project root so `nvm` always uses the right version automatically:
```bash
echo "20" > .nvmrc
nvm use  # reads .nvmrc automatically
```

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

### Step 3.5: Install Android Studio (Optional but Recommended)

Android Studio provides the Android SDK and development tools needed for advanced Android analysis. If you only plan to use basic analysis features, you can skip this step. However, it's recommended for full functionality.

#### **Windows**
1. Go to [developer.android.com/studio](https://developer.android.com/studio)
2. Click **Download Android Studio**
3. Accept the terms and download the installer
4. Run the downloaded `.exe` file
5. Follow the installation wizard:
   - Click **Next** through the welcome screens
   - Choose installation location (default is fine)
   - Select "Android Virtual Device" if you want to test apps (optional)
   - Click **Install** and wait for completion
6. After installation, Android Studio opens and downloads components (this may take several minutes)
7. Close Android Studio when done

#### **macOS**
1. Go to [developer.android.com/studio](https://developer.android.com/studio)
2. Click **Download Android Studio**
3. Accept the terms and download the `.dmg` file
4. Open the downloaded file and drag the Android Studio icon to the Applications folder
5. Open Applications and double-click **Android Studio**
6. Follow the setup wizard:
   - Click through the welcome screens
   - Choose "Standard" setup (recommended)
   - The IDE downloads required components
7. Close Android Studio when done

#### **Linux (Ubuntu/Debian)**
1. Go to [developer.android.com/studio](https://developer.android.com/studio)
2. Click **Download Android Studio**
3. Accept the terms and download the `.tar.gz` file
4. Open Terminal and run:
   ```bash
   cd ~/Downloads
   tar -xzf android-studio-*.tar.gz
   mv android-studio ~
   cd ~/android-studio/bin
   ./studio.sh
   ```
5. Follow the setup wizard and let it download required components
6. Close Android Studio when done

#### **Linux (Fedora/RHEL)**
1. Install the IDE and Java development tools:
   ```bash
   sudo dnf install android-studio
   ```
2. Open Android Studio from your applications menu
3. Follow the setup wizard and let it download components
4. Close when done

---

### Step 3.6: Install Android SDK Platforms and Tools

Once Android Studio is installed, you need to install the Android SDK platforms and tools. Follow these steps:

#### **All Platforms (Windows, macOS, Linux)**

1. Open Android Studio
2. Click **Tools** in the top menu
3. Click **SDK Manager**
4. A window opens showing "Android SDK"
5. Go to the **SDK Platforms** tab:
   - Check the boxes for:
     - **Android 15** (API 35) or your target API level
     - **Android 14** (API 34) - recommended for compatibility
     - **Android 13** (API 33) - recommended for compatibility
   - Click **Apply** and wait for downloads to complete (may take 5-10 minutes)

6. Go to the **SDK Tools** tab:
   - Make sure these are checked:
     - **Android SDK Build-Tools** (latest version)
     - **Android Emulator** (if you want to test apps)
     - **Android SDK Platform-Tools** (includes adb)
     - **Google USB Driver** (Windows only, if using real Android devices)
   - Click **Apply** and wait for installation

7. Click **OK** and close the SDK Manager

8. Close Android Studio

**Verification:**
Open Terminal/Command Prompt and verify the SDK tools are installed:
```bash
adb --version    # Should show Android Debug Bridge version
```

You should see version information without errors.

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

### Step 5: Configure Android SDK Path (Optional but Recommended)

The app works better when it knows where your Android SDK is installed. This step helps the analysis tools find Android components automatically.

#### **Windows**
1. Open Command Prompt
2. Run this command (replacing the path with your actual SDK location):
   ```bash
   setx ANDROID_SDK_ROOT "C:\Users\YourName\AppData\Local\Android\Sdk"
   ```
3. Close Command Prompt and open a new one
4. Verify by typing: `echo %ANDROID_SDK_ROOT%`

#### **macOS**
1. Open Terminal
2. Edit your profile:
   ```bash
   nano ~/.zprofile
   ```
3. Add this line:
   ```bash
   export ANDROID_SDK_ROOT=~/Library/Android/sdk
   ```
4. Press `Ctrl + X`, then `Y`, then `Enter` to save
5. Run: `source ~/.zprofile`
6. Verify by typing: `echo $ANDROID_SDK_ROOT`

#### **Linux**
1. Open Terminal
2. Edit your profile:
   ```bash
   nano ~/.bashrc
   ```
3. Add this line:
   ```bash
   export ANDROID_SDK_ROOT=~/Android/Sdk
   ```
4. Press `Ctrl + X`, then `Y`, then `Enter` to save
5. Run: `source ~/.bashrc`
6. Verify by typing: `echo $ANDROID_SDK_ROOT`

---

### Step 6: Start the App

You can run the app in two ways:

#### **Option A: Desktop App (Recommended)**
```bash
npm run dev:electron
```
This launches the app as a native desktop application with hot-reload during development. The app window opens automatically.

#### **Option B: Web Version**
```bash
npm run dev
```
This starts a local web server. You should see output like:
```
➜  Local:   https://localhost:5173/
```
Open your web browser and go to `https://localhost:5173`. Your browser may show a security warning about the certificate — this is normal for local development. Click **Advanced** or **Proceed** to continue.

---

### Step 7: Create Your Vault

1. Click **Open Vault Folder** and select a folder where you want to store your notes
2. Start creating notes!

**Done!** You can now use the Personal Note App.

---

### Building a Standalone Desktop App

To build a standalone application that can be distributed to others:

```bash
./build-electron.sh          # macOS/Linux
build-electron.bat           # Windows
```

This creates professional installers in the `dist-app/` folder. See [STANDALONE_README.md](./STANDALONE_README.md) for details.

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
- This can happen when `node_modules` is partially corrupted (e.g. a package was installed but its `dist/` folder is missing). A clean reinstall fixes it:
  ```bash
  rm -rf node_modules
  npm install
  ```
  On Windows, use `rmdir /s /q node_modules` instead of `rm -rf`.

**Browser shows HTTPS certificate warning**
- This is expected for local development. Click **Advanced** and proceed — it's safe.

**"Chrome blocks opening certain sensitive directories"**
- Store your notes in a subfolder (e.g., `~/Documents/Notes` instead of `~/Documents`)

**Linux: AppImage shows a blank white window**
- This is caused by the Vite build using absolute asset paths (`/assets/...`) which don't resolve correctly under `file://`. Rebuild from source — the fix is already included in the latest version:
  ```bash
  npm run build:electron:linux
  ```

**Linux: git-server fails with "Failed to load native module: pty.node"**
- `node-pty` ships prebuilt binaries that must match your system's Node.js version. Rebuild it:
  ```bash
  npm rebuild node-pty
  ```
- If that fails, install build tools first:
  ```bash
  sudo apt-get install -y python3 make g++
  npm rebuild node-pty
  ```

**Linux: AppImage git-server keeps trying ports 3001, 3002, 3003...**
- Multiple stale git-server processes are running. Kill them all and restart:
  ```bash
  pkill -f 'git-server.mjs'
  ```
- Then relaunch the AppImage.

---

### Verify Your Setup

After installation, verify everything is working by running these commands:

```bash
java -version              # Should show Java 21 or higher
node --version             # Should show v20 or higher
npm --version              # Should show v10 or higher
apktool --version          # Should show the apktool version
adb --version              # Should show Android Debug Bridge version
echo $ANDROID_SDK_ROOT     # Should show your SDK path (Mac/Linux)
echo %ANDROID_SDK_ROOT%    # Should show your SDK path (Windows)
```

All commands should return version numbers or paths without errors. If any fail, re-read the installation section for that tool.

**Quick Checklist:**
- [ ] Java installed and `java -version` works
- [ ] Node.js installed and `node --version` works
- [ ] npm installed and `npm --version` works
- [ ] apktool installed and `apktool --version` works
- [ ] Android Studio installed (optional but recommended)
- [ ] Android SDK Platforms installed (Android 13, 14, 15)
- [ ] Android SDK Tools installed (Build-Tools, Platform-Tools, Emulator)
- [ ] ANDROID_SDK_ROOT environment variable set (optional but recommended)

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
