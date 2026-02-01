/**
 * Network message handlers
 * Handles network-related messages from UI and injected script
 */

import type { RuntimeHandler } from '../types'

/**
 * Forward network command to injected script
 */
function forwardToInjected(message: any): void {
  window.postMessage({
    ...message,
    __VUE_INSPECTOR__: true,
    __NETWORK_CMD__: true
  }, '*')
}

/**
 * Handle network pause command
 */
export const handleNetworkPause: RuntimeHandler = (message, sender, sendResponse) => {
  forwardToInjected({ type: 'NETWORK_PAUSE' })
  sendResponse({ success: true })
  return true
}

/**
 * Handle network resume command
 */
export const handleNetworkResume: RuntimeHandler = (message, sender, sendResponse) => {
  forwardToInjected({ type: 'NETWORK_RESUME' })
  sendResponse({ success: true })
  return true
}

/**
 * Handle network clear command
 */
export const handleNetworkClear: RuntimeHandler = (message, sender, sendResponse) => {
  forwardToInjected({ type: 'NETWORK_CLEAR' })
  sendResponse({ success: true })
  return true
}

/**
 * Handle network get entries command
 */
export const handleNetworkGetEntries: RuntimeHandler = (message, sender, sendResponse) => {
  forwardToInjected({ type: 'NETWORK_GET_ENTRIES' })
  sendResponse({ success: true })
  return true
}

/**
 * Handle network get status command
 */
export const handleNetworkGetStatus: RuntimeHandler = (message, sender, sendResponse) => {
  forwardToInjected({ type: 'NETWORK_GET_STATUS' })
  sendResponse({ success: true })
  return true
}

/**
 * Handle network config update command
 */
export const handleNetworkConfigUpdate: RuntimeHandler = (message, sender, sendResponse) => {
  forwardToInjected({ type: 'NETWORK_CONFIG_UPDATE', config: message.config })
  sendResponse({ success: true })
  return true
}
