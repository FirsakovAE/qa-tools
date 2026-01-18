import { createApp } from 'vue'
import App from '../App.vue'
import { setRuntimeAdapter, createExtensionAdapter, createStandaloneAdapter } from '@/runtime'

import '@/assets/index.css'
import '@/assets/json.css'
import '@/assets/json-viewer.css'
import '@/assets/prism-json-theme.css'
import '@/assets/prism-overrides.css'

// Определяем режим работы и создаём соответствующий адаптер
function initRuntime() {
  // Проверяем standalone режим через URL hash (избегаем CORS проблем)
  // Format: #standalone=http://localhost:5174
  const hash = window.location.hash
  const standaloneMatch = hash.match(/standalone=([^&]+)/)
  
  let isStandalone = false
  let baseURL = ''
  
  if (standaloneMatch) {
    isStandalone = true
    baseURL = decodeURIComponent(standaloneMatch[1])
  } else {
    // Fallback: проверяем window.parent (работает только для same-origin)
    try {
      isStandalone = !!(window.parent as any)?.__VUE_INSPECTOR_STANDALONE__
      baseURL = (window.parent as any)?.__VUE_INSPECTOR_BASE_URL__ || ''
    } catch {
      // Cross-origin - не standalone
    }
  }

  if (isStandalone) {
    // Standalone mode
    const adapter = createStandaloneAdapter({
      baseURL,
      targetWindow: window.parent
    })
    setRuntimeAdapter(adapter)
  } else {
    // Extension mode
    const adapter = createExtensionAdapter()
    setRuntimeAdapter(adapter)
  }
}

// Инициализируем runtime ДО монтирования Vue приложения
initRuntime()

createApp(App).mount('#app')