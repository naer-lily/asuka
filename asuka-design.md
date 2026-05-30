# Asuka — 设计计划

## 一、一句话

**桌面常驻一个悬浮球。用户拖文件到球上 → 球自动展开为命令菜单 → 拖到菜单项松手触发插件命令。复制文件/文本后球也会自动在鼠标旁展开菜单，点击菜单项执行；失焦即收拢。**

不需要全局鼠标钩子。不需要搜索栏。不需要 WebView。

---

## 二、交互剧本

### 场景一：拖放文件到悬浮球

```
1. 用户在文件管理器选中 3 张 PNG，按住鼠标开始拖拽
2. 用户将文件拖到桌面右侧的悬浮球上
3. 悬浮球检测到 dragenter → 自动展开为命令菜单:
     🗜️  压缩为 ZIP
     🖼️  转换为 WebP
     🔗  上传到图床
     (分隔线)
     📦  另存为...  ▶
4. 用户拖着文件挪到"转换为 WebP"上松手
5. 菜单收拢回小球，图片处理插件在后台转换
6. 屏幕底部 toast:"已转换 3 张图片为 WebP"
```

### 场景二：拖放文本到球

```
1. 用户在浏览器中选中一段文字，按住鼠标往外拖
2. 拖到悬浮球上 → 球展开:
     🌐 翻译为中文
     🔍 搜索
     📝 保存为笔记
3. 用户拖到"翻译为中文"上松手
4. toast:"今天天气真不错 —— Today is a nice day"
```

### 场景三：复制文件/文本 → 球自动在鼠标旁展开

```
1. 用户在文件管理器选中 3 张 PNG，Ctrl+C 复制
2. Asuka 检测到剪贴板变更 → 球在鼠标旁展开为菜单:
     🗜️  压缩为 ZIP
     🖼️  转换为 WebP
     🔗  上传到图床
3. 用户点击"转换为 WebP"
4. 菜单收拢，插件从剪贴板取文件路径 → 转换 → toast
```

```
1. 用户复制一段文字，菜单在鼠标旁展开:
     🌐 翻译
     🔍 搜索
     📝 保存为笔记
2. 用户点"翻译" → 取剪贴板文本 → 翻译 → toast
3. 用户改变主意点了其他地方 → 菜单失焦 → 收拢
```

### 场景四：子菜单

```
1. 用户拖文件到"另存为..."项上（不松手）
2. 子菜单展开:
     📦 原目录保留原名
     📦 桌面
     📦 文档
     重命名...
3. 拖到"桌面"上松手 → 文件复制到桌面
```

### 场景五：右键悬浮球

```
1. 用户右键悬浮球
2. 弹出右键菜单:
     📋 打开临时工作区         ← 插件注册的
     📊 剪贴板历史              ← 插件注册的
     (分隔线)
     🔧 设置                   ← Asuka 自带
     🔄 重载插件               ← Asuka 自带
     ❌ 退出                   ← Asuka 自带
```

### 场景六：托盘

```
1. 用户右键系统托盘的 Asuka 图标
2. 菜单:
     🔧 设置
     🔄 重载插件
     ❌ 退出
```

---

## 三、不在范围内

- 全局鼠标钩子（electron-dragfile-plugin）
- 搜索栏、打字输入
- WebView / 内嵌网页
- 键盘导航
- 面板展开 / 带内容的容器窗口
- 自动激活（检测前台应用）

屏幕上的东西只有三个:
- **悬浮球**（常驻，收拢态 56×56 圆形 / 展开态 240×N 菜单）
- **设置窗口**（按需打开）
- **插件自己的窗口**（Asuka 不管）

---

## 四、架构

