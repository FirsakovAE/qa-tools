/**
 * Network Entries State Composable
 * Manages network entries state and IPC communication
 *
 * NOTE: State AND message listener are at module level to persist across tab switches
 * This ensures network updates are received even when NetworkTab is not visible
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { DEFAULT_NETWORK_CONFIG } from '@/types/network';
import { postToContentScript } from '@/utils/postToContentScript';
// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================
const entries = ref([]);
const paused = ref(false);
const config = ref({ ...DEFAULT_NETWORK_CONFIG });
const isReady = ref(false);
// Monotonically increasing counter — triggers watchers that can't rely on array identity
const entriesVersion = ref(0);
// O(1) lookup index: entry.id → array position
const idIndex = new Map();
function rebuildIdIndex() {
    idIndex.clear();
    for (let i = 0; i < entries.value.length; i++) {
        idIndex.set(entries.value[i].id, i);
    }
}
let listenerInitialized = false;
const breakpointHitCallbacks = new Set();
// ============================================================================
// Module-level Functions
// ============================================================================
function sendCommand(type, data = {}) {
    postToContentScript({
        type,
        __VUE_INSPECTOR__: true,
        __NETWORK_CMD__: true,
        ...data
    });
}
function normalizeEntry(entry) {
    return { ...entry, version: entry.version ?? 1 };
}
/**
 * Enforce the max entries limit by trimming from the front.
 * Mutates the array in-place and rebuilds the id index.
 */
