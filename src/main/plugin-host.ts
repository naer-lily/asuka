import { readdirSync, existsSync, statSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { app } from 'electron'
import type { IPlugin, DragMetadata, CommandDef, ExecuteContext, CommandItem, PluginContext, DropPayload } from '@shared/plugin-api'
import { companionManager } from './companion-manager'
import { createPluginLogger } from './logger'
import { createPluginStorage } from './storage'
import { showToast } from './toast'
import { config } from './config'

const PLUGIN_DIR = join(app.getPath('home'), '.asuka', 'plugins')

let esbuildRegistered = false

function registerTsHook(): void {
  if (esbuildRegistered) return
  esbuildRegistered = true

  const Module = require('module')
  const originalLoad = Module._extensions['.js']

  Module._extensions['.ts'] = function (mod: any, filename: string) {
    const fs = require('fs')
    const path = require('path')
    const esbuild = require('esbuild')

    const source = fs.readFileSync(filename, 'utf-8')
    const result = esbuild.transformSync(source, {
      loader: 'ts',
      format: 'cjs',
      target: 'node18',
      sourcefile: filename
    })

    mod._compile(result.code, filename)
  }

  Module._extensions['.js'] = function (mod: any, filename: string) {
    const dir = resolve(filename, '..')
    const tsFile = join(dir, filename.replace(/\.js$/, '.ts'))
    if (existsSync(tsFile)) {
      Module._extensions['.ts'](mod, tsFile)
      return
    }
    originalLoad(mod, filename)
  }
}

class PluginHostImpl {
  private plugins: Map<string, IPlugin> = new Map()
  private lastDragMeta: DragMetadata | null = null
  private lastClipboardItems: DropPayload[] | null = null

  initialize(): void {
    registerTsHook()
    this.doScanUserPlugins()
  }

  scanUserPlugins(): void {
    this.doScanUserPlugins()
  }

  private doScanUserPlugins(): void {
    console.log('[plugin-host] scanning user plugins from', PLUGIN_DIR)
    if (!existsSync(PLUGIN_DIR)) return
    try {
      const entries = readdirSync(PLUGIN_DIR)
      console.log(`[plugin-host] found ${entries.length} entries in plugin dir`)
      for (const entry of entries) {
        const pluginDir = join(PLUGIN_DIR, entry)
        try {
          const st = statSync(pluginDir)
          if (!st.isDirectory()) continue

          const pkgPath = join(pluginDir, 'package.json')
          if (!existsSync(pkgPath)) {
            const defaultPkg = {
              name: entry,
              version: '0.1.0',
              main: './index.ts'
            }
            writeFileSync(pkgPath, JSON.stringify(defaultPkg, null, 2), 'utf-8')
          }

          const indexPath = join(pluginDir, 'index.ts')
          if (!existsSync(indexPath)) {
            const jsPath = join(pluginDir, 'index.js')
            if (existsSync(jsPath)) {
              this.loadFromPath(jsPath)
              continue
            }
            continue
          }

          this.loadFromPath(indexPath)
        } catch (err) {
          console.error(`[plugin-host] failed to load user plugin ${entry}:`, err)
        }
      }
    } catch (err) {
      console.error('[plugin-host] scanUserPlugins error:', err)
    }
  }

  loadFromPath(filePath: string): IPlugin {
    delete require.cache[require.resolve(filePath)]
    const mod = require(filePath)
    const plugin: IPlugin = mod.default || mod

    if (!plugin || !plugin.id) {
      throw new Error(`plugin at ${filePath} missing id`)
    }

    const key = plugin.id

    if (this.plugins.has(key)) {
      this.unload(key)
    }

    const pluginContext: PluginContext = {
      id: plugin.id,
      configDir: join(app.getPath('home'), '.asuka'),
      storageDir: join(app.getPath('home'), '.asuka', 'storage'),
      logDir: join(app.getPath('home'), '.asuka', 'logs'),
      pluginDir: PLUGIN_DIR,
      appVersion: app.getVersion()
    }

    plugin.onActivate(pluginContext).catch((err: unknown) => {
      console.error(`[plugin-host] activate error for ${plugin.id}:`, err)
    })

    this.plugins.set(key, plugin)

    return plugin
  }

  unload(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      plugin.onDeactivate().catch((err: unknown) => {
        console.error(`[plugin-host] deactivate error for ${pluginId}:`, err)
      })
      companionManager.stopForPlugin(pluginId)
    }
    this.plugins.delete(pluginId)
  }

  private isEnabled(pluginId: string): boolean {
    const enabled = config.get().enabledPlugins || []
    if (enabled.length === 0) return true
    return enabled.includes(pluginId)
  }

  setEnabled(pluginId: string, enabled: boolean): void {
    const current = config.get().enabledPlugins || []
    if (enabled && !current.includes(pluginId)) {
      config.patch({ enabledPlugins: [...current, pluginId] })
    } else if (!enabled && current.includes(pluginId)) {
      config.patch({ enabledPlugins: current.filter((id: string) => id !== pluginId) })
    }
  }

  private formatCommands(pluginKey: string, defs: CommandDef[]): CommandItem[] {
    return defs.map(d => ({
      id: `${pluginKey}:${d.id}`,
      pluginId: pluginKey,
      name: d.name,
      icon: d.icon,
      submenu: d.submenu ? this.formatCommands(pluginKey, d.submenu) : undefined
    }))
  }

  collectDragCommands(meta: DragMetadata): CommandItem[] {
    this.lastDragMeta = meta
    const result: CommandItem[] = []
    for (const [key, plugin] of this.plugins) {
      if (!this.isEnabled(key)) continue
      try {
        const defs = plugin.buildDragCommands(meta)
        if (defs.length > 0) {
          result.push(...this.formatCommands(key, defs))
        }
      } catch (err) {
        console.error(`[plugin-host] buildDragCommands error for ${key}:`, err)
      }
    }
    return result
  }

  collectClipboardCommands(items: DropPayload[]): CommandItem[] {
    this.lastClipboardItems = items
    const result: CommandItem[] = []
    const hasFiles = items.some(i => i.kind === 'file')
    const hasText = items.some(i => i.kind === 'text')
    const hasHtml = items.some(i => i.kind === 'html')
    const hasImage = items.some(i => i.kind === 'image')
    console.log(`[plugin-host] collectClipboardCommands items: files=${hasFiles} text=${hasText} html=${hasHtml} image=${hasImage} plugins=${this.plugins.size}`)
    for (const [key, plugin] of this.plugins) {
      if (!this.isEnabled(key)) continue
      try {
        const defs = plugin.buildClipboardCommands(items)
        console.log(`[plugin-host]   plugin=${key} returned ${defs.length} commands`)
        if (defs.length > 0) {
          result.push(...this.formatCommands(key, defs))
        }
      } catch (err) {
        console.error(`[plugin-host] buildClipboardCommands error for ${key}:`, err)
      }
    }
    console.log(`[plugin-host] collectClipboardCommands total=${result.length}`)
    return result
  }

  collectContextCommands(items: DropPayload[]): CommandItem[] {
    const result: CommandItem[] = []
    for (const [key, plugin] of this.plugins) {
      if (!this.isEnabled(key)) continue
      try {
        const defs = plugin.buildContextCommands(items)
        if (defs.length > 0) {
          result.push(...this.formatCommands(key, defs))
        }
      } catch (err) {
        console.error(`[plugin-host] buildContextCommands error for ${key}:`, err)
      }
    }
    return result
  }

  findCommand(commandId: string): { plugin: IPlugin; execute: CommandDef['execute'] } | null {
    const idx = commandId.indexOf(':')
    if (idx === -1) return null
    const pluginKey = commandId.substring(0, idx)
    const cmdId = commandId.substring(idx + 1)

    const plugin = this.plugins.get(pluginKey)
    if (!plugin) return null

    const defs: CommandDef[] = []
    if (this.lastDragMeta) {
      try { defs.push(...plugin.buildDragCommands(this.lastDragMeta)) } catch { }
    }
    if (this.lastClipboardItems) {
      try { defs.push(...plugin.buildClipboardCommands(this.lastClipboardItems)) } catch { }
      try { defs.push(...plugin.buildContextCommands(this.lastClipboardItems)) } catch { }
    } else {
      try { defs.push(...plugin.buildContextCommands([])) } catch { }
    }

    const found = findDefInList(defs, cmdId)
    if (!found) return null
    return { plugin, execute: found.execute }
  }

  execute(commandId: string, ctx: ExecuteContext): void {
    const found = this.findCommand(commandId)
    if (!found) {
      console.error(`[plugin-host] command not found: ${commandId}`)
      return
    }

    const pluginKey = commandId.substring(0, commandId.indexOf(':'))
    const plugin = this.plugins.get(pluginKey)
    const companions = companionManager.getHandlesForPlugin(pluginKey)

    const fullCtx: ExecuteContext = {
      ...ctx,
      log: createPluginLogger(plugin?.id || 'unknown'),
      companions
    }

    try {
      const result = found.execute(fullCtx)
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          console.error(`[plugin-host] execute error for ${commandId}:`, err)
          showToast('执行失败')
        })
      }
    } catch (err) {
      console.error(`[plugin-host] execute error for ${commandId}:`, err)
      showToast('执行失败')
    }
  }

  getPluginIds(): string[] {
    return Array.from(this.plugins.keys())
  }

  getPluginInfo(pluginId: string): { id: string; name: string; icon?: string } | null {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return null
    return {
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon
    }
  }

  getAllPluginInfo(): Array<{ id: string; name: string; icon?: string }> {
    return Array.from(this.plugins.keys())
      .map(key => this.getPluginInfo(key))
      .filter((p): p is NonNullable<typeof p> => p !== null)
  }
}

export const pluginHost = new PluginHostImpl()

function findDefInList(defs: CommandDef[], targetId: string): CommandDef | null {
  for (const d of defs) {
    if (d.id === targetId) return d
    if (d.submenu) {
      const found = findDefInList(d.submenu, targetId)
      if (found) return found
    }
  }
  return null
}