```
Main Process:
  ├── 悬浮球窗口 (BrowserWindow)
  │      收拢态: 56×56 圆形, transparent:true, focusable:false
  │      展开态: 240×320 菜单面板, 同一窗口 resize
  │      拖放检测: 窗口自身 dragenter → 展开 (无需外部插件)
  │      剪贴板检测: clipboard 变更 → 展开 (focusable:true)
  │      drop 到菜单项 → 构造 DropPayload → 调插件 execute()
  │      blur → 收拢
  │
  ├── 剪贴板监控 (轮询 500ms, 防抖 300ms)
  │
  ├── 插件主机
  │      加载/卸载/重载/扫描
  │      getDropCommands() → 构建菜单
  │      getBubbleContextCommands() → 构建右键菜单
  │      构造 ExecuteContext → execute()
  │
  ├── 设置窗口 (独立 BrowserWindow)
  │
  ├── 系统托盘
  │
  └── Toast
```

**Renderer 不是状态机。** Renderer 只做:
1. 渲染悬浮球/菜单 DOM
2. 处理 dragenter / dragover / dragleave / drop 事件并上报 main
3. 渲染设置页面

所有逻辑判断在 main process。

---

## 五、悬浮球窗口

一个窗口，两种形态:

| 状态 | 尺寸 | 触发 | 行为 |
|------|------|------|------|
| **收拢** | 56×56 圆形 | 默认 / 失焦 / 命令执行完 | 显示图标，等待拖放或右键 |
| **展开** | 240×320 菜单 | dragenter / 剪贴板变更 | 显示命令菜单，接收 drop/click |

### 窗口属性

```typescript
const bubbleWindow = new BrowserWindow({
  width: 56,
  height: 56,
  frame: false,
  transparent: true,         // 圆形视觉 + 阴影
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  show: false,
  focusable: false,          // 默认不抢焦点
  // 注意: 不调 setIgnoreMouseEvents!
  // 原因: WS_EX_TRANSPARENT 会阻止 OLE hit-test
  // transparent:true (WS_EX_LAYERED) 本身不阻止 OLE
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
})
```

### 两个触发路径

```
拖放路径 (无需任何插件):
  OLE dragenter on 悬浮球
    → 球 expand 为菜单
    → 菜单项上有 dragenter/dragleave (高亮反馈)
    → 用户 drop 到某菜单项
    → 从 dataTransfer 构造 DropPayload[]
    → 调 command.execute(ctx)
    → 球 collapse

剪贴板路径:
  剪贴板内容变更 (防抖 300ms)
    → 球 expand 到鼠标附近 (focusable:true)
    → 用户 click 某菜单项
    → 从剪贴板构造 DropPayload[]
    → 调 command.execute(ctx)
    → 球 collapse

  菜单失焦 (blur) → collapse (未执行)
```

### 展开定位

**拖放模式**: 球在原位展开 (用户已经把文件拖到球上了，不需要移动)
**剪贴板模式**: 球移动到鼠标附近展开，固定不跟踪鼠标

```typescript
// 剪贴板模式: 定位到鼠标附近
function expandAtCursor(x: number, y: number) {
  const bounds = {
    x: x + 20,
    y: y - 20,
    width: 240,
    height: Math.min(itemCount * 44 + 24, 360)
  }
  // 边界检测
  if (bounds.x + bounds.width > screenW) bounds.x = x - 260
  if (bounds.y + bounds.height > screenH) bounds.y = screenH - bounds.height - 8

  bubbleWindow.setBounds(bounds)
  bubbleWindow.setSize(240, bounds.height)  // CSS transition 做动画
}
```

### 收拢定位

收拢时球回到默认位置 (屏幕右侧垂直居中，用户可在设置中自定义)。

---

## 六、剪贴板监控

### 触发条件

轮询剪贴板 (每 500ms)，内容变化时 (防抖 300ms) 展开菜单。

剪贴板内容解析:
```
CF_HDROP (文件)   → PowerShell 取路径  → DropPayload { kind:'file' }
CF_TEXT / CF_UNICODETEXT → DropPayload { kind:'text' }
CF_HTML           → DropPayload { kind:'html' }
CF_BITMAP / image → 写临时文件 → DropPayload { kind:'image' }
未识别            → 忽略 (不展开)
```

### 去抖

