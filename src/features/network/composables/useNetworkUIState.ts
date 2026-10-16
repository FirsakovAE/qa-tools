/**
 * Network UI State Composable
 * Persists UI state across tab switches (component unmount/remount)
 * and within a devtools session (in-memory only; not saved to settings).
 */

import { ref, reactive } from 'vue'

// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================

const selectedEntryId = ref<string | null>(null)

export type NetworkDetailsSectionId =
  | 'url'
  | 'params'
  | 'headers'
  | 'request'
  | 'response'
  | 'messages'

/** Last Network details sub-tab (Params, Headers, …) for this session */
const lastNetworkDetailsSection = ref<NetworkDetailsSectionId>('response')

/** Request/response header block collapse state on the Headers tab (session-only) */
const networkHeadersCollapse = reactive({
  pinnedRequest: true,
  pinnedResponse: true,
  request: true,
  response: true,
})

export function resolveNetworkDetailsSection(
  preferred: NetworkDetailsSectionId,
  hasUrlTab: boolean,
  websocket = false,
  editingMessage = false,
): NetworkDetailsSectionId {
  const allowed: NetworkDetailsSectionId[] = editingMessage
    ? ['request']
    : websocket
      ? ['headers', 'messages']
      : hasUrlTab
        ? ['url', 'params', 'headers', 'request', 'response']
        : ['params', 'headers', 'request', 'response']
  if (allowed.includes(preferred)) return preferred
  if (editingMessage) return 'request'
  return websocket ? 'messages' : 'response'
}

/**
 * Composable for Network tab UI state
 */
export function useNetworkUIState() {
  return {
    selectedEntryId,
    lastNetworkDetailsSection,
    networkHeadersCollapse,
  }
}
