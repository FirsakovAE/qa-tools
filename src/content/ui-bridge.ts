/**
 * UI iframe message bridge
 * Handles communication between content script and UI iframe
 */

import { runtimeHandlers } from './handlers'
import { requestWindow, getExpectedResponseType } from './ipc'
import { uiBridgeInitialized, setUiBridgeInitialized, featureFlags } from './state'

export const UI_MESSAGE_PREFIX = '__VUE_INSPECTOR__'

/**
 * Message handler for UI iframe communication
 */
function uiBridgeMessageHandler(event: MessageEvent): void {
  const data = event.data
  if (!data || typeof data !== 'object') return
  
  // Handle messages from injected script (network events, etc.)
  if (data.__FROM_VUE_INSPECTOR__ && data.__NETWORK__) {
    // Forward network messages to UI iframe
    broadcastToUI(data)
    return
  }
  
  if (!data[UI_MESSAGE_PREFIX]) return
  
  // Check that message is from our iframe (get fresh reference)
  const currentIframe = document.getElementById('vue-inspector-ui') as HTMLIFrameElement | null
  if (!currentIframe?.contentWindow) return
  if (event.source !== currentIframe.contentWindow) return
  
  const requestId = data.requestId
  const message = data.message
  
  if (!message || !message.type) return

  // Handle network commands - forward to injected script
  if (message.__NETWORK_CMD__) {
    window.postMessage({
      ...message,
      __VUE_INSPECTOR__: true,
      __NETWORK_CMD__: true
    }, '*')
    return
  }

  // Get handler from runtimeHandlers
  const handler = runtimeHandlers[message.type]
  
  if (handler) {
    // Create sendResponse function for responding to iframe
    const sendResponse = (response: any) => {
      if (currentIframe?.contentWindow) {
        currentIframe.contentWindow.postMessage({
          [UI_MESSAGE_PREFIX]: true,
          responseId: requestId,
          response
        }, '*')
      }
    }
    
    try {
      // Call handler (sender is fake since this isn't chrome messaging)
      handler(message, {} as chrome.runtime.MessageSender, sendResponse)
    } catch (error) {
      sendResponse({ success: false, error: String(error) })
    }
  } else {
    // No handler - forward to injected script
    const sendResponse = (response: any) => {
      if (currentIframe?.contentWindow) {
        currentIframe.contentWindow.postMessage({
          [UI_MESSAGE_PREFIX]: true,
          responseId: requestId,
          response
        }, '*')
      }
    }
    
    // Forward to injected script and wait for response
    requestWindow(message, getExpectedResponseType(message.type), 5000)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }))
  }
}

/**
 * Setup UI message bridge
 */
export function setupUIMessageBridge(): void {
  if (uiBridgeInitialized) return
  setUiBridgeInitialized(true)
  window.addEventListener('message', uiBridgeMessageHandler)
}

/**
 * Remove UI message bridge
 */
export function removeUIMessageBridge(): void {
  if (!uiBridgeInitialized) return
  setUiBridgeInitialized(false)
  window.removeEventListener('message', uiBridgeMessageHandler)
}

/**
 * Send feature flags to UI iframe
 */
export function sendFlagsToUI(): void {
  const iframe = document.getElementById('vue-inspector-ui') as HTMLIFrameElement
  if (iframe?.contentWindow) {
    // Use new format with __VUE_INSPECTOR__ prefix
    iframe.contentWindow.postMessage({
      [UI_MESSAGE_PREFIX]: true,
      broadcast: true,
      message: {
        type: 'VUE_INSPECTOR_FEATURE_FLAGS',
        flags: featureFlags
      }
    }, '*')
  }
}

/**
 * Send broadcast message to UI iframe
 */
export function broadcastToUI(message: any): void {
  const iframe = document.getElementById('vue-inspector-ui') as HTMLIFrameElement | null
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage({
      [UI_MESSAGE_PREFIX]: true,
      broadcast: true,
      message
    }, '*')
  }
}