```typescript
let debounceTimer: NodeJS.Timeout | null = null

function onClipboardChange() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const content = parseClipboard()
    if (isRecognized(content)) {
      expandAtCursor(cursorX, cursorY, 'clipboard')
    }
  }, 300)
}
```

### 取剪贴板文件列表 (Windows)

Electron `clipboard` 不暴露 `CF_HDROP`。MVP 用 PowerShell:

```typescript
execFile('powershell', [
  '-NoProfile', '-Command',
  'Get-Clipboard -Format FileDropList | ForEach-Object { $_ }'
], { timeout: 2000 }, (err, stdout) => {
  // parse stdout lines
})
```

备选: 小型 native addon (Rust) 直接读 `CF_HDROP`。

### 拖放时内容解析

从 `dataTransfer.items` 遍历:
```
item.kind === 'file'   → DropPayload { kind:'file', path, name, ... }
item.type === 'text/plain' → DropPayload { kind:'text', content }
item.type === 'text/html'  → DropPayload { kind:'html', content }
item.type === 'text/uri-list' → DropPayload { kind:'url', url }
图片 (非文件路径)          → 写临时文件 → DropPayload { kind:'image', path }
```

---

## 七、插件系统

### 设计原则

- **全能力**：插件运行在 Electron 主进程，拥有完整 Node.js 权限（`fs`、`child_process` 等）。无沙箱。
- **写起来最省事**：插件只需导出 `IPlugin` 对象，告诉 Asuka"我能提供哪些命令"，命令触发时执行。
- **TypeScript 一等公民**：插件可以写 `.ts`，无需构建步骤——esbuild 运行时内存编译。
- **自带存储**：Asuka 为每个插件提供简单的 KV 持久化，插件不用自己管文件 I/O。

### 七.1 插件接口

```typescript
// src/shared/plugin-api.ts

interface IPlugin {
  /** 全局唯一 ID，如 'file-archiver' */
  id: string
  /** 显示名称 */
  name: string
  /** 图标：emoji 字符 或 内联 SVG 字符串 */
  icon: string

  /** 插件被加载时调用 */
  onActivate?(ctx: PluginContext): void | Promise<void>
  /** 插件被卸载时调用 */
  onDeactivate?(): void | Promise<void>

  /** 返回展开菜单中的命令 (拖放/剪贴板共用) */
  getDropCommands?(): DropCommand[]

  /** 返回悬浮球右键菜单中的命令 */
  getBubbleContextCommands?(): BubbleContextCommand[]

  /** 可选：用户设置变更时通知插件 */
  onConfigChange?(newConfig: AsukaConfig): void

  /** 伴生子进程配置 (可选，用于需要常驻后台的插件) */
  companion?: CompanionConfig | CompanionConfig[]
}

interface DropCommand {
  /** 命令 ID，插件内唯一 */
  id: string
  /** 在菜单中显示的名称 */
  name: string
  /** 菜单项图标，不提供则用插件的 icon */
  icon?: string
  /** 提示文本 (鼠标悬停时显示) */
  acceptLabel?: string
  /** 子菜单 (可选)。有子菜单时，此命令本身不被触发 */
  submenu?: DropCommand[]

  /** 用户触发此命令时调用 */
  execute(ctx: ExecuteContext): void | Promise<void>
}

interface BubbleContextCommand {
  id: string
  label: string
  icon?: string
  onClick(): void
}

/** 拖放或剪贴板携带的每一项数据 */
type DropPayload =
  | { kind: 'file'; path: string; name: string; ext: string; size: number; mimeType?: string }
  | { kind: 'text'; content: string }
  | { kind: 'html'; content: string }
  | { kind: 'image'; path: string; width?: number; height?: number }
  | { kind: 'url'; url: string; title?: string }

interface ExecuteContext {
  /** 拖放/剪贴板携带的全部载荷 */
  items: DropPayload[]

  /** 触发来源 */
  source: 'drag' | 'clipboard'
  /** 显示屏幕底部 toast */
  toast(message: string): void
  /** 系统剪贴板 (读/写文本) */
  clipboard: {
    writeText(text: string): void
    readText(): string
    writeHTML(html: string): void
    readHTML(): string
    clear(): void
  }
  /** 系统 Shell */
  shell: {
    openExternal(url: string): Promise<void>
    openPath(path: string): Promise<string>
    showItemInFolder(path: string): void
    beep(): void
  }
  /** 当前主题 */
  theme: 'dark' | 'light'
  /** 日志 */
  log: PluginLogger
}

interface PluginContext {
  /** 伴生进程句柄 (若插件声明了 companion) */
  companions: CompanionHandle[]
  /** 插件存储: 简单的 KV 持久化 */
  storage: PluginStorage
  /** 当前主题 */
  theme: 'dark' | 'light'
  /** 日志: 5 级, 写入 ~/.asuka/logs/{pluginId}.log */
  log: PluginLogger
}

interface PluginLogger {
  error(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  info(msg: string, ...args: unknown[]): void
  debug(msg: string, ...args: unknown[]): void
  trace(msg: string, ...args: unknown[]): void
}

interface PluginStorage {
  /** 读取键值。无此键返回 undefined */
  get<T = unknown>(key: string): T | undefined
  /** 写入键值。自动持久化到 ~/.asuka/storage/{pluginId}.json */
  set<T = unknown>(key: string, value: T): void
  /** 删除键值 */
  delete(key: string): void
  /** 获取全部键列表 */
  keys(): string[]
}
```

