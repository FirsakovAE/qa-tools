/**
 * Standalone Runtime Adapter
 * 
 * Реализация RuntimeAdapter для standalone режима (без расширения).
 * Использует postMessage для коммуникации, localStorage для storage.
 */

import type { 
  RuntimeAdapter, 
  RuntimeCapabilities, 
  RuntimeStorage,
  Message,
  MessageHandler,
  Unsubscribe 
} from '../types'

const STORAGE_KEY = '__vue_inspector_storage__'
const MESSAGE_PREFIX = '__VUE_INSPECTOR__'

class StandaloneStorage implements RuntimeStorage {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const data = stored ? JSON.parse(stored) : {}
      return (data[key] as T) ?? null
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const data = stored ? JSON.parse(stored) : {}
      data[key] = value
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Silent fail
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const data = stored ? JSON.parse(stored) : {}
      delete data[key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Silent fail
    }
  }
}

export interface StandaloneAdapterConfig {
  /** Base URL для загрузки ресурсов */
  baseURL: string
  /** Целевое окно для postMessage (для iframe UI) */
  targetWindow?: Window
  /** Origin для postMessage */
  targetOrigin?: string
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

  readonly storage = new StandaloneStorage()
  
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
  }

  getResourceURL(path: string): string {
    const base = this.config.baseURL.replace(/\/$/, '')
    return `${base}/${path}`
  }

  async sendMessage<T = unknown>(message: Message, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const requestId = `req_${++this.requestCounter}_${Date.now()}`
        
        console.log('[StandaloneAdapter] Sending message:', message.type, 'requestId:', requestId)
        
        const timeoutId = setTimeout(() => {
          console.log('[StandaloneAdapter] Message timeout:', message.type, requestId)
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
        console.log('[StandaloneAdapter] Posting to target:', target === window.parent ? 'window.parent' : 'custom')
        target.postMessage({
          [MESSAGE_PREFIX]: true,
          requestId,
          message
        }, this.config.targetOrigin!)
        console.log('[StandaloneAdapter] postMessage completed for:', message.type)
      } catch (err) {
        console.error('[StandaloneAdapter] Error in sendMessage:', err)
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

      console.log('[StandaloneAdapter] Received message with prefix, responseId:', data.responseId, 'hasPending:', this.pendingRequests.has(data.responseId))

      // Response to our request
      if (data.responseId && this.pendingRequests.has(data.responseId)) {
        const pending = this.pendingRequests.get(data.responseId)!
        this.pendingRequests.delete(data.responseId)
        clearTimeout(pending.timeout)
        
        console.log('[StandaloneAdapter] Resolving request:', data.responseId, 'response:', data.response)
        
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
            console.error('[Standalone] Message handler error:', e)
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
            console.error('[Standalone] Message handler error:', e)
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
