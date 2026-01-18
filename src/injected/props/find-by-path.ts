// src/injected/find-by-path.ts

// Define interfaces locally to avoid import issues
interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}

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

/**
 * Единый контракт для найденного компонента
 */
export interface ResolvedComponent {
  /** Исходный vnode */
  vnode: any
  /** Экземпляр компонента (для Vue 3) или instance (для Vue 2) */
  instance: any | null
  /** Цель для записи props */
  propsTarget: Record<string, any> | null
  /** Флаг Vue 2 */
  isVue2: boolean
}
import { findVueRoots, extractRootVNode, detectVueContext } from './vue-detect'
import { getVueComponents as getAllVueComponents } from './collect-all'
import { getVueComponents } from './collect-all'
import { resolveAsyncComponent } from './async-wrapper'

/**
 * Ищет Vue компонент, связанный с данным DOM элементом.
 * Рекурсивно обходит дерево компонентов для поиска соответствия.
 * @param element - DOM-элемент для поиска.
 * @returns Найденный VNode компонента или null.
 */
export function findVueComponentByElement(element: HTMLElement): any {
  // Ищем Vue компонент по DOM элементу
  const vueRoots = findVueRoots()
  for (const root of vueRoots) {
    const rootVNode = extractRootVNode(root)
    if (!rootVNode) continue

    const findInVNode = (vnode: any): any => {
      if (!vnode) return null

      // Проверяем текущий vnode
      if (vnode.el === element || (vnode.component && vnode.component.subTree?.el === element)) {
        return vnode
      }

      // Рекурсивно ищем в дочерних элементах
      if (vnode.children && Array.isArray(vnode.children)) {
        for (const child of vnode.children) {
          const found = findInVNode(child)
          if (found) return found
        }
      }

      // Ищем в subTree компонента
      if (vnode.component?.subTree) {
        const found = findInVNode(vnode.component.subTree)
        if (found) return found
      }

      return null
    }

    const component = findInVNode(rootVNode)
    if (component) return component
  }

  return null
}

/**
 * Находит Vue компонент по его пути в дереве компонентов.
 * Возвращает только vnode без нормализации.
 * @param componentUid - Уникальный идентификатор компонента (путь).
 * @returns Найденный VNode компонента или null.
 */
