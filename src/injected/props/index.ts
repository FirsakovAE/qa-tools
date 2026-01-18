// src/injected/props/index.ts

// Модуль для работы с Vue компонентами и пропсами
// Инициализируется только когда Vue обнаружен

// Bridge импортируется, но не активируется до вызова initPropsModule
import { initPropsBridge } from './bridge'

let initialized = false

/**
 * Инициализирует модуль props (регистрирует message handlers)
 */
export function initPropsModule() {
  if (initialized) return
  initialized = true
  initPropsBridge()
}

// НЕ импортируем pinia/bridge здесь - он загружается отдельно через main.ts

// Define interfaces locally to avoid import issues
interface ComponentInfo {
  name: string
  props: Record<string, any>
  path: string
  element: ElementInfo | null
  hasProps: boolean
  propsCount: number
  rootElement: ElementInfo | null
}

interface ElementInfo {
  tagName?: string
  id?: string
  className?: string
  testId?: string
}

interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}
import { findVueRoots, extractRootVNode, isVueDetected, detectVueContext } from './vue-detect'
import { collectComponentsRecursively } from './collect'
import { findComponentByPath } from './find-by-path'
import { updateComponentProps } from './update-props'
import { getVueComponents } from './collect-all'

// Создаем глобальный API
const vueInspectorAPI = {
  isVueDetected: () => isVueDetected(),
  getComponents: () => getVueComponents(),
  findComponentByPath: (path: string) => findComponentByPath(path),
  updateComponentProps: (path: string, newProps: Record<string, any>) => {
    return updateComponentProps(path, newProps)
  },
  getComponentProps: (path: string) => {
    const componentVNode = findComponentByPath(path)
    if (!componentVNode) {
      return null
    }

    let props: Record<string, any> = {}
    if (componentVNode.component) {
      const instance = componentVNode.component
      props = instance.props || {}
    } else if (componentVNode.props) {
      props = componentVNode.props
    }

    return props
 },
  findVueRoots: () => findVueRoots(),
  version: '1.0.0'
}

// Присваиваем API к глобальному объекту window
Object.assign(window as any, {
  __VUE_INSPECTOR__: vueInspectorAPI,
  __VUE_INSPECTOR_INJECTED__: {
    getComponents: () => getVueComponents(),
    isVueDetected: () => isVueDetected(),
    findComponentByPath: (path: string) => findComponentByPath(path),
    updateComponentProps: (path: string, newProps: Record<string, any>) => {
      return updateComponentProps(path, newProps)
    }
  }
})

// Экспортируем все основные функции
export {
  findVueRoots,
  extractRootVNode,
  isVueDetected,
  collectComponentsRecursively,
  findComponentByPath,
  updateComponentProps,
  getVueComponents,
  detectVueContext
}