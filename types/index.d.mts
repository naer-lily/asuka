/**
 * Asuka 插件类型声明
 *
 * 所有 Asuka 插件通过 `/// <reference types="asuka-plugin-types" />` 引用此文件以获得完整的类型支持。
 * 此文件为全局 ambient 声明（declare namespace Asuka），插件中无需 import 即可使用 Asuka.* 类型。
 */

declare namespace Asuka {
  /**
   * 拖放/剪贴板条目联合类型
   *
   * `DropPayload` 代表插件从用户拖放或剪贴板操作中收到的单个条目。
   * 根据来源不同，条目可以是文件、文本、HTML、图片或 URL。
   */
  type DropPayload =
    /** 文件条目：包含本地路径、文件名、扩展名、大小和可选的 MIME 类型 */
    | { kind: 'file'; path: string; name: string; ext: string; size: number; mimeType?: string }
    /** 纯文本条目 */
    | { kind: 'text'; content: string }
    /** HTML 片段条目 */
    | { kind: 'html'; content: string }
    /** 图片条目：包含文件路径和可选的尺寸信息 */
    | { kind: 'image'; path: string; width?: number; height?: number }
    /** URL 条目 */
    | { kind: 'url'; url: string; title?: string }

  /**
   * 拖放/剪贴板的元数据摘要
   *
   * 在生成命令菜单前，Asuka 会先向插件传递此元数据对象，
   * 使插件能够快速判断是否需要"参与"此次交互，而无需检查具体的 DropPayload 数组。
   */
  interface DragMetadata {
    /** 来源：拖放（drag）或剪贴板（clipboard） */
    source: 'drag' | 'clipboard'
    /** 所有 MIME 类型的字符串列表 */
    mimeTypes: string[]
    /** 文件条目数量 */
    fileCount: number
    /** 是否包含文件 */
    hasFiles: boolean
    /** 是否包含纯文本 */
    hasText: boolean
    /** 是否包含 HTML 内容 */
    hasHtml: boolean
    /** 是否包含图片文件 */
    hasImage: boolean
  }

  /**
   * 命令定义
   *
   * 插件通过 `buildDragCommands` / `buildClipboardCommands` / `buildContextCommands` 返回
   * `CommandDef` 数组。每个命令对应菜单中的一个菜单项。含有 `submenu` 的命令将渲染为
   * 父子菜单结构（展开子菜单列）。
   */
  interface CommandDef {
    /** 命令唯一标识，在同一插件范围内不可重复 */
    id: string
    /** 菜单项显示名称 */
    name: string
    /** 菜单项图标（emoji 字符或单字符图标） */
    icon: string
    /** 子命令列表（可选），存在时该菜单项变为父级，点击/拖入后展开子菜单 */
    submenu?: CommandDef[]
    /** 命令执行回调，用户点击菜单项或拖放到菜单项时触发 */
    execute(ctx: ExecuteContext): void | Promise<void>
  }

  /**
   * 命令执行上下文
   *
   * 当用户点击或拖放到某个命令时，Asuka 构造此对象并传入 `execute()` 回调。
   * 插件通过此对象获取操作数据、显示 toast 通知、操作存储、与伴生进程通信等。
   */
  interface ExecuteContext {
    /** 触发命令的元数据（来源、文件数等） */
    metadata: DragMetadata
    /** 所有拖放/剪贴板的实际条目数据 */
    items: DropPayload[]
    /** 被触发的命令 ID */
    commandId: string
    /** 在屏幕底部显示一个短暂的 toast 提示（约 2.5 秒自动消失） */
    toast(message: string): void
    /** 弹出表单对话框，用户填写后返回字段值；用户取消时返回 null */
    showForm(config: FormConfig): Promise<Record<string, unknown> | null>
    /** 插件专用日志对象，日志写入 ~/.asuka/logs/{pluginId}.log */
    log: PluginLogger
    /** 插件 KV 存储，数据持久化到 ~/.asuka/storage/{pluginId}.json */
    storage: PluginStorage
    /** 插件启动的伴生进程句柄数组，用于进程间通信 */
    companions: CompanionHandle[]
  }

  /**
   * 插件激活上下文
   *
   * 当插件被加载时，Asuka 调用 `onActivate(ctx)` 并传入此对象，
   * 提供插件运行所需的目录路径和基础信息。
   */
  interface PluginContext {
    /** 插件唯一标识（目录名/插件 ID） */
    id: string
    /** Asuka 配置目录：~/.asuka/ */
    configDir: string
    /** 插件存储目录：~/.asuka/storage/ */
    storageDir: string
    /** 日志目录：~/.asuka/logs/ */
    logDir: string
    /** 插件自身所在的目录路径 */
    pluginDir: string
    /** Asuka 当前版本号 */
    appVersion: string
  }

  /**
   * 插件日志接口
   *
   * 每个插件获得独立的 Logger 实例，日志同时输出到文件和控制台。
   * 日志文件位于 ~/.asuka/logs/{pluginId}.log。
   */
  interface PluginLogger {
    /** 记录错误级别日志 */
    error(message: string, ...args: unknown[]): void
    /** 记录警告级别日志 */
    warn(message: string, ...args: unknown[]): void
    /** 记录信息级别日志 */
    info(message: string, ...args: unknown[]): void
    /** 记录调试级别日志 */
    debug(message: string, ...args: unknown[]): void
  }

