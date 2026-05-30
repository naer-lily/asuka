<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const PARENT_SWITCH_MS = 300
const BUBBLE_LEAVE_MS = 100

interface CommandItem {
  id: string
  pluginId: string
  name: string
  icon: string
  submenu?: CommandItem[]
}

const expanded = ref(false)
const dragHover = ref(false)
const source = ref<'drag' | 'clipboard' | 'context'>('drag')
const commands = ref<CommandItem[]>([])
const activeSubmenuId = ref<string | null>(null)
const submenuOnLeft = ref(false)

const activeSubmenu = computed(() => {
  if (!activeSubmenuId.value) return null
  return findCommand(commands.value, activeSubmenuId.value)
})

function findCommand(list: CommandItem[], id: string): CommandItem | null {
  for (const item of list) {
    if (item.id === id) return item
    if (item.submenu) {
      const found = findCommand(item.submenu, id)
      if (found) return found
    }
  }
  return null
}

function findParent(list: CommandItem[], id: string): CommandItem | null {
  for (const item of list) {
    if (item.submenu?.some(c => c.id === id)) return item
  }
  return null
}

let isDragging = false
let dragStartX = 0
let dragStartY = 0

let unsubExpand: (() => void) | undefined
let unsubCollapse: (() => void) | undefined
let unsubSubmenuState: (() => void) | undefined

function ts(): string {
  return new Date().toISOString().slice(11, 23)
}

function getMenuStyle(): Record<string, string> {
  if (!expanded.value) return {}
  const count = commands.value.length || 5
  const height = Math.min(count * 44 + 24, 360)
  return { height: `${height}px` }
}

function clearItemHighlights(): void {
  const items = document.querySelectorAll('.menu-item')
  items.forEach(i => i.classList.remove('drag-over'))
}

function highlightItem(el: HTMLElement): void {
  clearItemHighlights()
  const item = el.closest?.('.menu-item')
  if (item) item.classList.add('drag-over')
}

function openSubmenu(cmdId: string): void {
  if (activeSubmenuId.value === cmdId) return
  const wasOpen = !!activeSubmenuId.value
  activeSubmenuId.value = cmdId
  if (!wasOpen) {
    window.asukaAPI?.openSubmenu()
  }
}

function closeSubmenu(): void {
  if (!activeSubmenuId.value) return
  cancelParentSwitch()
  activeSubmenuId.value = null
  submenuOnLeft.value = false
  window.asukaAPI?.closeSubmenu()
}

// -- drag mode handlers --
// Drag submenu: only close when drag leaves the window entirely (global dragleave with relatedTarget === null).
// onItemDragEnter opens/closes submenu based on which parent item is hovered.

function onItemDragEnter(e: DragEvent): void {
  highlightItem(e.target as HTMLElement)
  const el = (e.target as HTMLElement)?.closest?.('.menu-item') as HTMLElement | null
  if (!el) return

  const cmdId = el.dataset.command
  if (!cmdId || cmdId === pendingParentId) return

  const cmd = findCommand(commands.value, cmdId)
  cancelParentSwitch()
  pendingParentId = cmdId

  if (cmd?.submenu && cmd.submenu.length > 0) {
    if (activeSubmenuId.value !== cmdId) {
      if (!activeSubmenuId.value) {
        openSubmenu(cmdId)
      } else {
        parentSwitchTimer = setTimeout(() => {
          openSubmenu(cmdId)
        }, PARENT_SWITCH_MS)
      }
    }
  } else {
    if (activeSubmenuId.value) {
      parentSwitchTimer = setTimeout(() => {
        closeSubmenu()
      }, PARENT_SWITCH_MS)
    }
  }
}

function onItemDragLeave(e: DragEvent): void {
  const el = (e.target as HTMLElement)?.closest?.('.menu-item')
  if (!el) return
  const related = e.relatedTarget as HTMLElement | null
  if (related && el.contains(related)) return
  el.classList.remove('drag-over')
}

// -- click / clipboard mode handlers --
// mouseenter on parent items drives submenu visibility, but with a 100ms debounce.
// Entering the submenu zone cancels the debounce, so diagonal mouse moves
// that briefly cross other parent items don't close the submenu.

let parentSwitchTimer: ReturnType<typeof setTimeout> | null = null
let pendingParentId: string | null = null
let bubbleLeaveTimer: ReturnType<typeof setTimeout> | null = null

