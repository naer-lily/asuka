import { clipboard, screen } from 'electron'
import { resolve, basename, extname } from 'path'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expandAtCursor } from './bubble-window'
import { ts } from '@shared/utils'
import type { DropPayload } from '@shared/ipc-types'

let debounceId: ReturnType<typeof setTimeout> | null = null
let parsing = false

let currentData: DropPayload[] = []

let nativeClipboard: { start: (cb: () => void) => void; stop: () => void; getFilePaths: () => string[] } | null = null
try {
  nativeClipboard = require('../../native/build/Release/clipboard_native.node')
} catch (e) {
  console.error('[clipboard] native addon failed to load, clipboard monitoring disabled:', (e as Error).message)
}

function getFileDrop(): string[] {
  if (nativeClipboard) {
    return nativeClipboard.getFilePaths()
  }
  return []
}

async function parseAndExpand(): Promise<void> {
  parsing = true
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [clipboard] parseAndExpand() start`)

  try {
    const items: DropPayload[] = []

    const text = clipboard.readText()
    if (text) {
      items.push({ kind: 'text', content: text })
    }

    const lines = getFileDrop()
    for (const p of lines) {
      const full = resolve(p)
      items.push({
        kind: 'file',
        path: full,
        name: basename(full),
        ext: extname(full),
        size: 0,
        mimeType: undefined
      })
    }

    const html = clipboard.readHTML()
    if (html && html.length > 10) {
      items.push({ kind: 'html', content: html })
    }

    const img = clipboard.readImage()
    if (!img.isEmpty()) {
      const png = img.toPNG()
      const tmpPath = join(tmpdir(), `asuka-clip-${Date.now()}.png`)
      writeFileSync(tmpPath, png)
      const size = img.getSize()
      items.push({
        kind: 'image',
        path: tmpPath,
        width: size.width,
        height: size.height
      })
    }

    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [clipboard] parsed ${items.length} items:`, items.map(i => i.kind))

    if (items.length === 0) return

    currentData = items

    const pos = screen.getCursorScreenPoint()
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [clipboard] expanding at cursor (${pos.x},${pos.y}) with ${items.length} items`)
    const shown = expandAtCursor(items)
    if (!shown) {
      // eslint-disable-next-line no-console
      console.log(`[${ts()}] [clipboard] no matching commands, skipping`)
      clearData()
    }
  } finally {
    parsing = false
  }
}

function onClipboardChange(): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [clipboard] change detected (native listener)`)

  if (debounceId) clearTimeout(debounceId)
  debounceId = setTimeout(() => {
    debounceId = null
    if (parsing) return
    parseAndExpand().catch(err => { console.error('[clipboard] parse error:', err) })
  }, 50)
}

export function start(): void {
  if (nativeClipboard) {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [clipboard] monitoring started (native AddClipboardFormatListener, debounce 50ms)`)
    nativeClipboard.start(onClipboardChange)
  } else {
    console.warn('[clipboard] native addon not available, clipboard monitoring disabled')
  }
}

export function stop(): void {
  if (nativeClipboard) {
    nativeClipboard.stop()
  }
  if (debounceId) {
    clearTimeout(debounceId)
    debounceId = null
  }
}

export function getCurrentData(): DropPayload[] {
  return currentData
}

export function clearData(): void {
  currentData = []
}
