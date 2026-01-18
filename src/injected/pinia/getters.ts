import { PiniaStore } from './types'
import { getStore } from './state-reader'
import { getGetterKeys } from './store-meta'
import { unwrapValue } from './unwrap'

/**
 * Получает значения геттеров хранилища (использует unwrapValue для computed refs)
 */
export function getStoreGetters(storeId: string): Record<string, any> {
  const store = getStore(storeId)
  if (!store) return {}

  const getters: Record<string, any> = {}
  const getterKeys = getGetterKeys(store)

  for (const key of getterKeys) {
    try {
      getters[key] = unwrapValue(store[key])
    } catch {
      getters[key] = '[Non-serializable]'
    }
  }

 return getters
}