/**
 * Проверяет, является ли хранилище setup-хранилищем
 */
export function isSetupStore(store) {
    // 1. Official Pinia flag (if available)
    if (store._setupStore === true) {
        return true;
    }
    // 2. Heuristic: if $state is empty but store has non-function keys → setup-store
    const stateKeys = Object.keys(store.$state || {});
    if (stateKeys.length === 0) {
        // Check if store has ref-like values
        for (const key of Object.keys(store)) {
            if (key.startsWith('$') || key.startsWith('_'))
                continue;
            if (typeof store[key] === 'function')
                continue;
            // Has non-function keys but empty $state → setup-store
            return true;
        }
    }
    // 3. Check if store values are Vue refs (setup-store pattern)
    for (const key of Object.keys(store)) {
        if (key.startsWith('$') || key.startsWith('_'))
            continue;
        if (typeof store[key] === 'function')
            continue;
        const value = store[key];
        if (value && typeof value === 'object' && value.__v_isRef === true) {
            return true;
        }
    }
    return false;
}
/**
 * Определяет тип хранилища по флагу
 */
export function detectSetupStoreByFlag(store) {
    return store._setupStore === true;
}
/**
 * Определяет тип хранилища по пустому состоянию
 */
export function detectSetupStoreByEmptyState(store) {
    const stateKeys = Object.keys(store.$state || {});
    if (stateKeys.length === 0) {
        for (const key of Object.keys(store)) {
            if (key.startsWith('$') || key.startsWith('_'))
                continue;
            if (typeof store[key] === 'function')
                continue;
            return true;
        }
    }
    return false;
}
/**
 * Определяет тип хранилища по refs
 */
export function detectSetupStoreByRefs(store) {
    for (const key of Object.keys(store)) {
        if (key.startsWith('$') || key.startsWith('_'))
            continue;
        if (typeof store[key] === 'function')
            continue;
        const value = store[key];
        if (value && typeof value === 'object' && value.__v_isRef === true) {
            return true;
        }
    }
    return false;
}
/**
 * Нормализует ID хранилища (удаляет динамические суффиксы)
 */
export function normalizeStoreId(storeId) {
    return storeId.replace(/-\d+$/, '').replace(/_\d+$/, '');
}
/**
 * Анализирует структуру хранилища
 */
export function analyzeStore(store) {
    const stateKeys = getStoreStateKeys(store);
    const getterKeys = getGetterKeys(store);
    const actionKeys = getActionKeys(store);
    return {
        stateKeys,
        getterKeys,
        actionKeys
    };
}
/**
 * Получает ключи состояния (для options + setup + гибридных хранилищ)
 */
export function getStoreStateKeys(store) {
    // 🎯 For Pinia stores, $state is the SOURCE OF TRUTH for state keys
    // Keys on store but NOT in $state are GETTERS
    if (store.$state && typeof store.$state === 'object') {
        // Options-store or hybrid: use $state keys directly
        return Object.keys(store.$state);
    }
    // Setup-store without $state: collect all non-function, non-computed values
    const storeKeys = [];
    for (const key of Object.keys(store)) {
        if (key.startsWith('$') ||
            key.startsWith('_') ||
            typeof store[key] === 'function')
            continue;
        const value = store[key];
        // ❌ computed getter (ref with effect)
        if (isComputedRef(value))
            continue;
        // ✅ Include all non-function values (refs, reactive objects, plain values)
        storeKeys.push(key);
    }
    return storeKeys;
}
/**
 * Проверяет, является ли значение вычисляемым ref (геттером)
 */
export function isComputedRef(value) {
    if (!value || typeof value !== 'object')
        return false;
    // Vue 3 ComputedRef has __v_isRef + effect (ReactiveEffect object)
    if (value.__v_isRef === true && value.effect !== undefined) {
        return true;
    }
    // Alternative: check for _getter (internal computed property)
    if (value.__v_isRef === true && typeof value._getter === 'function') {
        return true;
    }
    // Check for __v_isReadonly (computed are readonly by default)
    if (value.__v_isRef === true && value.__v_isReadonly === true) {
        return true;
    }
    return false;
}
/**
 * Проверяет, является ли значение Vue ref
 */
export function isVueRef(value) {
    return !!(value && typeof value === 'object' && value.__v_isRef === true);
}
/**
 * Получает ключи геттеров из хранилища (несколько стратегий обнаружения)
 */
export function getGetterKeys(store) {
    const getters = [];
    const stateKeys = new Set(Object.keys(store.$state || {}));
    // Strategy 1: Look for computed refs (setup-store with computed())
    for (const key of Object.keys(store)) {
        if (key.startsWith('$') ||
            key.startsWith('_') ||
            typeof store[key] === 'function')
            continue;
        const value = store[key];
        if (isComputedRef(value)) {
            getters.push(key);
        }
    }
    // Strategy 2: Keys on store but NOT in $state are getters (Pinia pattern)
    for (const key of Object.keys(store)) {
        if (key.startsWith('$') ||
            key.startsWith('_') ||
            typeof store[key] === 'function')
            continue;
        if (getters.includes(key))
            continue;
        // Key exists on store but NOT in $state = getter
        if (!stateKeys.has(key)) {
            getters.push(key);
        }
    }
    // Strategy 3: Look for getters in prototype (options-store pattern)
    const proto = Object.getPrototypeOf(store);
    if (proto && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === 'constructor' || key.startsWith('$') || key.startsWith('_'))
                continue;
            if (getters.includes(key))
                continue;
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            if (desc && typeof desc.get === 'function') {
                getters.push(key);
            }
        }
    }
    return getters;
}
/**
 * Получает ключи действий из хранилища
 */
export function getActionKeys(store) {
    const actions = [];
    for (const key in store) {
        if (!key.startsWith('$') && !key.startsWith('_') && typeof store[key] === 'function') {
            actions.push(key);
        }
    }
    return actions;
}
//# sourceMappingURL=store-meta.js.map