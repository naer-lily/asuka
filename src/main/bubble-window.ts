import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import type { ExpandMenuPayload } from '@shared/ipc-types'
import { ts, computeMenuHeight, clampMenuBounds } from '@shared/utils'

const BUBBLE_SIZE = 56
const MENU_W = 240

let bubbleWin: BrowserWindow | null = null
let expanded = false
let timeoutId: ReturnType<typeof setTimeout> | null = null
let bubbleHomeX = 0
let bubbleHomeY = 0

const MOCK_COMMANDS = [
  { id: 'compress', pluginId: 'builtin', name: '压缩为 ZIP', icon: '🗜️' },
  { id: 'convert', pluginId: 'builtin', name: '转换为 WebP', icon: '🖼️' },
  { id: 'upload', pluginId: 'builtin', name: '上传到图床', icon: '🔗' },
  { id: 'translate', pluginId: 'builtin', name: '翻译为中文', icon: '🌐' },
  { id: 'search', pluginId: 'builtin', name: '搜索', icon: '🔍' }
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

export function expandToMenu(): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] expandToMenu() called, expanded=${expanded}`)

  if (!bubbleWin || expanded) return
  expanded = true

  const bounds = bubbleWin.getBounds()
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workArea
  const menuH = computeMenuHeight(MOCK_COMMANDS.length)

  const { x, y } = clampMenuBounds(
    bounds.x,
    Math.max(8, bounds.y - 40),
    MENU_W,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x, y, width: MENU_W, height: menuH })

  sendExpand('drag')
}

export function expandAtCursor(cursorX: number, cursorY: number): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] expandAtCursor(${cursorX},${cursorY}) expanded=${expanded}`)

  if (!bubbleWin || expanded) return
  expanded = true

  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY })
  const { width: screenW, height: screenH } = display.workArea
  const menuH = computeMenuHeight(MOCK_COMMANDS.length)

  const { x, y } = clampMenuBounds(
    cursorX - MENU_W / 2,
    cursorY - menuH / 3,
    MENU_W,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x, y, width: MENU_W, height: menuH })

  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] clipboard idle timeout, collapsing`)
    collapseToBubble()
  }, 10000)

  sendExpand('clipboard')
}

export function expandContextMenu(cursorX: number, cursorY: number): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] expandContextMenu(${cursorX},${cursorY}) expanded=${expanded}`)

  if (!bubbleWin || expanded) return
  expanded = true

  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY })
  const { width: screenW, height: screenH } = display.workArea
  const menuH = computeMenuHeight(MOCK_CONTEXT_COMMANDS.length)

  const { x, y } = clampMenuBounds(
    cursorX - MENU_W / 2,
    cursorY - menuH / 3,
    MENU_W,
    menuH,
    screenW,
    screenH
  )

  bubbleWin.setBounds({ x, y, width: MENU_W, height: menuH })

  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [main] context menu idle timeout, collapsing`)
    collapseToBubble()
  }, 10000)

  sendExpand('context')
}

export function collapseToBubble(): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [main] collapseToBubble() called, expanded=${expanded}`)

  if (!bubbleWin || !expanded) return
  expanded = false

  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  bubbleWin.setBounds({
    x: bubbleHomeX,
    y: bubbleHomeY,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE
  })

  sendCollapse()
}
