import log from 'electron-log'
import { app } from 'electron'
import { mkdirSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'
import type { PluginLogger } from '@shared/plugin-api'

const LOG_DIR = join(app.getPath('home'), '.asuka', 'logs')

log.transports.file.resolvePathFn = (variables: { fileName?: string }) => {
  return join(LOG_DIR, variables.fileName || 'main.log')
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatTs(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`
}

export function initLogger(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
  log.initialize()
  log.transports.file.level = 'info'
  log.transports.console.level = 'info'
}

export function createPluginLogger(pluginId: string): PluginLogger {
  const filePath = join(LOG_DIR, `${pluginId}.log`)
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }

  function writeLine(level: string, message: string, ...args: unknown[]): void {
    const ts = formatTs()
    const extra = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : ''
    const line = `[${ts}] [${level}] ${message}${extra}\n`
    try {
      appendFileSync(filePath, line, 'utf-8')
    } catch {
      // ignore write errors
    }
  }

  return {
    error(message: string, ...args: unknown[]) {
      writeLine('ERROR', message, ...args)
      log.error(`[${pluginId}] ${message}`, ...args)
    },
    warn(message: string, ...args: unknown[]) {
      writeLine('WARN', message, ...args)
      log.warn(`[${pluginId}] ${message}`, ...args)
    },
    info(message: string, ...args: unknown[]) {
      writeLine('INFO', message, ...args)
      log.info(`[${pluginId}] ${message}`, ...args)
    },
    debug(message: string, ...args: unknown[]) {
      writeLine('DEBUG', message, ...args)
      log.debug(`[${pluginId}] ${message}`, ...args)
    }
  }
}

export { log as mainLogger }
