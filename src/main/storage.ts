import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { PluginStorage } from '@shared/plugin-api'

const STORAGE_DIR = join(app.getPath('home'), '.asuka', 'storage')

function filePathFor(pluginId: string): string {
  return join(STORAGE_DIR, `${pluginId}.json`)
}

class PluginStorageImpl implements PluginStorage {
  private pluginId: string
  private data: Record<string, unknown> = {}
  private dirty = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(pluginId: string) {
    this.pluginId = pluginId
    this.load()
  }

  private load(): void {
    const fp = filePathFor(this.pluginId)
    try {
      if (!existsSync(STORAGE_DIR)) {
        mkdirSync(STORAGE_DIR, { recursive: true })
      }
      if (existsSync(fp)) {
        this.data = JSON.parse(readFileSync(fp, 'utf-8'))
      }
    } catch {
      this.data = {}
    }
  }

  private flushNow(): void {
    if (!this.dirty) return
    const fp = filePathFor(this.pluginId)
    try {
      if (!existsSync(STORAGE_DIR)) {
        mkdirSync(STORAGE_DIR, { recursive: true })
      }
      writeFileSync(fp, JSON.stringify(this.data, null, 2), 'utf-8')
      this.dirty = false
    } catch {
      // ignore write errors
    }
  }

  private scheduleFlush(): void {
    this.dirty = true
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flushNow()
    }, 500)
  }

  save(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.flushNow()
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  set<T = unknown>(key: string, value: T): void {
    this.data[key] = value
    this.scheduleFlush()
  }

  delete(key: string): void {
    delete this.data[key]
    this.scheduleFlush()
  }
}

export function createPluginStorage(pluginId: string): PluginStorage {
  return new PluginStorageImpl(pluginId)
}
