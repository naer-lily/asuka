import type { AsukaAPI } from './index'

declare global {
  interface Window {
    asukaAPI: AsukaAPI
  }
}
