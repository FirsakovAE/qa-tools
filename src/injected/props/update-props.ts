// src/injected/update-props.ts

import { resolveComponent } from './find-by-path'

/**
 * Сохраняет тип данных при обновлении значения
 */
function preserveType(oldValue: any, newValue: any) {
  if (oldValue instanceof Set) {
    return newValue instanceof Set
      ? newValue
      : new Set(Array.isArray(newValue) ? newValue : [])
  }

  if (oldValue instanceof Map) {
    return newValue instanceof Map
      ? newValue
      : new Map(newValue ?? [])
  }

  return newValue
}

/**
 * Разворачивает ref и присваивает значение
 */
function unwrapAndAssign(oldValue: any, newValue: any) {
  if (oldValue?.__v_isRef) {
    oldValue.value = newValue
    return oldValue
  }
  return preserveType(oldValue, newValue)
}

/**
 * Проверяет, является ли проп двусторонне связанным (useModel)
 */
function isModelProp(instance: any, key: string): boolean {
  const propName = key.replace(/^-/, '')
  const updateEvent = `update:${propName}`

  // Vue 3
  if (instance?.emitsOptions?.[updateEvent]) return true

  // Vue 2 fallback
  if (instance?.$listeners?.[updateEvent]) return true

  return false
}

/**
 * Обновляет двусторонне связанный проп через emit
 */
function updateModelProp(instance: any, key: string, value: any): boolean {
  const propName = key.replace(/^-/, '')
  const updateEvent = `update:${propName}`

  if (instance?.emit) {
    instance.emit(updateEvent, value)
    return true
  }

  if (instance?.$emit) {
    instance.$emit(updateEvent, value)
    return true
  }

  return false
}

/**
 * Обновляет пропсы компонента по указанному пути.
 * @param path - Путь к компоненту (или UID для обратной совместимости).
 * @param newProps - Новые значения пропсов.
 * @returns true, если обновление прошло успешно, иначе false.
 */
export function updateComponentProps(
  path: string,
  newProps: Record<string, any>
): boolean {
  let resolved = resolveComponent(path) ?? findComponentByUidFallback(path)

  if (!resolved?.instance?.props) {
    return false
  }

  let success = false
  const props = resolved.instance.props

  for (const key in newProps) {
    if (!(key in props)) continue

    try {
      const oldValue = props[key]

      // Для useModel пропсов используем emit вместо прямого присваивания
      if (isModelProp(resolved.instance, key)) {
        if (updateModelProp(resolved.instance, key, newProps[key])) {
          success = true
          continue
        }
      }

      // Обычное обновление props с сохранением типа и защитой от ref
      const nextValue = unwrapAndAssign(oldValue, newProps[key])
      props[key] = nextValue
      success = true

    } catch (e) {
    }
  }

  return success
}

/**
 * Fallback функция для поиска компонента по UID (как в старом коде)
 */
function findComponentByUidFallback(uid: string) {

  const { findVueRoots, extractRootVNode, detectVueContext } = require('./vue-detect')
  const vueRoots = findVueRoots()
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2

  // Рекурсивная функция для поиска компонента по дереву
  function findInTree(vnode: any, path: string = ''): any {
    if (!vnode) return null

    // Проверяем текущий vnode
    let instance = null
    if (isVue2) {
      instance = vnode.componentInstance || vnode.context
    } else {
      instance = vnode.component
    }

    if (instance) {
      // Проверяем UID
      const instanceUid = instance.uid || instance._uid
      const instanceName = instance.type?.name || instance.type?.__name || instance.$options?.name

      if (instanceUid === uid || instanceUid?.toString() === uid ||
          instanceName === uid) {
        return {
          vnode: vnode,
          instance: instance,
          propsTarget: instance.props || vnode.props,
          isVue2
        }
      }
    }

    // Рекурсивно ищем в дочерних элементах
    if (vnode.children && Array.isArray(vnode.children)) {
      for (let i = 0; i < vnode.children.length; i++) {
        const found = findInTree(vnode.children[i], `${path}.children[${i}]`)
        if (found) return found
      }
    }

    // Для Vue 3 проверяем subTree
    if (!isVue2 && vnode.component?.subTree) {
      const found = findInTree(vnode.component.subTree, `${path}.subTree`)
      if (found) return found
    }

    // Для Vue 2 проверяем $children
    if (isVue2 && instance?.$children) {
      for (let i = 0; i < instance.$children.length; i++) {
        const child = instance.$children[i]
        if (child.$vnode) {
          const found = findInTree(child.$vnode, `${path}.$children[${i}]`)
          if (found) return found
        }
      }
    }

    return null
  }

  // Ищем во всех корнях
  for (let rootIndex = 0; rootIndex < vueRoots.length; rootIndex++) {
    const root = vueRoots[rootIndex]
    const rootVNode = extractRootVNode(root)
    if (rootVNode) {
      const found = findInTree(rootVNode, `root[${rootIndex}]`)
      if (found) return found
    }
  }

  return null
}
