# Asuka 插件开发指南

## 1. 概述

Asuka 是一个桌面悬浮球 — 拖文件到球上自动展开命令菜单，松手触发插件。复制文件/文本后在鼠标旁弹出菜单，点击执行。

**插件代码运行在 Electron 主进程**，拥有完整的 Node.js 权限。与普通网页 JS 完全不同 — 你可以读写文件、执行系统命令、访问数据库等。

### 1.1 插件目录结构

每个插件是一个目录，放在 `~/.asuka/plugins/` 下。推荐通过托盘 → 开发 → 创建插件 脚手架生成。

```
my-plugin/
├── index.ts           ← TypeScript 入口（或 index.js）
├── tsconfig.json      ← IDE 类型提示（TS 插件，esbuild 不读取）
├── package.json       ← 包信息 + 类型引用
└── lib.js             ← 共享模块（可选）
```

### 1.2 TypeScript 插件与运行时编译

支持直接编写 `.ts` 插件。运行时使用 **esbuild** 在内存中编译，不产生中间文件。

| 关注点 | 说明 |
|---|---|
| **运行时编译器** | esbuild（内置于 Asuka，无需额外安装） |
| **编译产物** | 纯内存，插件目录始终只有 `.ts` 源文件 |
| **import 处理** | `import './lib'` → `require('./lib.ts')`，支持相对路径 |
| **第三方库** | `require('lodash')` 正常走 node_modules |
| **tsconfig.json** | **仅供 IDE 类型提示**，esbuild 不读取 |

建议创建的最小 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "node"
  },
  "include": ["index.ts"]
}
```

### 1.3 类型声明的分发方式

Asuka 附带本地类型包 `asuka-plugin-types`，插件通过 `package.json` 的 `devDependencies` 引用。使用"创建插件"命令生成的 `package.json` 已内置此项。

```json
{
  "devDependencies": {
    "asuka-plugin-types": "file:C:/path/to/asuka/types"
  }
}
```

在插件代码中通过 `/// <reference types="asuka-plugin-types" />` 获得全局 `Asuka` 命名空间的类型提示。无需 import。

---

## 2. 最小示例

### 2.1 JavaScript

```javascript
/// <reference types="asuka-plugin-types" />

const { mkdirSync, copyFileSync } = require('fs')
const { join } = require('path')

/**
 * @type {Asuka.IPlugin}
 */
const plugin = {
  id: 'my-plugin',
  name: '我的插件',

  async onActivate() {},
  async onDeactivate() {},

  buildDragCommands(meta) {
    if (!meta.hasFiles) return []
    return [{
      id: 'save',
      name: '保存到桌面',
      icon: '💾',
      execute(ctx) {
        for (const item of ctx.items) {
          if (item.kind === 'file' && item.path) {
            copyFileSync(item.path, join(require('os').homedir(), 'Desktop', item.name))
          }
        }
        ctx.toast('已保存')
      }
    }]
  },

  buildClipboardCommands(items) {
    if (items.length === 0) return []
    return [{
      id: 'save',
      name: '保存到桌面',
      icon: '💾',
      execute(ctx) {
        for (const item of ctx.items) {
          if (item.kind === 'file' && item.path) {
            copyFileSync(item.path, join(require('os').homedir(), 'Desktop', item.name))
          }
        }
        ctx.toast('已保存')
      }
    }]
  },

  buildContextCommands() {
    return []
  }
}

module.exports = plugin
```

### 2.2 TypeScript

