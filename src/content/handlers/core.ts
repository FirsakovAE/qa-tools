/**
 * Core runtime message handlers (PING, FLAGS, COMPONENTS)
 */

import type { RuntimeHandler } from '../types'
import { requestWindow } from '../ipc'
import { featureFlags, detectionCompleted } from '../state'
import { collectVueComponentsFromDOM } from '../utils'

// Inline check - content script cannot use ES modules (no import from shared chunks)
function isExpectedExtensionError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '')
  return (
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('Extension context invalidated') ||
    msg.includes('disconnected port') ||
    msg.includes('Attempting to use a disconnected port') ||
    msg.includes('Port disconnected') ||
    msg === 'Timeout' ||
    msg.includes('Message timeout')
  )
}

/**
 * PING handler - responds with ready status
 */
export const handlePing: RuntimeHandler = (message, sender, sendResponse) => {
  sendResponse({ pong: true, ready: true })
  return true
}

/**
 * GET_FLAGS / VUE_INSPECTOR_GET_FLAGS handler
 */
export const handleGetFlags: RuntimeHandler = (message, sender, sendResponse) => {
  // If flags already obtained - return immediately
  if (detectionCompleted) {
    sendResponse({
      type: 'VUE_INSPECTOR_FEATURE_FLAGS',
      flags: featureFlags
    })
    return true
  }
  
  // Otherwise request from injected script and respond later
  window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*')
  
  // Wait for detection result
  const checkInterval = setInterval(() => {
    if (detectionCompleted) {
      clearInterval(checkInterval)
      sendResponse({
        type: 'VUE_INSPECTOR_FEATURE_FLAGS',
        flags: featureFlags
      })
    }
  }, 100)
  
  // Timeout after 3 seconds
  setTimeout(() => {
    clearInterval(checkInterval)
    if (!detectionCompleted) {
      sendResponse({
        type: 'VUE_INSPECTOR_FEATURE_FLAGS',
        flags: { hasVue: false, hasPinia: false, vueVersion: null }
      })
    }
  }, 3000)
  
  return true // Async response
}

/**
 * GET_COMPONENTS handler
 */
export const handleGetComponents: RuntimeHandler = (message, sender, sendResponse) => {
  const inspector = (window as any).__VUE_INSPECTOR__
  sendResponse({ components: inspector?.getComponents?.() || [] })
  return true
}

/**
 * COLLECT_VUE_COMPONENTS handler
 * Uses lightweight format (no serialized props) to avoid 64MB port.postMessage limit.
 * Props loaded on-demand via GET_COMPONENT_PROPS when user selects a component.
 */
export const handleCollectVueComponents: RuntimeHandler = (message, sender, sendResponse) => {
  const forceRefresh = !!(message as any).forceRefresh
  const blacklist = (message as any).blacklist as { active: string[]; inactive: string[] } | undefined
  const rootElementUid = (message as any).rootElementUid as number | undefined

  requestWindow(
    { type: 'VUE_INSPECTOR_GET_COMPONENTS', forceRefresh, blacklist, rootElementUid },
    'VUE_INSPECTOR_COMPONENTS_DATA',
    3000
  )
    .then((response: any) => {
      sendResponse({ components: response.components || [] })
    })
    .catch((err) => {
      if (!isExpectedExtensionError(err)) {
        console.error('[content/handlers/core] requestWindow for components failed:', err)
      }
      // Try to get components directly from DOM as fallback
      try {
        const components = collectVueComponentsFromDOM()
        sendResponse({ components })
      } catch (error) {
        console.error('[content/handlers/core] collectVueComponentsFromDOM fallback failed:', error)
        sendResponse({ components: [], error: String(error) })
      }
    })

  return true // Async response
}
