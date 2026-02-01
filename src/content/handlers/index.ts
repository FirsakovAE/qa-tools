/**
 * Runtime message handlers registry
 */

import type { RuntimeHandler } from '../types'

// Core handlers
import {
  handlePing,
  handleGetFlags,
  handleGetComponents,
  handleCollectVueComponents
} from './core'

// Props handlers
import {
  handleUnhighlightElement,
  handleHighlightElement,
  handleHighlightElementByElement,
  handleHighlightByUid,
  handleClearElementRegistry,
  handleUpdateComponentProps,
  handleGetComponentProps
} from './props'

// Pinia handlers
import {
  handlePiniaGetStoresSummary,
  handlePiniaGetStoreState,
  handlePiniaBuildSearchIndex,
  handlePiniaPatchState,
  handlePiniaReplaceState,
  handlePiniaPatchGetters,
  handlePiniaCallAction
} from './pinia'

// Network handlers
import {
  handleNetworkPause,
  handleNetworkResume,
  handleNetworkClear,
  handleNetworkGetEntries,
  handleNetworkGetStatus,
  handleNetworkConfigUpdate
} from './network'

/**
 * Runtime handlers map - message type to handler function
 */
export const runtimeHandlers: Record<string, RuntimeHandler> = {
  // Core
  PING: handlePing,
  VUE_INSPECTOR_GET_FLAGS: handleGetFlags,
  GET_FEATURE_FLAGS: handleGetFlags, // Alias
  GET_COMPONENTS: handleGetComponents,
  COLLECT_VUE_COMPONENTS: handleCollectVueComponents,
  
  // Props / Highlight
  UNHIGHLIGHT_ELEMENT: handleUnhighlightElement,
  HIGHLIGHT_BY_UID: handleHighlightByUid,
  HIGHLIGHT_ELEMENT: handleHighlightElement, // Legacy support
  HIGHLIGHT_ELEMENT_BY_ELEMENT: handleHighlightElementByElement, // Deprecated
  CLEAR_ELEMENT_REGISTRY: handleClearElementRegistry,
  UPDATE_COMPONENT_PROPS: handleUpdateComponentProps,
  GET_COMPONENT_PROPS: handleGetComponentProps,
  
  // Pinia
  PINIA_GET_STORES_SUMMARY: handlePiniaGetStoresSummary,
  PINIA_GET_STORE_STATE: handlePiniaGetStoreState,
  PINIA_BUILD_SEARCH_INDEX: handlePiniaBuildSearchIndex,
  PINIA_PATCH_STATE: handlePiniaPatchState,
  PINIA_REPLACE_STATE: handlePiniaReplaceState,
  PINIA_PATCH_GETTERS: handlePiniaPatchGetters,
  PINIA_CALL_ACTION: handlePiniaCallAction,
  
  // Network
  NETWORK_PAUSE: handleNetworkPause,
  NETWORK_RESUME: handleNetworkResume,
  NETWORK_CLEAR: handleNetworkClear,
  NETWORK_GET_ENTRIES: handleNetworkGetEntries,
  NETWORK_GET_STATUS: handleNetworkGetStatus,
  NETWORK_CONFIG_UPDATE: handleNetworkConfigUpdate
}

/**
 * Setup Chrome runtime message listener
 */
export function setupRuntimeMessageListener(): void {
  try {
    if (!chrome?.runtime?.id) return
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = runtimeHandlers[message?.type]

      if (!handler) {
        sendResponse({ received: true })
        return true
      }

      try {
        return handler(message, sender, sendResponse) ?? true
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
        return true
      }
    })
  } catch {
    // Extension context not available
  }
}