export function findComponentByPath(componentUid: string): any {
  const vueRoots = findVueRoots()
  if (vueRoots.length === 0) {
    return null
  }

  // Новый формат: path::name::componentId[::selector][::text:content]
  const parts = componentUid.split('::')
  const actualPath = parts[0]
  const expectedName = parts[1]
  // componentId может содержать селектор, берем только базовую часть uid
  const expectedUidWithSelector = parts[2]
  const expectedUid = expectedUidWithSelector ? expectedUidWithSelector.split('::')[0] : null

  // Если componentUid содержит DOM селектор, используем его для поиска
  const selectorIndex = parts.findIndex((part, index) => {
    return (part.startsWith('#') || part.includes(' > ') || (part.includes('.') && index > 2))
  })

  if (selectorIndex !== -1) {
    let selector = parts.slice(selectorIndex).join('::').replace(/^::/, '')

    // Убираем текстовую часть для поиска по селектору
    if (selector.includes('::text:')) {
      selector = selector.split('::text:')[0]
    }

    try {
      const element = document.querySelector(selector)
      if (element && element instanceof HTMLElement) {
        // Найдем Vue компонент, связанный с этим элементом
        const component = findVueComponentByElement(element)
        if (component) {
          return component
        }
      }
    } catch (e) {
      // Игнорируем ошибки невалидных селекторов
    }
  }

  // Fallback: используем улучшенный подход для поиска по пути компонента
  const pathParts = actualPath.split('.')

  if (pathParts.length === 1 && pathParts[0] === 'root') {
    const root = vueRoots[0]
    const rootVNode = extractRootVNode(root)
    if (rootVNode && rootVNode.component) {
      return rootVNode
    }
    return null
  }

  if (pathParts.length === 0 || !pathParts[0].startsWith('root')) {
    return null
  }

  let rootIndex = 0
  if (pathParts[0].startsWith('root[')) {
    const rootIndexMatch = pathParts[0].match(/root\[(\d+)\]/)
    if (!rootIndexMatch) {
      return null
    }
    rootIndex = parseInt(rootIndexMatch[1], 10)
  } else if (pathParts[0] === 'root') {
    rootIndex = 0
  } else {
    return null
 }

  if (rootIndex >= vueRoots.length) {
    return null
 }

  const root = vueRoots[rootIndex]
  const rootVNode = extractRootVNode(root)
  if (!rootVNode) {
    return null
 }

  if (pathParts.length === 1) {
    return rootVNode
  }

  let current: any = rootVNode
  // Получаем контекст Vue для унификации работы с версиями
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2

  for (let i = 1; i < pathParts.length; i++) {
    const part = pathParts[i]

    if (part === 'subTree') {
      if (current.component?.subTree) {
        current = current.component.subTree
      }
      else if (isVue2) {
        if (current.child?.component?.subTree) {
          current = current.child.component.subTree
        } else if (current.child) {
          current = current.child
        } else if (current.componentInstance?.$vnode) {
          current = current.componentInstance.$vnode
        } else {
          return null
        }
      } else {
        return null
      }
    } else if (part.startsWith('children[')) {
      const indexMatch = part.match(/children\[(\d+)\]/)
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10)

        if (Array.isArray(current.children)) {
          if (index < current.children.length) {
            current = current.children[index]
          } else {
            return null
          }
        }
        else if (isVue2) {
          if (current.componentInstance?.$children && Array.isArray(current.componentInstance.$children)) {
            if (index < current.componentInstance.$children.length) {
              const childInstance = current.componentInstance.$children[index]
              current = childInstance.$vnode || childInstance
            } else {
              return null
            }
          }
          else if (current.context?.$children && Array.isArray(current.context.$children)) {
            if (index < current.context.$children.length) {
              const childInstance = current.context.$children[index]
              current = childInstance.$vnode || childInstance
            } else {
              return null
            }
          }
          else if (current.$children && Array.isArray(current.$children)) {
            if (index < current.$children.length) {
              const childInstance = current.$children[index]
              current = childInstance.$vnode || childInstance
            } else {
              return null
            }
          }
          else if (Array.isArray(current.children)) {
            if (index < current.children.length) {
              current = current.children[index]
            } else {
              return null
            }
          } else {
            return null
          }
        } else {
          return null
        }
      } else {
        return null
      }
    } else if (part.startsWith('vnodeChildren[')) {
      const indexMatch = part.match(/vnodeChildren\[(\d+)\]/)
      if (indexMatch && Array.isArray(current.children)) {
        const index = parseInt(indexMatch[1], 10)
        if (index < current.children.length) {
          current = current.children[index]
        } else {
          return null
        }
      } else {
        return null
      }
    } else {
      return null
    }

    if (!current) {
      return null
    }
  }

  // Проверяем имя компонента и uid, если они указаны в пути
  if (expectedName && current) {
    const currentName = current.component?.type?.name ||
                       current.component?.type?.__name ||
                       current.component?.type?.displayName ||
                       current.component?.type?.__file?.split('/').pop()?.replace(/\.vue$/, '') ||
                       (isVue2 ? current.$options?.name : null) ||
                       'Anonymous'

    // Проверяем имя компонента
    if (currentName !== expectedName) {
      // Продолжаем поиск
    } else {
      // Проверяем uid компонента, если он указан в пути
      if (expectedUid !== null && expectedUid !== 'undefined' && expectedUid !== 'null') {
        const currentUid = current.component?.uid || current._uid
        // Сравниваем только базовую часть uid (без селектора)
        if (currentUid && currentUid !== expectedUid && !expectedUid.startsWith('anon_')) {
          return null
        }
      }
      return current
    }
  }

  // Поиск по имени должен выполняться в resolveComponent

    // Если точная навигация по пути не удалась, возвращаем null
    // Искусственные объекты должны создаваться в resolveComponent через similarity search

  return current
}

/**
 * Находит и нормализует компонент к единому контракту ResolvedComponent
 * @param componentUid - Уникальный идентификатор компонента (путь)
 * @returns ResolvedComponent или null
 */