function enforceLimit() {
    const max = config.value.maxEntries;
    if (entries.value.length > max) {
        entries.value.splice(0, entries.value.length - max);
        rebuildIdIndex();
    }
}
function processMessage(msg) {
    const { type } = msg;
    switch (type) {
        case 'NETWORK_READY':
            isReady.value = true;
            if (typeof msg.paused === 'boolean') {
                paused.value = msg.paused;
            }
            sendCommand('NETWORK_GET_ENTRIES');
            break;
        case 'NETWORK_ENTRY_CAPTURED':
            if (msg.entry && !paused.value) {
                const entry = normalizeEntry(msg.entry);
                if (!idIndex.has(entry.id)) {
                    const idx = entries.value.push(entry) - 1;
                    idIndex.set(entry.id, idx);
                    enforceLimit();
                    entriesVersion.value++;
                }
            }
            break;
        case 'NETWORK_ENTRY_UPDATED':
            if (msg.entry) {
                const entry = normalizeEntry(msg.entry);
                const idx = idIndex.get(entry.id);
                if (idx !== undefined) {
                    entries.value[idx] = entry;
                    entriesVersion.value++;
                }
                else if (!paused.value) {
                    const newIdx = entries.value.push(entry) - 1;
                    idIndex.set(entry.id, newIdx);
                    entriesVersion.value++;
                }
            }
            break;
        case 'NETWORK_BREAKPOINT_HIT':
            if (msg.requestId && msg.trigger) {
                if (msg.entry) {
                    const idx = idIndex.get(msg.requestId);
                    if (idx === undefined) {
                        const entry = { ...normalizeEntry(msg.entry), pending: true };
                        const newIdx = entries.value.push(entry) - 1;
                        idIndex.set(entry.id, newIdx);
                    }
                    else {
                        entries.value[idx] = { ...entries.value[idx], pending: true };
                    }
                    entriesVersion.value++;
                }
                breakpointHitCallbacks.forEach(cb => cb(msg.requestId, msg.trigger, msg.entry));
            }
            break;
        case 'NETWORK_ENTRIES_DATA':
            isReady.value = true;
            if (msg.entries && Array.isArray(msg.entries)) {
                const incomingEntries = msg.entries.map(normalizeEntry);
                const pendingIds = new Set();
                for (const e of entries.value) {
                    if (e.pending)
                        pendingIds.add(e.id);
                }
                const mergedEntries = [];
                const processedIds = new Set();
                for (const incoming of incomingEntries) {
                    processedIds.add(incoming.id);
                    if (pendingIds.has(incoming.id)) {
                        mergedEntries.push({ ...incoming, pending: true });
                    }
                    else {
                        mergedEntries.push(incoming);
                    }
                }
                for (const existing of entries.value) {
                    if (existing.pending && !processedIds.has(existing.id)) {
                        mergedEntries.push(existing);
                    }
                }
                entries.value = mergedEntries;
                rebuildIdIndex();
                entriesVersion.value++;
            }
            break;
        case 'NETWORK_STATUS':
            isReady.value = true;
            if (typeof msg.paused === 'boolean') {
                paused.value = msg.paused;
            }
            break;
        case 'NETWORK_PAUSED':
            paused.value = true;
            break;
        case 'NETWORK_RESUMED':
            paused.value = false;
            break;
        case 'NETWORK_CLEARED':
            entries.value = [];
            idIndex.clear();
            entriesVersion.value++;
            break;
    }
}
function handleMessage(event) {
    const data = event.data;
    if (data?.__VUE_INSPECTOR__ && data.broadcast && data.message?.__NETWORK__) {
        processMessage(data.message);
        return;
    }
    if (data?.__FROM_VUE_INSPECTOR__ && data.__NETWORK__) {
        processMessage(data);
    }
}
function initModuleListener() {
    if (listenerInitialized)
        return;
    listenerInitialized = true;
    window.addEventListener('message', handleMessage);
}
// ============================================================================
// Composable
// ============================================================================
export function useNetworkEntries(options = {}) {
    initModuleListener();
    // ============================================================================
    // Actions
    // ============================================================================
    function togglePause() {
        if (paused.value) {
            paused.value = false;
            sendCommand('NETWORK_RESUME');
        }
        else {
            paused.value = true;
            sendCommand('NETWORK_PAUSE');
        }
    }
    function clearEntries() {
        entries.value = [];
        idIndex.clear();
        sendCommand('NETWORK_CLEAR');
    }
    function addEntry(entry) {
        if (!idIndex.has(entry.id)) {
            const idx = entries.value.push(entry) - 1;
            idIndex.set(entry.id, idx);
            enforceLimit();
            entriesVersion.value++;
        }
    }
    function getEntry(id) {
        const idx = idIndex.get(id);
        return idx !== undefined ? entries.value[idx] : undefined;
    }
    // ============================================================================
    // Computed
    // ============================================================================
    const totalCount = computed(() => {
        void entriesVersion.value;
        return entries.value.length;
    });
    const pendingCount = computed(() => {
        void entriesVersion.value;
        let count = 0;
        for (const e of entries.value) {
            if (e.pending)
                count++;
        }
        return count;
    });
    // ============================================================================
    // Lifecycle
    // ============================================================================
    let statusCheckInterval = null;
    onMounted(() => {
        if (options.onBreakpointHit) {
            breakpointHitCallbacks.add(options.onBreakpointHit);
        }
        sendCommand('NETWORK_GET_STATUS');
        if (entries.value.length === 0) {
            sendCommand('NETWORK_GET_ENTRIES');
        }
        else {
            isReady.value = true;
        }
        let retryCount = 0;
        const needsEntries = entries.value.length === 0;
        statusCheckInterval = setInterval(() => {
            if (isReady.value || retryCount > 10) {
                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                }
                return;
            }
            retryCount++;
            sendCommand('NETWORK_GET_STATUS');
            if (needsEntries) {
                sendCommand('NETWORK_GET_ENTRIES');
            }
        }, 500);
    });
    onUnmounted(() => {
        if (options.onBreakpointHit) {
            breakpointHitCallbacks.delete(options.onBreakpointHit);
        }
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
        }
    });
    return {
        entries,
        entriesVersion,
        paused,
        config,
        isReady,
        totalCount,
        pendingCount,
        sendCommand,
        togglePause,
        clearEntries,
        addEntry,
        getEntry,
        normalizeEntry
    };
}
//# sourceMappingURL=useNetworkEntries.js.map