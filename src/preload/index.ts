import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DropReportPayload, ExpandMenuPayload } from '@shared/ipc-types'

const api = {
  reportDragEnter: () => {
    // eslint-disable-next-line no-console
    console.log('[preload] reportDragEnter -> IPC')
    ipcRenderer.send(IPC.DRAG_ENTER)
  },
  reportDragLeave: () => {
    // eslint-disable-next-line no-console
    console.log('[preload] reportDragLeave -> IPC')
    ipcRenderer.send(IPC.DRAG_LEAVE)
  },
  reportDrop: (payload: DropReportPayload) => {
    // eslint-disable-next-line no-console
    console.log('[preload] reportDrop -> IPC')
    ipcRenderer.send(IPC.DROP_EXECUTE, payload)
  },
  reportClick: (commandId: string) => {
    // eslint-disable-next-line no-console
    console.log(`[preload] reportClick commandId=${commandId} -> IPC`)
    ipcRenderer.send(IPC.CLICK_EXECUTE, { commandId })
  },
  reportBlur: () => {
    // eslint-disable-next-line no-console
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
  onExpand: (cb: (payload: ExpandMenuPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ExpandMenuPayload): void => {
      // eslint-disable-next-line no-console
      console.log('[preload] onExpand received')
      cb(payload)
    }
    ipcRenderer.on(IPC.EXPAND_MENU, handler)
    return (): void => { ipcRenderer.removeListener(IPC.EXPAND_MENU, handler) }
  },
  onCollapse: (cb: () => void) => {
    const handler = (): void => {
      // eslint-disable-next-line no-console
      console.log('[preload] onCollapse received')
      cb()
    }
    ipcRenderer.on(IPC.COLLAPSE, handler)
    return (): void => { ipcRenderer.removeListener(IPC.COLLAPSE, handler) }
  }
}

contextBridge.exposeInMainWorld('asukaAPI', api)

export type AsukaAPI = typeof api