```typescript
/// <reference types="asuka-plugin-types" />

const { mkdirSync, copyFileSync } = require('fs')
const { join } = require('path')
const { homedir } = require('os')

const plugin: Asuka.IPlugin = {
  id: 'my-plugin',
  name: '我的插件',

  async onActivate() {},
  async onDeactivate() {},

  buildDragCommands(meta: Asuka.DragMetadata) {
    if (!meta.hasFiles) return []
    return [{
      id: 'save',
      name: '保存到桌面',
      icon: '💾',
      execute(ctx: Asuka.ExecuteContext) {
        for (const item of ctx.items) {
          if (item.kind === 'file' && item.path) {
            copyFileSync(item.path, join(homedir(), 'Desktop', item.name))
          }
        }
        ctx.toast('已保存')
      }
    }]
  },

  buildClipboardCommands(items: Asuka.DropPayload[]) {
    if (items.length === 0) return []
    return [{
      id: 'save',
      name: '保存到桌面',
      icon: '💾',
      execute(ctx: Asuka.ExecuteContext) {
        for (const item of ctx.items) {
          if (item.kind === 'file' && item.path) {
            copyFileSync(item.path, join(homedir(), 'Desktop', item.name))
          }
        }
        ctx.toast('已保存')
      }
    }]
  },

  buildContextCommands() {
    return []
  }
}

export default plugin
```

---

## 3. 插件对象结构 (IPlugin)

```typescript
interface IPlugin {
  id: string                        // 唯一标识（如 'my-plugin'）
  name: string                      // 显示名称
  icon?: string                     // emoji（每个 CommandDef 各自带 icon）

  onActivate(ctx: PluginContext): Promise<void>
  onDeactivate(): Promise<void>

  buildDragCommands(meta: DragMetadata): CommandDef[]
  buildClipboardCommands(items: DropPayload[]): CommandDef[]
  buildContextCommands(): CommandDef[]
}
```

### 3.1 三个命令入口

| 方法 | 触发时机 | 参数 | 空命令行为 |
|------|---------|------|----------|
| `buildDragCommands(meta)` | 拖文件/文本到悬浮球 | `DragMetadata` | 显示"没有匹配命令" |
| `buildClipboardCommands(items)` | Ctrl+C 后菜单展开 | `DropPayload[]`（剪贴板解析内容） | **静默不展开** |
| `buildContextCommands(items)` | 右键悬浮球 | `DropPayload[]`（当前剪贴板内容，未复制则为 `[]`） | 显示"没有匹配命令" |

**重要**：`buildDragCommands` 仅在 `dragenter` 阶段调用，此时 Chromium 不暴露文件名——只能通过 `meta.hasFiles`/`meta.hasText`/`meta.hasImage` 做粗略筛选，具体文件信息在 `execute` 的 `ctx.items` 里拿。

---

## 4. DragMetadata

拖拽悬浮球时用于筛选命令的元数据。**Chromium 安全限制导致 `dragenter` 阶段只能获取 MIME 类型和布尔标志，无法获取文件名。** 具体文件信息（路径、名称、大小）仅在 `execute` 时通过 `ctx.items` 获得。

```typescript
interface DragMetadata {
  source: 'drag' | 'clipboard'

  mimeTypes: string[]    // MIME 类型，如 ['Files', 'text/plain']
  fileCount: number      // 文件数量（来自 dt.items 计数）

  hasFiles: boolean      // 是否包含文件
  hasText: boolean       // 是否包含纯文本
  hasHtml: boolean       // 是否包含 HTML
  hasImage: boolean      // 是否包含图片（通过 MIME 类型检测）
}
```

**正确用法**：用布尔标志做筛选。

```typescript
buildDragCommands(meta) {
  if (meta.hasImage) {
    // 显示图片相关的命令（转换格式、上传图床等）
  }
  if (meta.hasText) {
    // 显示文本相关的命令（翻译、搜索等）
  }
}
```

---

## 5. CommandDef

每个命令的定义：

```typescript
interface CommandDef {
  id: string                        // 命令标识（插件内部唯一）
  name: string                      // 显示名称
  icon: string                      // emoji 图标
  submenu?: CommandDef[]            // 子菜单（递归）
  execute(ctx: ExecuteContext): void | Promise<void>
}
```

带子菜单的命令：

```typescript
buildDragCommands(meta) {
  return [{
    id: 'save-as',
    name: '另存为...',
    icon: '💾',
    submenu: [
      { id: 'desktop', name: '桌面', icon: '🖥️', execute(ctx) { ... } },
      { id: 'docs', name: '文档', icon: '📁', execute(ctx) { ... } }
    ]
  }]
}
```

