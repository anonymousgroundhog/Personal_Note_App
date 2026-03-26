# Quick Reference - Personal Note App Standalone

One-page reference for common tasks and commands.

## 🚀 Getting Started (2 minutes)

```bash
npm install                    # Install dependencies
npm run dev:electron          # Start development mode
```

Then build:

```bash
# Windows
build-electron.bat

# macOS/Linux
chmod +x build-electron.sh
./build-electron.sh
```

Find your app in: **dist-app/**

---

## 📋 Commands

### Development
| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start web dev server (Vite only) |
| `npm run dev:electron` | Start Electron with hot reload |
| `npm run git-server` | Start git backend server |

### Building
| Command | Purpose |
|---------|---------|
| `npm run build` | Build React app for web |
| `npm run build:electron` | Build desktop app (auto-platform) |
| `npm run build:electron:win` | Build for Windows |
| `npm run build:electron:mac` | Build for macOS |
| `npm run build:electron:linux` | Build for Linux |

---

## 📁 Important Files

### To Edit
| File | Change |
|------|--------|
| `package.json` | App name, version, dependencies |
| `electron/main.ts` | Window size, menus, app behavior |
| `electron-builder.json5` | Installer settings, icons |
| `src/` | React components and features |

---

## 🔄 Build Process

```
1. npm install             → Install packages
2. npm run dev:electron    → Test development
3. ./build-electron.sh     → Build for distribution
4. dist-app/               → Find packaged apps
```

---

## 📊 Platform Output

After building, you'll find:

**Windows (dist-app/):**
- `Personal Note App Setup 1.0.0.exe` → Installer
- `Personal Note App 1.0.0.exe` → Portable

**macOS (dist-app/):**
- `Personal Note App-1.0.0.dmg` → Installer
- `Personal Note App-1.0.0.zip` → Archive

**Linux (dist-app/):**
- `personal-note-app-1.0.0.AppImage` → Executable
- `personal-note-app_1.0.0_amd64.deb` → Package

---

## 🎨 Customization

### Change App Name
```json
{
  "name": "my-app",
  "version": "1.0.0"
}

// electron-builder.json5
{
  productName: "My App",
  appId: "com.mycompany.myapp"
}
```

### Change Window Size
```typescript
// electron/main.ts
mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
})
```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Port 3001 in use | `lsof -i :3001 \| awk '{print $2}' \| xargs kill -9` |
| Build fails | `rm -rf dist dist-electron && npm install && ./build-electron.sh` |
| Electron won't start | `node --version` (need 18+) |
| Module not found | `npm install` again |

---

## 💡 Tips

✅ Use `npm run dev:electron` during development
✅ Changes to React code auto-reload
✅ Changes to `electron/main.ts` need app restart
✅ Press F12 in app to open DevTools
✅ Check git-server.mjs if features fail (port 3001)

---

**Pro Tip**: Read STANDALONE_README.md for the full guide.
