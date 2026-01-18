/**
 * Extension Runtime Adapter
 * 
 * Реализация RuntimeAdapter для Chrome Extension.
 * Использует реальные chrome.* APIs.
 */

import type { 
  RuntimeAdapter, 
  RuntimeCapabilities, 
  RuntimeStorage,
  Message,
  MessageHandler,
  Unsubscribe 
} from '../types'

class ExtensionStorage implements RuntimeStorage {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key)
      return (result[key] as T) ?? null
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch {
      // Silent fail
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key)
    } catch {
      // Silent fail
    }
  }
}

const MESSAGE_PREFIX = '__VUE_INSPECTOR__'

export class ExtensionAdapter implements RuntimeAdapter {
  readonly id = 'extension'
  
  readonly capabilities: RuntimeCapabilities = {
    hasBackgroundScript: true,
    hasPopup: true,
    canInspectOtherTabs: true,
    hasPersistentStorage: true,
    mode: 'extension'
  }

  readonly storage = new ExtensionStorage()
  
  private messageListeners: Set<MessageHandler> = new Set()
  private windowListener: ((event: MessageEvent) => void) | null = null
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }> = new Map()
  private requestCounter = 0
  
  // Определяем, работаем ли мы в iframe (injected UI) или в popup/devtools
  private isIframe: boolean

  constructor() {
    this.isIframe = window !== window.parent
  }

  getResourceURL(path: string): string {
    return chrome.runtime.getURL(path)
  }

  async sendMessage<T = unknown>(message: Message, timeout = 5000): Promise<T> {
    // Если мы в iframe - используем postMessage к parent (content script)
    if (this.isIframe) {
      return this.sendViaPostMessage<T>(message, timeout)
    }
    
    // Иначе (popup/devtools) - используем chrome.tabs.sendMessage
    return this.sendViaChrome<T>(message, timeout)
  }
  
  private async sendViaPostMessage<T>(message: Message, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
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

      this.ensureWindowListener()

      // Отправляем в parent window (content script)
      window.parent.postMessage({
        [MESSAGE_PREFIX]: true,
        requestId,
        message
      }, '*')
    })
  }
  
  private async sendViaChrome<T>(message: Message, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'))
      }, timeout)

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
          clearTimeout(timeoutId)
          reject(new Error('No active tab'))
          return
        }

        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          clearTimeout(timeoutId)
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response as T)
          }
        })
      })
    })
  }

  onMessage(handler: MessageHandler): Unsubscribe {
    this.messageListeners.add(handler)
    
    if (this.isIframe) {
      this.ensureWindowListener()
    } else {
      this.ensureChromeListener()
    }

    return () => {
      this.messageListeners.delete(handler)
      if (this.messageListeners.size === 0 && this.pendingRequests.size === 0) {
        this.removeWindowListener()
        this.removeChromeListener()
      }
    }
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

      // Incoming broadcast message
      if (data.broadcast && data.message) {
        for (const handler of this.messageListeners) {
          try {
            handler(data.message, () => {})
          } catch (e) {
            console.error('[ExtensionAdapter] Message handler error:', e)
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

  private chromeListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | void) | null = null

  private ensureChromeListener(): void {
    if (this.chromeListener) return
    
    this.chromeListener = (message, _sender, sendResponse) => {
      let handled = false
      for (const h of this.messageListeners) {
        const result = h(message, sendResponse)
        if (result === true) {
          handled = true
        }
      }
      return handled
    }
    chrome.runtime.onMessage.addListener(this.chromeListener)
  }
  
  private removeChromeListener(): void {
    if (this.chromeListener) {
      chrome.runtime.onMessage.removeListener(this.chromeListener)
      this.chromeListener = null
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
    this.removeChromeListener()
    
    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout)
      reject(new Error('Adapter destroyed'))
    }
    this.pendingRequests.clear()
    this.messageListeners.clear()
  }
}

export function createExtensionAdapter(): RuntimeAdapter {
  return new ExtensionAdapter()
}
