/**
 * DevTools panel bridge
 * Handles port-based communication between the DevTools panel and content script.
 * Replaces the postMessage-based ui-bridge when the panel runs inside DevTools.
 *
 * Lifecycle:
 *  - DevTools opens → port connects → inject scripts, set up forwarding
 *  - DevTools closes → port disconnects → clean up interception
 *  - Page reloads → content script is destroyed (port auto-disconnects),
 *    DevTools panel reconnects to the new content script instance
 */

import { runtimeHandlers } from './handlers'
import { requestWindow, getExpectedResponseType } from './ipc'
import {
  injectedScriptLoaded,
  setInjectedScriptLoaded,
  featureFlags,
  resetDetectionState
} from './state'
import { injectScript } from './script-injector'
import { addMessageListenerIfNeeded } from './detection'

export function setupDevtoolsBridge(): void {
  try {
    if (!chrome?.runtime?.id) return
  } catch {
    return
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'devtools') return

    // Inject detection script if not loaded yet
    if (!injectedScriptLoaded) {
      injectScript()
      setInjectedScriptLoaded(true)
    }
    addMessageListenerIfNeeded()

    // Handle request/response messages from DevTools panel
    port.onMessage.addListener((data: any) => {
      const { requestId, message } = data
      if (!message?.type) return

      const sendResponse = (response: any) => {
        try {
          port.postMessage({ responseId: requestId, response })
        } catch {}
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
          sendResponse({ success: false, error: String(error) })
        }
      } else {
        requestWindow(message, getExpectedResponseType(message.type), 5000)
          .then(sendResponse)
          .catch((err: Error) => sendResponse({ error: err.message }))
      }
    })

    // Forward broadcasts from injected script to DevTools panel
    const broadcastListener = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return

      // Network events from injected script
      if (data.__FROM_VUE_INSPECTOR__ && data.__NETWORK__) {
        try {
          port.postMessage({ broadcast: true, message: data })
        } catch {}
        return
      }

      // Detection results → send feature flags broadcast
      if (data.__FROM_VUE_INSPECTOR__ && data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
        try {
          port.postMessage({
            broadcast: true,
            message: {
              type: 'VUE_INSPECTOR_FEATURE_FLAGS',
              flags: featureFlags
            }
          })
        } catch {}
        return
      }

      // Props/Pinia ready → send both formats
      if (data.__FROM_VUE_INSPECTOR__ && (
        data.type === 'VUE_INSPECTOR_PROPS_READY' ||
        data.type === 'VUE_INSPECTOR_PINIA_READY'
      )) {
        try {
          port.postMessage({
            broadcast: true,
            message: {
              type: 'VUE_INSPECTOR_FEATURE_FLAGS',
              flags: featureFlags
            }
          })
          port.postMessage({
            broadcast: true,
            message: data
          })
        } catch {}
      }
    }
    window.addEventListener('message', broadcastListener)

    // DevTools panel closed → clean up injected interception
    port.onDisconnect.addListener(() => {
      window.removeEventListener('message', broadcastListener)

      // Clear active breakpoints and mocks so the injected interceptor stops
      window.postMessage({
        type: 'NETWORK_BREAKPOINTS_SYNC',
        breakpoints: [],
        __VUE_INSPECTOR__: true,
        __NETWORK_CMD__: true
      }, '*')
      window.postMessage({
        type: 'NETWORK_MOCKS_SYNC',
        mocks: [],
        __VUE_INSPECTOR__: true,
        __NETWORK_CMD__: true
      }, '*')
    })

    // Trigger initial detection
    resetDetectionState()
    window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')

    // Restore breakpoints and mocks from settings after a short delay
    // (injected network bridge needs time to initialize)
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
          if (chrome.runtime.lastError || !settings || typeof settings !== 'object') return

          const activeBps = settings.breakpoints?.active
          if (Array.isArray(activeBps) && activeBps.length > 0) {
            const bps = activeBps.map((bp: any) => ({
              id: bp.id, scheme: bp.scheme, host: bp.host,
              port: bp.port, path: bp.path, query: bp.query,
              trigger: bp.trigger, method: bp.method, enabled: true
            }))
            window.postMessage({
              type: 'NETWORK_BREAKPOINTS_SYNC',
              breakpoints: bps,
              __VUE_INSPECTOR__: true,
              __NETWORK_CMD__: true
            }, '*')
          }

          const activeMocks = settings.mocks?.active
          if (Array.isArray(activeMocks) && activeMocks.length > 0) {
            const mocks = activeMocks.map((m: any) => ({
              id: m.id, enabled: true, scheme: m.scheme,
              host: m.host, port: m.port, path: m.path,
              query: m.query, method: m.method,
              status: m.status || 200, statusText: m.statusText || 'OK',
              headers: m.headers || [], body: m.body,
              delay: m.delay
            }))
            window.postMessage({
              type: 'NETWORK_MOCKS_SYNC',
              mocks: mocks,
              __VUE_INSPECTOR__: true,
              __NETWORK_CMD__: true
            }, '*')
          }
        })
      } catch {}
    }, 500)
  })
}
