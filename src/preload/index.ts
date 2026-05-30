import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DropReportPayload, ExpandMenuPayload, DragMetadata } from '@shared/ipc-types'

const api = {
  reportDragEnter: (meta: DragMetadata) => {
    console.log('[preload] reportDragEnter -> IPC', JSON.stringify(meta))
    ipcRenderer.send(IPC.DRAG_ENTER, meta)
  },
  reportDragLeave: () => {
    console.log('[preload] reportDragLeave -> IPC')
    ipcRenderer.send(IPC.DRAG_LEAVE)
  },
  reportDrop: (payload: DropReportPayload) => {
    console.log('[preload] reportDrop -> IPC')
    ipcRenderer.send(IPC.DROP_EXECUTE, payload)
  },
  reportClick: (commandId: string) => {
    console.log(`[preload] reportClick commandId=${commandId} -> IPC`)
    ipcRenderer.send(IPC.CLICK_EXECUTE, { commandId })
  },
  reportBlur: () => {
    console.log('[preload] reportBlur -> IPC')
    ipcRenderer.send(IPC.BLUR)
  },
  reportMove: (dx: number, dy: number) => {
    ipcRenderer.send(IPC.MOVE_TO, { dx, dy })
  },
  reportDragStart: (x: number, y: number) => {
    ipcRenderer.send(IPC.DRAG_START, { x, y })
  },
  reportDragMove: (x: number, y: number) => {
    ipcRenderer.send(IPC.DRAG_MOVE, { x, y })
  },
  reportContextMenu: (x: number, y: number) => {
    ipcRenderer.send(IPC.BUBBLE_CONTEXT, { x, y })
  },
  openSubmenu: () => {
    ipcRenderer.send(IPC.SUBMENU_OPEN)
  },
  closeSubmenu: () => {
    ipcRenderer.send(IPC.SUBMENU_CLOSE)
  },
  getFilePath: (file: File): string => {
    return webUtils.getPathForFile(file)
  },
  onBubbleIcon: (cb: (dataUrl: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dataUrl: string): void => {
      cb(dataUrl)
    }
    ipcRenderer.on('asuka:bubble-icon', handler)
    return (): void => { ipcRenderer.removeListener('asuka:bubble-icon', handler) }
  },
  openSettings: () => {
    ipcRenderer.send(IPC.OPEN_SETTINGS)
  },
  onExpand: (cb: (payload: ExpandMenuPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ExpandMenuPayload): void => {
      console.log('[preload] onExpand received')
      cb(payload)
    }
    ipcRenderer.on(IPC.EXPAND_MENU, handler)
    return (): void => { ipcRenderer.removeListener(IPC.EXPAND_MENU, handler) }
  },
  onCollapse: (cb: () => void) => {
    const handler = (): void => {
      console.log('[preload] onCollapse received')
      cb()
    }
    ipcRenderer.on(IPC.COLLAPSE, handler)
    return (): void => { ipcRenderer.removeListener(IPC.COLLAPSE, handler) }
  },
  onSubmenuState: (cb: (state: { active: boolean; onLeft: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { active: boolean; onLeft: boolean }): void => {
      cb(state)
    }
    ipcRenderer.on(IPC.SUBMENU_STATE, handler)
    return (): void => { ipcRenderer.removeListener(IPC.SUBMENU_STATE, handler) }
  },
  onThemeChanged: (cb: (theme: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: string): void => {
      cb(theme)
    }
    ipcRenderer.on(IPC.THEME_CHANGED, handler)
    return (): void => { ipcRenderer.removeListener(IPC.THEME_CHANGED, handler) }
  },
  onConfigChange: (cb: (cfg: Record<string, unknown>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, cfg: Record<string, unknown>): void => {
      cb(cfg)
    }
    ipcRenderer.on(IPC.CONFIG_CHANGED, handler)
    return (): void => { ipcRenderer.removeListener(IPC.CONFIG_CHANGED, handler) }
  }
}

contextBridge.exposeInMainWorld('asukaAPI', api)

export type AsukaAPI = typeof api
