import { isExpectedExtensionError } from './expectedErrors'

// Safe guards for extension context
export function safeRuntime(): typeof chrome.runtime | null {
  try {
    if (!chrome?.runtime?.id) return null
    return chrome.runtime
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeRuntime failed:', e)
    return null
  }
}

export function safeStorage(): typeof chrome.storage.local | null {
  try {
    if (!chrome?.storage?.local) return null
    return chrome.storage.local
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeStorage failed:', e)
    return null
  }
}

export function safeTabs(): typeof chrome.tabs | null {
  try {
    if (!chrome?.tabs) return null
    return chrome.tabs
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeTabs failed:', e)
    return null
  }
}

// Safe async operations
export async function safeSet(key: string, value: any) {
  try {
    const storage = safeStorage()
    if (!storage) return
    await storage.set({ [key]: value })
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeSet failed:', key, e)
  }
}

export async function safeGet(key: string): Promise<any> {
  try {
    const storage = safeStorage()
    if (!storage) return null
    const result = await storage.get(key)
    return result[key]
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeGet failed:', key, e)
    return null
  }
}

export async function safeSendMessage(message: any): Promise<any> {
  try {
    const runtime = safeRuntime()
    if (!runtime) return null
    return await runtime.sendMessage(message)
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeSendMessage failed:', message?.type, e)
    return null
  }
}

export async function safeSendTabMessage(tabId: number, message: any): Promise<any> {
  try {
    const tabs = safeTabs()
    if (!tabs) return null
    return await tabs.sendMessage(tabId, message)
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] safeSendTabMessage failed:', tabId, message?.type, e)
    return null
  }
}

// URL validation
export function isInjectableUrl(url?: string): boolean {
  return !!url && (
    url.startsWith('http://') ||
    url.startsWith('https://')
  )
}

// Content script health check
export async function isContentScriptAlive(tabId: number): Promise<boolean> {
  try {
    const response = await safeSendTabMessage(tabId, { type: 'PING' })
    return response?.alive === true
  } catch (e) {
    if (!isExpectedExtensionError(e)) console.error('[utils/extensionBridge] isContentScriptAlive failed:', tabId, e)
    return false
  }
}