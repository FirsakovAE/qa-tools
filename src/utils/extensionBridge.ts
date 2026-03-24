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
