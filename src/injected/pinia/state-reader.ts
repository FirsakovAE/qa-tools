import { PiniaStore } from './types'
import { getStoreStateKeys } from './store-meta'
import { unwrapValue } from './unwrap'
import { getPiniaInstance } from './context'

/**
 * Интерфейс для снимка состояния хранилища
 */
export interface StoreSnapshot {
  [key: string]: any
}

/**
 * Создает снимок состояния хранилища (безопасно для setup и options хранилищ)
 */
export function createSnapshot(store: PiniaStore): StoreSnapshot {
  const snapshot: StoreSnapshot = {}
  const keys = getStoreStateKeys(store)

  for (const key of keys) {
    try {
      // Use unwrapValue to handle refs and reactive objects
      snapshot[key] = unwrapValue(store[key])
    } catch {
      snapshot[key] = '[Non-serializable]'
    }
  }

 return snapshot
}

/**
 * Получает состояние хранилища (с проверкой актуальности)
 */
export function getStoreState(storeId: string): any {
  const store = getStore(storeId)
  if (!store) return null
  return createSnapshot(store)
}

/**
 * Получает список всех ID хранилищ
 */
export function getStoresList(): string[] {
  const pinia = getPiniaInstance()
  if (!pinia) return []
  return Array.from(pinia._s.keys())
}

/**
 * Получает хранилище по ID
 */
export function getStore(storeId: string): PiniaStore | null {
  const pinia = getPiniaInstance()
  if (!pinia) return null
  return pinia._s.get(storeId) || null
}