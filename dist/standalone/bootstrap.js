/**
 * Standalone Bootstrap
 *
 * Entry point для standalone режима.
 * Инициализирует runtime adapter и загружает core.
 */
import { setRuntimeAdapter, createStandaloneAdapter } from '@/runtime';
/**
 * Инициализирует standalone режим
 */
export function bootstrapStandalone(config) {
    // Защита от повторной инициализации
    if (window.__VUE_INSPECTOR_INITIALIZED__) {
        return;
    }
    ;
    window.__VUE_INSPECTOR_INITIALIZED__ = true;
    window.__VUE_INSPECTOR_CONFIG__ = config;
    // Создаём и устанавливаем адаптер
    const adapter = createStandaloneAdapter(config);
    setRuntimeAdapter(adapter);
    // Автоматически инжектим UI если запрошено
    if (config.autoInjectUI !== false) {
        adapter.onReady(() => {
            injectInspectorUI(config.baseURL);
        });
    }
}
/**
 * Инжектирует UI inspector на страницу
 */
function injectInspectorUI(baseURL) {
    // Проверяем, не был ли уже добавлен UI
    if (document.getElementById('vue-inspector-root')) {
        return;
    }
    // Загружаем content script который создаст UI
    const script = document.createElement('script');
    script.id = 'vue-inspector-content-script';
    script.src = `${baseURL}/js/content.js`;
    script.onerror = () => {
    };
    document.head.appendChild(script);
}
// Экспортируем для глобального доступа (bookmarklet)
;
window.VueInspector = {
    bootstrap: bootstrapStandalone
};
//# sourceMappingURL=bootstrap.js.map