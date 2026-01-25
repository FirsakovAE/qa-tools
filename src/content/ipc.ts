/**
 * Window IPC utilities for communication with injected script
 */

/**
 * Universal async IPC with injected script via postMessage
 */
export function requestWindow<T>(
  request: any,
  responseType: string,
  timeout = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2)
    let timeoutId: number | null = null

    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        typeof event.data === 'object' &&
        event.data !== null &&
        event.data.type === responseType &&
        event.data.requestId === requestId
      ) {
        cleanup()
        resolve(event.data as T)
      }
    }

    const cleanup = () => {
      window.removeEventListener('message', handler)
      if (timeoutId) clearTimeout(timeoutId)
    }

    window.addEventListener('message', handler)
    window.postMessage({ ...request, requestId }, '*')

    timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timeout'))
    }, timeout)
  })
}

/**
 * Mapping of request types to expected response types for injected script
 */
const RESPONSE_TYPE_MAP: Record<string, string> = {
  'COLLECT_VUE_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
  'VUE_INSPECTOR_GET_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
  'VUE_INSPECTOR_GET_COMPONENT_PROPS': 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
  'VUE_INSPECTOR_UPDATE_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
  'UPDATE_COMPONENT_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
  'PINIA_GET_STORES_SUMMARY': 'PINIA_STORES_SUMMARY_DATA',
  'PINIA_GET_STORE_STATE': 'PINIA_STORE_STATE_DATA',
  'PINIA_PATCH_STATE': 'PINIA_PATCH_STATE_RESULT',
  'PINIA_REPLACE_STATE': 'PINIA_REPLACE_STATE_RESULT',
  'PINIA_PATCH_GETTERS': 'PINIA_PATCH_GETTERS_RESULT',
  'PINIA_CALL_ACTION': 'PINIA_CALL_ACTION_RESULT',
  'PINIA_CHECK_DETECTED': 'PINIA_DETECTED_RESULT',
  'PINIA_BUILD_SEARCH_INDEX': 'PINIA_SEARCH_INDEX_READY',
  'VUE_INSPECTOR_GET_FLAGS': 'VUE_INSPECTOR_DETECTION_RESULT',
  'VUE_INSPECTOR_CHECK_VUE': 'VUE_INSPECTOR_DETECTION_RESULT'
}

/**
 * Get expected response type for a request type
 */
export function getExpectedResponseType(requestType: string): string {
  return RESPONSE_TYPE_MAP[requestType] || requestType + '_RESULT'
}
