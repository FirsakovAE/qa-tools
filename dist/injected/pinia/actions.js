import { getStore } from './state-reader';
import { getActionKeys } from './store-meta';
import { unwrapValue } from './unwrap';
/**
 * Получает список действий хранилища
 */
export function getStoreActions(storeId) {
    const store = getStore(storeId);
    if (!store)
        return [];
    return getActionKeys(store);
}
/**
 * Вызывает действие с распаковкой результата
 */
export async function callAction(storeId, actionName, ...args) {
    const store = getStore(storeId);
    if (!store) {
        throw new Error(`Store "${storeId}" not found`);
    }
    if (typeof store[actionName] !== 'function') {
        throw new Error(`Action "${actionName}" not found in store "${storeId}"`);
    }
    try {
        const result = await store[actionName](...args);
        return result;
    }
    catch (e) {
        console.error('[injected/pinia/actions] callAction failed:', storeId, actionName, e);
        throw e;
    }
}
/**
 * Вызывает действие и распаковывает результат (для значений ref)
 */
export async function callActionUnwrapped(storeId, actionName, ...args) {
    const result = await callAction(storeId, actionName, ...args);
    return unwrapValue(result);
}
//# sourceMappingURL=actions.js.map