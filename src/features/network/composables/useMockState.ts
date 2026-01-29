/**
 * Mock State Composable
 * Manages mock (Map Local) sync to injected script
 */

import type { MockRule } from '@/types/inspector'
import { deepClone } from '../utils'

export interface MockStateOptions {
  sendCommand: (type: string, data?: Record<string, any>) => void
}

/**
 * Composable for mock state management
 */
export function useMockState(
  activeMocks: () => MockRule[],
  options: MockStateOptions
) {
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
      body: m.body || '',
      delay: m.delay
    }))

    options.sendCommand('NETWORK_MOCKS_SYNC', {
      mocks: deepClone(mocksToSync)
    })
  }

  return {
    syncMocks
  }
}