子菜单项无 `execute` 的视为分组标题（点击无效）。

---

## 6. ExecuteContext

`execute(ctx)` 收到的 `ctx` 对象：

```typescript
interface ExecuteContext {
  metadata: DragMetadata              // 触发时的元数据
  items: DropPayload[]                // 实际数据
  commandId: string                   // 被执行的命令 ID（格式: "插件id:命令id"）
  toast(message: string): void        // 显示浮动提示
  showForm(config: FormConfig): Promise<Record<string, unknown> | null>
  log: PluginLogger                   // 日志接口
  storage: PluginStorage              // 持久化 KV 存储
  companions: CompanionHandle[]       // 伴生进程句柄
}
```

### 6.1 ctx.items 的内容

**根据触发场景不同，`ctx.items` 的内容也不同**：

| 场景 | `ctx.items` 内容 |
|------|-----------------|
| 拖拽文件到命令 | 拖放的实际文件/文本/HTML（含 `item.path`） |
| 拖拽后点击命令 | 同上 |
| Ctrl+C 后点击命令 | 剪贴板解析内容 |
| 右键点击命令 | **上一次剪贴板缓存**（未复制过则为 `[]`） |

`DropPayload` 类型：

```typescript
type DropPayload =
  | { kind: 'file'; path: string; name: string; ext: string; size: number; mimeType?: string }
  | { kind: 'text'; content: string }
  | { kind: 'html'; content: string }
  | { kind: 'image'; path: string; width?: number; height?: number }
  | { kind: 'url'; url: string; title?: string }
```

### 6.2 ctx.toast(message)

屏幕底部浮动提示，2.5 秒后消失。

```typescript
execute(ctx) {
  ctx.toast('操作完成')
}
```

### 6.3 ctx.showForm(config) → Promise

弹出表单窗口，用户填写后返回数据，取消则返回 `null`。

```typescript
execute(ctx) {
  const result = await ctx.showForm({
    title: '用户信息',
    width: 440,
    fields: [
      { type: 'input', key: 'name', label: '姓名', required: true },
      { type: 'select', key: 'role', label: '角色', defaultValue: 'admin',
        options: [{ label: '管理员', value: 'admin' }, { label: '用户', value: 'user' }] },
      { type: 'checkbox', key: 'agree', label: '同意协议', defaultValue: true }
    ]
  })
  if (!result) return
  ctx.toast(`你好 ${result.name}`)
}
```

支持的字段类型：`input`、`number`、`select`、`checkbox`、`radio`、`switch`、`textarea`。

### 6.4 ctx.storage

持久化 KV 存储，数据写入 `~/.asuka/storage/{pluginId}.json`，500ms 防抖写入。

```typescript
execute(ctx) {
  const count = ctx.storage.get<number>('count') || 0
  ctx.storage.set('count', count + 1)
  ctx.toast(`已执行 ${count + 1} 次`)
}
```

### 6.5 ctx.log

插件专属日志，写入 `~/.asuka/logs/{pluginId}.log`。

```typescript
execute(ctx) {
  ctx.log.info('处理文件:', ctx.items.map(i => i.kind))
  ctx.log.error('处理失败', err)
}
```

---

## 7. 伴生进程 (Companion)

插件可以启动外部程序作为伴生进程，支持两种协议：

| 模式 | 协议 | 适用场景 |
|------|------|---------|
| `jsonl` | stdin/stdout JSON-line | Node.js/Python 子进程 |
| `http` | HTTP + 端口分配 + 健康检查 | 已有 HTTP 服务的程序 |

```typescript
interface CompanionConfig {
  type: 'jsonl' | 'http'
  pluginId: string
  command: string
  args?: string[]
  cwd?: string
  port?: number            // HTTP 模式自动分配
  healthPath?: string      // HTTP 健康检查路径，默认 '/health'
  startupTimeout?: number  // 超时，默认 10000ms
}
```

