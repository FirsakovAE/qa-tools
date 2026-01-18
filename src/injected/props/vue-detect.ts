// src/injected/vue-detect.ts

/**
 * Интерфейс для экземпляра Vue компонента
 */
interface VueInstance {
  _uid?: number
  $options?: { name?: string }
  type?: { name?: string; __name?: string; displayName?: string }
  props?: Record<string, any>
  subTree?: any
  root?: any
  _instance?: any
  _container?: any
  setupState?: any
}

/**
 * Интерфейс для HTML элемента с Vue свойствами
 */
interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

/**
 * Интерфейс для контекста Vue (для унификации работы с Vue 2 и Vue 3)
 */
interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}


/**
 * Находит корневые элементы Vue приложений на странице.
 * Ищет по широкому набору селекторов для максимального покрытия.
 * @returns Массив корневых элементов Vue приложений.
 */
export function findVueRoots(): VueHTMLElement[] {
  const vueRoots: VueHTMLElement[] = []

  // Шаг 1: Ищем по широкому набору селекторов (как в рабочей версии)
  const selector = '[__vue_app__], [__vue__], div, main, section, article, #app, #root, [class*="app"], [class*="vue"], [id*="app"]'
  document.querySelectorAll<HTMLElement>(selector).forEach(el => {
    const vEl = el as VueHTMLElement
    if ((vEl.__vue_app__ || vEl.__vue__ || vEl._vnode) && !vueRoots.includes(vEl)) {
      vueRoots.push(vEl)
    }
  })

  // Шаг 2: Если ничего не нашли - проверяем DevTools hook
  if (vueRoots.length === 0) {
    const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (hook?.apps && hook.apps.length > 0) {
      for (const app of hook.apps) {
        const rootEl = app._instance?.root?.el || app._container?._vnode?.el
        if (rootEl && rootEl instanceof HTMLElement && !vueRoots.includes(rootEl as VueHTMLElement)) {
          vueRoots.push(rootEl as VueHTMLElement)
        }
      }
    }
  }

  return vueRoots
}

/**
 * Извлекает корневой VNode из корневого элемента Vue приложения.
 * @param root - Корневой элемент Vue приложения.
 * @returns Корневой VNode или null.
 */
export function extractRootVNode(root: VueHTMLElement): any {
 if (root.__vue_app__) {
    // Vue 3
    const app = root.__vue_app__ as any
    return app._instance?.root ?? app._container?._vnode ?? root._vnode
  } else if (root.__vue__) {
    // Vue 2
    const vue2Instance = root.__vue__ as any
    const rootInstance = vue2Instance.$root || vue2Instance
    return rootInstance.$vnode || rootInstance
  }
  return root._vnode
}

/**
 * Проверяет, обнаружен ли Vue на странице.
 * @returns true, если Vue обнаружен, иначе false.
 */
export function isVueDetected(): boolean {
  const vueRoots = findVueRoots()
  const hasDevToolsHook = !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
  const hasVue2 = !!(window as any).__VUE__

  return vueRoots.length > 0 || hasDevToolsHook || hasVue2
}

// Функция уже экспортирована как 'export function', убираем дублирующий экспорт

/**
 * Создает контекст Vue для унифицированной работы с Vue 2 и Vue 3.
 * @returns Контекст Vue с информацией о версии и корнях.
 */
export function detectVueContext(): VueContext {
  const vueRoots = findVueRoots()


  // Проверяем наличие Vue 3 приложения (новая логика)
  const hasVue3App = vueRoots.some(root => {
    if (root.__vue_app__) return true
    // Для CDN версии проверяем наличие _vnode и component
    const vnode = (root as any)._vnode
    return vnode && vnode.component
  })

  // Проверяем наличие Vue 2 приложения
  const hasVue2App = vueRoots.some(root => root.__vue__ && !root.__vue_app__)

  // Определяем версию Vue: приоритет Vue 3
  const version: 2 | 3 = hasVue3App ? 3 : (hasVue2App ? 2 : 3) // По умолчанию Vue 3

  return {
    version,
    roots: vueRoots
  }
}