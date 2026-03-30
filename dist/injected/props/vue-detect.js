// src/injected/vue-detect.ts
/**
 * Находит корневые элементы Vue приложений на странице.
 * Ищет по широкому набору селекторов для максимального покрытия.
 * @returns Массив корневых элементов Vue приложений.
 */
export function findVueRoots() {
    const vueRoots = [];
    // Шаг 1: Ищем по широкому набору селекторов (как в рабочей версии)
    const selector = '[__vue_app__], [__vue__], div, main, section, article, #app, #root, [class*="app"], [class*="vue"], [id*="app"]';
    document.querySelectorAll(selector).forEach(el => {
        const vEl = el;
        if ((vEl.__vue_app__ || vEl.__vue__ || vEl._vnode) && !vueRoots.includes(vEl)) {
            vueRoots.push(vEl);
        }
    });
    // Шаг 2: Если ничего не нашли - проверяем DevTools hook
    if (vueRoots.length === 0) {
        const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
        if (hook?.apps && hook.apps.length > 0) {
            for (const app of hook.apps) {
                const rootEl = app._instance?.root?.el || app._container?._vnode?.el;
                if (rootEl && rootEl instanceof HTMLElement && !vueRoots.includes(rootEl)) {
                    vueRoots.push(rootEl);
                }
            }
        }
    }
    return vueRoots;
}
/**
 * Извлекает корневой VNode из корневого элемента Vue приложения.
 * @param root - Корневой элемент Vue приложения.
 * @returns Корневой VNode или null.
 */
export function extractRootVNode(root) {
    if (root.__vue_app__) {
        // Vue 3
        const app = root.__vue_app__;
        return app._instance?.root ?? app._container?._vnode ?? root._vnode;
    }
    else if (root.__vue__) {
        // Vue 2
        const vue2Instance = root.__vue__;
        const rootInstance = vue2Instance.$root || vue2Instance;
        return rootInstance.$vnode || rootInstance;
    }
    return root._vnode;
}
/**
 * Проверяет, обнаружен ли Vue на странице.
 * @returns true, если Vue обнаружен, иначе false.
 */
export function isVueDetected() {
    const vueRoots = findVueRoots();
    const hasDevToolsHook = !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
    const hasVue2 = !!window.__VUE__;
    return vueRoots.length > 0 || hasDevToolsHook || hasVue2;
}
// Функция уже экспортирована как 'export function', убираем дублирующий экспорт
/**
 * Создает контекст Vue для унифицированной работы с Vue 2 и Vue 3.
 * @returns Контекст Vue с информацией о версии и корнях.
 */
export function detectVueContext() {
    const vueRoots = findVueRoots();
    // Проверяем наличие Vue 3 приложения (новая логика)
    const hasVue3App = vueRoots.some(root => {
        if (root.__vue_app__)
            return true;
        // Для CDN версии проверяем наличие _vnode и component
        const vnode = root._vnode;
        return vnode && vnode.component;
    });
    // Проверяем наличие Vue 2 приложения
    const hasVue2App = vueRoots.some(root => root.__vue__ && !root.__vue_app__);
    // Определяем версию Vue: приоритет Vue 3
    const version = hasVue3App ? 3 : (hasVue2App ? 2 : 3); // По умолчанию Vue 3
    return {
        version,
        roots: vueRoots
    };
}
//# sourceMappingURL=vue-detect.js.map