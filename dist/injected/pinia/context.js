import { findPinia } from './detect';
let globalPiniaContext = null;
/**
 * Возвращает контекст Pinia, при необходимости инициализируя его
 */
export function getPiniaContext(forceRefresh = false) {
    if (!globalPiniaContext || forceRefresh) {
        globalPiniaContext = createPiniaContext();
    }
    return globalPiniaContext;
}
/**
 * Создает новый контекст Pinia
 */
function createPiniaContext() {
    const pinia = findPinia();
    let liveStoreIds = new Set();
    if (pinia && pinia._s) {
        if (pinia._s instanceof Map) {
            liveStoreIds = new Set(Array.from(pinia._s.keys()));
        }
        else {
            liveStoreIds = new Set(Object.keys(pinia._s));
        }
    }
    return {
        pinia,
        liveStoreIds,
        lastScan: Date.now()
    };
}
/**
 * Обновляет контекст Pinia
 */
export function updatePiniaContext() {
    globalPiniaContext = createPiniaContext();
    return globalPiniaContext;
}
/**
 * Возвращает актуальный экземпляр Pinia
 */
export function getPiniaInstance() {
    return getPiniaContext().pinia;
}
/**
 * Возвращает актуальные ID активных хранилищ
 */
export function getLiveStoreIds() {
    return getPiniaContext().liveStoreIds;
}
/**
 * Проверяет, активно ли хранилище
 */
export function isStoreActive(storeId) {
    return getLiveStoreIds().has(storeId);
}
//# sourceMappingURL=context.js.map