/**
 * When Network "Advanced" capture is enabled, the service worker merges
 * chrome.webRequest headers into NETWORK_ENTRY_UPDATED before the UI sees them.
 */

import type { SendBroadcast } from './message-router'

function isNetworkEntryUpdate(data: any): boolean {
  return (
    data?.__FROM_VUE_INSPECTOR__ &&
    data.__NETWORK__ &&
    data.type === 'NETWORK_ENTRY_UPDATED' &&
    data.entry &&
    typeof data.entry === 'object'
  )
}

/**
 * Async enrich then broadcast. Non-entry network messages pass through synchronously.
 */
export function enrichNetworkBroadcastIfNeeded(data: any, sendToTarget: SendBroadcast): void {
  if (!data?.__NETWORK__) {
    sendToTarget({ broadcast: true, message: data })
    return
  }

  if (!isNetworkEntryUpdate(data)) {
    sendToTarget({ broadcast: true, message: data })
    return
  }

  try {
    if (!chrome?.runtime?.sendMessage) {
      sendToTarget({ broadcast: true, message: data })
      return
    }
  } catch {
    sendToTarget({ broadcast: true, message: data })
    return
  }

  chrome.runtime.sendMessage(
    { type: 'NETWORK_MERGE_WEBREQUEST_HEADERS', entry: data.entry },
    (response) => {
      if (chrome.runtime.lastError) {
        sendToTarget({ broadcast: true, message: data })
        return
      }
      const entry = response?.entry ?? data.entry
      sendToTarget({ broadcast: true, message: { ...data, entry } })
    },
  )
}