  /**
   * 插件 KV 存储接口
   *
   * 基于 JSON 文件的简单键值存储，自动去抖写入。
   * 数据文件位于 ~/.asuka/storage/{pluginId}.json。
   * 注意：get/set/delete 仅修改内存，调用 save() 才会持久化到磁盘。
   * 在 dev 模式下（窗口关闭时），宿主会自动调用 save() 确保数据不丢失。
   */
  interface PluginStorage {
    /** 读取指定 key 的值 */
    get<T = unknown>(key: string): T | undefined
    /** 设置指定 key 的值（仅内存） */
    set<T = unknown>(key: string, value: T): void
    /** 删除指定 key */
    delete(key: string): void
    /** 将内存中的修改持久化到磁盘 */
    save(): void
  }

  /**
   * 伴生进程配置
   *
   * 插件可通过伴生进程运行外部程序（如 Python 脚本、HTTP 服务），
   * 支持两种通信模式：JSONL（stdin/stdout 行协议）和 HTTP（端口 + 健康检查）。
   */
  interface CompanionConfig {
    /** 通信模式：jsonl（行协议）或 http（REST API） */
    type: 'jsonl' | 'http'
    /** 所属插件 ID */
    pluginId: string
    /** 启动命令（可执行文件路径） */
    command: string
    /** 命令行参数 */
    args?: string[]
    /** 工作目录 */
    cwd?: string
    /** HTTP 模式监听端口（0 表示自动分配） */
    port?: number
    /** HTTP 模式健康检查路径（如 /health），用于确认服务已就绪 */
    healthPath?: string
    /** 启动超时时间（毫秒），超时则视为启动失败 */
    startupTimeout?: number
  }

  /**
   * 伴生进程句柄
   *
   * 伴生进程启动成功后返回此句柄，插件通过它向子进程发送消息、接收消息或终止进程。
   */
  interface CompanionHandle {
    /** 子进程 PID */
    pid: number
    /** 伴生进程配置（只读） */
    config: CompanionConfig
    /** HTTP 模式下的实际访问 URL（如 http://127.0.0.1:45678） */
    url?: string
    /** 向伴生进程发送消息（jsonl 模式写 stdin 一行，http 模式 POST 请求） */
    send(payload: unknown): void
    /** 注册消息接收回调（jsonl 模式监听 stdout 行，http 模式不适用） */
    onMessage(cb: (payload: unknown) => void): void
    /** 终止伴生进程 */
    kill(): void
  }

  /**
   * 插件主接口
   *
   * 所有 Asuka 插件必须默认导出一个实现此接口的对象。
   * 插件文件（index.ts 或 index.js）放在 ~/.asuka/plugins/{pluginName}/ 下。
   *
   * @example
   * ```ts
   * /// <reference types="asuka-plugin-types" />
   *
   * const plugin: Asuka.IPlugin = {
   *   id: 'my-plugin',
   *   name: '我的插件',
   *   icon: '🔧',
   *   async onActivate(ctx) {},
   *   async onDeactivate() {},
   *   buildDragCommands(meta) { return [] },
   *   buildClipboardCommands(items) { return [] },
   *   buildContextCommands(items) { return [] }
   * }
   * export default plugin
   * ```
   */
  interface IPlugin {
    /** 插件唯一标识，与目录名一致 */
    id: string
    /** 插件显示名称 */
    name: string
    /** 插件图标（emoji 字符），可选 */
    icon?: string
    /** 插件激活时调用，传入运行时上下文 */
    onActivate(ctx: PluginContext): Promise<void>
    /** 插件停用时调用，用于清理资源 */
    onDeactivate(): Promise<void>
    /** 拖放场景：根据拖放元数据返回可用的命令列表 */
    buildDragCommands(meta: DragMetadata): CommandDef[]
    /** 剪贴板场景：根据剪贴板条目返回可用的命令列表 */
    buildClipboardCommands(items: DropPayload[]): CommandDef[]
    /** 右键上下文菜单场景：根据条目返回可用的命令列表 */
    buildContextCommands(items: DropPayload[]): CommandDef[]
  }

  /**
   * 表单字段定义
   *
   * 当插件通过 `showForm()` 弹出表单对话框时，使用此类型定义每个字段。
   * 支持 input、number、select、checkbox、radio、switch、textarea 和 file 八种字段类型。
   */
  interface FormField {
    /** 字段类型 */
    type: 'input' | 'number' | 'select' | 'checkbox' | 'radio' | 'switch' | 'textarea' | 'file'
    /** 字段键名（表单提交后返回对象的 key） */
    key: string
    /** 字段显示标签 */
    label: string
    /** 字段默认值 */
    defaultValue?: unknown
    /** 占位符文本 */
    placeholder?: string
    /** 是否必填 */
    required?: boolean
    /** 是否禁用 */
    disabled?: boolean
    /** select/radio 类型字段的可选项 */
    options?: { label: string; value: string }[]
  }

  /**
   * 表单对话框配置
   *
   * 用于 `showForm(config)` 调用的参数。
   */
  interface FormConfig {
    /** 对话框标题 */
    title: string
    /** 对话框宽度（像素），默认自适应 */
    width?: number
    /** 表单字段列表 */
    fields: FormField[]
  }
}
