// src/injected/props/async-wrapper.ts
/**
 * Проверяет, является ли компонент AsyncComponentWrapper
 * @param instance - Экземпляр компонента
 * @returns true, если компонент является AsyncComponentWrapper
 */
export function isAsyncComponentWrapper(instance) {
    return instance && instance.type && instance.type.name === 'AsyncComponentWrapper';
}
/**
 * Разрешает AsyncComponentWrapper и возвращает реальный компонент
 * @param instance - Экземпляр компонента (может быть AsyncComponentWrapper)
 * @returns Реальный компонент или исходный instance
 */
export function resolveAsyncComponent(instance) {
    if (!instance || !instance.type || instance.type.name !== 'AsyncComponentWrapper') {
        return instance;
    }
    // Порядок поиска реального компонента внутри AsyncComponentWrapper
    const candidates = [
        instance.subTree?.component,
        instance.subTree?.subTree?.component,
        instance.vnode?.subTree?.component
    ];
    for (const candidate of candidates) {
        if (candidate && candidate !== instance) {
            return candidate;
        }
    }
    // Если ничего не нашли, возвращаем оригинальный instance
    return instance;
}
//# sourceMappingURL=async-wrapper.js.map