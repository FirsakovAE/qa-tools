/**
 * Интерфейс для хранилища Pinia
 */
export interface PiniaStore {
  $id: string
  $state: Record<string, any>
  $patch: (state: any) => void
  $subscribe: (callback: any) => void
  [key: string]: any
}

/**
 * Интерфейс для экземпляра Pinia
 */
export interface PiniaInstance {
  _s: Map<string, any> | Record<string, any>
  $id?: string
}

/**
 * Интерфейс для информации о хранилище
 */
export interface StoreSummary {
  id: string
  baseId: string
  stateKeys: number
  getterKeys: number
  actions: number
  lastUpdated: number
  lastUpdatedFormatted: string
}

/**
 * Интерфейс для поискового индекса
 */
export interface SearchIndexEntry {
  storeId: string
  baseId: string
  type: 'state' | 'getter'
  key: string
  value: any
  valueStr: string
}