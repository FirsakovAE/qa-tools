import { findPinia } from './detect'
import type { PiniaInstance } from './types'

export interface PiniaContext {
  pinia: PiniaInstance | null
  liveStoreIds: Set<string>
  lastScan: number
}

let globalPiniaContext: PiniaContext | null = null

/**
 * Возвращает контекст Pinia, при необходимости инициализируя его
 */
export function getPiniaContext(forceRefresh = false): PiniaContext {
  if (!globalPiniaContext || forceRefresh) {
    globalPiniaContext = createPiniaContext()
  }
  return globalPiniaContext
}

/**
 * Создает новый контекст Pinia
 */
function createPiniaContext(): PiniaContext {
  const pinia = findPinia()
  
  let liveStoreIds = new Set<string>()
  if (pinia && pinia._s) {
    if (pinia._s instanceof Map) {
      liveStoreIds = new Set(Array.from(pinia._s.keys()))
    } else {
      liveStoreIds = new Set(Object.keys(pinia._s))
    }
  }
  
  return {
    pinia,
    liveStoreIds,
    lastScan: Date.now()
  }
}

/**
 * Обновляет контекст Pinia
 */
export function updatePiniaContext(): PiniaContext {
  globalPiniaContext = createPiniaContext()
  return globalPiniaContext
}

/**
 * Возвращает актуальный экземпляр Pinia
 */
export function getPiniaInstance(): PiniaInstance | null {
  return getPiniaContext().pinia
}

/**
 * Возвращает актуальные ID активных хранилищ
 */
export function getLiveStoreIds(): Set<string> {
 return getPiniaContext().liveStoreIds
}

/**
 * Проверяет, активно ли хранилище
 */
export function isStoreActive(storeId: string): boolean {
  return getLiveStoreIds().has(storeId)
}