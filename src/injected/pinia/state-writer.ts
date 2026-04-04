import { getStore } from './state-reader'
import { isComputedRef, isVueRef } from './store-meta'

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
 * Deep-merge plain JSON into existing reactive/plain objects (Pinia's mergeReactiveObjects
 * semantics). Never bulk-delete keys — that breaks Vue metadata and app invariants (e.g.
 * effects reading nested fields ending up as undefined → '.needs' access errors).
 */
function mergeLikePiniaInPlace(target: any, patch: Record<string, any>): void {
  for (const pKey of Object.keys(patch)) {
    const subPatch = patch[pKey]
    const targetSlot = target[pKey]

    if (isVueRef(targetSlot) && !isComputedRef(targetSlot)) {
      const inner = targetSlot.value
      if (
        subPatch &&
        typeof subPatch === 'object' &&
        !Array.isArray(subPatch) &&
        inner &&
        typeof inner === 'object' &&
        !Array.isArray(inner) &&
        !isVueRef(inner) &&
        !isComputedRef(inner)
      ) {
        mergeLikePiniaInPlace(inner, subPatch)
      } else {
        targetSlot.value = subPatch
      }
      continue
    }

    if (
      targetSlot &&
      typeof targetSlot === 'object' &&
      !Array.isArray(targetSlot) &&
      !isVueRef(targetSlot) &&
      !isComputedRef(targetSlot) &&
      subPatch &&
      typeof subPatch === 'object' &&
      !Array.isArray(subPatch)
    ) {
      mergeLikePiniaInPlace(targetSlot, subPatch)
      continue
    }

    target[pKey] = subPatch
  }
}

/** Writable ref: merge JSON into ref.value object when both sides are plain object trees. */
function assignRefValueFromJson(ref: any, newValue: any): void {
  if (!isVueRef(ref) || isComputedRef(ref)) return
  const inner = ref.value
  if (
    newValue &&
    typeof newValue === 'object' &&
    !Array.isArray(newValue) &&
    inner &&
    typeof inner === 'object' &&
    !Array.isArray(inner) &&
    !isVueRef(inner) &&
    !isComputedRef(inner)
  ) {
    mergeLikePiniaInPlace(inner, newValue)
  } else {
    ref.value = newValue
  }
}

/**
 * Pinia passes `pinia.state.value[storeId]` into `$patch(fn)`. For setup stores each
 * state slice is often a Ref — assigning `root[key] = jsonValue` drops the Ref and
 * breaks reactivity (errors like reading props of undefined inside effects).
 */
function assignToPiniaPatchRoot(patchRoot: any, key: string, newValue: any): void {
  const cell = patchRoot[key]
  if (isVueRef(cell) && !isComputedRef(cell)) {
    assignRefValueFromJson(cell, newValue)
    return
  }
  if (
    cell &&
    typeof cell === 'object' &&
    !Array.isArray(cell) &&
    !isVueRef(cell) &&
    !isComputedRef(cell) &&
    typeof newValue === 'object' &&
    newValue !== null &&
    !Array.isArray(newValue)
  ) {
    mergeLikePiniaInPlace(cell, newValue)
    return
  }
  if (Array.isArray(cell) && Array.isArray(newValue)) {
    cell.length = 0
    cell.push(...newValue)
    return
  }
  patchRoot[key] = newValue
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
            assignRefValueFromJson(store[key], nextValue)
          } else if (store[key] && typeof store[key] === 'object' && !Array.isArray(store[key])) {
            const existingObj = store[key]
            if (
              nextValue &&
              typeof nextValue === 'object' &&
              !Array.isArray(nextValue) &&
              !isVueRef(nextValue)
            ) {
              mergeLikePiniaInPlace(existingObj, nextValue)
            } else {
              try {
                store[key] = nextValue
              } catch {
                /* reactive proxy may block full replace on root */
              }
            }
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
  error?: string
} {
  const store = getStore(storeId)
  if (!store) {
    return {
      success: false,
      updated: [],
      error: `Store not found: ${storeId}`
    }
  }

  const updated: string[] = []      // Keys where real state was updated
  const keyFailures: string[] = []
  const stateKeysGlobal = new Set(Object.keys(store.$state || {}))

  const applyOneKey = (key: string, newValue: any, patchRoot: Record<string, any>) => {
    // Strategy 1: If key exists in $state - update Pinia's internal state root
    // (This handles cases where "getter" is actually state exposed on store)
    if (stateKeysGlobal.has(key)) {
      assignToPiniaPatchRoot(patchRoot, key, newValue)
      updated.push(key)
      return
    }

    // Strategy 2: Check if store[key] is a writable ref (not computed)
    const storeValue = store[key]
    if (isVueRef(storeValue) && !isComputedRef(storeValue)) {
      assignRefValueFromJson(storeValue, newValue)
      updated.push(key)
      return
    }

    // Strategy 3: For objects/arrays on store that are reactive but not in $state
    if (storeValue && typeof storeValue === 'object' && !isComputedRef(storeValue)) {
      if (Array.isArray(storeValue) && Array.isArray(newValue)) {
        storeValue.length = 0
        storeValue.push(...newValue)
        updated.push(key)
        return
      } else if (!Array.isArray(storeValue) && typeof newValue === 'object' && newValue !== null) {
        mergeLikePiniaInPlace(storeValue, newValue)
        updated.push(key)
        return
      }
    }

    // For computed getters - skip, cannot update
  }

  try {
    store.$patch((patchRoot: Record<string, any>) => {
      for (const key of Object.keys(newGetters)) {
        try {
          applyOneKey(key, newGetters[key], patchRoot)
        } catch (keyErr) {
          const msg = keyErr instanceof Error ? keyErr.message : String(keyErr)
          keyFailures.push(`${key}: ${msg}`)
          console.warn('[injected/pinia/state-writer] patchGetters key failed:', storeId, key, keyErr)
        }
      }
    })

    if (keyFailures.length && updated.length === 0) {
      const detail = keyFailures.join('; ')
      console.error('[injected/pinia/state-writer] patchGetters failed for all keys:', storeId, detail)
      return {
        success: false,
        updated,
        error: detail || 'Could not apply getter patch (see console)'
      }
    }

    if (keyFailures.length) {
      console.warn('[injected/pinia/state-writer] patchGetters partial failures:', storeId, keyFailures.join('; '))
    }

    return { success: true, updated }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[injected/pinia/state-writer] patchGetters failed:', storeId, e)
    return {
      success: false,
      updated,
      error: msg || 'patchGetters threw'
    }
  }
}