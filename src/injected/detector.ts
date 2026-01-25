/**
 * Reactive detector for Vue and Pinia
 * Uses event-based detection instead of polling for better performance
 * 
 * Detection strategies:
 * - Vue: __VUE_DEVTOOLS_GLOBAL_HOOK__ with app:init event
 * - Pinia: app.use() interception + app:init fallback
 */

export interface DetectionResult {
  hasVue: boolean
  hasPinia: boolean
  vueVersion: 2 | 3 | null
}

export interface DetectionCallbacks {
  onVueDetected?: (version: 2 | 3) => void
  onPiniaDetected?: () => void
}

// Global state
let vueDetected = false
let piniaDetected = false
let vueVersion: 2 | 3 | null = null
let callbacks: DetectionCallbacks = {}
let hookInstalled = false
let cleanupFunctions: (() => void)[] = []

/**
 * Install Vue DevTools hook if not present
 * This hook is checked by Vue when it initializes
 */
function ensureDevToolsHook(): any {
  if ((window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    return (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
  }
  
  // Create minimal hook that Vue will use
  const hook = {
    apps: [],
    emit: () => {},
    on: () => {},
    once: () => {},
    off: () => {},
    appRecords: [],
    // Buffer for events before Vue loads
    _buffer: [] as any[],
  }
  
  ;(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__ = hook
  return hook
}

/**
 * Check if an app has Pinia installed
 */
function checkAppForPinia(app: any): boolean {
  try {
    const pinia = app._context?.provides?.pinia ||
                  app._context?.config?.globalProperties?.$pinia ||
                  app.config?.globalProperties?.$pinia
    
    if (pinia && pinia._s instanceof Map) {
      return true
    }
  } catch (e) { /* ignore */ }
  
  return false
}

/**
 * Handle new Vue app registration
 */
function handleAppInit(app: any, version: 2 | 3) {
  if (!vueDetected) {
    vueDetected = true
    vueVersion = version
    callbacks.onVueDetected?.(version)
  }
  
  // Check for Pinia in this app
  if (!piniaDetected && checkAppForPinia(app)) {
    piniaDetected = true
    callbacks.onPiniaDetected?.()
  }
}

/**
 * Setup hook listeners for Vue app:init event
 */
function setupHookListeners(hook: any) {
  if (hookInstalled) return
  hookInstalled = true

  // Store original emit
  const originalEmit = hook.emit?.bind(hook) || (() => {})
  
  // Intercept emit for app:init and app:unmount
  hook.emit = function(event: string, ...args: any[]) {
    if (event === 'app:init') {
      const app = args[0]
      if (app) {
        handleAppInit(app, 3)
        
        // Also intercept app.use() for future Pinia installation
        interceptAppUse(app)
      }
    }
    
    return originalEmit(event, ...args)
  }
  
  // Check existing apps in the hook
  if (hook.apps && Array.isArray(hook.apps)) {
    for (const app of hook.apps) {
      handleAppInit(app, 3)
      interceptAppUse(app)
    }
  }
  
  // Also check appRecords (used by some Vue versions)
  if (hook.appRecords && Array.isArray(hook.appRecords)) {
    for (const record of hook.appRecords) {
      if (record.app) {
        handleAppInit(record.app, 3)
        interceptAppUse(record.app)
      }
    }
  }

  cleanupFunctions.push(() => {
    hook.emit = originalEmit
  })
}

/**
 * Intercept app.use() to detect Pinia installation
 */
function interceptAppUse(app: any) {
  if (!app || !app.use || app.__piniaIntercepted) return
  app.__piniaIntercepted = true
  
  const originalUse = app.use.bind(app)
  
  app.use = function(plugin: any, ...options: any[]) {
    const result = originalUse(plugin, ...options)
    
    // Check if this was Pinia
    if (!piniaDetected) {
      // Pinia adds itself to globalProperties.$pinia
      setTimeout(() => {
        if (checkAppForPinia(app)) {
          piniaDetected = true
          callbacks.onPiniaDetected?.()
        }
      }, 0)
    }
    
    return result
  }
}

/**
 * Immediate detection - checks current state without waiting
 */
export function detectVue(): { detected: boolean; version: 2 | 3 | null } {
  // Already detected
  if (vueDetected) {
    return { detected: true, version: vueVersion }
  }
  
  // Vue 3 via DevTools hook
  const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
  if (hook?.apps && hook.apps.length > 0) {
    vueDetected = true
    vueVersion = 3
    return { detected: true, version: 3 }
  }
  
  // Vue 2 global
  if ((window as any).__VUE__) {
    vueDetected = true
    vueVersion = 2
    return { detected: true, version: 2 }
  }
  
  // Vue CDN
  const globalVue = (window as any).Vue
  if (globalVue) {
    if (globalVue.createApp) {
      vueDetected = true
      vueVersion = 3
      return { detected: true, version: 3 }
    }
    if (globalVue.version?.startsWith('2')) {
      vueDetected = true
      vueVersion = 2
      return { detected: true, version: 2 }
    }
  }
  
  // Check DOM elements (quick check)
  const selectors = ['#app', '#root', '[data-v-app]']
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector) as any
      if (el?.__vue_app__) {
        vueDetected = true
        vueVersion = 3
        return { detected: true, version: 3 }
      }
      if (el?.__vue__) {
        vueDetected = true
        vueVersion = 2
        return { detected: true, version: 2 }
      }
    } catch (e) { /* ignore */ }
  }
  
  return { detected: false, version: null }
}

