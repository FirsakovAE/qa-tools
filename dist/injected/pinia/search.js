import { getStoreGetters } from './getters';
import { getStoreState } from './state-reader';
import { getPiniaInstance } from './context';
import { normalizeStoreId } from './store-meta';
const MAX_SEARCH_DEPTH = 20;
function searchKeyInObject(obj, query, exactMatch, depth = 0) {
    if (depth > MAX_SEARCH_DEPTH || obj === null || obj === undefined)
        return false;
    if (typeof obj !== 'object')
        return false;
    if (Array.isArray(obj)) {
        return obj.some((item) => searchKeyInObject(item, query, exactMatch, depth + 1));
    }
    const matchKey = exactMatch
        ? (k) => k.toLowerCase() === query
        : (k) => k.toLowerCase().includes(query);
    for (const key of Object.keys(obj)) {
        if (matchKey(key))
            return true;
        if (searchKeyInObject(obj[key], query, exactMatch, depth + 1))
            return true;
    }
    return false;
}
function searchValueInObject(obj, query, exactMatch, depth = 0) {
    if (depth > MAX_SEARCH_DEPTH)
        return false;
    if (obj === null || obj === undefined)
        return false;
    if (typeof obj !== 'object') {
        const str = String(obj).toLowerCase();
        return exactMatch ? str === query : str.includes(query);
    }
    if (Array.isArray(obj)) {
        return obj.some((item) => searchValueInObject(item, query, exactMatch, depth + 1));
    }
    for (const key of Object.keys(obj)) {
        if (searchValueInObject(obj[key], query, exactMatch, depth + 1))
            return true;
    }
    return false;
}
/** Search stores by key/value - on-demand, returns matched store IDs (like PROPS_SEARCH) */
export function searchStores(query, options = {}) {
    const { searchByKey = false, searchByValue = false, exactMatch = false, limit = 100 } = options;
    const results = [];
    const q = query.toLowerCase().trim();
    if (!q)
        return results;
    const pinia = getPiniaInstance();
    if (!pinia)
        return results;
    const storeIds = Array.from(pinia._s.keys());
    for (const storeId of storeIds) {
        if (results.length >= limit)
            break;
        const baseId = normalizeStoreId(storeId);
        let matchByKey = false;
        let matchByValue = false;
        try {
            const state = getStoreState(storeId);
            const getters = getStoreGetters(storeId);
            if (searchByKey) {
                if (state && searchKeyInObject(state, q, exactMatch))
                    matchByKey = true;
                if (getters && searchKeyInObject(getters, q, exactMatch))
                    matchByKey = true;
            }
            if (searchByValue) {
                if (state && searchValueInObject(state, q, exactMatch))
                    matchByValue = true;
                if (getters && searchValueInObject(getters, q, exactMatch))
                    matchByValue = true;
            }
            if (matchByKey || matchByValue) {
                results.push({ storeId, baseId });
            }
        }
        catch (e) {
            console.error('[injected/pinia/search] searchStores store failed:', storeId, e);
        }
    }
    return results;
}
//# sourceMappingURL=search.js.map