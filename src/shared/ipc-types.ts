import type { DropPayload, CommandItem, DragMetadata } from '@shared/plugin-api'

export type { DropPayload, CommandItem, DragMetadata }

export interface DropReportPayload {
  items: DropPayload[]
  command: string | null
}

export interface ExpandMenuPayload {
  commands: CommandItem[]
  source: 'drag' | 'clipboard' | 'context'
}

export interface ClickExecutePayload {
  commandId: string
}
