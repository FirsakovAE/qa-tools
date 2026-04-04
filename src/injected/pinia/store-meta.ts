import { PiniaStore } from './types'

export interface StoreShape {
  stateKeys: string[]
  getterKeys: string[]
  actionKeys: string[]
}

/**
 * Проверяет, является ли хранилище setup-хранилищем
 */
export function isSetupStore(store: PiniaStore): boolean {
  // 1. Official Pinia flag (if available)
  if ((store as any)._setupStore === true) {
    return true
  }
  
  // 2. Heuristic: if $state is empty but store has non-function keys → setup-store
  const stateKeys = Object.keys(store.$state || {})
  if (stateKeys.length === 0) {
    // Check if store has ref-like values
    for (const key of Object.keys(store)) {
      if (key.startsWith('$') || key.startsWith('_')) continue
      if (typeof store[key] === 'function') continue
      // Has non-function keys but empty $state → setup-store
      return true
    }
  }
  
  // 3. Check if store values are Vue refs (setup-store pattern)
  for (const key of Object.keys(store)) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    if (typeof store[key] === 'function') continue
    const value = store[key]
    if (value && typeof value === 'object' && value.__v_isRef === true) {
      return true
    }
  }
  
  return false
}

/**
 * Определяет тип хранилища по флагу
 */
export function detectSetupStoreByFlag(store: PiniaStore): boolean {
  return (store as any)._setupStore === true
}

/**
 * Определяет тип хранилища по пустому состоянию
 */
export function detectSetupStoreByEmptyState(store: PiniaStore): boolean {
  const stateKeys = Object.keys(store.$state || {})
  if (stateKeys.length === 0) {
    for (const key of Object.keys(store)) {
      if (key.startsWith('$') || key.startsWith('_')) continue
      if (typeof store[key] === 'function') continue
      return true
    }
  }
  return false
}

/**
 * Определяет тип хранилища по refs
 */
export function detectSetupStoreByRefs(store: PiniaStore): boolean {
  for (const key of Object.keys(store)) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    if (typeof store[key] === 'function') continue
    const value = store[key]
    if (value && typeof value === 'object' && value.__v_isRef === true) {
      return true
    }
  }
  return false
}

/**
 * Нормализует ID хранилища (удаляет динамические суффиксы)
 */
export function normalizeStoreId(storeId: string): string {
  return storeId.replace(/-\d+$/, '').replace(/_\d+$/, '')
}

/**
 * Анализирует структуру хранилища
 */
export function analyzeStore(store: PiniaStore): StoreShape {
  const stateKeys = getStoreStateKeys(store)
  const getterKeys = getGetterKeys(store)
  const actionKeys = getActionKeys(store)
  
  return {
    stateKeys,
    getterKeys,
    actionKeys
  }
}

/**
 * Получает ключи состояния (для options + setup + гибридных хранилищ)
 */
export function getStoreStateKeys(store: PiniaStore): string[] {
 // 🎯 For Pinia stores, $state is the SOURCE OF TRUTH for state keys
  // Keys on store but NOT in $state are GETTERS
  
  if (store.$state && typeof store.$state === 'object') {
    // Options-store or hybrid: use $state keys directly
    return Object.keys(store.$state)
  }
  
  // Setup-store without $state: collect all non-function, non-computed values
  const storeKeys: string[] = []

  for (const key of Object.keys(store)) {
    if (
      key.startsWith('$') ||
      key.startsWith('_') ||
      typeof store[key] === 'function'
    ) continue

    const value = store[key]

    // ❌ computed getter (ref with effect)
    if (isComputedRef(value)) continue

    // ✅ Include all non-function values (refs, reactive objects, plain values)
    storeKeys.push(key)
  }

  return storeKeys
}

/**
 * Проверяет, является ли значение вычисляемым ref (геттером)
 */
export function isComputedRef(value: any): boolean {
  if (!value || typeof value !== 'object') return false
  
  // Vue 3 ComputedRef has __v_isRef + effect (ReactiveEffect object)
  if (value.__v_isRef === true && value.effect !== undefined) {
    return true
  }
  
  // Alternative: check for _getter (internal computed property)
  if (value.__v_isRef === true && typeof value._getter === 'function') {
    return true
  }
  
  // Check for __v_isReadonly (computed are readonly by default)
  if (value.__v_isRef === true && value.__v_isReadonly === true) {
    return true
  }
  
  return false
}

/**
 * Проверяет, является ли значение Vue ref
 */
export function isVueRef(value: any): boolean {
  return !!(value && typeof value === 'object' && value.__v_isRef === true)
}

/**
 * Descriptor from own props or prototype chain — does not invoke accessors
 * (reading store[key] for Pinia options getters would run user code and can throw).
 */
function getPropertyDescriptorChain(obj: object, key: string): PropertyDescriptor | undefined {
  let cur: object | null = obj
  while (cur && cur !== Object.prototype) {
    const d = Object.getOwnPropertyDescriptor(cur, key)
    if (d) return d
    cur = Object.getPrototypeOf(cur)
  }
  return undefined
}

/**
 * Получает ключи геттеров из хранилища (несколько стратегий обнаружения)
 */
export function getGetterKeys(store: PiniaStore): string[] {
  const getters: string[] = []
  const stateKeys = new Set(Object.keys(store.$state || {}))

  const considerKey = (key: string) => {
    if (key.startsWith('$') || key.startsWith('_')) return
    if (getters.includes(key)) return

    const desc = getPropertyDescriptorChain(store, key)
    if (!desc) return

    // Options-store getters: accessor on instance/prototype (never call .get)
    if (typeof desc.get === 'function') {
      getters.push(key)
      return
    }

    // Actions are data properties whose value is a function
    if (typeof desc.value === 'function') return

    // Setup-store: computed() exposed as ComputedRef (inspect .value only)
    if (isComputedRef(desc.value)) {
      getters.push(key)
      return
    }

    // Keys on store but not in $state → treated as getters (Pinia pattern)
    if (!stateKeys.has(key)) {
      getters.push(key)
    }
  }

  for (const key of Object.keys(store)) {
    considerKey(key)
  }

  const proto = Object.getPrototypeOf(store)
  if (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue
      considerKey(key)
    }
  }

  return getters
}

/**
 * Получает ключи действий из хранилища (без чтения store[key]: геттеры не вызываются)
 */
export function getActionKeys(store: PiniaStore): string[] {
  const actions: string[] = []
  const keys = new Set<string>()
  for (const key in store) keys.add(key)
  for (const key of Object.getOwnPropertyNames(store)) keys.add(key)

  for (const key of keys) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    const desc = getPropertyDescriptorChain(store, key)
    if (!desc) continue
    if (typeof desc.get === 'function') continue
    if (typeof desc.value === 'function') actions.push(key)
  }
  return actions
}