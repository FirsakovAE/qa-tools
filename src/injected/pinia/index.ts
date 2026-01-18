// Основной модуль Pinia Inspector API
// Объединяет все подмодули в единый интерфейс
// Инициализируется только когда Pinia обнаружен

// Bridge импортируется, но не активируется до вызова initPiniaModule
import { initPiniaBridge } from './bridge'

let initialized = false

/**
 * Инициализирует модуль pinia (регистрирует message handlers)
 */
export function initPiniaModule() {
  if (initialized) return
  initialized = true
  initPiniaBridge()
}

import { findPinia, isPiniaDetected } from './detect'
import { getPiniaContext, getPiniaInstance, getLiveStoreIds, isStoreActive, updatePiniaContext } from './context'
import { getStore, getStoresList, getStoreState, createSnapshot } from './state-reader'
import { getStoreGetters } from './getters'
import { getStoreActions, callAction, callActionUnwrapped } from './actions'
import { patchState, replaceState, patchGetters, parsePath, setByPath } from './state-writer'
import { 
  isVueRef, 
  isVueReactive, 
  isComputedRef, 
  unwrapValue, 
  unwrapRef, 
  unwrapReactive, 
  toPlainObject 
} from './unwrap'
import { 
  getStoreStateKeys, 
  getGetterKeys, 
  getActionKeys, 
  isSetupStore, 
  normalizeStoreId, 
  analyzeStore,
  detectSetupStoreByFlag,
  detectSetupStoreByEmptyState,
  detectSetupStoreByRefs
} from './store-meta'
import { buildStoreSearchIndex, flattenObject } from './search'
import { PiniaStore, PiniaInstance, StoreSummary, SearchIndexEntry } from './types'

// Основной интерфейс Pinia Inspector API
export const PiniaInspectorAPI = {
  // Detection
  findPinia,
  isPiniaDetected,
  
  // Context
  getPiniaContext,
  getPiniaInstance,
  getLiveStoreIds,
  isStoreActive,
  updatePiniaContext,
  
  // Store access
 getStore,
  getStoresList,
 getStoreState,
  createSnapshot,
  
  // Getters
  getStoreGetters,
  
  // Actions
  getStoreActions,
  callAction,
 callActionUnwrapped,
  
  // State writing
  patchState,
  replaceState,
  patchGetters,
  parsePath,
  setByPath,
  
  // Unwrap utilities
  isVueRef,
  isVueReactive,
  isComputedRef,
  unwrapValue,
  unwrapRef,
 unwrapReactive,
  toPlainObject,
  
  // Store meta
  getStoreStateKeys,
  getGetterKeys,
  getActionKeys,
  isSetupStore,
  normalizeStoreId,
  analyzeStore,
  detectSetupStoreByFlag,
  detectSetupStoreByEmptyState,
  detectSetupStoreByRefs,
  
 // Search
  buildStoreSearchIndex,
  flattenObject,
  
  // Types are not included in runtime object
}

// Экспортируем отдельные модули для более точного использования
export { 
  // Detection
  findPinia, 
  isPiniaDetected,
  
  // Context
  getPiniaContext,
  getPiniaInstance,
  getLiveStoreIds,
  isStoreActive,
  updatePiniaContext,
  
  // Store access
  getStore,
  getStoresList,
 getStoreState,
  createSnapshot,
  
  // Getters
  getStoreGetters,
  
  // Actions
  getStoreActions,
  callAction,
  callActionUnwrapped,
  
  // State writing
 patchState,
  replaceState,
  patchGetters,
  parsePath,
  setByPath,
  
  // Unwrap utilities
  isVueRef,
  isVueReactive,
  isComputedRef,
  unwrapValue,
  unwrapRef,
  unwrapReactive,
  toPlainObject,
  
  // Store meta
  getStoreStateKeys,
  getGetterKeys,
  getActionKeys,
  isSetupStore,
  normalizeStoreId,
  analyzeStore,
  detectSetupStoreByFlag,
  detectSetupStoreByEmptyState,
  detectSetupStoreByRefs,
  
  // Search
  buildStoreSearchIndex,
  flattenObject
}

export type { 
  PiniaStore, 
  PiniaInstance, 
  StoreSummary, 
  SearchIndexEntry 
}

// Глобальная регистрация
(window as any).__PINIA_INSPECTOR__ = PiniaInspectorAPI