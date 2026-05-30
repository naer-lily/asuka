const ITEM_HEIGHT = 44
const MENU_PADDING = 24
const MENU_MAX_H = 360

export function ts(): string {
  return new Date().toISOString().slice(11, 23)
}

export function computeMenuHeight(itemCount: number): number {
  const count = itemCount || 1
  return Math.min(count * ITEM_HEIGHT + MENU_PADDING, MENU_MAX_H)
}

export function clampMenuBounds(
  proposedX: number,
  proposedY: number,
  menuW: number,
  menuH: number,
  screenW: number,
  screenH: number
): { x: number; y: number } {
  let x = proposedX
  let y = proposedY

  if (x + menuW > screenW) x = screenW - menuW - 8
  if (y + menuH > screenH) y = screenH - menuH - 8
  if (x < 8) x = 8
  if (y < 8) y = 8

  return { x: Math.round(x), y: Math.round(y) }
}
