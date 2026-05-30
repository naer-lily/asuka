import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import type { ExpandMenuPayload } from '@shared/ipc-types'
import { ts, computeMenuHeight, clampMenuBounds } from '@shared/utils'

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

const MOCK_COMMANDS = [
  { id: 'compress', pluginId: 'builtin', name: '压缩为 ZIP', icon: '🗜️' },
  { id: 'convert', pluginId: 'builtin', name: '转换为 WebP', icon: '🖼️' },
  { id: 'upload', pluginId: 'builtin', name: '上传到图床', icon: '🔗' },
  { id: 'translate', pluginId: 'builtin', name: '翻译为中文', icon: '🌐' },
  { id: 'search', pluginId: 'builtin', name: '搜索', icon: '🔍' },
  {
    id: 'save-as',
    pluginId: 'builtin',
    name: '另存为...',
    icon: '📦',
    submenu: [
      { id: 'save-desktop', pluginId: 'builtin', name: '桌面', icon: '🖥️' },
      { id: 'save-docs', pluginId: 'builtin', name: '文档', icon: '📁' },
      { id: 'save-original', pluginId: 'builtin', name: '原目录保留原名', icon: '📄' },
      { id: 'save-rename', pluginId: 'builtin', name: '重命名...', icon: '✏️' }
    ]
  }
]

const MOCK_CONTEXT_COMMANDS = [
  { id: 'open-workspace', pluginId: 'builtin', name: '打开临时工作区', icon: '📋' },
  { id: 'clipboard-history', pluginId: 'builtin', name: '剪贴板历史', icon: '📊' },
  { id: 'settings', pluginId: 'builtin', name: '设置', icon: '🔧' },
  { id: 'reload-plugins', pluginId: 'builtin', name: '重载插件', icon: '🔄' },
  { id: 'quit', pluginId: 'builtin', name: '退出', icon: '❌' }
]

function sendExpand(source: 'drag' | 'clipboard' | 'context'): void {
  const map = {
    drag: MOCK_COMMANDS,
    clipboard: MOCK_COMMANDS,
    context: MOCK_CONTEXT_COMMANDS
  }
  const payload: ExpandMenuPayload = {
    commands: map[source],
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
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workArea

  bubbleHomeX = screenW - BUBBLE_SIZE - 24
  bubbleHomeY = Math.round((screenH - BUBBLE_SIZE) / 2)

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

  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] bubble window created at (${bubbleHomeX},${bubbleHomeY}) size=${BUBBLE_SIZE}`)

  return bubbleWin
}

export function getBubbleWindow(): BrowserWindow | null {
  return bubbleWin
}

export function setBubblePosition(x: number, y: number): void {
  bubbleHomeX = x
  bubbleHomeY = y
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

  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] submenu open, onLeft=${submenuOnLeft}, fitsRight=${fitsOnRight}`)
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

  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] submenu close`)

  sendSubmenuState(false, false)
}

export function expandToMenu(): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] expandToMenu() called, expanded=${expanded}`)

  if (!bubbleWin || expanded) return
  expanded = true
  submenuOpen = false
  submenuOnLeft = false

  const bounds = bubbleWin.getBounds()
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workArea
  const menuH = computeMenuHeight(MOCK_COMMANDS.length)

  const { x, y } = clampMenuBounds(
    bounds.x,
    Math.max(8, bounds.y - 40),
    MENU_W + MENU_PAD * 2,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x, y, width: MENU_W + MENU_PAD * 2, height: menuH })

  sendExpand('drag')
}

export function expandAtCursor(cursorX: number, cursorY: number): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] expandAtCursor(${cursorX},${cursorY}) expanded=${expanded}`)

  if (!bubbleWin || expanded) return
  expanded = true
  submenuOpen = false
  submenuOnLeft = false

  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY })
  const { width: screenW, height: screenH } = display.workArea
  const menuH = computeMenuHeight(MOCK_COMMANDS.length)

  const { x, y } = clampMenuBounds(
    cursorX - (MENU_W + MENU_PAD * 2) / 2,
    cursorY - menuH / 3,
    MENU_W + MENU_PAD * 2,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x, y, width: MENU_W + MENU_PAD * 2, height: menuH })

  sendExpand('clipboard')
}

export function expandContextMenu(cursorX: number, cursorY: number): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] expandContextMenu(${cursorX},${cursorY}) expanded=${expanded}`)

  if (!bubbleWin || expanded) return
  expanded = true
  submenuOpen = false
  submenuOnLeft = false

  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY })
  const { width: screenW, height: screenH } = display.workArea
  const menuH = computeMenuHeight(MOCK_CONTEXT_COMMANDS.length)

  const { x, y } = clampMenuBounds(
    cursorX - (MENU_W + MENU_PAD * 2) / 2,
    cursorY - menuH / 3,
    MENU_W + MENU_PAD * 2,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x, y, width: MENU_W + MENU_PAD * 2, height: menuH })

  sendExpand('context')
}

export function collapseToBubble(): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] collapseToBubble() called, expanded=${expanded}`)

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
