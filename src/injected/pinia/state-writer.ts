import { PiniaStore } from './types'
import { getStore } from './state-reader'
import { getStoreStateKeys, getGetterKeys, isComputedRef, isVueRef } from './store-meta'
import { isVueReactive } from './unwrap'

/**
 * Разбирает путь, поддерживая индексы массивов
 * Пример: "items[0].name" -> ["items", "0", "name"]
 */
export function parsePath(path: string): string[] {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.')
}

/**
 * Устанавливает значение по пути (поддерживает массивы вроде "items[0].name")
 */
export function setByPath(target: any, path: string, value: any): void {
  const parts = parsePath(path)
  let obj = target
  
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!(key in obj)) obj[key] = {}
    obj = obj[key]
  }
  
  obj[parts[parts.length - 1]] = value
}

/**
 * Записывает значение ref
 */
export function writeRefValue(ref: any, value: any): boolean {
  if (isVueRef(ref)) {
    ref.value = value
    return true
  }
  return false
}

/**
 * Записывает значение в реактивный объект
 */
export function writeReactiveObject(obj: any, value: any): boolean {
  if (isVueReactive(obj)) {
    if (Array.isArray(obj) && Array.isArray(value)) {
      obj.length = 0
      obj.push(...value)
      return true
    } else if (!Array.isArray(obj) && typeof value === 'object' && value !== null) {
      const keysToPreserve = Object.keys(obj).filter(k => typeof obj[k] === 'function')
      const preservedFunctions: Record<string, any> = {}
      for (const k of keysToPreserve) {
        preservedFunctions[k] = obj[k]
      }
      Object.keys(obj).forEach(k => delete obj[k])
      Object.assign(obj, value)
      Object.assign(obj, preservedFunctions)
      return true
    }
  }
  return false
}

/**
 * Записывает примитивное значение
 */
export function writePrimitive(target: any, key: string, value: any): boolean {
  if (target && typeof target === 'object' && key in target) {
    target[key] = value
    return true
 }
  return false
}

/**
 * Патчит состояние хранилища (обрабатывает все паттерны: setup, options, гибрид)
 */
export function patchState(storeId: string, path: string, value: any): boolean {
  const store = getStore(storeId)
  if (!store) {
    return false
 }
  
  try {
    // Parse path
    const parts = parsePath(path)
    const rootKey = parts[0]
    
    // Determine where root key lives (store or $state)
    let target: any
    if (rootKey in store && !rootKey.startsWith('$') && !rootKey.startsWith('_') && typeof store[rootKey] !== 'function') {
      target = store
    } else if (store.$state && rootKey in store.$state) {
      target = store.$state
    } else {
      // Try store as default
      target = store
    }
    
    // Navigate to target, unwrapping refs along the way
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]]
      if (target === undefined) {
        return false
      }
      // Unwrap ref if encountered in path
      if (isVueRef(target)) {
        target = target.value
      }
    }
    
    const lastKey = parts[parts.length - 1]
    const finalTarget = target[lastKey]
    
    // 🚫 computed getter — запрещено
    if (isComputedRef(finalTarget)) {
      return false
    }
    
    // Set value, handling ref at final position
    if (isVueRef(finalTarget)) {
      finalTarget.value = value
    } else {
      target[lastKey] = value
    }
    
    return true
  } catch (e) {
    console.error('[injected/pinia/state-writer] patchState failed:', storeId, path, e)
    return false
  }
}

/**
 * Заменяет все состояние хранилища (обрабатывает все паттерны: setup, options, гибрид)
 */