### 七.2 运行时 TypeScript 编译

插件可以直接写 `.ts`，无需运行 `tsc`。Asuka 的 plugin-host 通过 **esbuild** 在内存中编译：

```
require('my-plugin/index.ts')
  → Module._extensions['.ts'] hook (esbuild transform)
  → 内存编译为 CommonJS
  → 执行
```

不产生中间文件。对插件开发者完全透明——只需要 `index.ts` 和 `package.json` 指向它。

### 七.3 类型包分发

为插件开发者提供类型提示，Asuka 将类型定义打包为本地 npm 包 `asuka-plugin-types`：

```
asuka/
└── types/
    ├── package.json    # { "name": "asuka-plugin-types", "types": "./index.d.mts" }
    └── index.d.mts     # 声明全局 namespace Asuka，包含所有接口类型
```

插件开发者在自己的 `package.json` 中：

```json
{
  "devDependencies": {
    "asuka-plugin-types": "file:C:/path/to/asuka/types"
  }
}
```

`npm install` 后 IDE 自动获得 IPlugin / DropCommand / ExecuteContext 等类型补全。

### 七.4 CompanionConfig 详细协议

插件可以声明伴生子进程，用于需要常驻后台的任务。支持两种通信模式：

```typescript
type CompanionConfig = {
  /** 启动命令 */
  command: string
  /** 命令行参数 */
  args?: string[]
  /** 通信模式 */
  mode: 'jsonl' | 'http'
}

interface CompanionHandle {
  /** 进程 ID */
  pid: number
  /** 配置 */
  config: CompanionConfig
  /** HTTP 模式下为 'http://127.0.0.1:{port}' */
  url?: string
  /** (仅 jsonl 模式) 向子进程发送数据 */
  send(data: unknown): void
  /** (仅 jsonl 模式) 监听子进程消息。返回取消订阅函数 */
  onMessage(cb: (data: unknown) => void): () => void
  /** 结束子进程 (SIGTERM → 5s → SIGKILL) */
  kill(): void
}
```

**jsonl 模式**：主进程将数据 JSON.stringify 后写入子进程 stdin，从 stdout 按行读取并 JSON.parse。适用于 Node.js / Python 子进程。

**http 模式**：Asuka 为子进程分配空闲端口（通过 `FUTARI_PORT` 和 `PORT` 环境变量传入），轮询 `http://127.0.0.1:{port}/health` 直到就绪。适用于任意语言的 HTTP 服务器。

插件通过 `ctx.companions` 获取句柄，操作子进程。

### 七.5 插件存储

每个插件自动拥有一个 `PluginStorage` 实例，数据持久化到 `~/.asuka/storage/{pluginId}.json`。插件无需手动 fs 读写：

