import { Tray, Menu, app, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null

const ICON_DATA =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAPklEQVR42mNg+M9AAWBigAL4TwFQACiQAZcCJiD4TwEFUCCDMAUQIIH/lAsooEAaoEAAYgUHFBRA4QGxAQB5ZiZ+m+xdHwAAAABJRU5ErkJggg=='

export function createTray(bubbleWin: BrowserWindow): Tray {
  const icon = nativeImage.createFromDataURL(ICON_DATA)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Asuka')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 DevTools',
      click: () => {
        bubbleWin.webContents.openDevTools({ mode: 'detach' })
      }
    },
    {
      label: '重新加载',
      click: () => {
        bubbleWin.webContents.reload()
      }
    },
    { type: 'separator' },
    {
      label: '退出 Asuka',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    bubbleWin.webContents.openDevTools({ mode: 'detach' })
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
