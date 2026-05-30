<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface CommandItem {
  id: string
  pluginId: string
  name: string
  icon: string
}

const expanded = ref(false)
const dragHover = ref(false)
const source = ref<'drag' | 'clipboard' | 'context'>('drag')

const commands = ref<CommandItem[]>([])

let isDragging = false
let dragStartX = 0
let dragStartY = 0

let unsubExpand: (() => void) | undefined
let unsubCollapse: (() => void) | undefined

function ts(): string {
  return new Date().toISOString().slice(11, 23)
}

function getMenuStyle(): Record<string, string> {
  if (!expanded.value) return {}
  const count = commands.value.length || 5
  const height = Math.min(count * 44 + 24, 360)
  return { height: `${height}px` }
}

function targetLabel(el: EventTarget | null): string {
  if (!el) return 'null'
  const e = el as HTMLElement
  const tag = e.tagName?.toLowerCase() || '?'
  const cls = e.className?.toString?.() || ''
  const id = e.id || ''
  return id ? `${tag}#${id}` : cls ? `${tag}.${cls}` : tag
}

function clearItemHighlights(): void {
  const items = document.querySelectorAll('.menu-item')
  items.forEach(i => i.classList.remove('drag-over'))
}

function onItemDragEnter(e: DragEvent): void {
  const el = (e.target as HTMLElement)?.closest?.('.menu-item')
  if (!el) return
  clearItemHighlights()
  el.classList.add('drag-over')
}

function onItemDragLeave(e: DragEvent): void {
  const el = (e.target as HTMLElement)?.closest?.('.menu-item')
  if (!el) return
  const related = e.relatedTarget as HTMLElement | null
  if (related && el.contains(related)) return
  el.classList.remove('drag-over')
}

function onClickItem(commandId: string, _event: MouseEvent): void {
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [ui] click menu-item commandId=${commandId}`)
  window.asukaAPI?.reportClick(commandId)
}

function onBubbleMouseLeave(): void {
  if ((source.value !== 'clipboard' && source.value !== 'context') || !expanded.value) return
  window.asukaAPI?.reportBlur()
}

function onBubbleMouseEnter(): void {
  // placeholder for future use
}

function onContextMenu(e: MouseEvent): void {
  if (expanded.value) return
  e.preventDefault()
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [ui] contextmenu at (${e.screenX},${e.screenY})`)
  window.asukaAPI?.reportContextMenu(e.screenX, e.screenY)
}

function onMouseDown(e: MouseEvent): void {
  if (expanded.value) return
  if (e.button !== 0) return
  e.preventDefault()
  isDragging = true
  dragStartX = e.screenX
  dragStartY = e.screenY
  window.asukaAPI?.reportDragStart(e.screenX, e.screenY)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging) return
  if (e.screenX === dragStartX && e.screenY === dragStartY) return
  dragStartX = e.screenX
  dragStartY = e.screenY
  window.asukaAPI?.reportDragMove(e.screenX, e.screenY)
}

