/**
 * Core runtime message handlers (PING, FLAGS, COMPONENTS)
 */

import type { RuntimeHandler } from '../types'
import { requestWindow } from '../ipc'
import { featureFlags, detectionCompleted } from '../state'
import { collectVueComponentsFromDOM } from '../utils'

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
 */
export const handleCollectVueComponents: RuntimeHandler = (message, sender, sendResponse) => {
  // PRIORITY: Use window.__VUE_INSPECTOR__ API directly if available
  const inspector = (window as any).__VUE_INSPECTOR__
  if (inspector && typeof inspector.getComponents === 'function') {
    try {
      const components = inspector.getComponents()
      sendResponse({ components: components || [] })
      return true
    } catch {
      // Continue with postMessage as fallback
    }
  }

  // Fallback: Request components via injected script
  requestWindow({ type: 'VUE_INSPECTOR_GET_COMPONENTS' }, 'VUE_INSPECTOR_COMPONENTS_DATA', 3000)
    .then((response: any) => {
      sendResponse({ components: response.components || [] })
    })
    .catch(() => {
      // Try to get components directly from DOM as fallback
      try {
        const components = collectVueComponentsFromDOM()
        sendResponse({ components })
      } catch (error) {
        sendResponse({ components: [], error: String(error) })
      }
    })

  return true // Async response
}
