import { BrowserWindow, screen } from 'electron'

const TOAST_W = 280
const TOAST_H = 36
const OFFSCREEN_X = -9999
const OFFSCREEN_Y = -9999
const DURATION_MS = 2500

let toastWin: BrowserWindow | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function getToastHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: -apple-system, "Microsoft YaHei", sans-serif;
    font-size: 13px;
    overflow: hidden;
    background: transparent;
  }
  .toast-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: ${TOAST_H}px;
    border-radius: 8px;
    padding: 0 16px;
    background: rgba(30, 30, 30, 0.92);
    color: #e0e0e0;
    white-space: nowrap;
    transition: transform 0.25s ease-out, opacity 0.25s ease-out;
    transform: translateY(12px);
    opacity: 0;
  }
  .toast-wrap.visible {
    transform: translateY(0);
    opacity: 1;
  }
</style>
</head>
<body>
  <div id="toast" class="toast-wrap"></div>
  <script>
    const { ipcRenderer } = require('electron')
    const el = document.getElementById('toast')
    ipcRenderer.on('asuka:toast-text', (_e, text) => {
      el.textContent = text
      el.classList.add('visible')
    })
    ipcRenderer.on('asuka:toast-hide', () => {
      el.classList.remove('visible')
    })
  </script>
</body>
</html>`
}

export function createToast(): BrowserWindow {
  if (toastWin) return toastWin

  toastWin = new BrowserWindow({
    x: OFFSCREEN_X,
    y: OFFSCREEN_Y,
    width: TOAST_W,
    height: TOAST_H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  toastWin.setIgnoreMouseEvents(true, { forward: true })

  toastWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getToastHTML())}`)

  toastWin.once('ready-to-show', () => {
    toastWin!.showInactive()
  })

  return toastWin
}

export function showToast(message: string): void {
  if (!toastWin) return

  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: screenX, y: screenY, width: screenW } = display.workArea

  const x = Math.round(screenX + (screenW - TOAST_W) / 2)
  const y = Math.round(screenY + display.workArea.height - TOAST_H - 60)

  toastWin.setBounds({ x, y, width: TOAST_W, height: TOAST_H })
  toastWin.webContents.send('asuka:toast-text', message)

  hideTimer = setTimeout(() => {
    hideTimer = null
    hideToast()
  }, DURATION_MS)
}

function hideToast(): void {
  if (!toastWin) return
  toastWin.webContents.send('asuka:toast-hide')
  setTimeout(() => {
    if (toastWin) {
      toastWin.setBounds({ x: OFFSCREEN_X, y: OFFSCREEN_Y, width: TOAST_W, height: TOAST_H })
    }
  }, 300)
}
