// src/injected/props/bridge.ts

import { findComponentByPath } from './find-by-path'
import { updateComponentProps } from './update-props'
import { isVueDetected, findVueRoots, detectVueContext } from './vue-detect'
import { serializeProps } from './serialize'

// Константы для типов сообщений
const MESSAGE_TYPES = {
  UPDATE_PROPS: 'VUE_INSPECTOR_UPDATE_PROPS',
  UPDATE_PROPS_RESULT: 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
  GET_COMPONENT_PROPS: 'VUE_INSPECTOR_GET_COMPONENT_PROPS',
  COMPONENT_PROPS_DATA: 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
  GET_COMPONENTS: 'VUE_INSPECTOR_GET_COMPONENTS',
  COMPONENTS_DATA: 'VUE_INSPECTOR_COMPONENTS_DATA',
  CHECK_VUE: 'VUE_INSPECTOR_CHECK_VUE',
  VUE_DETECTED: 'VUE_INSPECTOR_VUE_DETECTED',
  READY: 'VUE_INSPECTOR_READY'
} as const

let initialized = false

// Импорт getVueComponents делаем лениво чтобы избежать циклических зависимостей
function getVueComponentsLazy() {
  return (window as any).__VUE_INSPECTOR__?.getComponents?.() || []
}

function handleMessage(event: MessageEvent) {
  if (!event.data || typeof event.data !== 'object' || !event.data.type) {
    return
  }

  const { requestId } = event.data

  if (event.data.type === MESSAGE_TYPES.UPDATE_PROPS) {
    try {
      const { componentPath, props } = event.data
      const success = updateComponentProps(componentPath, props)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.UPDATE_PROPS_RESULT,
        success: success,
        error: success ? undefined : 'Failed to update component props',
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.UPDATE_PROPS_RESULT,
        success: false,
        error: String(e),
        requestId
      }, '*')
    }
  }

  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENT_PROPS) {
    try {
      const { componentPath } = event.data
      const componentVNode = findComponentByPath(componentPath)

      if (!componentVNode) {
        window.postMessage({
          __FROM_VUE_INSPECTOR__: true,
          type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
          props: {},
          requestId
        }, '*')
        return
      }

      const vueContext = detectVueContext()
      const isVue2 = vueContext.version === 2
      let props: Record<string, any> = {}

      if (isVue2) {
        const instance = componentVNode.componentInstance || componentVNode.context
        if (instance) {
          props = serializeProps(instance.$props || instance.propsData || instance._props || {})
        }
      } else {
        const instance = componentVNode.component
        if (instance) {
          props = serializeProps(instance.props || {})
        }
      }

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        props: props,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        props: {},
        requestId
      }, '*')
    }
  }

  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENTS) {
    try {
      const components = getVueComponentsLazy()

      const serializedComponents = components.map((comp: any) => {
        try {
          JSON.stringify(comp)
          return comp
        } catch (e) {
          return {
            name: comp.name,
            props: comp.props,
            path: comp.path,
            hasProps: comp.hasProps,
            propsCount: comp.propsCount,
            element: comp.element,
            rootElement: comp.rootElement
          }
        }
      })

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENTS_DATA,
        components: serializedComponents,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENTS_DATA,
        components: [],
        requestId
      }, '*')
    }
  }

  if (event.source === window && event.data?.type === MESSAGE_TYPES.CHECK_VUE) {
    const detected = isVueDetected()
    const vueRoots = findVueRoots()

    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: MESSAGE_TYPES.VUE_DETECTED,
      detected: detected,
      url: window.location.href,
      appCount: vueRoots.length,
      hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
      hasVue2: !!(window as any).__VUE__
    }, '*')
  }
}

/**
 * Инициализирует props bridge - регистрирует message handlers
 */
export function initPropsBridge() {
  if (initialized) return
  initialized = true

  window.addEventListener('message', handleMessage)

  // Автоматически отправляем сигнал о готовности
  if (isVueDetected()) {
    const vueRoots = findVueRoots()
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: MESSAGE_TYPES.VUE_DETECTED,
      detected: true,
      url: window.location.href,
      appCount: vueRoots.length,
      hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
      hasVue2: !!(window as any).__VUE__
    }, '*')
  }

  window.postMessage({
    __FROM_VUE_INSPECTOR__: true,
    type: MESSAGE_TYPES.READY
  }, '*')
}