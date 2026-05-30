import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DropReportPayload, ClickExecutePayload, DragMetadata } from '@shared/ipc-types'
import { ts } from '@shared/utils'
import { expandToMenu, collapseToBubble, getBubbleWindow, expandContextMenu, isExpanded, setBubblePosition, openSubmenu, closeSubmenu } from './bubble-window'
import { getCurrentData, clearData } from './clipboard-monitor'
import { pluginHost } from './plugin-host'
import { showToast } from './toast'
import { config } from './config'
import { formDialog } from './form-dialog'
import type { AsukaConfig } from './config'

export function registerIpc(): void {
  ipcMain.on(IPC.DRAG_ENTER, (_event, meta: DragMetadata) => {
    console.log(`[${ts()}] [main] IPC DRAG_ENTER meta: ${JSON.stringify(meta)}`)
    expandToMenu(meta)
  })

  ipcMain.on(IPC.DRAG_LEAVE, () => {
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
    console.log(`[${ts()}] [main] IPC DROP_EXECUTE command=${payload.command} items=${payload.items.length}`)

    let currentMeta: DragMetadata | null = null
    try {
      const files = payload.items.filter(i => i.kind === 'file')
      currentMeta = {
        source: 'drag',
        mimeTypes: payload.items.map(i => i.kind === 'file' ? 'Files' : 'text/plain'),
        fileCount: files.length,
        hasFiles: files.length > 0,
        hasText: payload.items.some(i => i.kind === 'text'),
        hasHtml: payload.items.some(i => i.kind === 'html'),
        hasImage: payload.items.some(i => i.kind === 'image')
      }
    } catch {
      // proceed without metadata
    }

    if (payload.command) {
      pluginHost.execute(payload.command, {
        metadata: currentMeta || {
          source: 'drag',
          mimeTypes: [],
          fileCount: 0,
          hasFiles: false,
          hasText: false,
          hasHtml: false,
          hasImage: false
        },
        items: payload.items,
        commandId: payload.command,
        toast: showToast,
        showForm: (cfg) => formDialog.show(cfg),
        log: {
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {}
        },
        storage: {
          get: () => undefined,
          set: () => {},
          delete: () => {},
          save: () => {}
        },
        companions: []
      })
    }

    collapseToBubble()
  })

  ipcMain.on(IPC.CLICK_EXECUTE, (_event, payload: ClickExecutePayload) => {
    console.log(`[${ts()}] [main] IPC CLICK_EXECUTE commandId=${payload.commandId}`)

    const data = getCurrentData()

    const files = data.filter(d => d.kind === 'file')
    const meta: DragMetadata = {
      source: 'clipboard',
      mimeTypes: data.map(d => d.kind === 'file' ? 'Files' : 'text/plain'),
      fileCount: files.length,
      hasFiles: files.length > 0,
      hasText: data.some(d => d.kind === 'text'),
      hasHtml: data.some(d => d.kind === 'html'),
      hasImage: data.some(d => d.kind === 'image')
    }

    pluginHost.execute(payload.commandId, {
      metadata: meta,
      items: data,
      commandId: payload.commandId,
      toast: showToast,
      showForm: (cfg) => formDialog.show(cfg),
      log: {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {}
      },
      storage: {
        get: () => undefined,
        set: () => {},
        delete: () => {},
        save: () => {}
      },
      companions: []
    })

    clearData()
    collapseToBubble()
  })

  ipcMain.on(IPC.BUBBLE_CONTEXT, (_event, { x, y }: { x: number; y: number }) => {
    console.log(`[${ts()}] [main] IPC BUBBLE_CONTEXT (${x},${y})`)
    expandContextMenu(x, y)
  })

  ipcMain.on(IPC.BLUR, () => {
    console.log(`[${ts()}] [main] IPC BLUR`)
    collapseToBubble()
  })

  ipcMain.on(IPC.SUBMENU_OPEN, () => {
    openSubmenu()
  })

  ipcMain.on(IPC.SUBMENU_CLOSE, () => {
    closeSubmenu()
  })

  ipcMain.on('asuka:settings-save', (_event, patch: Partial<AsukaConfig>) => {
    config.patch(patch)
  })

  ipcMain.on('asuka:settings-reload-plugins', () => {
    const bubbleWin = getBubbleWindow()
    if (bubbleWin) {
      bubbleWin.webContents.reload()
    }
  })

  ipcMain.on('form-submit', (event, values: Record<string, unknown>) => {
    formDialog.handleSubmit(event.sender.id, values)
  })
}