/**
 * Immediate detection for Pinia
 */
export function detectPinia(): boolean {
  if (piniaDetected) return true
  
  // Via window._s
  try {
    const windowS = (window as any)._s
    if (windowS instanceof Map && windowS.size > 0) {
      piniaDetected = true
      return true
    }
  } catch (e) { /* ignore */ }
  
  // Via DevTools hook
  try {
    const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (hook?.apps) {
      for (const app of hook.apps) {
        if (checkAppForPinia(app)) {
          piniaDetected = true
          return true
        }
      }
    }
  } catch (e) { /* ignore */ }
  
  // Via DOM elements
  const selectors = ['#app', '#root']
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector) as any
      if (el?.__vue_app__ && checkAppForPinia(el.__vue_app__)) {
        piniaDetected = true
        return true
      }
    } catch (e) { /* ignore */ }
  }
  
  return false
}

/**
 * Run full detection
 */
export function detect(): DetectionResult {
  const vue = detectVue()
  const hasPinia = vue.detected ? detectPinia() : false
  
  return {
    hasVue: vue.detected,
    hasPinia,
    vueVersion: vue.version
  }
}

/**
 * Setup reactive detection that will call callbacks when Vue/Pinia are detected later
 */
export function setupReactiveDetection(cbs: DetectionCallbacks): () => void {
  callbacks = cbs
  
  // Ensure hook exists for Vue to find
  const hook = ensureDevToolsHook()
  
  // Setup listeners on the hook
  setupHookListeners(hook)
  
  // Run immediate detection
  const result = detect()
  
  // If already detected, call callbacks
  if (result.hasVue && cbs.onVueDetected) {
    cbs.onVueDetected(result.vueVersion!)
  }
  
  if (result.hasPinia && cbs.onPiniaDetected) {
    cbs.onPiniaDetected()
  }
  
  // If not detected yet, setup MutationObserver as fallback for DOM-based detection
  let observer: MutationObserver | null = null
  
  if (!result.hasVue) {
    let checkCount = 0
    const maxChecks = 20 // Stop after 20 checks (about 10 seconds with 500ms interval)
    
    const checkDOM = () => {
      checkCount++
      
      if (!vueDetected) {
        const vue = detectVue()
        if (vue.detected) {
          cbs.onVueDetected?.(vue.version!)
          
          // Also check Pinia now that Vue is detected
          if (!piniaDetected && detectPinia()) {
            cbs.onPiniaDetected?.()
          }
        }
      }
      
      // Stop observing after max checks or when both detected
      if (checkCount >= maxChecks || (vueDetected && piniaDetected)) {
        observer?.disconnect()
        observer = null
      }
    }
    
    // Observe DOM changes (Vue mounting adds __vue_app__ to elements)
    observer = new MutationObserver(() => {
      // Debounce checks
      setTimeout(checkDOM, 100)
    })
    
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-v-app']
    })
    
    cleanupFunctions.push(() => {
      observer?.disconnect()
    })
  }
  
  // Return cleanup function
  return () => {
    cleanupFunctions.forEach(fn => fn())
    cleanupFunctions = []
    callbacks = {}
    hookInstalled = false
  }
}

/**
 * Get current detection state
 */
export function getDetectionState(): DetectionResult {
  return {
    hasVue: vueDetected,
    hasPinia: piniaDetected,
    vueVersion
  }
}

/**
 * Reset detection state (for testing)
 */
export function resetDetection(): void {
  vueDetected = false
  piniaDetected = false
  vueVersion = null
  callbacks = {}
  hookInstalled = false
  cleanupFunctions.forEach(fn => fn())
  cleanupFunctions = []
}