```typescript
// 在 onActivate 或 execute 中使用
ctx.storage.set('lastOutputDir', '/home/user/pictures')
const dir = ctx.storage.get<string>('lastOutputDir')
ctx.storage.keys()  // → ['lastOutputDir', 'favorites', ...]
```

存储自动去抖写入（500ms），崩溃安全。

### 七.6 错误处理策略

插件命令执行时的异常处理：

```
command.execute(ctx):
  → try { await execute(ctx) } catch (err) {
       log.error(`[${pluginId}:${commandId}]`, err)
       ctx.toast(`执行失败: ${err.message}`)
     }
  → 始终收拢菜单 (无论成功或失败)
```

**原则**：单个插件崩溃不影响 Asuka 和其他插件。plugin-host 在加载/卸载/扫描时逐个 try-catch，单个插件的故障只打日志，不中断整体流程。

### 七.7 插件目录约定

```
~/.asuka/
├── config.json              # { "theme": "dark", "bubblePosition": {...} }
├── plugins/
│   ├── image-processor/
│   │   ├── package.json     # { "name": "...", "main": "./index.ts" }
│   │   ├── index.ts         # export default { id, name, icon, ... }
│   │   ├── tsconfig.json    # (可选) IDE 类型检查配置
│   │   └── node_modules/    # (可选) 插件自己的依赖
│   └── file-archiver/
│       ├── package.json
│       └── index.js
├── storage/
│   ├── image-processor.json # PluginStorage 自动生成
│   └── file-archiver.json
└── logs/
    ├── asuka.log
    ├── image-processor.log
    └── file-archiver.log
```

**判别标准**：`scanAndLoadUserPlugins()` 扫描 `plugins/` 下含 `package.json` 的子目录。`require(dir)` 通过 `package.json.main` 解析入口。

### 七.8 插件示例

```typescript
/// <reference types="asuka-plugin-types" />

const plugin: Asuka.IPlugin = {
  id: 'image-processor',
  name: '图片处理',
  icon: '🖼️',

  onActivate(ctx) {
    ctx.log.info('图片处理插件已激活')
    // 恢复上次使用的输出目录
    const lastDir = ctx.storage.get<string>('lastOutputDir')
    if (lastDir) ctx.log.info('上次输出目录:', lastDir)
  },

  getDropCommands() {
    return [
      {
        id: 'convert-webp',
        name: '转换为 WebP',
        acceptLabel: '拖放或粘贴',
        async execute(ctx) {
          const files = ctx.items.filter(i => i.kind === 'file')
          if (files.length === 0) {
            ctx.toast('没有找到可处理的文件')
            return
          }

          let count = 0
          for (const f of files) {
            if (!['.png', '.jpg', '.jpeg'].includes(f.ext.toLowerCase())) continue
            const outPath = f.path.replace(/\.\w+$/, '.webp')
            await sharp(f.path).webp({ quality: 80 }).toFile(outPath)
            count++
          }

          // 记住输出目录
          if (files.length > 0) {
            const dir = path.dirname(files[0].path)
            ctx.storage.set('lastOutputDir', dir)
          }

          ctx.toast(`已转换 ${count} 张图片为 WebP`)
          ctx.log.info(`转换完成: ${count}/${files.length} 个文件`)
        }
      },
      {
        id: 'compress',
        name: '压缩图片',
        acceptLabel: '拖放或粘贴',
        async execute(ctx) {
          const files = ctx.items.filter(i => i.kind === 'file')
          let count = 0
          for (const f of files) {
            const outPath = f.path.replace(/(\.\w+)$/, '_compressed$1')
            await sharp(f.path).jpeg({ quality: 60 }).toFile(outPath)
            count++
          }
          ctx.toast(`已压缩 ${count} 张图片`)
        }
      }
    ]
  },

  getBubbleContextCommands() {
    return [{
      id: 'open-workspace',
      label: '打开图片工作区',
      onClick() { /* 打开插件自己的 BrowserWindow */ }
    }]
  }
}

export default plugin
```

