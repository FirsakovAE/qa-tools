import { suppressResizeObserverError } from '@/utils/suppressResizeObserverError'
import { installClipboardConsoleNoiseFilter } from '@/utils/clipboardConsoleFilter'
import { installClipboardHelpEscCaptureOnce } from '@/utils/clipboardHelpEscGate'
import { isExpectedCrossOriginError } from '@/utils/expectedErrors'
suppressResizeObserverError()
installClipboardConsoleNoiseFilter()
installClipboardHelpEscCaptureOnce()

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
import {
  notAllowedClipboardError,
  shouldUseNavigatorClipboardApis,
} from '@/utils/clipboardPermissions'
import { copyTextWithExecCommandSync, copyToClipboard } from '@/utils/networkUtils'

/**
 * Patches Clipboard after `initRuntime()` so `data-devtools` / `data-injected` exist before checks.
 *
 * DevTools panel and overlay frames: do not call native `navigator.clipboard` — Chrome logs
 * Permissions-Policy violations per call; `allowsFeature` may still report true.
 * `readText` rejects without native call so vanilla-jsoneditor’s clipboard-help `catch` still runs.
 */
function installNavigatorClipboardShims(): void {
  try {
    if (typeof Clipboard === 'undefined') return

    type ClipboardProto = Clipboard & {
      writeText?: (data: string) => Promise<void>
      readText?: () => Promise<string>
    }

    const proto = Clipboard.prototype as ClipboardProto

    const origWrite = proto.writeText
    if (typeof origWrite === 'function') {
      proto.writeText = async function shimWriteText(this: Clipboard, data: string) {
        if (!shouldUseNavigatorClipboardApis()) {
          if (copyTextWithExecCommandSync(data))
            return
          const ok = await copyToClipboard(data)
          if (!ok) throw notAllowedClipboardError()
          return
        }

        try {
          await origWrite.call(this, data)
        } catch {
          if (copyTextWithExecCommandSync(data))
            return
          const ok = await copyToClipboard(data)
          if (!ok) throw notAllowedClipboardError()
        }
      }
    }

    const origRead = proto.readText
    if (typeof origRead === 'function') {
      proto.readText = async function shimReadText(this: Clipboard): Promise<string> {
        if (!shouldUseNavigatorClipboardApis()) throw notAllowedClipboardError()
        return origRead.call(this) as Promise<string>
      }
    }
  } catch (e) {
    console.warn('[injected-ui/main] installNavigatorClipboardShims:', e)
  }
}

function initRuntime() {
  try {
    const params = new URLSearchParams(window.location.search)

    // DevTools panel mode
    if (params.get('devtools') === '1') {
      const tabId = Number(params.get('tabId'))
      if (tabId) {
        document.documentElement.setAttribute('data-devtools', 'true')
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
      } catch (e) {
        if (!isExpectedCrossOriginError(e)) console.error('[injected-ui/main] Cross-origin parent access failed:', e)
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
  } catch (e) {
    console.error('[injected-ui/main] initRuntime failed:', e)
    try {
      const adapter = createExtensionAdapter()
      setRuntimeAdapter(adapter)
    } catch (fallbackError) {
      console.error('[injected-ui/main] initRuntime fallback failed:', fallbackError)
    }
  }
}

initRuntime()
installNavigatorClipboardShims()

import { Toaster } from '@/components/ui/Toaster'
import { useInspectorSettings } from '@/settings/useInspectorSettings'

const app = createApp(App)
app.component('Toaster', Toaster)

useInspectorSettings()
  .then(() => {
    app.mount('#app')
  })
  .catch(e => {
    console.error('[injected-ui/main] useInspectorSettings failed:', e)
    app.mount('#app')
  })