function cancelParentSwitch(): void {
  if (parentSwitchTimer) {
    clearTimeout(parentSwitchTimer)
    parentSwitchTimer = null
  }
  pendingParentId = null
}

function cancelBubbleLeave(): void {
  if (bubbleLeaveTimer) {
    clearTimeout(bubbleLeaveTimer)
    bubbleLeaveTimer = null
  }
}

function onParentItemMouseEnter(cmdId: string): void {
  if (cmdId === pendingParentId) return

  const cmd = findCommand(commands.value, cmdId)
  cancelParentSwitch()
  pendingParentId = cmdId

  if (cmd?.submenu && cmd.submenu.length > 0) {
    if (activeSubmenuId.value !== cmdId) {
      if (!activeSubmenuId.value) {
        openSubmenu(cmdId)
      } else {
        parentSwitchTimer = setTimeout(() => {
          openSubmenu(cmdId)
        }, PARENT_SWITCH_MS)
      }
    }
  } else {
    if (activeSubmenuId.value) {
      parentSwitchTimer = setTimeout(() => {
        closeSubmenu()
      }, PARENT_SWITCH_MS)
    }
  }
}

function onSubmenuZoneEnter(): void {
  cancelParentSwitch()
  cancelBubbleLeave()
}

function onSubmenuItemDragEnter(e: DragEvent): void {
  highlightItem(e.target as HTMLElement)
  onSubmenuZoneEnter()
}

// -- click handlers --

