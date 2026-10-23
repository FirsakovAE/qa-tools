/**
 * Requests of the AI assistant to the live page (relayed by the content script).
 */

import { inspectUi, readStores } from './page-inspect'

const HANDLERS: Record<string, (data: any) => unknown> = {
  VUE_INSPECTOR_AI_INSPECT_UI: data => inspectUi(data),
  VUE_INSPECTOR_AI_READ_STORES: data => readStores(data),
}

let initialized = false

function handleMessage(event: MessageEvent) {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return
  const { type, requestId } = event.data
  const handler = HANDLERS[type]
  if (!handler) return
  let result: unknown
  try {
    result = handler(event.data)
  } catch (e) {
    result = { error: String((e as Error)?.message || e) }
  }
  window.postMessage({ __FROM_VUE_INSPECTOR__: true, type: `${type}_RESULT`, requestId, result }, '*')
}

export function initAiModule(): void {
  if (initialized) return
  initialized = true
  window.addEventListener('message', handleMessage)
}
