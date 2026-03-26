export interface ElectronAPI {
    getAppVersion: () => Promise<string>;
    openFile: (options?: Record<string, any>) => Promise<any>;
    openDirectory: (options?: Record<string, any>) => Promise<any>;
    saveFile: (options?: Record<string, any>) => Promise<any>;
    onFileOpen: (callback: (data: any) => void) => () => void;
}
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
