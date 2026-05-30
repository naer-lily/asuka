import { spawn, ChildProcess } from 'child_process'
import { createServer } from 'net'
import { request } from 'http'
import type { CompanionConfig, CompanionHandle } from '@shared/plugin-api'

interface InternalHandle extends CompanionHandle {
  child: ChildProcess
  ready: boolean
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('failed to get port')))
      }
    })
    server.on('error', reject)
  })
}

function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    function check(): void {
      const req = request(url, (res) => {
        if (res.statusCode === 200) {
          resolve()
        } else if (Date.now() < deadline) {
          setTimeout(check, 200)
        } else {
          reject(new Error(`health check timeout: ${url}`))
        }
      })
      req.on('error', () => {
        if (Date.now() < deadline) {
          setTimeout(check, 200)
        } else {
          reject(new Error(`health check timeout: ${url}`))
        }
      })
      req.end()
    }
    check()
  })
}

class CompanionManagerImpl {
  private handles: Map<string, InternalHandle[]> = new Map()

  async start(config: CompanionConfig): Promise<CompanionHandle> {
    if (config.type === 'http') {
      return this.startHttp(config)
    }
    return this.startJsonl(config)
  }

  private async startHttp(config: CompanionConfig): Promise<CompanionHandle> {
    const port = config.port || (await findFreePort())
    const cmdArgs = [...(config.args || [])]
    const portIdx = cmdArgs.indexOf('{port}')
    if (portIdx >= 0) {
      cmdArgs[portIdx] = String(port)
    } else {
      cmdArgs.push('--port', String(port))
    }

    const child = spawn(config.command, cmdArgs, {
      cwd: config.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const healthPath = config.healthPath || '/health'
    const url = `http://127.0.0.1:${port}${healthPath}`
    const timeout = config.startupTimeout || 10000

    try {
      await waitForHealth(url, timeout)
    } catch (err) {
      child.kill()
      throw err
    }

    const handle: InternalHandle = {
      pid: child.pid!,
      config: { ...config, port },
      url: `http://127.0.0.1:${port}`,
      child,
      ready: true,
      send(payload: unknown) {
        const r = request(`http://127.0.0.1:${port}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        r.write(JSON.stringify(payload))
        r.end()
      },
      onMessage() {
        // HTTP companions push via send callback; subscriber pattern optional
      },
      kill() {
        child.kill()
      }
    }

    this.trackHandle(config.pluginId, handle)
    return handle
  }

  private startJsonl(config: CompanionConfig): Promise<CompanionHandle> {
    return new Promise((resolve) => {
      const child = spawn(config.command, config.args || [], {
        cwd: config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      const listeners: Array<(payload: unknown) => void> = []

      const handle: InternalHandle = {
        pid: child.pid!,
        config: { ...config },
        child,
        ready: true,
        send(payload: unknown) {
          const line = JSON.stringify(payload) + '\n'
          child.stdin!.write(line)
        },
        onMessage(cb: (payload: unknown) => void) {
          listeners.push(cb)
        },
        kill() {
          child.kill()
        }
      }

      let buffer = ''
      child.stdout!.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8')
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const obj = JSON.parse(trimmed)
            for (const cb of listeners) {
              try {
                cb(obj)
              } catch {
                // ignore listener errors
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      })

      child.on('error', () => {
        handle.ready = false
      })

      child.on('exit', () => {
        handle.ready = false
      })

      this.trackHandle(config.pluginId, handle)
      resolve(handle)
    })
  }

  private trackHandle(pluginId: string, handle: InternalHandle): void {
    if (!this.handles.has(pluginId)) {
      this.handles.set(pluginId, [])
    }
    this.handles.get(pluginId)!.push(handle)
  }

  getHandlesForPlugin(pluginId: string): CompanionHandle[] {
    return (this.handles.get(pluginId) || []).filter(h => h.pid !== 0)
  }

  stopForPlugin(pluginId: string): void {
    const list = this.handles.get(pluginId)
    if (!list) return
    for (const h of list) {
      try {
        h.kill()
      } catch {
        // ignore kill errors
      }
    }
    this.handles.delete(pluginId)
  }
}

export const companionManager = new CompanionManagerImpl()
