import { Tray, Menu, app, nativeImage, shell, screen, dialog } from 'electron'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { config } from './config'
import { openSettings } from './settings-window'
import { formDialog } from './form-dialog'
import { pluginHost } from './plugin-host'
import { autoUpdater } from './auto-updater'
import { showToast } from './toast'
import { mainLogger } from './logger'

let tray: Tray | null = null
let baseIcon16: Electron.NativeImage
let badgedIcon16: Electron.NativeImage | null = null
let updateVersion = ''
let bubbleWindow: BrowserWindow | null = null

function getTrayIconPath(): string {
  return join(app.getAppPath(), 'resources', 'icon@16.png')
}

function createBadgedIcon(base: Electron.NativeImage): Electron.NativeImage {
  const size = 16
  const buf = Buffer.from(base.toBitmap())
  const cx = 12, cy = 12, r2 = 8
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy <= r2) {
        const i = (y * size + x) * 4
        buf[i] = 60
        buf[i + 1] = 60
        buf[i + 2] = 255
        buf[i + 3] = 255
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

function rebuildMenu(bubbleWin: BrowserWindow): void {
  if (!tray) return

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '设置...',
      click: () => {
        openSettings()
      }
    },
    {
      label: '重置悬浮球位置',
      click: () => {
        const { width, height } = screen.getPrimaryDisplay().workArea
        const cx = Math.round(width / 2 - 28)
        const cy = Math.round(height / 2 - 28)
        config.patch({ bubbleX: cx, bubbleY: cy })
        bubbleWin.setBounds({ x: cx, y: cy, width: 56, height: 56 })
      }
    },
    {
      label: updateVersion ? `安装更新 ${updateVersion}` : '检查更新',
      click: () => { void handleUpdateClick() }
    },
    { type: 'separator' },
    {
      label: '开发',
      submenu: [
        {
          label: '创建插件...',
          click: async () => {
            const result = await formDialog.show({
              title: '创建新插件',
              width: 440,
              fields: [
                { type: 'input', key: 'name', label: '插件名称', defaultValue: '', placeholder: '我的插件', required: true },
                { type: 'select', key: 'language', label: '语言', defaultValue: 'ts', options: [
                  { label: 'TypeScript', value: 'ts' },
                  { label: 'JavaScript', value: 'js' }
                ]}
              ]
            })
            if (!result) return
            const pluginName = String(result.name || '').trim()
            if (!pluginName) return

            const language: 'ts' | 'js' = String(result.language || 'ts') === 'js' ? 'js' : 'ts'
            const pluginId = pluginName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            const safeDir = pluginName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 60) || 'new-plugin'
            const pluginsDir = join(app.getPath('home'), '.asuka', 'plugins')
            const pluginDir = join(pluginsDir, safeDir)

            if (!existsSync(pluginsDir)) mkdirSync(pluginsDir, { recursive: true })
            if (existsSync(pluginDir)) return
            mkdirSync(pluginDir)

            if (language === 'ts') {
              const tsCode = `/// <reference types="asuka-plugin-types" />

const plugin: Asuka.IPlugin = {
  id: '${pluginId}',
  name: '${pluginName}',

  async onActivate() {},
  async onDeactivate() {},

  buildDragCommands(meta: Asuka.DragMetadata): Asuka.CommandDef[] { return [] },
  buildClipboardCommands(meta: Asuka.DragMetadata): Asuka.CommandDef[] { return [] },
  buildContextCommands(): Asuka.CommandDef[] { return [] }
}

export default plugin
`
              writeFileSync(join(pluginDir, 'index.ts'), tsCode, 'utf-8')
              writeFileSync(join(pluginDir, 'tsconfig.json'), JSON.stringify({
                compilerOptions: { target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true, moduleResolution: 'node' },
                include: ['index.ts']
              }, null, 2), 'utf-8')
            } else {
              const jsCode = `/// <reference types="asuka-plugin-types" />

/**
 * @type {Asuka.IPlugin}
 */
const plugin = {
  id: '${pluginId}',
  name: '${pluginName}',

  async onActivate() {},
  async onDeactivate() {},

  buildDragCommands(meta) { return [] },
  buildClipboardCommands(meta) { return [] },
  buildContextCommands() { return [] }
}

module.exports = plugin
`
              writeFileSync(join(pluginDir, 'index.js'), jsCode, 'utf-8')
            }

            const typesPath = join(app.getAppPath(), 'types').replace(/\\/g, '/')
            const pkgJson: Record<string, unknown> = {
              name: pluginId,
              version: '0.1.0',
              main: `./index.${language}`,
              devDependencies: { 'asuka-plugin-types': `file:${typesPath}` }
            }
            writeFileSync(join(pluginDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8')
            shell.openPath(pluginDir)
          }
        },
        {
          label: '重新加载',
          click: () => {
            pluginHost.scanUserPlugins()
            bubbleWin.webContents.reload()
          }
        },
        {
          label: '打开日志目录',
          click: () => {
            shell.openPath(join(app.getPath('home'), '.asuka', 'logs'))
          }
        },
        {
          label: '打开插件目录',
          click: () => {
            shell.openPath(join(app.getPath('home'), '.asuka', 'plugins'))
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '打开 DevTools',
      click: () => {
        bubbleWin.webContents.openDevTools({ mode: 'detach' })
      }
    },
    {
      label: '退出 Asuka',
      click: () => {
        app.quit()
      }
    }
  ]

  tray.setContextMenu(Menu.buildFromTemplate(template))
}

let updateInProgress = false

async function handleUpdateClick(): Promise<void> {
  if (updateInProgress) return

  if (updateVersion) {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Asuka 更新',
      message: `是否安装 Asuka ${updateVersion}？`,
      detail: `当前版本: v${app.getVersion()}\n安装完成后 Asuka 将自动重启。`,
      buttons: ['安装更新', '取消'],
      defaultId: 0,
      cancelId: 1
    })
    if (response !== 0) return
    updateInProgress = true
    try {
      await autoUpdater.downloadAndInstall((msg) => showToast(msg))
    } catch (e) {
      mainLogger.error('[Tray] update install failed:', e)
      showToast('更新失败，请稍后重试')
      updateInProgress = false
    }
    return
  }

  showToast('正在检查更新...')
  const info = await autoUpdater.checkForUpdates()
  if (info.available && info.latestVersion) {
    updateVersion = info.latestVersion
    if (tray && bubbleWindow) rebuildMenu(bubbleWindow)
    if (badgedIcon16) tray?.setImage(badgedIcon16)
    tray?.setToolTip(`Asuka - 新版本 ${info.latestVersion} 可用`)
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Asuka 更新',
      message: `新版本 ${info.latestVersion} 可用`,
      detail: `当前版本: v${info.currentVersion}\n是否立即安装？`,
      buttons: ['安装更新', '稍后'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) {
      updateInProgress = true
      try {
        await autoUpdater.downloadAndInstall((msg) => showToast(msg))
      } catch (e) {
        mainLogger.error('[Tray] update install failed:', e)
        showToast('更新失败，请稍后重试')
        updateInProgress = false
      }
    }
  } else {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Asuka',
      message: '已是最新版本',
      detail: `当前版本: v${info.currentVersion}`
    })
  }
}

export function setUpdateAvailable(version: string): void {
  updateVersion = version
  if (tray && bubbleWindow) rebuildMenu(bubbleWindow)
  if (badgedIcon16) tray?.setImage(badgedIcon16)
  tray?.setToolTip(`Asuka - 新版本 ${version} 可用`)
}

export function createTray(bubbleWin: BrowserWindow): Tray {
  const iconPath = getTrayIconPath()
  baseIcon16 = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  badgedIcon16 = createBadgedIcon(baseIcon16)

  tray = new Tray(baseIcon16)
  tray.setToolTip('Asuka')

  bubbleWindow = bubbleWin

  rebuildMenu(bubbleWin)

  tray.on('double-click', () => {
    bubbleWin.webContents.openDevTools({ mode: 'detach' })
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
