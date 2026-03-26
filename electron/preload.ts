import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => {
    return new Promise((resolve) => {
      ipcRenderer.once('app-version', (event, arg) => {
        resolve(arg.version)
      })
      ipcRenderer.send('app-version')
    })
  },
  openFile: (options?: Record<string, any>) => {
    return ipcRenderer.invoke('dialog:openFile', options)
  },
  openDirectory: (options?: Record<string, any>) => {
    return ipcRenderer.invoke('dialog:openDirectory', options)
  },
  saveFile: (options?: Record<string, any>) => {
    return ipcRenderer.invoke('dialog:saveFile', options)
  },
  onFileOpen: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('file:open', subscription)
    return () => {
      ipcRenderer.removeListener('file:open', subscription)
    }
  },
})

export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  openFile: (options?: Record<string, any>) => Promise<any>
  openDirectory: (options?: Record<string, any>) => Promise<any>
  saveFile: (options?: Record<string, any>) => Promise<any>
  onFileOpen: (callback: (data: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
