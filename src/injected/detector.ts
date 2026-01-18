/**
 * Легковесный детектор Vue и Pinia
 * Не импортирует тяжёлые модули - только проверяет наличие
 */

export interface DetectionResult {
  hasVue: boolean
  hasPinia: boolean
  vueVersion: 2 | 3 | null
}

/**
 * Проверяет наличие Vue на странице
 */
export function detectVue(): { detected: boolean; version: 2 | 3 | null } {
  // Vue 3 через DevTools hook
  const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
  if (hook?.apps && hook.apps.length > 0) {
    return { detected: true, version: 3 }
  }
  
  // Vue 2 глобальный
  if ((window as any).__VUE__) {
    return { detected: true, version: 2 }
  }
  
  // Vue CDN
  const globalVue = (window as any).Vue
  if (globalVue) {
    if (globalVue.createApp) {
      return { detected: true, version: 3 }
    }
    if (globalVue.version?.startsWith('2')) {
      return { detected: true, version: 2 }
    }
  }
  
  // Проверяем DOM элементы
  const containers = ['#app', '#root', '[data-v-app]']
  for (const selector of containers) {
    try {
      const el = document.querySelector(selector) as any
      if (el?.__vue_app__) {
        return { detected: true, version: 3 }
      }
      if (el?.__vue__) {
        return { detected: true, version: 2 }
      }
    } catch (e) { /* ignore */ }
  }
  
  // Проверяем body children
  const children = document.body?.children
  if (children) {
    const max = Math.min(children.length, 10)
    for (let i = 0; i < max; i++) {
      const el = children[i] as any
      if (el.__vue_app__) {
        return { detected: true, version: 3 }
      }
      if (el.__vue__) {
        return { detected: true, version: 2 }
      }
    }
  }
  
  return { detected: false, version: null }
}

/**
 * Проверяет наличие Pinia на странице
 * Должна вызываться только если Vue уже обнаружен
 */
export function detectPinia(): boolean {
  // Через window._s (стандартное место для Pinia stores Map)
  try {
    const windowS = (window as any)._s
    if (windowS instanceof Map && windowS.size > 0) {
      return true
    }
  } catch (e) { /* ignore */ }
  
  // Через DevTools hook
  try {
    const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (hook?.apps) {
      for (const app of hook.apps) {
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia ||
                      app.config?.globalProperties?.$pinia
        if (pinia && pinia._s instanceof Map) {
          return true
        }
      }
    }
  } catch (e) { /* ignore */ }
  
  // Через Vue roots
  const containers = ['#app', '#root']
  for (const selector of containers) {
    try {
      const el = document.querySelector(selector) as any
      if (el?.__vue_app__) {
        const app = el.__vue_app__
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia
        if (pinia && pinia._s instanceof Map) {
          return true
        }
      }
    } catch (e) { /* ignore */ }
  }
  
  return false
}

/**
 * Выполняет полную детекцию
 */
export function detect(): DetectionResult {
  const vue = detectVue()
  
  // Pinia проверяем только если Vue найден
  const hasPinia = vue.detected ? detectPinia() : false
  
  return {
    hasVue: vue.detected,
    hasPinia,
    vueVersion: vue.version
  }
}
