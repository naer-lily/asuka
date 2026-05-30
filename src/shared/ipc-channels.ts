export const IPC = {
  EXPAND_MENU: 'asuka:expand-menu',
  COLLAPSE: 'asuka:collapse',
  MOVE_TO: 'asuka:move-to',

  DRAG_ENTER: 'asuka:drag-enter',
  DRAG_LEAVE: 'asuka:drag-leave',
  DROP_EXECUTE: 'asuka:drop-execute',
  CLICK_EXECUTE: 'asuka:click-execute',
  BLUR: 'asuka:blur',
  BUBBLE_CONTEXT: 'asuka:bubble-context',
  DRAG_START: 'asuka:drag-start',
  DRAG_MOVE: 'asuka:drag-move',
  SUBMENU_OPEN: 'asuka:submenu-open',
  SUBMENU_CLOSE: 'asuka:submenu-close',
  SUBMENU_STATE: 'asuka:submenu-state',

  TOAST: 'asuka:toast',
  LOG: 'asuka:log',
  GET_CONFIG: 'asuka:get-config',
  SET_CONFIG: 'asuka:set-config',
  THEME_CHANGED: 'asuka:theme-changed',
  CONFIG_CHANGED: 'asuka:config-changed',

  OPEN_SETTINGS: 'asuka:open-settings',
  RELOAD_PLUGINS: 'asuka:reload-plugins',
  RESET_BUBBLE: 'asuka:reset-bubble'
} as const