function onMouseUp(): void {
  isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onMounted(() => {
  const api = window.asukaAPI

  unsubExpand = api?.onExpand((payload) => {
    expanded.value = true
    source.value = payload.source
    commands.value = payload.commands
  })

  unsubCollapse = api?.onCollapse(() => {
    expanded.value = false
    dragHover.value = false
    clearItemHighlights()
  })

  document.addEventListener('dragenter', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isDragging) return
    dragHover.value = true
    if (!expanded.value) {
      api?.reportDragEnter()
    }
  })

  document.addEventListener('dragover', (e) => {
    e.preventDefault()
  })

  document.addEventListener('dragleave', (e) => {
    e.preventDefault()
    if (e.relatedTarget === null) {
      dragHover.value = false
      clearItemHighlights()
      api?.reportDragLeave()
    }
  })

  document.addEventListener('drop', (e) => {
    e.preventDefault()
    e.stopPropagation()

    dragHover.value = false
    clearItemHighlights()

    const dt = e.dataTransfer
    if (!dt) return

    const items: {
      kind: 'file'
      path: string
      name: string
      ext: string
      size: number
      mimeType?: string
    }[] = []

    if (dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const f = dt.files[i]
        const extMatch = f.name.match(/\.([^.]+)$/)
        items.push({
          kind: 'file',
          path: f.path || '',
          name: f.name,
          ext: extMatch ? `.${extMatch[1]}` : '',
          size: f.size,
          mimeType: f.type || undefined
        })
      }
    }

    const text = dt.getData('text/plain')
    if (text) items.push({ kind: 'text', content: text })

    const html = dt.getData('text/html')
    if (html) items.push({ kind: 'html', content: html })

    const url = dt.getData('text/uri-list')
    if (url) items.push({ kind: 'url', url })

    let command: string | null = null
    const target = (e.target as HTMLElement)?.closest?.('.menu-item')
    if (target instanceof HTMLElement) {
      command = target.dataset.command ?? null
    }

    api?.reportDrop({ items, command })
  })
})

onUnmounted(() => {
  unsubExpand?.()
  unsubCollapse?.()
})
</script>

<template>
  <div
    class="bubble"
    :class="{ expanded, 'drag-hover': dragHover }"
    :style="getMenuStyle()"
    @mouseenter="onBubbleMouseEnter"
    @mouseleave="onBubbleMouseLeave"
    @mousedown="onMouseDown"
    @contextmenu.prevent="onContextMenu"
  >
    <div v-if="!expanded" class="bubble-icon">&#x1F31F;</div>

    <div v-if="expanded" class="menu-items">
      <div
        v-for="item in commands"
        :key="item.id"
        class="menu-item"
        :data-command="item.id"
        @dragenter.prevent="onItemDragEnter($event)"
        @dragleave.prevent="onItemDragLeave($event)"
        @dragover.prevent
        @click.stop="onClickItem(item.id, $event)"
      >
        <span class="item-icon">{{ item.icon }}</span>
        <span class="item-label">{{ item.name }}</span>
        <span class="item-hint">{{ source === 'drag' ? 'drop' : 'click' }}</span>
      </div>
    </div>

    <div v-if="expanded" class="status">Asuka v0.1.0</div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-panel: #1e1e2e;
  --bg-item: rgba(255, 255, 255, 0.04);
  --bg-item-hover: rgba(100, 180, 255, 0.12);
  --text: #cdd6f4;
  --text-dim: #6c7086;
  --border: rgba(255, 255, 255, 0.08);
  --accent: #89b4fa;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  border-radius: 0;
  font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
  user-select: none;
}

.bubble {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-panel);
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition:
    border-radius 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.bubble:active {
  cursor: grabbing;
}

.bubble.drag-hover {
  outline: 3px solid rgba(137, 180, 250, 0.4);
  outline-offset: -3px;
}

.bubble.expanded {
  border-radius: 12px;
  flex-direction: column;
  justify-content: flex-start;
  padding: 8px;
  width: 100%;
  min-height: 120px;
}

.bubble-icon {
  font-size: 24px;
  opacity: 0.85;
  transition: opacity 0.2s;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.bubble.expanded .menu-items {
  opacity: 1;
  transform: translateY(0);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  transition: background 0.12s;
  cursor: default;
}

.menu-item:hover {
  background: var(--bg-item-hover);
}

.menu-item.drag-over {
  background: var(--bg-item-hover);
  outline: 1.5px solid var(--accent);
  outline-offset: -1px;
}

.menu-item .item-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.menu-item .item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-item .item-hint {
  font-size: 10px;
  color: var(--text-dim);
}

.status {
  padding: 4px 12px 8px;
  font-size: 10px;
  color: var(--text-dim);
  width: 100%;
  text-align: center;
}
</style>
