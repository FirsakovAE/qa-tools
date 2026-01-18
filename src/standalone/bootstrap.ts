/**
 * Standalone Bootstrap
 * 
 * Entry point для standalone режима.
 * Инициализирует runtime adapter и загружает core.
 */

import { setRuntimeAdapter, createStandaloneAdapter } from '@/runtime'
import type { StandaloneAdapterConfig } from '@/runtime'

export interface StandaloneBootstrapConfig extends StandaloneAdapterConfig {
  /** Автоматически инжектить UI после инициализации */
  autoInjectUI?: boolean
}

/**
 * Инициализирует standalone режим
 */
export function bootstrapStandalone(config: StandaloneBootstrapConfig): void {
  // Защита от повторной инициализации
  if ((window as any).__VUE_INSPECTOR_INITIALIZED__) {
    return
  }
  ;(window as any).__VUE_INSPECTOR_INITIALIZED__ = true
  
  // Сохраняем конфиг глобально для доступа из других модулей
  ;(window as any).__VUE_INSPECTOR_CONFIG__ = config
  
  // Создаём и устанавливаем адаптер
  const adapter = createStandaloneAdapter(config)
  setRuntimeAdapter(adapter)
  
  
  // Автоматически инжектим UI если запрошено
  if (config.autoInjectUI !== false) {
    adapter.onReady(() => {
      injectInspectorUI(config.baseURL)
    })
  }
}

/**
 * Инжектирует UI inspector на страницу
 */
function injectInspectorUI(baseURL: string): void {
  // Проверяем, не был ли уже добавлен UI
  if (document.getElementById('vue-inspector-root')) {
    return
  }
  
  // Загружаем content script который создаст UI
  const script = document.createElement('script')
  script.id = 'vue-inspector-content-script'
  script.src = `${baseURL}/js/content.js`
  script.onerror = () => {
  }
  document.head.appendChild(script)
}

// Экспортируем для глобального доступа (bookmarklet)
;(window as any).VueInspector = {
  bootstrap: bootstrapStandalone
}
