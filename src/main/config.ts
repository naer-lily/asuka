import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

export interface AsukaConfig {
  theme: 'light' | 'dark'
  bubbleX: number
  bubbleY: number
  launchAtStartup: boolean
  enabledPlugins: string[]
  lastUpdateCheck?: number
  skipVersion?: string
}

const DEFAULT_CONFIG: AsukaConfig = {
  theme: 'dark',
  bubbleX: 0,
  bubbleY: 0,
  launchAtStartup: false,
  enabledPlugins: []
}

class ConfigManagerImpl {
  private path: string
  private data: AsukaConfig = DEFAULT_CONFIG
  private loaded = false

  constructor() {
    this.path = join(app.getPath('home'), '.asuka', 'config.json')
  }

  private ensureDir(): void {
    const dir = dirname(this.path)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  load(): AsukaConfig {
    try {
      this.ensureDir()
      if (existsSync(this.path)) {
        const raw = readFileSync(this.path, 'utf-8')
        this.data = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      }
    } catch {
      this.data = { ...DEFAULT_CONFIG }
    }
    this.loaded = true
    app.setLoginItemSettings({ openAtLogin: this.data.launchAtStartup })
    return this.data
  }

  get(): AsukaConfig {
    return { ...this.data }
  }

  patch(partial: Partial<AsukaConfig>): void {
    this.data = { ...this.data, ...partial }
    this.save()
    if ('launchAtStartup' in partial) {
      app.setLoginItemSettings({ openAtLogin: this.data.launchAtStartup })
    }
  }

  save(): void {
    try {
      this.ensureDir()
      writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[config] save error:', err)
    }
  }
}

export const config = new ConfigManagerImpl()
