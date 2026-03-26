import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let gitServer = null;
const isDev = process.env.ELECTRON_DEV === 'true';
const preloadPath = path.join(__dirname, 'preload.js');
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
        },
    });
    const url = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(url);
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
async function startGitServer() {
    const serverScript = path.join(__dirname, '../git-server.mjs');
    try {
        gitServer = spawn('node', [serverScript], {
            stdio: 'inherit',
            shell: true,
        });
        console.log('Git server started');
    }
    catch (error) {
        console.error('Failed to start git server:', error);
    }
}
app.on('ready', async () => {
    await startGitServer();
    createWindow();
    createAppMenu();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (gitServer) {
            gitServer.kill();
        }
        app.quit();
    }
});
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// IPC handlers
ipcMain.on('app-version', (event) => {
    event.reply('app-version', { version: app.getVersion() });
});
ipcMain.handle('dialog:openFile', async (event, options = {}) => {
    if (!mainWindow)
        return;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        ...options,
    });
    return result;
});
ipcMain.handle('dialog:openDirectory', async (event, options = {}) => {
    if (!mainWindow)
        return;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        ...options,
    });
    return result;
});
ipcMain.handle('dialog:saveFile', async (event, options = {}) => {
    if (!mainWindow)
        return;
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});
// Application menu
function createAppMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        if (gitServer) {
                            gitServer.kill();
                        }
                        app.quit();
                    },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Personal Note App',
                            message: 'Personal Note App',
                            detail: `Version ${app.getVersion()}\n\nA comprehensive note-taking and productivity application.`,
                        });
                    },
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
//# sourceMappingURL=main.js.map