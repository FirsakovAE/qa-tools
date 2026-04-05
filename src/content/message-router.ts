/**
 * Shared message routing logic for ui-bridge and devtools-bridge.
 * Handles request routing (handlers, requestWindow) and broadcast forwarding.
 */

import { runtimeHandlers } from './handlers'
import { requestWindow, getExpectedResponseType } from './ipc'
import { featureFlags } from './state'
import { enrichNetworkBroadcastIfNeeded } from './network-header-enrichment'

export type SendResponse = (response: any) => void

/** Local UI commands — handled by content script (inspector-ui), no injected script response */
const LOCAL_UI_COMMANDS = new Set(['EXPAND_INSPECTOR'])

/**
 * Route an incoming request: handle __NETWORK_CMD__, handler lookup, or forward to injected script.
 */
export function routeRequest(
  message: any,
  sendResponse: SendResponse,
  logPrefix = '[content]'
): void {
  // Local UI commands — no-op, ack immediately (inspector-ui sentinel handles EXPAND_INSPECTOR)
  if (LOCAL_UI_COMMANDS.has(message.type)) {
    sendResponse({ success: true })
    return
  }

  // Network commands → forward to injected script, ack immediately
  if (message.__NETWORK_CMD__) {
    window.postMessage({
      ...message,
      __VUE_INSPECTOR__: true,
      __NETWORK_CMD__: true
    }, '*')
    sendResponse({ success: true })
    return
  }

  const handler = runtimeHandlers[message.type]

  if (handler) {
    try {
      handler(message, {} as chrome.runtime.MessageSender, sendResponse)
    } catch (error) {
      console.error(`${logPrefix} Handler error for`, message.type, error)
      sendResponse({ success: false, error: String(error) })
    }
  } else {
    requestWindow(message, getExpectedResponseType(message.type), 5000)
      .then(sendResponse)
      .catch((err: Error) => {
        console.error(`${logPrefix} requestWindow failed for`, message.type, err)
        sendResponse({ error: err.message })
      })
  }
}

export type SendBroadcast = (msg: { broadcast: boolean; message: any }) => void

/**
 * Handle broadcast messages from injected script.
 * For DevTools: forwards network, detection, props/pinia to the target.
 * For UI iframe: only network is forwarded here (detection is handled by detection.ts → sendFlagsToUI).
 */
export function forwardInjectedBroadcast(
  data: any,
  sendToTarget: SendBroadcast,
  options: { onlyNetwork?: boolean } = {}
): boolean {
  if (!data.__FROM_VUE_INSPECTOR__) return false

  if (data.__NETWORK__) {
    enrichNetworkBroadcastIfNeeded(data, sendToTarget)
    return true
  }

  if (options.onlyNetwork) return false

  // Detection results → send feature flags broadcast
  if (data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
    sendToTarget({
      broadcast: true,
      message: { type: 'VUE_INSPECTOR_FEATURE_FLAGS', flags: featureFlags }
    })
    return true
  }

  // Props/Pinia ready → send both flags and original
  if (data.type === 'VUE_INSPECTOR_PROPS_READY' || data.type === 'VUE_INSPECTOR_PINIA_READY') {
    sendToTarget({
      broadcast: true,
      message: { type: 'VUE_INSPECTOR_FEATURE_FLAGS', flags: featureFlags }
    })
    sendToTarget({ broadcast: true, message: data })
    return true
  }

  return false
}
