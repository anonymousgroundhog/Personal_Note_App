# Personal Note App - Standalone Desktop Application

A full-featured, production-ready standalone desktop application built with Electron, React, TypeScript, and Vite.

## 🚀 Quick Start

### For Windows Users:
```cmd
build-electron.bat
```

### For macOS/Linux Users:
```bash
chmod +x build-electron.sh
./build-electron.sh
```

Your packaged application will be ready in the `dist-app/` directory.

---

## 📦 What You Get

This standalone application package includes:

### Features
✅ **Desktop Application** - Native Windows, macOS, and Linux app
✅ **Auto-Installer** - Professional installers for each platform
✅ **Hot Reload Development** - Instant feedback during development
✅ **Secure IPC** - Safe inter-process communication
✅ **Native Dialogs** - File pickers, save dialogs, message boxes
✅ **App Menu** - Professional application menus
✅ **Git Integration** - Full git operations support
✅ **Terminal Access** - Built-in terminal emulation
✅ **Code Editor** - Multiple language syntax highlighting

### Distribution Formats

**Windows:**
- NSIS Installer (`Personal Note App Setup 1.0.0.exe`)
- Portable Executable (`Personal Note App 1.0.0.exe`)

**macOS:**
- Disk Image (`Personal Note App-1.0.0.dmg`)
- ZIP Archive (`Personal Note App-1.0.0.zip`)

**Linux:**
- AppImage (`personal-note-app-1.0.0.AppImage`)
- Debian Package (`personal-note-app_1.0.0_amd64.deb`)

---

## 🏗️ Installation & Development

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Development Mode

For active development with hot-reload:

```bash
npm run dev:electron
```

This starts:
- ⚡ Vite dev server (http://localhost:5173)
- 🖥️ Electron app window
- 🔧 Chrome DevTools (press F12)
- 🔗 Git server (port 3001)

### Step 3: Build the Application

Choose one of these methods:

#### Automatic (Recommended)

**Linux/macOS:**
```bash
./build-electron.sh           # Auto-detect platform
./build-electron.sh linux     # Explicit Linux
./build-electron.sh mac       # Explicit macOS
```

**Windows:**
```cmd
build-electron.bat
```

#### Manual Steps

```bash
npm install
npx tsc -p tsconfig.electron.json
npm run build
npm run build:electron
```

### Step 4: Access Your App

Find your packaged applications in `dist-app/`:

**Windows:**
- `Personal Note App Setup 1.0.0.exe` - Double-click to install
- `Personal Note App 1.0.0.exe` - Run directly (portable)

**macOS:**
- `Personal Note App-1.0.0.dmg` - Mount and drag to Applications

**Linux:**
- `personal-note-app-1.0.0.AppImage` - Make executable and run
  ```bash
  chmod +x personal-note-app-*.AppImage
  ./personal-note-app-*.AppImage
  ```
- `personal-note-app_1.0.0_amd64.deb` - Install with apt
  ```bash
  sudo dpkg -i personal-note-app_*.deb
  ```

---

## 💻 Key Commands

```bash
npm run dev:electron          # Start developing with hot-reload
npm run build:electron        # Build for your current platform
npm run build:electron:win    # Build for Windows
npm run build:electron:mac    # Build for macOS
npm run build:electron:linux  # Build for Linux
npm run git-server            # Run backend only
```

---

## 🔧 Customization

### Change App Name/Version

Edit `package.json`:
```json
{
  "version": "1.1.0",
  "name": "my-custom-app"
}
```

Edit `electron-builder.json5`:
```json5
{
  appId: "com.mycompany.myapp",
  productName: "My Custom App"
}
```

### Customize Window Size

Edit `electron/main.ts`:
```typescript
mainWindow = new BrowserWindow({
  width: 1600,    // Change width
  height: 1000,   // Change height
})
```

---

## 📁 Project Structure

```
personal-note-app/
├── electron/                    # Electron main process
│   ├── main.ts                 # Application entry point
│   └── preload.ts              # Secure IPC bridge
├── src/                        # React application
├── dist/                       # Built React app (generated)
├── dist-electron/              # Compiled Electron (generated)
├── dist-app/                   # Final packaged apps (generated)
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── tsconfig.electron.json      # Electron TypeScript config
├── package.json                # Dependencies & scripts
├── electron-builder.json5      # Electron packager config
├── build-electron.sh           # Linux/macOS builder
└── build-electron.bat          # Windows builder
```

---

## 🆘 Troubleshooting

### Build Fails
```bash
rm -rf dist dist-electron dist-app
npm install
./build-electron.sh
```

### Port 3001 Already in Use
```bash
# macOS/Linux
lsof -i :3001 | awk '{print $2}' | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Electron Won't Start
- Ensure Node.js 18+ is installed: `node --version`
- Clear cache: `rm -rf .vite`
- Check console: `npm run dev:electron`

---

## 🎉 You're All Set!

Your Personal Note App is now a full-featured standalone desktop application.

**Happy building! 🚀**
