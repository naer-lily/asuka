export type DropPayload =
  | { kind: 'file'; path: string; name: string; ext: string; size: number; mimeType?: string }
  | { kind: 'text'; content: string }
  | { kind: 'html'; content: string }
  | { kind: 'image'; path: string; width?: number; height?: number }
  | { kind: 'url'; url: string; title?: string }

export interface DragMetadata {
  source: 'drag' | 'clipboard'

  mimeTypes: string[]
  fileCount: number

  hasFiles: boolean
  hasText: boolean
  hasHtml: boolean
  hasImage: boolean
}

export interface CommandDef {
  id: string
  name: string
  icon: string
  submenu?: CommandDef[]
  execute(ctx: ExecuteContext): void | Promise<void>
}

export interface ExecuteContext {
  metadata: DragMetadata
  items: DropPayload[]
  commandId: string
  toast(message: string): void
  showForm(config: FormConfig): Promise<Record<string, unknown> | null>
  log: PluginLogger
  storage: PluginStorage
  companions: CompanionHandle[]
}

export interface PluginContext {
  id: string
  configDir: string
  storageDir: string
  logDir: string
  pluginDir: string
  appVersion: string
}

export interface PluginLogger {
  error(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
}

export interface PluginStorage {
  get<T = unknown>(key: string): T | undefined
  set<T = unknown>(key: string, value: T): void
  delete(key: string): void
  save(): void
}

export interface CompanionConfig {
  type: 'jsonl' | 'http'
  pluginId: string
  command: string
  args?: string[]
  cwd?: string
  port?: number
  healthPath?: string
  startupTimeout?: number
}

export interface CompanionHandle {
  pid: number
  config: CompanionConfig
  url?: string
  send(payload: unknown): void
  onMessage(cb: (payload: unknown) => void): void
  kill(): void
}

export interface IPlugin {
  id: string
  name: string
  icon?: string

  onActivate(ctx: PluginContext): Promise<void>
  onDeactivate(): Promise<void>

  buildDragCommands(meta: DragMetadata): CommandDef[]
  buildClipboardCommands(items: DropPayload[]): CommandDef[]
  buildContextCommands(items: DropPayload[]): CommandDef[]
}

export interface CommandItem {
  id: string
  pluginId: string
  name: string
  icon: string
  submenu?: CommandItem[]
}

export interface FormField {
  type: 'input' | 'number' | 'select' | 'checkbox' | 'radio' | 'switch' | 'textarea' | 'file'
  key: string
  label: string
  defaultValue?: unknown
  placeholder?: string
  required?: boolean
  disabled?: boolean
  options?: { label: string; value: string }[]
}

export interface FormConfig {
  title: string
  width?: number
  fields: FormField[]
}