伴生进程通过 `companionManager` 管理，插件目前通过 `ctx.companions` 访问已启动的进程句柄。

---

## 8. 完整示例：暂存插件

`~/.asuka/plugins/staging/index.ts`：

```typescript
/// <reference types="asuka-plugin-types" />

const { existsSync, mkdirSync, copyFileSync, writeFileSync } = require('fs')
const { join, basename } = require('path')
const { tmpdir } = require('os')
const { shell } = require('electron')

const STAGING_DIR = join(tmpdir(), 'asuka-staging')

function ensureDir() {
  if (!existsSync(STAGING_DIR)) mkdirSync(STAGING_DIR, { recursive: true })
}

const plugin: Asuka.IPlugin = {
  id: 'staging',
  name: '暂存',

  async onActivate() { ensureDir() },
  async onDeactivate() {},

  buildDragCommands(meta: Asuka.DragMetadata) {
    if (!meta.hasFiles && !meta.hasText && !meta.hasHtml && !meta.hasImage) return []
    return [{
      id: 'stash',
      name: '暂存到临时文件夹',
      icon: '📋',
      execute(ctx: Asuka.ExecuteContext) {
        ensureDir()
        for (const item of ctx.items) {
          if (item.kind === 'file' && item.path) {
            copyFileSync(item.path, join(STAGING_DIR, item.name))
          } else if (item.kind === 'text') {
            writeFileSync(join(STAGING_DIR, `text-${Date.now()}.txt`), item.content, 'utf-8')
          } else if (item.kind === 'html') {
            writeFileSync(join(STAGING_DIR, `html-${Date.now()}.html`), item.content, 'utf-8')
          } else if (item.kind === 'image' && item.path) {
            copyFileSync(item.path, join(STAGING_DIR, basename(item.path)))
          }
        }
        ctx.toast(`已保存到 ${STAGING_DIR}`)
      }
    }]
  },

  buildClipboardCommands(items: Asuka.DropPayload[]) {
    if (items.length === 0) return []
    return [{
      id: 'stash',
      name: '暂存到临时文件夹',
      icon: '📋',
      execute(ctx: Asuka.ExecuteContext) {
        // 同 buildDragCommands 中的 execute
      }
    }]
  },

  buildContextCommands() {
    return [{
      id: 'open',
      name: '打开暂存文件夹',
      icon: '📂',
      execute(ctx: Asuka.ExecuteContext) {
        ensureDir()
        shell.openPath(STAGING_DIR)
        ctx.toast('已打开暂存文件夹')
      }
    }]
  }
}

export default plugin
```

---

## 9. 调试技巧

- **插件代码 (index.ts/js)**：`console.log()` 输出到启动 Electron 的终端
- **重新加载**：托盘 → 开发 → 重新加载（重新扫描插件目录 + 刷新 UI）
- **日志**：`ctx.log.info()` 写入 `~/.asuka/logs/{pluginId}.log`
- **DevTools**：托盘 → 打开 DevTools 查看渲染进程日志

---

## 10. 环境能力

插件代码运行在 Electron 主进程：

| 能力 | 可用 |
|------|:--:|
| `require('fs')` | ✔ |
| `require('path')` | ✔ |
| `require('electron')` | ✔ |
| `require('child_process')` | ✔ |
| 访问 `node_modules` 中的 npm 包 | ✔ |
| DOM API (`document`) | ✖ |
| 浏览器 `fetch()` | ✖（用 `require('https')` 或 `require('node-fetch')`) |

---

## 11. 已知限制

- **子菜单高度**：菜单高度仅按一级命令数计算。当子菜单命令数超过一级命令数时，子菜单区域会溢出被裁剪。
- **剪贴板文件路径**：Windows 上通过 PowerShell `Get-Clipboard` 获取，可能有延迟。
- **右键命令的 items**：右键命令的 `ctx.items` 为上一次剪贴板缓存；未复制过则为空数组。
