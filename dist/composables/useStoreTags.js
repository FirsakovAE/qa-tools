import { computed } from 'vue';
/**
 * Composable для генерации тегов Pinia store
 * Используется в StoreTreeNode.vue и StoreDetails.vue
 */
export function useStoreTags(storeId, state, getterKeys, piniaMethods) {
    // State tag
    const stateTag = computed(() => getStateTag(state));
    // Getters tag
    const gettersTag = computed(() => getGettersTag(getterKeys));
    // Pinia Methods tag
    const piniaMethodsTag = computed(() => getPiniaMethodsTag(piniaMethods?.length || 0));
    // Store type tag
    const typeTag = computed(() => getStoreTypeTag(state ? Object.keys(state).length : 0, getterKeys, storeId, state));
    return {
        stateTag,
        gettersTag,
        piniaMethodsTag,
        typeTag
    };
}
/**
 * Генерация тега для state
 */
function getStateTag(state) {
    // 1.1 Определение наличия state
    if (state == null)
        return null;
    if (typeof state === 'object' && Object.keys(state).length === 0)
        return null;
    // 1.2 Root type
    if (Array.isArray(state)) {
        // 1.3 🅰 Root = Array
        return `State(list(${state.length}))`;
    }
    if (typeof state === 'object') {
        // 1.3 🅱 Root = Object
        const keys = Object.keys(state);
        const count = keys.length;
        // Специальная проверка: если объект имеет только одно поле и оно массив
        if (count === 1) {
            const singleValue = state[keys[0]];
            if (Array.isArray(singleValue)) {
                return `State(list(${singleValue.length}))`;
            }
        }
        // Условия:
        if (count === 0)
            return null;
        if (count === 1)
            return 'State(1)';
        if (count > 1)
            return `State(${count})`;
    }
    // primitive - игнорируем
    return null;
}
/**
 * Генерация тега для getters
 */
function getGettersTag(gettersCount) {
    return gettersCount > 0 ? `Getters(${gettersCount})` : null;
}
/**
 * Генерация тега для Pinia methods
 */
function getPiniaMethodsTag(piniaMethodsCount) {
    return piniaMethodsCount > 0 ? `Pinia(${piniaMethodsCount})` : null;
}
/**
 * Определение типа store
 */
function getStoreTypeTag(stateCount, getterKeys, storeId, state) {
    // Сначала проверяем session по имени
    const sessionNames = ['user', 'auth', 'session', 'tab', 'meta'];
    if (sessionNames.some(name => storeId.toLowerCase().includes(name))) {
        return 'session';
    }
    // Проверяем config
    if (stateCount <= 2 && getterKeys === 0) {
        return 'config';
    }
    // Проверяем UI store по новой логике
    if (detectUIStore(storeId, state)) {
        return 'ui';
    }
    // data - fallback
    return 'data';
}
/**
 * Детекция UI store
 */
function detectUIStore(storeId, state) {
    const UI_NAME_RE = /(ui|panel|nav|button|buttons|modal|dialog|popup|drawer|sidebar|menu|layout|toolbar|header|footer)/i;
    if (UI_NAME_RE.test(storeId))
        return true;
    const stateCount = state ? Object.keys(state).length : 0;
    if (stateCount <= 5)
        return true;
    return false;
}
//# sourceMappingURL=useStoreTags.js.map