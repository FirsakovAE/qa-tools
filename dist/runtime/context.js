/**
 * Runtime Context
 *
 * Глобальный контекст для доступа к текущему runtime адаптеру.
 * Инициализируется один раз при bootstrap.
 */
let currentAdapter = null;
/**
 * Устанавливает текущий runtime адаптер
 * Вызывается только из bootstrap
 */
export function setRuntimeAdapter(adapter) {
    try {
        if (currentAdapter) {
            currentAdapter.destroy();
        }
        currentAdapter = adapter;
    }
    catch (e) {
        console.error('[runtime/context] setRuntimeAdapter failed:', e);
        currentAdapter = adapter;
    }
}
/**
 * Получает текущий runtime адаптер
 * Выбрасывает ошибку если адаптер не инициализирован
 */
export function useRuntime() {
    if (!currentAdapter) {
        throw new Error('[Runtime] Adapter not initialized. Call bootstrap() first.');
    }
    return currentAdapter;
}
/**
 * Получает текущий runtime адаптер без выбрасывания ошибки
 * Возвращает null если адаптер не инициализирован
 * Используется в сервисах которые могут запускаться до инициализации runtime
 */
export function getRuntimeAdapter() {
    return currentAdapter;
}
/**
 * Проверяет, инициализирован ли runtime
 */
export function isRuntimeReady() {
    return currentAdapter !== null;
}
/**
 * Получает capabilities текущего runtime
 */
export function useCapabilities() {
    return useRuntime().capabilities;
}
/**
 * Проверяет доступность capability
 */
export function hasCapability(key) {
    return useRuntime().capabilities[key];
}
//# sourceMappingURL=context.js.map