### 七.9 菜单构建流程

```
展开触发 (dragenter 或 剪贴板变更):
  → pluginHost.getAllPlugins()
  → 收集所有 getDropCommands()
  → IPC → Renderer 渲染菜单项 DOM
  → 用户 drop/click 某菜单项
  → Renderer IPC 上报 pluginId + commandId (+ dataTransfer)
  → Main 构造 DropPayload[] → command.execute(ctx)
  → execute() 完成或异常后 → 始终收拢菜单
```

<!-- 原先的设计到这里结束 -->

### 七.10 onConfigChange

当用户在设置中修改配置（主题、球位置等），Asuka 通知所有已加载插件：

```
用户修改主题为 'light'
  → config.save()
  → pluginHost.forEach(plugin => plugin.onConfigChange?.(config))
```

插件可据此调整自己的窗口主题或行为。

---

## 八、配置与设置窗口

### 八.1 配置结构

```typescript
// src/main/config.ts

interface AsukaConfig {
  /** 主题: 'dark' | 'light' (默认 'dark') */
  theme: 'dark' | 'light'
  /** 悬浮球默认位置 (屏幕坐标)。收拢态始终回此位置 */
  bubblePosition: { x: number; y: number }
  /** 启用的插件 ID 白名单。undefined 表示全部启用 */
  enabledPlugins?: string[]
  /** 开机自启 (默认 false) */
  launchAtStartup: boolean
}

// ConfigManager 提供:
//   load(): AsukaConfig       从 ~/.asuka/config.json 读取
//   save(cfg): void           写入磁盘
//   patch(partial): void      部分更新 + 保存
//   getAll(): AsukaConfig     获取当前配置
//   onChange(callback): void  注册变更监听
```

`~/.asuka/config.json` 示例:
```json
{
  "theme": "dark",
  "bubblePosition": { "x": 1832, "y": 504 },
  "enabledPlugins": ["file-archiver", "image-processor"],
  "launchAtStartup": false
}
```

### 八.2 设置窗口

从托盘菜单或悬浮球右键菜单打开。独立的 frameless BrowserWindow:

```
┌──────────────────────────────────┐
│  Asuka 设置                   ✕  │
├──────────────────────────────────┤
│  主题:  ○ 暗色  ● 亮色          │
│  启动:  ○ 开机自启              │
│  插件:                           │
│    🖼️ 图片处理       [已启用]   │
│    📦 文件归档        [启/禁用]  │
│  球位置: 拖拽球到目标位置即保存  │
│  关于: Asuka v1.0.0             │
└──────────────────────────────────┘
```

配置变更后:
```typescript
config.patch({ theme: 'light' })
  → 保存到 ~/.asuka/config.json
  → 通知所有窗口更新主题 CSS
  → 通知所有插件的 onConfigChange(newConfig)
```

---

## 九、目录结构

```
asuka/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.ts              # app 入口: 插件加载、托盘初始化
│   │   ├── bubble-window.ts      # 悬浮球: 创建/展开/收拢/定位
│   │   ├── clipboard-monitor.ts  # 剪贴板轮询 + 内容解析
│   │   ├── plugin-host.ts        # 插件生命周期 (esbuild TS hook / load / unload / scan)
│   │   ├── companion-manager.ts  # 伴生进程管理 (jsonl / http)
│   │   ├── settings-window.ts    # 设置窗口
│   │   ├── tray.ts               # 系统托盘
│   │   ├── ipc-handlers.ts       # IPC 处理器
│   │   ├── toast.ts              # Toast 窗口
│   │   ├── config.ts             # ConfigManager: ~/.asuka/config.json 读写
│   │   ├── logger.ts             # Logger + createPluginLogger
│   │   ├── storage.ts            # PluginStorage 实现 (~/.asuka/storage/)
│   │   └── plugins/
│   │       └── builtins/
│   │           ├── file-archiver.ts
│   │           ├── image-processor.ts
│   │           └── uploader.ts
│   ├── preload/
│   │   ├── bubble-preload.ts     # 悬浮球窗口 preload
│   │   └── settings-preload.ts   # 设置窗口 preload
│   ├── renderer/src/
│   │   ├── bubble/
│   │   │   ├── App.vue           # 球/菜单根组件
│   │   │   ├── MenuItem.vue      # 菜单项
│   │   │   └── SubMenu.vue       # 子菜单
│   │   ├── settings/
│   │   │   ├── App.vue
│   │   │   └── ThemeSwitch.vue
│   │   └── styles/
│   └── shared/
│       ├── ipc-channels.ts       # IPC 通道常量
│       └── plugin-api.ts         # IPlugin / DropCommand / ExecuteContext 等
├── types/
│   ├── package.json              # "asuka-plugin-types": { "types": "./index.d.mts" }
│   └── index.d.mts               # declare namespace Asuka { ... }
├── resources/
│   └── icon.png
└── docs/
    └── asuka-design.md
```