export function resolveComponent(componentUid: string): ResolvedComponent | null {
  // Сначала пытаемся найти настоящий vnode
  const componentVNode = findComponentByPath(componentUid)

  if (!componentVNode) {
    // Fallback: поиск по имени среди всех компонентов
    const parts = componentUid.split('::')
    const expectedName = parts[1]

    if (expectedName) {
      const allComponents = getAllVueComponents()
      const foundComponent = allComponents.find(comp => comp.name === expectedName)

      if (foundComponent) {
        // Пытаемся найти реальный vnode для этого компонента
        const realVNode = findComponentByRealVNode(expectedName, foundComponent)

        if (realVNode) {
          // Нашли реальный vnode, используем его
          const vueContext = detectVueContext()
          const isVue2 = vueContext.version === 2

          let instance = realVNode.component
          let propsTarget = null

          if (!isVue2 && instance) {
            const resolvedInstance = resolveAsyncComponent(instance) || instance
            propsTarget = resolvedInstance.props && canWrite(resolvedInstance.props) ? resolvedInstance.props :
                         realVNode.props && canWrite(realVNode.props) ? realVNode.props : null
          }

          return {
            vnode: realVNode,
            instance,
            propsTarget,
            isVue2
          }
        } else {
          // Реальный vnode не найден, используем искусственный объект
          return {
            vnode: {
              component: foundComponent,
              el: foundComponent.element,
              props: foundComponent.props
            },
            instance: foundComponent,
            propsTarget: foundComponent.props,
            isVue2: false
          }
        }
      }
    }

    return null
  }

  // Обработка искусственных объектов из поиска по имени
  if (componentVNode.component && componentVNode.el && componentVNode.props && !componentVNode.vnode) {
    return {
      vnode: componentVNode,
      instance: componentVNode.component,
      propsTarget: componentVNode.props,
      isVue2: false
    }
  }

  // Обработка настоящих vnode
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2

  let instance = null
  let propsTarget = null

  if (isVue2) {
    // Vue 2
    instance = componentVNode.componentInstance || componentVNode.context || componentVNode
    propsTarget = instance?.$props || instance?.propsData || instance?._props || null
  } else {
    // Vue 3
    instance = componentVNode.component

    if (instance) {
      // Разрешаем AsyncComponentWrapper
      const resolvedInstance = resolveAsyncComponent(instance) || instance

      // Приоритеты записи props для Vue 3
      const resolvedWritable = resolvedInstance.props && canWrite(resolvedInstance.props)
      const vnodeWritable = componentVNode.props && canWrite(componentVNode.props)

      if (resolvedWritable) {
        propsTarget = resolvedInstance.props
      } else if (vnodeWritable) {
        propsTarget = componentVNode.props
      } else {
        // Fallback - пробуем все варианты
        propsTarget = resolvedInstance.props || componentVNode.props || null
      }
    }
  }

  return {
    vnode: componentVNode,
    instance,
    propsTarget,
    isVue2
  }
}

/**
 * Ищет реальный vnode для компонента, найденного по имени
 */
function findComponentByRealVNode(expectedName: string, foundComponent: any): any {
  const vueRoots = findVueRoots()

  for (const root of vueRoots) {
    const rootVNode = extractRootVNode(root)
    if (!rootVNode) continue

    // Рекурсивный поиск компонента по имени
    const findInTree = (vnode: any): any => {
      if (!vnode) return null

      // Проверяем текущий vnode
      const componentName = vnode.component?.type?.name ||
                           vnode.component?.type?.__name ||
                           vnode.component?.type?.displayName ||
                           vnode.$options?.name

      if (componentName === expectedName) {
        return vnode
      }

      // Ищем в дочерних элементах
      if (vnode.children && Array.isArray(vnode.children)) {
        for (const child of vnode.children) {
          const found = findInTree(child)
          if (found) return found
        }
      }

      // Ищем в subTree
      if (vnode.component?.subTree) {
        const found = findInTree(vnode.component.subTree)
        if (found) return found
      }

      return null
    }

    const result = findInTree(rootVNode)
    if (result) {
      return result
    }
  }

  return null
}

/**
 * Проверяет, можно ли записывать в объект
 */
function canWrite(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  try {
    const testKey = Symbol('test')
    obj[testKey] = true
    delete obj[testKey]
    return true
  } catch {
    return false
  }
}
