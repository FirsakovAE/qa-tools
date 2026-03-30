import { getStoresList, getStoreState, getStore } from './state-reader';
import { getStoreGetters } from './getters';
import { getStoreActions, callActionUnwrapped } from './actions';
import { isPiniaDetected, waitForPinia, watchPiniaStores } from './detect';
import { searchStores } from './search';
import { patchState, replaceState, patchGetters } from './state-writer';
import { getStoreStateKeys, getGetterKeys, getActionKeys, normalizeStoreId } from './store-meta';
import { updatePiniaContext } from './context';
let initialized = false;
// Обработчики сообщений
const handlers = {
    'PINIA_GET_STORES_SUMMARY': handleGetStoresSummary,
    'PINIA_SEARCH': handlePiniaSearch,
    'PINIA_GET_STORE_STATE': handleGetStoreState,
    'PINIA_PATCH_STATE': handlePatchState,
    'PINIA_REPLACE_STATE': handleReplaceState,
    'PINIA_PATCH_GETTERS': handlePatchGetters,
    'PINIA_CALL_ACTION': handleCallAction,
    'PINIA_CHECK_DETECTED': handleCheckDetected
};
function handleMessage(event) {
    if (event.source !== window ||
        !event.data ||
        typeof event.data !== 'object' ||
        typeof event.data.type !== 'string' ||
        !event.data.type.startsWith('PINIA_'))
        return;
    const handler = handlers[event.data.type];
    if (handler) {
        try {
            handler(event.data);
        }
        catch (e) {
            console.error('[injected/pinia/bridge] handler failed:', event.data?.type, e);
        }
    }
}
function handleGetStoresSummary(data) {
    try {
        const summary = getAllStoresSummaryLight();
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_STORES_SUMMARY_DATA',
            summary,
            detected: isPiniaDetected(),
            requestId: data.requestId
        }, '*');
    }
    catch (e) {
        console.error('[injected/pinia/bridge] handleGetStoresSummary failed:', e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_STORES_SUMMARY_DATA',
            summary: {},
            detected: false,
            error: String(e),
            requestId: data.requestId
        }, '*');
    }
}
function handlePiniaSearch(data) {
    try {
        const results = searchStores(data.query || '', {
            searchByKey: !!data.searchByKey,
            searchByValue: !!data.searchByValue,
            exactMatch: !!data.exactMatch
        });
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_SEARCH_RESULTS',
            results: results.map(r => ({ storeId: r.storeId })),
            requestId: data.requestId
        }, '*');
    }
    catch (e) {
        console.error('[injected/pinia/bridge] handlePiniaSearch failed:', e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_SEARCH_RESULTS',
            results: [],
            error: String(e),
            requestId: data.requestId
        }, '*');
    }
}
function handleGetStoreState(data) {
    let state = null, getters = {}, actions = {};
    try {
        state = getStoreState(data.storeId);
    }
    catch (e) {
        console.error('[injected/pinia/bridge] getStoreState failed:', data.storeId, e);
    }
    try {
        getters = getStoreGetters(data.storeId);
    }
    catch (e) {
        console.error('[injected/pinia/bridge] getStoreGetters failed:', data.storeId, e);
    }
    try {
        actions = getStoreActions(data.storeId);
    }
    catch (e) {
        console.error('[injected/pinia/bridge] getStoreActions failed:', data.storeId, e);
    }
    window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: 'PINIA_STORE_STATE_DATA',
        storeId: data.storeId,
        state,
        getters,
        actions,
        requestId: data.requestId
    }, '*');
}
function handlePatchState(data) {
    try {
        const success = patchState(data.storeId, data.path, data.value);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_PATCH_STATE_RESULT',
            storeId: data.storeId,
            path: data.path,
            success,
            requestId: data.requestId
        }, '*');
    }
    catch (e) {
        console.error('[injected/pinia/bridge] handlePatchState failed:', data.storeId, data.path, e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_PATCH_STATE_RESULT',
            storeId: data.storeId,
            path: data.path,
            success: false,
            error: String(e),
            requestId: data.requestId
        }, '*');
    }
}
function handleReplaceState(data) {
    try {
        const success = replaceState(data.storeId, data.newState);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_REPLACE_STATE_RESULT',
            storeId: data.storeId,
            success,
            requestId: data.requestId
        }, '*');
    }
    catch (e) {
        console.error('[injected/pinia/bridge] handleReplaceState failed:', data.storeId, e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_REPLACE_STATE_RESULT',
            storeId: data.storeId,
            success: false,
            error: String(e),
            requestId: data.requestId
        }, '*');
    }
}
function handlePatchGetters(data) {
    try {
        const result = patchGetters(data.storeId, data.newGetters);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_PATCH_GETTERS_RESULT',
            storeId: data.storeId,
            ...result,
            requestId: data.requestId
        }, '*');
    }
    catch (e) {
        console.error('[injected/pinia/bridge] handlePatchGetters failed:', data.storeId, e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_PATCH_GETTERS_RESULT',
            storeId: data.storeId,
            success: false,
            updated: [],
            error: String(e),
            requestId: data.requestId
        }, '*');
    }
}
function handleCallAction(data) {
    const { storeId, actionName, args = [] } = data;
    Promise.resolve(callActionUnwrapped(storeId, actionName, ...args))
        .then(result => {
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_CALL_ACTION_RESULT',
            storeId,
            actionName,
            success: true,
            result,
            requestId: data.requestId
        }, '*');
    })
        .catch(e => {
        console.error('[injected/pinia/bridge] handleCallAction failed:', storeId, actionName, e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_CALL_ACTION_RESULT',
            storeId,
            actionName,
            success: false,
            error: String(e),
            requestId: data.requestId
        }, '*');
    });
}
function handleCheckDetected(data) {
    try {
        const detected = isPiniaDetected();
        const storeCount = getStoresList().length;
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_DETECTED_RESULT',
            detected,
            storeCount,
            requestId: data.requestId
        }, '*');
    }
    catch (e) {
        console.error('[injected/pinia/bridge] handleCheckDetected failed:', e);
        window.postMessage({
            __FROM_VUE_INSPECTOR__: true,
            type: 'PINIA_DETECTED_RESULT',
            detected: false,
            storeCount: 0,
            error: String(e),
            requestId: data.requestId
        }, '*');
    }
}
// Форматирует время в строку
function formatTimestamp(ts) {
    return new Date(ts).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
/** Lightweight: store ids + counts only, no full state/getters (like Props metaToLegacyFormatLight) */
function getAllStoresSummaryLight() {
    const storeIds = getStoresList();
    if (storeIds.length === 0)
        return {};
    const summary = {};
    const now = Date.now();
    for (const storeId of storeIds) {
        try {
            const store = getStore(storeId);
            const stateKeys = store ? getStoreStateKeys(store).length : 0;
            const getterKeys = store ? getGetterKeys(store).length : 0;
            const actions = getStoreActions(storeId);
            const actionKeys = actions ? getActionKeys(actions).length : 0;
            summary[storeId] = {
                id: storeId,
                baseId: normalizeStoreId(storeId),
                stateKeys,
                getterKeys,
                actions: actionKeys,
                lastUpdated: now,
                lastUpdatedFormatted: formatTimestamp(now)
            };
        }
        catch (e) {
            console.error('[injected/pinia/bridge] getAllStoresSummaryLight store failed:', storeId, e);
        }
    }
    return summary;
}
/**
 * Инициализирует Pinia bridge - регистрирует message handlers
 */
export function initPiniaBridge() {
    if (initialized)
        return;
    initialized = true;
    // Регистрируем message handler
    window.addEventListener('message', handleMessage);
    // Инициализируем Pinia контекст
    waitForPinia(2000)
        .then(pinia => {
        if (pinia) {
            updatePiniaContext();
            watchPiniaStores(pinia, () => {
                updatePiniaContext();
            });
        }
    })
        .catch(e => {
        console.error('[injected/pinia/bridge] initPiniaBridge waitForPinia failed:', e);
    });
}
//# sourceMappingURL=bridge.js.map