---

## 十、技术决策

| 决策 | 理由 |
|------|------|
| 悬浮球方案 (非纯弹出菜单) | 无需全局鼠标钩子；窗口常驻 → OLE drop target 始终注册；球自身感知 dragenter，无假阳 |
| `transparent: true` | 圆形视觉 + 阴影。不调用 setIgnoreMouseEvents (那才阻止 OLE)。分层窗口本身可接收 OLE |
| `focusable: false` 收拢态 | 不抢焦点、不影响拖放源应用 |
| `focusable: true` 剪贴板展开态 | 接收点击、失焦自动收拢 |
| 拖放检测: 窗口自身 dragenter | Chromium dragenter 仅在有 OLE/HTML5 拖拽数据时触发，天然过滤假阳拖拽 |
| 无 electron-dragfile-plugin | 不需要。球自身就是传感器。减少依赖、减少杀软误报 |
| `getDropCommands()` 不传文件信息 | 拖放开始前无法获取内容；命令声明后自行校验 |
| `DropPayload` ADT 数组 | 一次操作可能携带多种格式，插件各自取所需 |
| PowerShell 取剪贴板文件 | MVP 快速实现，后续可换 native addon |
| 剪贴板去抖 300ms | 避免 IDE 格式化等场景反复展开菜单 |
| 菜单位置: 拖放模式球原位展开 | 用户已经把文件拖到球上了 |
| 菜单位置: 剪贴板模式移到鼠标旁 | 用户刚复制完，鼠标在附近 |
| 插件运行在主进程 (无沙箱) | 简单、插件拥有完整能力。信任模型类似 VSCode 扩展 |
| esbuild 运行时 TS 编译 | 插件写 .ts 无需构建步骤。内存编译，无中间文件 |
| 插件自带存储 (PluginStorage) | 简单 KV → JSON，插件不用管 fs。去抖写入，崩溃安全 |
| 每插件独立日志文件 | 不混入主日志，便于插件开发者调试 |
| 伴生进程支持 jsonl + http | 覆盖 Node.js 子进程 (jsonl) 和任意语言服务 (http) 两种场景 |
| 类型包本地 npm 分发 | 不发布到 npm。插件通过 file: 协议安装，IDE 自动补全 |
| 错误时始终收拢菜单 | 命令执行成功/失败都收拢，不卡在半展开状态 |
| 逐个 try-catch 插件 | 单个插件故障不影响 Asuka 和其他插件 |
| onConfigChange 通知插件 | 主题/配置变更时插件可同步自己的 UI

---

## 十一、IPC 通道

```typescript
const IPC = {
  // Main → Renderer
  EXPAND_MENU:    'expand-menu',      // 展开 (携带命令列表 + 来源)
  COLLAPSE:       'collapse',         // 收拢
  MOVE_TO:        'move-to',          // 移动球到某位置

  // Renderer → Main
  DRAG_ENTER:     'drag-enter',       // dragenter 了 → 展开
  DRAG_LEAVE:     'drag-leave',       // dragleave → 收拢
  DROP_EXECUTE:   'drop-execute',     // drop 到菜单项 (pluginId + commandId + files)
  CLICK_EXECUTE:  'click-execute',    // click 菜单项 (剪贴板模式)
  BLUR:           'blur',             // 失焦 → 收拢

  TOAST:          'toast',
  LOG:            'log',
  GET_CONFIG:     'get-config',
  SET_CONFIG:     'set-config',
  THEME_CHANGED:  'theme-changed',
}
```

