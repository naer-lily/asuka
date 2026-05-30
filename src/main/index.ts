import { execSync } from 'child_process'
import { app, ipcMain } from 'electron'
import { join } from 'path'
import { config } from './config'
import { initLogger } from './logger'
import { pluginHost } from './plugin-host'
import { createToast, showToast } from './toast'
import { createBubbleWindow } from './bubble-window'
import { registerIpc } from './ipc-handlers'
import { createTray, destroyTray, setUpdateAvailable } from './tray'
import { start as startClipboard, stop as stopClipboard } from './clipboard-monitor'
import { openSettings } from './settings-window'
import { autoUpdater } from './auto-updater'

if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch {
    // ignore if code page switch fails
  }
}

app.whenReady().then(() => {
  config.load()

  initLogger()

  pluginHost.initialize()

  createToast()

  const win = createBubbleWindow()

  registerIpc()

  win.loadFile(join(__dirname, '../renderer/index.html'))

  win.show()

  startClipboard()

  createTray(win)

  const skipVersion = config.get().skipVersion
  const lastCheck = config.get().lastUpdateCheck || 0
  const ONE_DAY = 24 * 60 * 60 * 1000
  if (Date.now() - lastCheck > ONE_DAY) {
    setTimeout(() => {
      void (async () => {
        config.patch({ lastUpdateCheck: Date.now() })
        const info = await autoUpdater.checkForUpdates()
        if (info.available && info.latestVersion && info.latestVersion !== skipVersion) {
          setUpdateAvailable(info.latestVersion)
          showToast(`Asuka ${info.latestVersion} 可用，右键托盘图标更新`)
        }
      })()
    }, 5000)
  }

  console.log('[asuka] 悬浮球已启动')
  console.log('[asuka]   拖文件到球 → 展开菜单')
  console.log('[asuka]   Ctrl+C 文件/文本 → 菜单在鼠标旁展开')
  console.log('[asuka] 右键托盘图标 → 设置/重置位置/开发')
})

app.on('window-all-closed', () => {})
app.on('activate', () => {})

app.on('will-quit', () => {
  stopClipboard()
  destroyTray()
})