function onClickItem(commandId: string): void {
  const cmd = findCommand(commands.value, commandId)
  if (cmd?.submenu) {
    if (activeSubmenuId.value === commandId) {
      closeSubmenu()
    } else {
      openSubmenu(commandId)
    }
    return
  }

  if (activeSubmenuId.value) {
    const parent = findParent(commands.value, commandId)
    if (parent) {
      // eslint-disable-next-line no-console
      console.log(`[${ts()}] [ui] click submenu-item ${parent.id}/${commandId}`)
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[${ts()}] [ui] click menu-item commandId=${commandId}`)
  window.asukaAPI?.reportClick(commandId)
}

function onBubbleMouseLeave(): void {
  if ((source.value !== 'clipboard' && source.value !== 'context') || !expanded.value) return
  cancelBubbleLeave()
  bubbleLeaveTimer = setTimeout(() => {
    closeSubmenu()
    window.asukaAPI?.reportBlur()
  }, BUBBLE_LEAVE_MS)
}

function onBubbleMouseEnter(): void {
  cancelBubbleLeave()
  // placeholder
}

function onContextMenu(e: MouseEvent): void {
  if (expanded.value) return
  e.preventDefault()
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
    activeSubmenuId.value = null
    submenuOnLeft.value = false
    cancelParentSwitch()
    cancelBubbleLeave()
  })

  unsubCollapse = api?.onCollapse(() => {
    expanded.value = false
    dragHover.value = false
    activeSubmenuId.value = null
    submenuOnLeft.value = false
    cancelParentSwitch()
    clearItemHighlights()
  })

  unsubSubmenuState = api?.onSubmenuState((state) => {
    submenuOnLeft.value = state.onLeft
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
      cancelBubbleLeave()
      bubbleLeaveTimer = setTimeout(() => {
        dragHover.value = false
        clearItemHighlights()
        closeSubmenu()
        api?.reportDragLeave()
      }, BUBBLE_LEAVE_MS)
    }
  })

  document.addEventListener('drop', (e) => {
    e.preventDefault()
    e.stopPropagation()

    dragHover.value = false
    clearItemHighlights()
    closeSubmenu()

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
      const cmdId = target.dataset.command
      if (cmdId) {
        const cmd = findCommand(commands.value, cmdId)
        if (cmd && !cmd.submenu) {
          command = cmdId
        }
      }
    }

    api?.reportDrop({ items, command })
  })
})

onUnmounted(() => {
  unsubExpand?.()
  unsubCollapse?.()
  unsubSubmenuState?.()
})
</script>

<template>
  <div
    class="bubble"
    :class="{ expanded, 'drag-hover': dragHover, 'submenu-left': submenuOnLeft }"
    :style="getMenuStyle()"
    @mouseenter="onBubbleMouseEnter"
    @mouseleave="onBubbleMouseLeave"
    @mousedown="onMouseDown"
    @contextmenu.prevent="onContextMenu"
  >
    <div v-if="!expanded" class="bubble-icon">&#x1F31F;</div>

    <div v-if="expanded" class="menu-body">
      <!-- Submenu on LEFT (when screen-right insufficient) -->
      <div
        v-if="activeSubmenu && submenuOnLeft"
        class="submenu-column submenu-left-col"
        @mouseenter="onSubmenuZoneEnter"
        @dragenter.prevent="onSubmenuZoneEnter"
      >
        <div
          v-for="sitem in activeSubmenu.submenu"
          :key="sitem.id"
          class="menu-item submenu-item"
          :data-command="sitem.id"
          @mouseenter="onSubmenuZoneEnter"
          @dragenter.prevent="onSubmenuItemDragEnter($event)"
          @dragleave.prevent
          @dragover.prevent
          @click.stop="onClickItem(sitem.id)"
        >
          <span class="item-icon">{{ sitem.icon }}</span>
          <span class="item-label">{{ sitem.name }}</span>
          <span class="item-hint">{{ source === 'drag' ? 'drop' : 'click' }}</span>
        </div>
      </div>

      <!-- Main parent menu column -->
      <div class="main-column">
        <div
          v-for="item in commands"
          :key="item.id"
          class="menu-item"
          :class="{ 'has-submenu': !!item.submenu?.length, 'submenu-active': activeSubmenuId === item.id }"
          :data-command="item.id"
          @dragenter.prevent="onItemDragEnter($event)"
          @dragleave.prevent="onItemDragLeave($event)"
          @dragover.prevent
          @mouseenter="onParentItemMouseEnter(item.id)"
          @click.stop="onClickItem(item.id)"
        >
          <span class="item-icon">{{ item.icon }}</span>
          <span class="item-label">{{ item.name }}</span>
          <span v-if="item.submenu?.length" class="item-arrow">{{ submenuOnLeft ? '&#9664;' : '&#9654;' }}</span>
          <span v-else class="item-hint">{{ source === 'drag' ? 'drop' : 'click' }}</span>
        </div>
      </div>

      <!-- Submenu on RIGHT (default) -->
      <div
        v-if="activeSubmenu && !submenuOnLeft"
        class="submenu-column submenu-right-col"
        @mouseenter="onSubmenuZoneEnter"
        @dragenter.prevent="onSubmenuZoneEnter"
      >
        <div
          v-for="sitem in activeSubmenu.submenu"
          :key="sitem.id"
          class="menu-item submenu-item"
          :data-command="sitem.id"
          @mouseenter="onSubmenuZoneEnter"
          @dragenter.prevent="onSubmenuItemDragEnter($event)"
          @dragleave.prevent
          @dragover.prevent
          @click.stop="onClickItem(sitem.id)"
        >
          <span class="item-icon">{{ sitem.icon }}</span>
          <span class="item-label">{{ sitem.name }}</span>
          <span class="item-hint">{{ source === 'drag' ? 'drop' : 'click' }}</span>
        </div>
      </div>
    </div>

    <div v-if="expanded" class="status">Asuka v0.0.0</div>
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
  --bg-submenu: rgba(0, 0, 0, 0.2);
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
  cursor: default;
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

.menu-body {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.bubble.expanded .menu-body {
  opacity: 1;
  transform: translateY(0);
}

.main-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.submenu-column {
  width: 176px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-submenu);
  border-radius: 6px;
}

.submenu-right-col {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.submenu-left-col {
  margin-right: 8px;
  padding-right: 8px;
  border-right: 1px solid var(--border);
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
  white-space: nowrap;
}

.menu-item:hover {
  background: var(--bg-item-hover);
}

.menu-item.drag-over {
  background: var(--bg-item-hover);
  outline: 1.5px solid var(--accent);
  outline-offset: -1px;
}

.menu-item.submenu-active {
  background: var(--bg-item-hover);
}

.menu-item .item-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.menu-item .item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-item .item-hint {
  font-size: 10px;
  color: var(--text-dim);
}

.menu-item .item-arrow {
  font-size: 10px;
  color: var(--text-dim);
}

.submenu-item {
  font-size: 12px;
  padding: 8px 10px;
}

.submenu-item .item-icon {
  font-size: 16px;
  width: 20px;
}

.status {
  padding: 4px 12px 8px;
  font-size: 10px;
  color: var(--text-dim);
  width: 100%;
  text-align: center;
}
</style>
