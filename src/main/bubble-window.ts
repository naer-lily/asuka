import { BrowserWindow, screen, nativeImage, app } from 'electron'
import { join } from 'path'
import type { ExpandMenuPayload, DragMetadata, CommandItem, DropPayload } from '@shared/ipc-types'
import { ts, computeMenuHeight, clampMenuBounds } from '@shared/utils'
import { pluginHost } from './plugin-host'
import { getCurrentData } from './clipboard-monitor'
import { config } from './config'

const BUBBLE_SIZE = 56
const MENU_W = 240
const SUBMENU_W = 176
const SUBMENU_GAP = 8
const MENU_PAD = 8

let bubbleWin: BrowserWindow | null = null
let expanded = false
let submenuOpen = false
let submenuOnLeft = false
let bubbleHomeX = 0
let bubbleHomeY = 0

const NO_MATCH_ITEM: CommandItem = {
  id: '__no_match__',
  pluginId: 'builtin',
  name: '没有匹配命令',
  icon: '🚫'
}

function sendExpand(source: 'drag' | 'clipboard' | 'context', commands: CommandItem[]): void {
  const payload: ExpandMenuPayload = {
    commands,
    source
  }
  bubbleWin!.webContents.send('asuka:expand-menu', payload)
}

function sendCollapse(): void {
  bubbleWin!.webContents.send('asuka:collapse')
}

function sendSubmenuState(active: boolean, onLeft: boolean): void {
  bubbleWin!.webContents.send('asuka:submenu-state', { active, onLeft })
}

export function createBubbleWindow(): BrowserWindow {
  const cfg = config.get()
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workArea

  if (cfg.bubbleX && cfg.bubbleY) {
    bubbleHomeX = cfg.bubbleX
    bubbleHomeY = cfg.bubbleY
  } else {
    bubbleHomeX = screenW - BUBBLE_SIZE - 24
    bubbleHomeY = Math.round((screenH - BUBBLE_SIZE) / 2)
  }

  bubbleWin = new BrowserWindow({
    x: bubbleHomeX,
    y: bubbleHomeY,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  bubbleWin.on('closed', () => {
    bubbleWin = null
  })

  const iconPath = join(app.getAppPath(), 'resources', 'icon@128.png')
  const iconDataUrl = nativeImage.createFromPath(iconPath).toDataURL()
  bubbleWin.webContents.on('dom-ready', () => {
    bubbleWin!.webContents.send('asuka:bubble-icon', iconDataUrl)
  })

  console.log(`[${ts()}] [main] bubble window created at (${bubbleHomeX},${bubbleHomeY}) size=${BUBBLE_SIZE}`)

  return bubbleWin
}

export function getBubbleWindow(): BrowserWindow | null {
  return bubbleWin
}

export function setBubblePosition(x: number, y: number): void {
  bubbleHomeX = x
  bubbleHomeY = y
  config.patch({ bubbleX: x, bubbleY: y })
}

export function isExpanded(): boolean {
  return expanded
}

export function openSubmenu(): void {
  if (!bubbleWin || !expanded) return

  const bounds = bubbleWin.getBounds()
  const { width: screenW } = screen.getPrimaryDisplay().workArea

  const fullW = MENU_W + SUBMENU_W + SUBMENU_GAP
  const parentMenuLeft = bounds.x + MENU_PAD

  const fitsOnRight = parentMenuLeft + fullW + MENU_PAD <= screenW

  if (fitsOnRight) {
    submenuOnLeft = false
    bubbleWin.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: fullW + MENU_PAD * 2,
      height: bounds.height
    })
  } else {
    submenuOnLeft = true
    const newX = bounds.x - SUBMENU_W - SUBMENU_GAP
    bubbleWin.setBounds({
      x: Math.max(0, newX),
      y: bounds.y,
      width: fullW + MENU_PAD * 2,
      height: bounds.height
    })
  }

  submenuOpen = true
  sendSubmenuState(true, submenuOnLeft)

  console.log(`[${ts()}] [main] submenu open, onLeft=${submenuOnLeft}`)
}

export function closeSubmenu(): void {
  if (!bubbleWin || !expanded || !submenuOpen) return

  const bounds = bubbleWin.getBounds()
  const wasOnLeft = submenuOnLeft
  submenuOpen = false
  submenuOnLeft = false

  bubbleWin.setBounds({
    x: wasOnLeft ? bounds.x + SUBMENU_W + SUBMENU_GAP : bounds.x,
    y: bounds.y,
    width: MENU_W + MENU_PAD * 2,
    height: bounds.height
  })

  sendSubmenuState(false, false)
}

export function expandToMenu(meta: DragMetadata): void {
  if (!bubbleWin || expanded) return

  const commands = pluginHost.collectDragCommands(meta)

  expanded = true
  submenuOpen = false
  submenuOnLeft = false

  const displayCommands = commands.length > 0 ? commands : [NO_MATCH_ITEM]
  const menuH = computeMenuHeight(displayCommands.length)

  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width: screenW, height: screenH } = display.workArea

  const clamped = clampMenuBounds(
    cursor.x - (MENU_W + MENU_PAD * 2) / 2,
    cursor.y - menuH / 3,
    MENU_W + MENU_PAD * 2,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x: clamped.x, y: clamped.y, width: MENU_W + MENU_PAD * 2, height: menuH })

  sendExpand('drag', displayCommands)
}

export function expandAtCursor(items: DropPayload[]): boolean {
  if (!bubbleWin) {
    console.log(`[${ts()}] [main] expandAtCursor: bubbleWin null`)
    return false
  }
  if (expanded) {
    console.log(`[${ts()}] [main] expandAtCursor: already expanded, skipping`)
    return false
  }

  const commands = pluginHost.collectClipboardCommands(items)

  if (commands.length === 0) return false

  expanded = true
  submenuOpen = false
  submenuOnLeft = false

  const display = screen.getDisplayNearestPoint({ x: 0, y: 0 })
  const cursor = screen.getCursorScreenPoint()
  const { width: screenW, height: screenH } = display.workArea
  const menuH = computeMenuHeight(commands.length)

  const clamped = clampMenuBounds(
    cursor.x - (MENU_W + MENU_PAD * 2) / 2,
    cursor.y - menuH / 3,
    MENU_W + MENU_PAD * 2,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x: clamped.x, y: clamped.y, width: MENU_W + MENU_PAD * 2, height: menuH })

  sendExpand('clipboard', commands)
  return true
}

export function expandContextMenu(cursorX: number, cursorY: number): void {
  if (!bubbleWin || expanded) return

  const items = getCurrentData()
  const commands = pluginHost.collectContextCommands(items)

  expanded = true
  submenuOpen = false
  submenuOnLeft = false

  const displayCommands = commands.length > 0 ? commands : [NO_MATCH_ITEM]
  const menuH = computeMenuHeight(displayCommands.length)

  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY })
  const { width: screenW, height: screenH } = display.workArea

  const clamped = clampMenuBounds(
    cursorX - (MENU_W + MENU_PAD * 2) / 2,
    cursorY - menuH / 3,
    MENU_W + MENU_PAD * 2,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x: clamped.x, y: clamped.y, width: MENU_W + MENU_PAD * 2, height: menuH })

  sendExpand('context', displayCommands)
}

export function collapseToBubble(): void {
  if (!bubbleWin || !expanded) return
  expanded = false
  submenuOpen = false
  submenuOnLeft = false

  bubbleWin.setBounds({
    x: bubbleHomeX,
    y: bubbleHomeY,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE
  })

  sendCollapse()
}
