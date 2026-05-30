import { BrowserWindow } from 'electron'
import { join } from 'path'
import { config } from './config'
import { pluginHost } from './plugin-host'

let settingsWin: BrowserWindow | null = null

function getPreloadPath(): string {
  return join(__dirname, '../preload/settings-preload.js')
}

function getHTMLPath(): string {
  return join(__dirname, '../renderer/settings.html')
}

export function openSettings(): void {
  if (settingsWin) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 480,
    height: 560,
    frame: true,
    resizable: false,
    title: 'Asuka 设置',
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  settingsWin.setMenuBarVisibility(false)

  settingsWin.on('closed', () => {
    settingsWin = null
  })

  settingsWin.once('ready-to-show', () => {
    settingsWin!.show()

    const cfg = config.get()
    const plugins = pluginHost.getAllPluginInfo()

    settingsWin!.webContents.send('asuka:settings-init', {
      config: cfg,
      plugins: plugins.map(p => ({ id: p.id, name: p.name, icon: p.icon || '' }))
    })
  })

  settingsWin.loadFile(getHTMLPath())
}
