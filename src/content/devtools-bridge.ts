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

import { routeRequest, forwardInjectedBroadcast } from './message-router'
import {
  injectedScriptLoaded,
  setInjectedScriptLoaded,
  resetDetectionState
} from './state'
import { injectScript } from './script-injector'
import { addMessageListenerIfNeeded } from './detection'
import { isExpectedExtensionError } from '@/utils/expectedErrors'

let devtoolsPort: chrome.runtime.Port | null = null
const onDisconnectCleanups: Array<() => void> = []

/**
 * Register a cleanup to run when DevTools panel disconnects (e.g. stop props inspector)
 */
export function registerOnDisconnectCleanup(fn: () => void): void {
  onDisconnectCleanups.push(fn)
}

/**
 * Send a broadcast message to the DevTools panel (e.g. PROPS_INSPECTOR_ELEMENT_SELECTED).
 * Only works when panel is connected via port.
 */
export function sendBroadcastToPanel(msg: { type: string; [key: string]: unknown }): void {
  if (devtoolsPort) {
    try {
      devtoolsPort.postMessage({ broadcast: true, message: msg })
    } catch (e) {
      if (!isExpectedExtensionError(e)) {
        console.error('[content/devtools-bridge] sendBroadcastToPanel failed:', e)
      }
    }
  }
}

export function setupDevtoolsBridge(): void {
  try {
    if (!chrome?.runtime?.id) return
  } catch (error) {
    console.error('[content/devtools-bridge] Chrome runtime not available:', error)
    return
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'devtools') return

    devtoolsPort = port

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
        } catch (error) {
          if (!isExpectedExtensionError(error)) {
            console.error('[content/devtools-bridge] port.postMessage failed:', error)
          }
        }
      }

      routeRequest(message, sendResponse, '[content/devtools-bridge]')
    })

    // Forward broadcasts from injected script to DevTools panel
    const broadcastListener = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return

      forwardInjectedBroadcast(data, (msg) => {
        try {
          port.postMessage(msg)
        } catch (error) {
          if (!isExpectedExtensionError(error)) {
            console.error('[content/devtools-bridge] port.postMessage (broadcast) failed:', error)
          }
        }
      })
    }
    window.addEventListener('message', broadcastListener)

    // DevTools panel closed → clean up injected interception
    port.onDisconnect.addListener(() => {
      devtoolsPort = null
      for (const fn of onDisconnectCleanups) {
        try {
          fn()
        } catch (e) {
          console.error('[content/devtools-bridge] onDisconnect cleanup failed:', e)
        }
      }
      onDisconnectCleanups.length = 0
      window.removeEventListener('message', broadcastListener)

      // Trigger fresh detection so overlay gets correct Vue/Pinia flags when user switches to it
      window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')

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
          if (chrome.runtime.lastError) {
            console.error('[content/devtools-bridge] GET_SETTINGS failed:', chrome.runtime.lastError.message)
            return
          }
          if (!settings || typeof settings !== 'object') return

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
      } catch (error) {
        console.error('[content/devtools-bridge] Failed to restore breakpoints/mocks:', error)
      }
    }, 500)
  })
}
