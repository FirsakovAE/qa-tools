import { SearchIndexEntry } from './types'
import { getStoreGetters } from './getters'
import { getStoreState } from './state-reader'
import { getPiniaInstance } from './context'
import { normalizeStoreId } from './store-meta'

/**
 * Вспомогательная функция для преобразования вложенных объектов с ограничениями
 */
export function flattenObject(obj: any, prefix = '', result: Record<string, any> = {}): Record<string, any> {
  if (obj === null || obj === undefined) return result

  if (typeof obj !== 'object') {
    result[prefix] = obj
    return result
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const value = obj[i]
      const nextKey = prefix ? `${prefix}.${i}` : i.toString()

      if (typeof value === 'object' && value !== null) {
        flattenObject(value, nextKey, result)
      } else {
        result[nextKey] = value
      }
    }
    return result
  }

  // Handle regular objects
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    const nextKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null) {
      flattenObject(value, nextKey, result)
    } else {
      result[nextKey] = value
    }
  }

  return result
}

/**
 * Создает поисковый индекс для всех хранилищ
 */
export function buildStoreSearchIndex(): SearchIndexEntry[] {
  const index: SearchIndexEntry[] = []
  const pinia = getPiniaInstance()
  if (!pinia) return index

  for (const [storeId, store] of pinia._s.entries()) {
    const baseId = normalizeStoreId(storeId)

    // ---- STATE ----
    const stateSnapshot = getStoreState(storeId)
    if (stateSnapshot) {
      const flatState = flattenObject(stateSnapshot)

      for (const key in flatState) {
        const value = flatState[key]
        let valueStr: string

        if (value === null) {
          valueStr = 'null'
        } else if (value === undefined) {
          valueStr = 'undefined'
        } else if (typeof value === 'object') {
          valueStr = JSON.stringify(value)
        } else {
          valueStr = String(value)
        }

        valueStr = valueStr.toLowerCase()

        index.push({
          storeId,
          baseId,
          type: 'state' as const,
          key,
          value,
          valueStr
        })
      }
    }

    // ---- GETTERS ----
    const getters = getStoreGetters(storeId)
    const flatGetters = flattenObject(getters)

    for (const key in flatGetters) {
      const value = flatGetters[key]
      let valueStr: string

      if (value === null) {
        valueStr = 'null'
      } else if (value === undefined) {
        valueStr = 'undefined'
      } else if (typeof value === 'object') {
        valueStr = JSON.stringify(value)
      } else {
        valueStr = String(value)
      }

      valueStr = valueStr.toLowerCase()

      index.push({
        storeId,
        baseId,
        type: 'getter' as const,
        key,
        value,
        valueStr
      })
    }
  }

  return index
}