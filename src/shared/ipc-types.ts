export type DropPayload =
  | { kind: 'file'; path: string; name: string; ext: string; size: number; mimeType?: string }
  | { kind: 'text'; content: string }
  | { kind: 'html'; content: string }
  | { kind: 'image'; path: string; width?: number; height?: number }
  | { kind: 'url'; url: string; title?: string }

export interface DropReportPayload {
  items: DropPayload[]
  command: string | null
}

export interface ExpandMenuPayload {
  commands: {
    id: string
    pluginId: string
    name: string
    icon: string
  }[]
  source: 'drag' | 'clipboard' | 'context'
}

export interface ClickExecutePayload {
  commandId: string
}
