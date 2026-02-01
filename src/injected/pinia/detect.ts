/**
 * Pinia detection module
 * Uses multiple strategies to find Pinia instance
 */

import type { PiniaInstance } from './types'

// Cached Pinia instance
let cachedPinia: PiniaInstance | null = null

/**
 * Detect Pinia from window._s (Map)
 */
export function detectFromWindow(): PiniaInstance | null {
  try {
    if ((window as any)._s && (window as any)._s instanceof Map) {
      return {
        _s: (window as any)._s as Map<string, any>,
        $id: 'found-in-window'
      }
    }
  } catch (e) { /* ignore */ }

  return null
}

/**
 * Detect Pinia via Vue DevTools Hook
 */
export function detectFromDevtools(): PiniaInstance | null {
  try {
    const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (hook?.apps) {
      for (const app of hook.apps) {
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia ||
                      app.config?.globalProperties?.$pinia
        if (pinia && pinia._s) {
          return pinia
        }
      }
    }
  } catch (e) { /* ignore */ }
  
  return null
}

/**
 * Detect Pinia from Vue app roots in DOM
 */
export function detectFromVueRoots(): PiniaInstance | null {
  try {
    // Check common container selectors
    const selectors = ['#app', '#root', '[data-v-app]']
    for (const selector of selectors) {
      const el = document.querySelector(selector) as any
      if (el?.__vue_app__) {
        const app = el.__vue_app__
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia ||
                      app.config?.globalProperties?.$pinia
        if (pinia && pinia._s) {
          return pinia
        }
      }
    }
    
    // Also check body children
    const children = document.body?.children
    if (children) {
      const max = Math.min(children.length, 10)
      for (let i = 0; i < max; i++) {
        const el = children[i] as any
        if (el.__vue_app__) {
          const app = el.__vue_app__
          const pinia = app._context?.provides?.pinia ||
                        app._context?.config?.globalProperties?.$pinia
          if (pinia && pinia._s) {
            return pinia
          }
        }
      }
    }
  } catch (e) { /* ignore */ }

  return null
}

/**
 * Detect Pinia from global __VUE_INSPECTOR__ (if props module loaded first)
 */
export function detectFromInspector(): PiniaInstance | null {
  try {
    const vueInspector = (window as any).__VUE_INSPECTOR__
    const findVueRoots = vueInspector?.findVueRoots
    if (!findVueRoots) return null
    
    const vueRoots = findVueRoots()
    for (const root of vueRoots) {
      if ((root as any).__vue_app__) {
        const app = (root as any).__vue_app__
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia
        if (pinia && pinia._s) {
          return pinia
        }
      }
    }
  } catch (e) { /* ignore */ }

  return null
}

/**
 * Main Pinia finder - uses all detection strategies
 * Results are cached for performance
 */
export function findPinia(): PiniaInstance | null {
  // Return cached if available
  if (cachedPinia) {
    // Verify cache is still valid
    if (cachedPinia._s instanceof Map) {
      return cachedPinia
    }
    cachedPinia = null
  }
  
  // Method 1: Check window._s (Map)
  let pinia = detectFromWindow()
  if (pinia) {
    cachedPinia = pinia
    return pinia
  }
  
  // Method 2: Check Vue DevTools Hook
  pinia = detectFromDevtools()
  if (pinia) {
    cachedPinia = pinia
    return pinia
  }
  
  // Method 3: Search in Vue app roots in DOM
  pinia = detectFromVueRoots()
  if (pinia) {
    cachedPinia = pinia
    return pinia
  }
  
  // Method 4: Use Vue Inspector if available
  pinia = detectFromInspector()
  if (pinia) {
    cachedPinia = pinia
    return pinia
  }
  
  return null
}

/**
 * Clear cached Pinia instance
 */
export function clearPiniaCache(): void {
  cachedPinia = null
}

/**
 * Check if Pinia is detected
 */
export function isPiniaDetected(): boolean {
  return findPinia() !== null
}

// Timeout ID for waitForPinia
let waitForPiniaTimeoutId: ReturnType<typeof setTimeout> | null = null

/**
 * Cancel waiting for Pinia (for cleanup)
 */
export function cancelWaitForPinia(): void {
  if (waitForPiniaTimeoutId !== null) {
    clearTimeout(waitForPiniaTimeoutId)
    waitForPiniaTimeoutId = null
  }
}

/**
 * Wait for Pinia to appear with timeout
 * Optimized: increased interval, reduced default timeout
 */
export async function waitForPinia(
  timeout: number = 2000,
  interval = 500
): Promise<PiniaInstance | null> {
  cancelWaitForPinia()

  return new Promise(resolve => {
    const start = Date.now()

    const tick = () => {
      const pinia = findPinia()
      if (pinia) {
        waitForPiniaTimeoutId = null
        return resolve(pinia)
      }

      if (Date.now() - start > timeout) {
        waitForPiniaTimeoutId = null
        return resolve(null)
      }

      waitForPiniaTimeoutId = setTimeout(tick, interval)
    }

    tick()
  })
}

/**
 * Subscribe to Pinia store changes
 */
export function watchPiniaStores(pinia: PiniaInstance, onUpdate: () => void): () => void {
  if (!pinia._s || !(pinia._s instanceof Map)) {
    return () => {}
  }

  const originalSet = pinia._s.set.bind(pinia._s)
  const originalDelete = pinia._s.delete.bind(pinia._s)

  pinia._s.set = function (...args) {
    const result = originalSet(...args)
    onUpdate()
    return result
  }

  pinia._s.delete = function (...args) {
    const result = originalDelete(...args)
    onUpdate()
    return result
  }

  // Return cleanup function
  return () => {
    pinia._s.set = originalSet
    pinia._s.delete = originalDelete
  }
}
