import { PiniaStore } from './types'
import { getStore } from './state-reader'
import { getActionKeys } from './store-meta'
import { unwrapValue } from './unwrap'

/**
 * Получает список действий хранилища
 */
export function getStoreActions(storeId: string): string[] {
  const store = getStore(storeId)
  if (!store) return []
  return getActionKeys(store)
}

/**
 * Вызывает действие с распаковкой результата
 */
export async function callAction(storeId: string, actionName: string, ...args: any[]): Promise<any> {
  const store = getStore(storeId)
  if (!store) {
    throw new Error(`Store "${storeId}" not found`)
  }
  
  if (typeof store[actionName] !== 'function') {
    throw new Error(`Action "${actionName}" not found in store "${storeId}"`)
  }

  try {
    const result = await store[actionName](...args)
    return result
  } catch (e) {
    throw e
  }
}

/**
 * Вызывает действие и распаковывает результат (для значений ref)
 */
export async function callActionUnwrapped(storeId: string, actionName: string, ...args: any[]): Promise<any> {
  const result = await callAction(storeId, actionName, ...args)
  return unwrapValue(result)
}