/**
 * DevTools Panel Runtime Adapter
 *
 * Communicates with the content script via chrome.tabs.connect port.
 * Automatically reconnects when the inspected page reloads.
 */

import { isExpectedExtensionError } from '@/utils/expectedErrors'
import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeStorage,
  Message,
  MessageHandler,
  Unsubscribe
} from '../types'

class DevtoolsStorage implements RuntimeStorage {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key)
      return (result[key] as T) ?? null
    } catch (e) {
      console.error('[runtime/devtools] DevtoolsStorage.get failed:', key, e)
      return null
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (e) {
      console.error('[runtime/devtools] DevtoolsStorage.set failed:', key, e)
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key)
    } catch (e) {
      console.error('[runtime/devtools] DevtoolsStorage.remove failed:', key, e)
    }
  }
}

export class DevtoolsAdapter implements RuntimeAdapter {
  readonly id = 'devtools'

  readonly capabilities: RuntimeCapabilities = {
    hasBackgroundScript: true,
    hasPopup: false,
    canInspectOtherTabs: false,
    hasPersistentStorage: true,
    mode: 'extension'
  }

  readonly storage = new DevtoolsStorage()

  private port!: chrome.runtime.Port
  private portMessageHandler!: (data: any) => void
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }> = new Map()
  private messageListeners: Set<MessageHandler> = new Set()
  private requestCounter = 0
  private destroyed = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private hasConnectedOnce = false
  private portDisconnected = false

  constructor(private tabId: number) {
    this.portMessageHandler = this.handlePortMessage.bind(this)
    this.connect()
  }

  private connect(): void {
    this.portDisconnected = false
    try {
      this.port = chrome.tabs.connect(this.tabId, { name: 'devtools' })
    } catch (e) {
      if (!isExpectedExtensionError(e)) console.error('[runtime/devtools] connect failed:', this.tabId, e)
      this.scheduleReconnect()
      return
    }

    const isReconnect = this.hasConnectedOnce
    this.hasConnectedOnce = true

    this.port.onMessage.addListener(this.portMessageHandler)

    this.port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError
      this.portDisconnected = true
      for (const { timeout, reject } of this.pendingRequests.values()) {
        clearTimeout(timeout)
        reject(new Error('Port disconnected'))
      }
      this.pendingRequests.clear()
      this.scheduleReconnect()
    })

    // On reconnect, notify UI so components can re-fetch data.
    // Delayed so the devtools-bridge has time to inject scripts and run detection.
    if (isReconnect) {
      setTimeout(() => {
        if (this.destroyed) return
        window.postMessage({
          __VUE_INSPECTOR__: true,
          broadcast: true,
          message: { type: 'DEVTOOLS_RECONNECTED' }
        }, '*')
      }, 1500)
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.destroyed) return
      this.connect()
    }, 500)
  }

  private handlePortMessage(data: any): void {
    if (this.destroyed) return

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

    if (data.broadcast && data.message) {
      const msg = data.message

      for (const handler of this.messageListeners) {
        try {
          handler(msg, () => {})
        } catch (e) {
          console.error('[runtime/devtools] message handler failed:', e)
        }
      }

      // Broadcast format for window.addEventListener handlers
      window.postMessage({
        __VUE_INSPECTOR__: true,
        broadcast: true,
        message: msg
      }, '*')

      // Direct format for __FROM_VUE_INSPECTOR__ handlers
      if (msg.__FROM_VUE_INSPECTOR__) {
        window.postMessage(msg, '*')
      }
    }
  }

  getResourceURL(path: string): string {
    return chrome.runtime.getURL(path)
  }

  getManifest(): chrome.runtime.Manifest {
    return chrome.runtime.getManifest()
  }

  async sendMessage<T = unknown>(message: Message, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.destroyed) {
        reject(new Error('Adapter destroyed'))
        return
      }
      if (this.portDisconnected) {
        reject(new Error('Port disconnected'))
        return
      }

      const requestId = `devtools_${++this.requestCounter}_${Date.now()}`

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Message timeout'))
      }, timeout)

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId
      })

      try {
        this.port.postMessage({ requestId, message })
      } catch (err) {
        this.pendingRequests.delete(requestId)
        clearTimeout(timeoutId)
        reject(err)
      }
    })
  }

  onMessage(handler: MessageHandler): Unsubscribe {
    this.messageListeners.add(handler)
    return () => {
      this.messageListeners.delete(handler)
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
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    try {
      this.port.disconnect()
    } catch (e) {
      if (!isExpectedExtensionError(e)) console.error('[runtime/devtools] port.disconnect failed:', e)
    }

    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout)
      reject(new Error('Adapter destroyed'))
    }
    this.pendingRequests.clear()
    this.messageListeners.clear()
  }
}

export function createDevtoolsAdapter(tabId: number): RuntimeAdapter {
  return new DevtoolsAdapter(tabId)
}
