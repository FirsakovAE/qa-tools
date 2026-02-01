/**
 * Network UI State Composable
 * Persists UI state across tab switches (component unmount/remount)
 */

import { ref } from 'vue'

// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================

const selectedEntryId = ref<string | null>(null)

/**
 * Composable for Network tab UI state
 */
export function useNetworkUIState() {
  return {
    selectedEntryId
  }
}
