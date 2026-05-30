import { execSync } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { createBubbleWindow } from './bubble-window'
import { registerIpc } from './ipc-handlers'
import { createTray, destroyTray } from './tray'
import { start as startClipboard, stop as stopClipboard } from './clipboard-monitor'

if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch {
    // ignore if code page switch fails
  }
}

app.whenReady().then(() => {
  const win = createBubbleWindow()

  win.loadFile(join(__dirname, '../renderer/index.html'))

  registerIpc()

  win.show()

  createTray(win)

  startClipboard()

  console.log('[asuka] 悬浮球已启动')
  console.log('[asuka]   拖文件到球 → 展开菜单')
  console.log('[asuka]   Ctrl+C 文件/文本 → 菜单在鼠标旁展开，移出即收拢')
  console.log('[asuka] 右键托盘图标 → 打开 DevTools 可查看渲染日志')
})

app.on('window-all-closed', () => {})
app.on('activate', () => {})

app.on('will-quit', () => {
  stopClipboard()
  destroyTray()
})
