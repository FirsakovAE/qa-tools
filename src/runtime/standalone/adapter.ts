/**
 * Standalone Runtime Adapter
 *
 * Реализация RuntimeAdapter для standalone режима (без расширения).
 * Использует postMessage для коммуникации.
 *
 * Storage:
 *   StorageClient   — communicates with hidden storage iframe (central-store IndexedDB)
 *   sessionStorage  — synchronous preload cache (survives F5)
 */

import type { 
  RuntimeAdapter, 
  RuntimeCapabilities, 
  RuntimeStorage,
  Message,
  MessageHandler,
  Unsubscribe 
} from '../types'
import type { StorageClient } from '@/storage/storage-client'

const STORAGE_KEY = '__vue_inspector_storage__'
const MESSAGE_PREFIX = '__VUE_INSPECTOR__'

function sessionGet<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    const data = stored ? JSON.parse(stored) : {}
    return (data[key] as T) ?? null
  } catch {
    return null
  }
}

function sessionSet(key: string, value: unknown): void {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    const data = stored ? JSON.parse(stored) : {}
    data[key] = value
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* quota / private mode */ }
}

function sessionRemove(key: string): void {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    const data = stored ? JSON.parse(stored) : {}
    delete data[key]
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* silent */ }
}

class StandaloneStorage implements RuntimeStorage {
  constructor(private client: StorageClient) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = await this.client.getSettings(key) as T | null
      if (value !== null) {
        sessionSet(key, value)
      }
      return value
    } catch {
      return sessionGet<T>(key)
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    sessionSet(key, value)
    await this.client.setSettings(value, key)
  }

  async remove(key: string): Promise<void> {
    sessionRemove(key)
    await this.client.removeSettings(key)
  }
}

export interface StandaloneAdapterConfig {
  /** Base URL для загрузки ресурсов */
  baseURL: string
  /** Целевое окно для postMessage (для iframe UI) */
  targetWindow?: Window
  /** Origin для postMessage */
  targetOrigin?: string
  /** StorageClient for central-store IndexedDB */
  storageClient: StorageClient
}

export class StandaloneAdapter implements RuntimeAdapter {
  readonly id = 'standalone'
  
  readonly capabilities: RuntimeCapabilities = {
    hasBackgroundScript: false,
    hasPopup: false,
    canInspectOtherTabs: false,
    hasPersistentStorage: true,
    mode: 'standalone'
  }

  readonly storage: RuntimeStorage
  
  private config: StandaloneAdapterConfig
  private messageListeners: Set<MessageHandler> = new Set()
  private windowListener: ((event: MessageEvent) => void) | null = null
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }> = new Map()
  private requestCounter = 0

  constructor(config: StandaloneAdapterConfig) {
    this.config = {
      targetOrigin: '*',
      ...config
    }
    this.storage = new StandaloneStorage(config.storageClient)
  }

  getResourceURL(path: string): string {
    const base = this.config.baseURL.replace(/\/$/, '')
    return `${base}/${path}`
  }

  getManifest(): chrome.runtime.Manifest {
    // Mock manifest for standalone mode
    return {
      manifest_version: 3,
      name: 'Vue Inspector (Standalone)',
      version: '1.0.0',
      description: 'Standalone version of Vue Inspector',
      action: {
        default_title: 'Vue Inspector'
      }
    } as chrome.runtime.Manifest
  }

  async sendMessage<T = unknown>(message: Message, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const requestId = `req_${++this.requestCounter}_${Date.now()}`

        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId)
          reject(new Error('Message timeout'))
        }, timeout)

        this.pendingRequests.set(requestId, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timeout: timeoutId
        })

        // Ensure listener is active
        this.ensureWindowListener()

        // Send to target window (content script listens on main window)
        const target = this.config.targetWindow || window.parent
        target.postMessage({
          [MESSAGE_PREFIX]: true,
          requestId,
          message
        }, this.config.targetOrigin!)
      } catch (err) {
        reject(err)
      }
    })
  }

  onMessage(handler: MessageHandler): Unsubscribe {
    this.messageListeners.add(handler)
    this.ensureWindowListener()

    return () => {
      this.messageListeners.delete(handler)
      if (this.messageListeners.size === 0 && this.pendingRequests.size === 0) {
        this.removeWindowListener()
      }
    }
  }

  onReady(callback: () => void): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback)
    } else {
      callback()
    }
  }

  destroy(): void {
    this.removeWindowListener()
    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout)
      reject(new Error('Adapter destroyed'))
    }
    this.pendingRequests.clear()
    this.messageListeners.clear()
  }

  private ensureWindowListener(): void {
    if (this.windowListener) return

    this.windowListener = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (!data[MESSAGE_PREFIX]) return

      // Response to our request
      if (data.responseId && this.pendingRequests.has(data.responseId)) {
        const pending = this.pendingRequests.get(data.responseId)!
        this.pendingRequests.delete(data.responseId)
        clearTimeout(pending.timeout)

        if (data.error) {
          pending.reject(new Error(data.error))
        } else {
          pending.resolve(data.response)
        }
        return
      }

      // Incoming message (broadcast)
      if (data.broadcast) {
        for (const handler of this.messageListeners) {
          try {
            handler(data.message, () => {
              // Broadcasts don't expect response
            })
          } catch (e) {
            // Ignore handler errors
          }
        }
        return
      }

      // Incoming request (needs response)
      if (data.requestId && data.message) {
        const sendResponse = (response: unknown) => {
          const source = event.source as Window
          if (source) {
            source.postMessage({
              [MESSAGE_PREFIX]: true,
              responseId: data.requestId,
              response
            }, this.config.targetOrigin!)
          }
        }

        for (const handler of this.messageListeners) {
          try {
            const result = handler(data.message, sendResponse)
            if (result === true) {
              // Async response - handler will call sendResponse
              return
            }
          } catch (e) {
            // Ignore handler errors
          }
        }
      }
    }

    window.addEventListener('message', this.windowListener)
  }

  private removeWindowListener(): void {
    if (this.windowListener) {
      window.removeEventListener('message', this.windowListener)
      this.windowListener = null
    }
  }
}

export function createStandaloneAdapter(config: StandaloneAdapterConfig): RuntimeAdapter {
  return new StandaloneAdapter(config)
}
