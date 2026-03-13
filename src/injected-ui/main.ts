import { suppressResizeObserverError } from '@/utils/suppressResizeObserverError'
suppressResizeObserverError()

import { createApp } from 'vue'
import App from '../App.vue'
import { setRuntimeAdapter, createExtensionAdapter, createStandaloneAdapter, createDevtoolsAdapter } from '@/runtime'
import { useDevtoolsSearch } from '@/composables/useDevtoolsSearch'
import { createStorageClient } from '@/storage/storage-client'
import { setMediaStorageClient } from '@/settings/mediaStore'

import '@/assets/index.css'
import '@/assets/json.css'
import '@/assets/json-viewer.css'
import '@/assets/prism-json-theme.css'
import '@/assets/prism-overrides.css'

function initRuntime() {
  const params = new URLSearchParams(window.location.search)

  // DevTools panel mode
  if (params.get('devtools') === '1') {
    const tabId = Number(params.get('tabId'))
    if (tabId) {
      const adapter = createDevtoolsAdapter(tabId)
      setRuntimeAdapter(adapter)
      useDevtoolsSearch()
      return
    }
  }

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
    try {
      isStandalone = !!(window.parent as any)?.__VUE_INSPECTOR_STANDALONE__
      baseURL = (window.parent as any)?.__VUE_INSPECTOR_BASE_URL__ || ''
    } catch {
      // Cross-origin - не standalone
    }
  }

  if (isStandalone) {
    const storageClient = createStorageClient(baseURL + '/storage/')
    setMediaStorageClient(storageClient)

    const adapter = createStandaloneAdapter({
      baseURL,
      targetWindow: window.parent,
      storageClient,
    })
    setRuntimeAdapter(adapter)
  } else {
    const adapter = createExtensionAdapter()
    setRuntimeAdapter(adapter)
  }
}

initRuntime()

import { Toaster } from '@/components/ui/Toaster'
import { useInspectorSettings } from '@/settings/useInspectorSettings'

const app = createApp(App)
app.component('Toaster', Toaster)

useInspectorSettings().then(() => {
  app.mount('#app')
})