export function replaceState(storeId: string, newState: Record<string, any>): boolean {
  const store = getStore(storeId)
  if (!store) {
    return false
  }
  
  try {
    // 🔥 Use $patch with callback - the ONLY reliable way to update Pinia store
    if (typeof store.$patch === 'function') {
      store.$patch(() => {
        for (const key of Object.keys(newState)) {
          const nextValue = newState[key]
          
          // Skip getters (computed refs)
          if (store[key] && isComputedRef(store[key])) {
            continue
          }
          
          // Skip defineProperty getters (options-store getters)
          const descriptor = Object.getOwnPropertyDescriptor(store, key)
          if (descriptor && typeof descriptor.get === 'function' && typeof descriptor.set !== 'function') {
            continue
          }
          
          // Skip functions
          if (typeof store[key] === 'function') {
            continue
          }
          
          // Check if key is a ref
          if (isVueRef(store[key])) {
            store[key].value = nextValue
          } else if (store[key] && typeof store[key] === 'object' && !Array.isArray(store[key])) {
            const existingObj = store[key]
            const keysToPreserve = Object.keys(existingObj).filter(k => typeof existingObj[k] === 'function')
            const preservedFunctions: Record<string, any> = {}
            for (const k of keysToPreserve) {
              preservedFunctions[k] = existingObj[k]
            }
            Object.keys(existingObj).forEach(k => delete existingObj[k])
            Object.assign(existingObj, nextValue)
            Object.assign(existingObj, preservedFunctions)
          } else {
            // For primitives - try $state first, then store directly
            if (store.$state && Object.prototype.hasOwnProperty.call(store.$state, key)) {
              store.$state[key] = nextValue
            } else {
              store[key] = nextValue
            }
          }
        }
      })
      
      return true
    }

    // Fallback: direct assignment (may not trigger reactivity)
    for (const key of Object.keys(newState)) {
      if (typeof store[key] === 'function') continue
      if (isComputedRef(store[key])) continue
      store[key] = newState[key]
    }
    return true
  } catch (e) {
    console.error('[injected/pinia/state-writer] replaceState failed:', storeId, e)
    return false
  }
}

/**
 * Патчит геттеры, находя и обновляя исходное состояние
 * Геттеры = f(состояние), поэтому мы обновляем состояние, чтобы изменить значения геттеров
 */
export function patchGetters(storeId: string, newGetters: Record<string, any>): {
  success: boolean
  updated: string[]      // Real state updated
} {
  const store = getStore(storeId)
  if (!store) {
    return { success: false, updated: [] }
  }

  const updated: string[] = []      // Keys where real state was updated
  const stateKeys = new Set(Object.keys(store.$state || {}))

  try {
    store.$patch(() => {
      for (const key of Object.keys(newGetters)) {
        const newValue = newGetters[key]

        // Strategy 1: If key exists in $state - update it directly
        // (This handles cases where "getter" is actually state exposed on store)
        if (stateKeys.has(key)) {
          if (store.$state) {
            store.$state[key] = newValue
            updated.push(key)
          }
          continue
        }

        // Strategy 2: Check if store[key] is a writable ref (not computed)
        const storeValue = store[key]
        if (isVueRef(storeValue) && !isComputedRef(storeValue)) {
          storeValue.value = newValue
          updated.push(key)
          continue
        }

        // Strategy 3: For objects/arrays on store that are reactive but not in $state
        if (storeValue && typeof storeValue === 'object' && !isComputedRef(storeValue)) {
          if (Array.isArray(storeValue) && Array.isArray(newValue)) {
            storeValue.length = 0
            storeValue.push(...newValue)
            updated.push(key)
            continue
          } else if (!Array.isArray(storeValue) && typeof newValue === 'object') {
            const keysToPreserve = Object.keys(storeValue).filter(k => typeof storeValue[k] === 'function')
            const preservedFunctions: Record<string, any> = {}
            for (const k of keysToPreserve) {
              preservedFunctions[k] = storeValue[k]
            }
            Object.keys(storeValue).forEach(k => delete storeValue[k])
            Object.assign(storeValue, newValue)
            Object.assign(storeValue, preservedFunctions)
            updated.push(key)
            continue
          }
        }

        // For computed getters - skip, cannot update
      }
    })

    return { success: true, updated }
  } catch (e) {
    console.error('[injected/pinia/state-writer] patchGetters failed:', storeId, e)
    return { success: false, updated }
  }
}