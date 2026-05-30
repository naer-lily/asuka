# Asuka — Agent Instructions

## What this is

A desktop app (Electron) that stays as a floating bubble. Drag files to it → it expands into a command menu → drop on a menu item triggers a plugin. Also expands on clipboard change (Ctrl+C).

**Current state**: designed, PoC-validated, not yet implemented. The real project will be built with **electron-vite + TypeScript + Vue 3**. The `poc/` directory is a throwaway plain-JS validation, not the codebase.

## Source of truth

[`asuka-design.md`](asuka-design.md) — complete spec. Read it first. Architecture, interaction scripts, plugin API, every technical decision is there.

## Hard-won technical findings (do not repeat these mistakes)

1. **OLE drag-and-drop on Windows**: `transparent:true` (layered window) DOES receive OLE `dragenter`/`drop` events. What blocks it is `win.setIgnoreMouseEvents(true, {forward:true})` — that adds `WS_EX_TRANSPARENT` which skips OLE hit-test entirely. So: `transparent:true` yes, `setIgnoreMouseEvents` no.

2. **Global mouse hook approach (electron-dragfile-plugin) is dead**. It detects *any* mouse drag (window resize, text selection, etc.) — cannot distinguish content drag from ordinary mouse movement. The bubble window's own `dragenter` event is the correct sensor because Chromium only fires it when OLE/HTML5 drag data is present.

3. **Full-screen transparent sensor window is dead**. Even with `transparent:true`, you can't make it "click-through" without `setIgnoreMouseEvents`, which kills OLE. A full-screen window without event forwarding blocks all mouse input.

4. **The bubble approach (3rd attempt) is the one that works**: small always-visible window, `transparent:true`, `focusable:false`, no `setIgnoreMouseEvents`. Drag enters → CSS expand to menu. Drop → execute → collapse.

5. **File paths from `dataTransfer.files[i].path`**: available when dragging from Windows Explorer. May be empty when dragging from apps like VSCode (they use custom drag formats). Design assumes paths may be absent; plugins self-validate.

6. **Clipboard detection is event-driven via native addon**: uses `AddClipboardFormatListener` (hidden message-only window → `WM_CLIPBOARDUPDATE` → Napi::ThreadSafeFunction callback). Replaces the old polling+PowerShell approach. `native/build/Release/clipboard_native.node` reads `CF_HDROP` directly via `GetClipboardData` + `DragQueryFileW`. Fallback: if `.node` fails to load, clipboard monitoring is silently disabled.

7. **`BrowserWindow.getBounds()` 在 Windows DPI 混插时返回设备像素**。例如 150% DPI 下窗口是 56×56 逻辑像素，`getBounds()` 返回 84×84。如果把这个值原样传给 `setBounds()`，它会按逻辑像素解释 → 窗口每帧放大。**解决方案**：拖拽/重设窗口时用常量尺寸（56×56 或 240×320），永远不要从 `getBounds()` 取宽高传给 `setBounds()`。

## Reference project

`D:\DESKTOP\AGENT_WORKSPACES\futari` — production Electron app with a mature plugin system. Borrow from it:
- esbuild runtime TS compilation for plugins (`Module._extensions['.ts']` hook)
- PluginHost patterns (load/unload/scan, try-catch per plugin, `activateBuiltin`)
- CompanionManager (jsonl via stdin/stdout, http via port allocation + health check)
- PluginStorage (KV → `~/.asuka/storage/{pluginId}.json`, debounced writes)
- Logger with per-plugin log files (`~/.asuka/logs/{pluginId}.log`)
- Local type package distribution (`types/package.json` with `file:` protocol)

Do NOT copy: search engine, WebView, form dialogs, prefix matching, auto-activate — those are out of scope for Asuka.

## Dev commands

```bash
# Build native addon
npm run build:native

# Dev server (auto-builds native addon)
npm run dev

# Production build (auto-builds native addon)  
npm run build

# Type check
npm run typecheck
```

## Architecture rules

- **Main process holds all logic**. The Vue renderer is a passive UI layer: receives command lists, renders DOM, reports events back to main via IPC. No state machine in the renderer.
- **No `electron-dragfile-plugin`**. No global mouse hooks.
- **One window, two modes**: collapsed bubble (56×56 circle) and expanded menu (240×N panel). Same BrowserWindow, CSS transition.
- **Plugins run in the main process** with full Node.js access. No sandbox. Same trust model as VSCode extensions.
- **`execute()` always collapses the menu** — success or failure. Never gets stuck half-expanded.

## File conventions

- TypeScript everywhere (main, preload, renderer).
- Plugins: `*.ts` with default export of `IPlugin`. Runtime-compiled via esbuild, no build step.
- Config: `~/.asuka/config.json`, single file read via `ConfigManager`.
- Plugin data: `~/.asuka/storage/{pluginId}.json`, managed by `PluginStorage` (debounced JSON writes).
- IPC channel constants: `src/shared/ipc-channels.ts`.
- Shared types: `src/shared/plugin-api.ts`. Type package: `types/`.

## Phased plan (from design doc section 十二)

Only proceed through phases sequentially; earlier phases are hard dependencies.

| Phase | Scope | Key deliverable |
|-------|-------|-----------------|
| 1 | electron-vite project + bubble window + drag/drop | Ball expands on drag, drops output file info |
| 2 | Clipboard monitoring + toast | Ctrl+C files → menu at cursor → click to execute |
| 3 | Full plugin system | PluginHost, companion, storage, built-in plugins |
| 4 | Tray, settings, config persistence | Complete desktop app |
| 5 | electron-builder, auto-update | Distributable installer |

## Known gotchas

- The bubble must be **pre-created** (not created on demand) — OLE `IDropTarget` registers at window creation time.
- `focusable: false` does NOT prevent OLE drop target registration.
- When switching to clipboard mode, call `win.setFocusable(true)`. On blur, collapse and reset to `false`.
- `dataTransfer.items` is more reliable than `dataTransfer.files` for detecting drag content types.
- DPI scaling: use `screen.getDisplayNearestPoint()` for multi-monitor positioning, not `screen.getPrimaryDisplay()`.
