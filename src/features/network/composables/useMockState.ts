/**
 * Mock State Composable
 * Manages mock (Map Local) sync to injected script
 */

import { computed } from 'vue'
import type { MockRule } from '@/types/inspector'
import type { NetworkEntry } from '@/types/network'
import { getMockMatchingEntryIds } from './useBreakpointMatching'
import { deepClone } from '../utils'

export interface MockStateOptions {
  sendCommand: (type: string, data?: Record<string, any>) => void
}

/**
 * Composable for mock state management
 */
export function useMockState(
  activeMocks: () => MockRule[],
  options: MockStateOptions,
  entries?: () => NetworkEntry[]
) {
  /**
   * Entry IDs that match any active mock pattern (for highlighting)
   */
  const entriesMatchingMocks = computed<Set<string>>(() => {
    if (!entries) return new Set()
    return getMockMatchingEntryIds(entries(), activeMocks())
  })

  /**
   * Sync mocks to injected script
   */
  function syncMocks() {
    const mocksToSync = activeMocks().map(m => ({
      id: m.id,
      enabled: m.enabled,
      scheme: m.scheme,
      host: m.host,
      port: m.port,
      path: m.path,
      query: m.query,
      method: m.method,
      status: m.status || 200,
      statusText: m.statusText || 'OK',
      headers: m.headers || [],
      // Preserve undefined for no-body mocks, only fallback to '' for null
      body: m.body === undefined ? undefined : (m.body || ''),
      delay: m.delay
    }))

    options.sendCommand('NETWORK_MOCKS_SYNC', {
      mocks: deepClone(mocksToSync)
    })
  }

  return {
    syncMocks,
    entriesMatchingMocks
  }
}