---

## 十二、开发阶段

### Phase 1 — 骨架 (PoC 已验证)
- [x] 悬浮球窗口: 预创建, transparent:true, focusable:false
- [x] dragenter → 展开菜单, dragleave → 收拢
- [x] drop 到菜单项 → 解析 dataTransfer → console 输出
- [x] 从文件管理器拖文件路径获取验证
- [ ] 球的位置持久化
- [ ] 展开/收拢 CSS 过渡动画

### Phase 2 — 剪贴板
- [ ] 剪贴板轮询 (500ms) + 防抖 300ms
- [ ] PowerShell 取 CF_HDROP
- [ ] 剪贴板展开: focusable:true + 定位到鼠标
- [ ] blur 自动收拢
- [ ] 文本/文件/图片/HTML 剪贴板解析

### Phase 3 — 插件系统
- [ ] plugin-host.ts: esbuild TS hook + load/unload/reload/scan
- [ ] PluginStorage 实现 (~/.asuka/storage/ KV → JSON)
- [ ] CompanionManager (jsonl + http 两种模式)
- [ ] getDropCommands() → 构建菜单 → IPC
- [ ] command.execute() 调用 + try-catch + 错误 toast
- [ ] 首个内建插件: file-archiver
- [ ] 子菜单 (drag-enter 展开 / click 展开)
- [ ] getBubbleContextCommands() → 球右键菜单
- [ ] onConfigChange 通知链路

### Phase 4 — 外围
- [ ] ConfigManager: schema + load/save/patch + onChange
- [ ] 系统托盘 + 托盘菜单
- [ ] 设置窗口 + 主题切换 + 球位置配置
- [ ] Logger + createPluginLogger (每插件独立日志文件)
- [ ] Toast 窗口
- [ ] 插件热重载 (scanAndLoadUserPlugins)
- [ ] 用户插件目录扫描 (~/.asuka/plugins/)

### Phase 5 — 发布
- [ ] asuka-plugin-types 类型包
- [ ] 自动更新
- [ ] 安装包构建

---

## 十三、已验证 & 待验证

| 问题 | 状态 | 结论 |
|------|------|------|
| `transparent:true` 能否接收 OLE dragenter | ✅ 已验证 | 可以。不调 setIgnoreMouseEvents 即可 |
| `focusable:false` 能否接收 drop | ✅ 已验证 | 可以。focusable 不影响 OLE |
| 文件管理器拖文件 path 能否获取 | ✅ 已验证 | 文件管理器 source 有 path。非文件系统 source (VSCode 等) 可能为空 |
| dragenter 能否过滤假阳拖拽 | ✅ 已验证 | dragenter 只在有 OLE 数据时触发 |
| transparent 全屏传感器 + setIgnoreMouseEvents | ❌ 不可行 | WS_EX_TRANSPARENT 阻止 OLE hit-test |
| electron-dragfile-plugin 方案 | ❌ 废弃 | 假阳太多，任何鼠标拖拽都触发 |
| esbuild 运行时 TS 编译 | ✅ 已验证 | futari 生产使用，稳定 |
| 本地类型包分发 (file: 协议) | ✅ 已验证 | futari 生产使用 |
| PluginStorage KV → JSON | ✅ 已验证 | futari 的 bookmark/sticky 插件均此模式 |
| 伴生进程 jsonl/http | ✅ 已验证 | futari 生产使用 |
| PowerShell 剪贴板文件列表速度 | ⚠️ 待测 | |
| 剪贴板图片生命周期 (临时文件清理) | ⚠️ 待测 | |
| 多显示器 DPI 球定位 | ⚠️ 待测 | |

---

*本文档描述的是设计目标，不是当前实现的快照。*
