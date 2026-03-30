import { getStore } from './state-reader';
import { getGetterKeys } from './store-meta';
import { unwrapValue } from './unwrap';
/**
 * Получает значения геттеров хранилища (использует unwrapValue для computed refs)
 */
export function getStoreGetters(storeId) {
    const store = getStore(storeId);
    if (!store)
        return {};
    const getters = {};
    const getterKeys = getGetterKeys(store);
    for (const key of getterKeys) {
        try {
            getters[key] = unwrapValue(store[key]);
        }
        catch (e) {
            console.error('[injected/pinia/getters] getStoreGetters unwrap failed:', storeId, key, e);
            getters[key] = '[Non-serializable]';
        }
    }
    return getters;
}
//# sourceMappingURL=getters.js.map