/**
 * Mock State Composable
 * Manages mock (Map Local) sync to injected script
 */
import { computed } from 'vue';
import { getMockMatchingEntryIds } from './useBreakpointMatching';
import { deepClone } from '../utils';
/**
 * Composable for mock state management
 */
export function useMockState(activeMocks, options, entries) {
    /**
     * Entry IDs that match any active mock pattern (for highlighting)
     */
    const entriesMatchingMocks = computed(() => {
        if (!entries)
            return new Set();
        return getMockMatchingEntryIds(entries(), activeMocks());
    });
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
        }));
        options.sendCommand('NETWORK_MOCKS_SYNC', {
            mocks: deepClone(mocksToSync)
        });
    }
    return {
        syncMocks,
        entriesMatchingMocks
    };
}
//# sourceMappingURL=useMockState.js.map