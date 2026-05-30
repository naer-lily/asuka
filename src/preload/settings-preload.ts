import { contextBridge, ipcRenderer } from 'electron'

const api = {
  onInit(cb: (data: { config: Record<string, unknown>; plugins: Array<{ id: string; name: string; icon: string; builtin: boolean }> }) => void) {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => {
      cb(data as { config: Record<string, unknown>; plugins: Array<{ id: string; name: string; icon: string; builtin: boolean }> })
    }
    ipcRenderer.on('asuka:settings-init', handler)
    return (): void => { ipcRenderer.removeListener('asuka:settings-init', handler) }
  },

  saveConfig(patch: Record<string, unknown>): void {
    ipcRenderer.send('asuka:settings-save', patch)
  },

  reloadPlugins(): void {
    ipcRenderer.send('asuka:settings-reload-plugins')
  }
}

contextBridge.exposeInMainWorld('settingsAPI', api)

export type SettingsAPI = typeof api
