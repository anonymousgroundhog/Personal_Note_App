import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => {
        return new Promise((resolve) => {
            ipcRenderer.once('app-version', (event, arg) => {
                resolve(arg.version);
            });
            ipcRenderer.send('app-version');
        });
    },
    openFile: (options) => {
        return ipcRenderer.invoke('dialog:openFile', options);
    },
    openDirectory: (options) => {
        return ipcRenderer.invoke('dialog:openDirectory', options);
    },
    saveFile: (options) => {
        return ipcRenderer.invoke('dialog:saveFile', options);
    },
    onFileOpen: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('file:open', subscription);
        return () => {
            ipcRenderer.removeListener('file:open', subscription);
        };
    },
});
//# sourceMappingURL=preload.js.map