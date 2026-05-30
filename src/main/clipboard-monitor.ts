import { clipboard, screen } from 'electron'
import { execFile } from 'child_process'
import { resolve, basename, extname } from 'path'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expandAtCursor } from './bubble-window'
import { ts } from '@shared/utils'
import type { DropPayload } from '@shared/ipc-types'

let intervalId: ReturnType<typeof setInterval> | null = null
let debounceId: ReturnType<typeof setTimeout> | null = null
let lastHash = ''
let parsing = false

let currentData: DropPayload[] = []

function hash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h.toString(16)
}

function checkClipboard(): void {
  const text = clipboard.readText() || ''
  const html = clipboard.readHTML() || ''
  const image = clipboard.readImage()
  const hasImage = !image.isEmpty()

  const fingerprint = `${text.length}:${html.length}:${hasImage}:${text.slice(0, 40)}`

  const h = hash(fingerprint)
  if (h === lastHash) return
  lastHash = h

  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [clipboard] change detected, hash=${h}`)

  if (debounceId) clearTimeout(debounceId)
  debounceId = setTimeout(() => {
    debounceId = null
    if (parsing) return
    parseAndExpand().catch(err => { console.error('[clipboard] parse error:', err) })
  }, 300)
}

async function getFileDrop(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile('powershell', [
      '-NoProfile', '-Command',
      'Get-Clipboard -Format FileDropList | ForEach-Object { $_ }'
    ], { timeout: 2000, encoding: 'utf-8' }, (err, stdout) => {
      if (err) {
        reject(err)
        return
      }
      const lines = (stdout || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      resolve(lines)
    })
  })
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

    try {
      const lines = await getFileDrop()
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
    } catch {
      // PowerShell may fail if no file drop on clipboard
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
    console.log(`[${ts()}] [clipboard] expanding at cursor (${pos.x},${pos.y})`)
    expandAtCursor(pos.x, pos.y)
  } finally {
    parsing = false
  }
}

export function start(): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [clipboard] monitoring started (poll 500ms, debounce 300ms)`)
  intervalId = setInterval(checkClipboard, 500)
}

export function stop(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
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
