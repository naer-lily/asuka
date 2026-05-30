# Asuka

桌面悬浮球 — 拖文件到球上自动展开命令菜单，松手触发插件。复制文件/文本后在鼠标旁弹出菜单，点击执行；失焦即收拢。

无需全局鼠标钩子。无需搜索栏。无需 WebView。

## 交互

| 场景 | 操作 | 结果 |
|------|------|------|
| 拖文件到球 | 从文件管理器拖拽 | 球展开为菜单 → 拖到菜单项松手 → 插件执行 |
| 拖文本到球 | 从浏览器选中拖拽 | 同上 |
| 复制文件/文本 | Ctrl+C | 菜单在鼠标旁展开 → 点击菜单项 → 插件执行 |
| 子菜单导航 | 拖放悬停或点击带 ▶ 的菜单项 | 子菜单在右侧（或左侧）展开，斜向导航有防抖 |
| 右键悬浮球 | 右键点击 | 展开右键菜单 |
| 拖动悬浮球 | 左键按住拖动 | 移动球到任意位置 |

## 技术栈

Electron + electron-vite + Vue 3 + TypeScript

## 开发

```bash
npm install
npm run dev      # 开发模式
npm run build    # 编译
npm run package  # 打包 (portable zip)
```

## 架构

```
src/main/          Electron 主进程
  index.ts           入口 + 应用生命周期
  bubble-window.ts   悬浮窗管理（创建/展开/收拢/移动/子菜单）
  ipc-handlers.ts    IPC 事件处理（拖放/点击/右键/子菜单）
  clipboard-monitor.ts 剪贴板监控
  tray.ts            系统托盘
src/preload/       contextBridge — 向渲染进程暴露 IPC API
src/renderer/      Vue 3 SPA — 悬浮球 UI（双栏子菜单布局）
src/shared/        共享类型与常量
```

## License

MIT
