/**
 * Pinia-related runtime message handlers
 */

import type { RuntimeHandler } from '../types'
import { requestWindow } from '../ipc'

/**
 * PINIA_GET_STORES_SUMMARY handler
 */
export const handlePiniaGetStoresSummary: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({ type: 'PINIA_GET_STORES_SUMMARY' }, 'PINIA_STORES_SUMMARY_DATA', 2000)
    .then((response: any) => {
      const result = {
        type: 'PINIA_STORES_SUMMARY_DATA',
        summary: response.summary || {},
        detected: response.detected || false,
        error: response.error
      }
      // Forward to background for popup
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      // Return via sendResponse for UI iframe
      sendResponse(result)
    })
    .catch((error) => {
      const result = {
        type: 'PINIA_STORES_SUMMARY_DATA',
        summary: {},
        detected: false,
        error: error.message
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })

  return true
}

/**
 * PINIA_GET_STORE_STATE handler
 */
export const handlePiniaGetStoreState: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({
    type: 'PINIA_GET_STORE_STATE',
    storeId: message.storeId
  }, 'PINIA_STORE_STATE_DATA', 2000)
    .then((response: any) => {
      const result = {
        type: 'PINIA_STORE_STATE_DATA',
        storeId: response.storeId,
        state: response.state,
        getters: response.getters,
        error: response.error
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })
    .catch(() => {
      const result = {
        type: 'PINIA_STORE_STATE_DATA',
        storeId: message.storeId,
        state: null,
        error: 'Timeout'
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })

  return true
}

/**
 * PINIA_BUILD_SEARCH_INDEX handler
 */
export const handlePiniaBuildSearchIndex: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({ type: 'PINIA_BUILD_SEARCH_INDEX' }, 'PINIA_SEARCH_INDEX_READY', 2000)
    .then((response: any) => {
      const result = {
        type: 'PINIA_SEARCH_INDEX_READY',
        index: response.index || [],
        error: response.error
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })
    .catch(() => {
      const result = {
        type: 'PINIA_SEARCH_INDEX_READY',
        index: [],
        error: 'Timeout'
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })

  return true
}

/**
 * PINIA_PATCH_STATE handler
 */
export const handlePiniaPatchState: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({
    type: 'PINIA_PATCH_STATE',
    storeId: message.storeId,
    path: message.path,
    value: message.value
  }, 'PINIA_PATCH_STATE_RESULT', 2000)
    .then((response: any) => {
      const result = {
        type: 'PINIA_PATCH_STATE_RESULT',
        storeId: response.storeId,
        path: response.path,
        success: response.success,
        error: response.error
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })
    .catch(() => {
      sendResponse({ type: 'PINIA_PATCH_STATE_RESULT', success: false, error: 'Timeout' })
    })

  return true
}

/**
 * PINIA_REPLACE_STATE handler
 */
export const handlePiniaReplaceState: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({
    type: 'PINIA_REPLACE_STATE',
    storeId: message.storeId,
    newState: message.newState
  }, 'PINIA_REPLACE_STATE_RESULT', 2000)
    .then((response: any) => {
      const result = {
        type: 'PINIA_REPLACE_STATE_RESULT',
        storeId: response.storeId,
        success: response.success,
        error: response.error
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })
    .catch(() => {
      sendResponse({ type: 'PINIA_REPLACE_STATE_RESULT', success: false, error: 'Timeout' })
    })

  return true
}

/**
 * PINIA_PATCH_GETTERS handler
 */
export const handlePiniaPatchGetters: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({
    type: 'PINIA_PATCH_GETTERS',
    storeId: message.storeId,
    newGetters: message.newGetters
  }, 'PINIA_PATCH_GETTERS_RESULT', 2000)
    .then((response: any) => {
      const result = {
        type: 'PINIA_PATCH_GETTERS_RESULT',
        storeId: response.storeId,
        success: response.success,
        updated: response.updated,
        overridden: response.overridden,
        error: response.error
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })
    .catch(() => {
      sendResponse({ type: 'PINIA_PATCH_GETTERS_RESULT', success: false, error: 'Timeout' })
    })

  return true
}

/**
 * PINIA_CALL_ACTION handler
 */
export const handlePiniaCallAction: RuntimeHandler = (message, sender, sendResponse) => {
  requestWindow({
    type: 'PINIA_CALL_ACTION',
    storeId: message.storeId,
    actionName: message.actionName,
    args: message.args || []
  }, 'PINIA_CALL_ACTION_RESULT', 5000) // 5 seconds for actions (may take longer)
    .then((response: any) => {
      const result = {
        type: 'PINIA_CALL_ACTION_RESULT',
        storeId: response.storeId,
        actionName: response.actionName,
        success: response.success,
        result: response.result,
        error: response.error
      }
      try { chrome.runtime?.sendMessage?.(result) } catch {}
      sendResponse(result)
    })
    .catch(() => {
      sendResponse({ type: 'PINIA_CALL_ACTION_RESULT', success: false, error: 'Timeout' })
    })

  return true
}
