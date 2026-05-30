import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DropReportPayload, ClickExecutePayload } from '@shared/ipc-types'
import { ts } from '@shared/utils'
import { expandToMenu, collapseToBubble, getBubbleWindow, expandContextMenu, isExpanded, setBubblePosition, openSubmenu, closeSubmenu } from './bubble-window'
import { getCurrentData, clearData } from './clipboard-monitor'

export function registerIpc(): void {
  ipcMain.on(IPC.DRAG_ENTER, () => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] IPC DRAG_ENTER`)
    expandToMenu()
  })

  ipcMain.on(IPC.DRAG_LEAVE, () => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] IPC DRAG_LEAVE`)
    collapseToBubble()
  })

  let dragAnchorWin: number[] = [0, 0]
  let dragAnchorMouse: { x: number; y: number } = { x: 0, y: 0 }
  let dragAnchorSize: { width: number; height: number } = { width: 0, height: 0 }

  ipcMain.on(IPC.DRAG_START, (_event, { x, y }: { x: number; y: number }) => {
    const win = getBubbleWindow()
    if (!win || isExpanded()) return
    dragAnchorWin = win.getPosition()
    dragAnchorMouse = { x, y }
    dragAnchorSize = { width: 56, height: 56 }
  })

  ipcMain.on(IPC.DRAG_MOVE, (_event, { x, y }: { x: number; y: number }) => {
    const win = getBubbleWindow()
    if (!win || isExpanded()) return
    const newX = dragAnchorWin[0] + (x - dragAnchorMouse.x)
    const newY = dragAnchorWin[1] + (y - dragAnchorMouse.y)
    setBubblePosition(Math.round(newX), Math.round(newY))
    win.setBounds({
      x: Math.round(newX),
      y: Math.round(newY),
      width: dragAnchorSize.width,
      height: dragAnchorSize.height
    })
  })

  ipcMain.on(IPC.DROP_EXECUTE, (_event, payload: DropReportPayload) => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] IPC DROP_EXECUTE command=${payload.command} items=${payload.items.length}`)

    for (const item of payload.items) {
      if (item.kind === 'file') {
        // eslint-disable-next-line no-console
        console.log(`  [file] ${item.name} path=${item.path || '(空)'} size=${item.size}`)
      } else if (item.kind === 'text') {
        // eslint-disable-next-line no-console
        console.log(`  [text] ${item.content.substring(0, 80)}`)
      }
    }

    collapseToBubble()
  })

  ipcMain.on(IPC.CLICK_EXECUTE, (_event, payload: ClickExecutePayload) => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] IPC CLICK_EXECUTE commandId=${payload.commandId}`)

    const data = getCurrentData()
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] clipboard data:`, data.map(d => d.kind))

    clearData()
    collapseToBubble()
  })

  ipcMain.on(IPC.BUBBLE_CONTEXT, (_event, { x, y }: { x: number; y: number }) => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] IPC BUBBLE_CONTEXT (${x},${y})`)
    expandContextMenu(x, y)
  })

  ipcMain.on(IPC.BLUR, () => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] IPC BLUR`)
    collapseToBubble()
  })

  ipcMain.on(IPC.SUBMENU_OPEN, () => {
    openSubmenu()
  })

  ipcMain.on(IPC.SUBMENU_CLOSE, () => {
    closeSubmenu()
  })
}
