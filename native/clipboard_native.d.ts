declare module 'clipboard_native' {
  export function start(onChange: () => void): void
  export function stop(): void
  export function getFilePaths(): string[]
}
