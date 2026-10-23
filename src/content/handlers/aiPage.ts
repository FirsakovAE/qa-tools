/**
 * Live page for the AI assistant: UI elements, their components and the stores. The data is
 * read by the injected script, which sees the Vue instances of the page.
 */

import type { RuntimeHandler } from '../types'
import { requestWindow } from '../ipc'

const TIMEOUT_MS = 5000

function relay(type: string): RuntimeHandler {
  return (message, _sender, sendResponse) => {
    const { type: _type, ...args } = message
    requestWindow<{ result?: unknown }>({ ...args, type }, `${type}_RESULT`, TIMEOUT_MS)
      .then(response => sendResponse(response.result ?? { error: 'Empty response from the page' }))
      .catch(error => sendResponse({ error: error?.message === 'Timeout' ? 'The page did not answer (the inspector script is not loaded or the page is busy)' : String(error?.message || error) }))
    return true
  }
}

export const handleAiInspectUi = relay('VUE_INSPECTOR_AI_INSPECT_UI')
export const handleAiReadStores = relay('VUE_INSPECTOR_AI_READ_STORES')
