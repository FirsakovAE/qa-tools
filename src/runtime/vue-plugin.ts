/**
 * Vue Plugin для Runtime Adapter
 * 
 * Позволяет использовать runtime через provide/inject в Vue компонентах.
 */

import type { App, InjectionKey } from 'vue'
import type { RuntimeAdapter, RuntimeCapabilities } from './types'
import { useRuntime, useCapabilities as getCapabilities } from './context'

// Injection keys
export const RuntimeKey: InjectionKey<RuntimeAdapter> = Symbol('RuntimeAdapter')
export const CapabilitiesKey: InjectionKey<RuntimeCapabilities> = Symbol('RuntimeCapabilities')

/**
 * Vue plugin для интеграции runtime
 */
export const RuntimePlugin = {
  install(app: App) {
    try {
      const runtime = useRuntime()
      app.provide(RuntimeKey, runtime)
      app.provide(CapabilitiesKey, runtime.capabilities)

      app.config.globalProperties.$runtime = runtime
      app.config.globalProperties.$capabilities = runtime.capabilities
    } catch (e) {
      console.error('[runtime/vue-plugin] RuntimePlugin.install failed:', e)
      throw e
    }
  }
}

// Composables для использования в setup()
export { useRuntime, getCapabilities as useCapabilities }

// Type augmentation для глобальных свойств
declare module 'vue' {
  interface ComponentCustomProperties {
    $runtime: RuntimeAdapter
    $capabilities: RuntimeCapabilities
  }
}
