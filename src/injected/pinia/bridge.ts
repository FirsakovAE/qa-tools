import { getStoresList, getStoreState } from './state-reader'
import { getStoreGetters } from './getters'
import { getStoreActions, callActionUnwrapped } from './actions'
import { isPiniaDetected, waitForPinia, watchPiniaStores } from './detect'
import { buildStoreSearchIndex } from './search'
import { patchState, replaceState, patchGetters } from './state-writer'
import { getStoreStateKeys, getGetterKeys, getActionKeys, normalizeStoreId } from './store-meta'
import { updatePiniaContext } from './context'

// Типы для сообщений
interface PiniaMessage<T = any> {
  type: string
  requestId: string
  payload?: T
}

interface GetStoresSummaryMessage extends PiniaMessage {
  type: 'PINIA_GET_STORES_SUMMARY'
}

interface GetStoreStateMessage extends PiniaMessage {
  type: 'PINIA_GET_STORE_STATE'
  storeId: string
}

interface PatchStateMessage extends PiniaMessage {
  type: 'PINIA_PATCH_STATE'
  storeId: string
  path: string
  value: any
}

interface ReplaceStateMessage extends PiniaMessage {
  type: 'PINIA_REPLACE_STATE'
  storeId: string
  newState: Record<string, any>
}

interface PatchGettersMessage extends PiniaMessage {
  type: 'PINIA_PATCH_GETTERS'
  storeId: string
  newGetters: Record<string, any>
}

interface CallActionMessage extends PiniaMessage {
  type: 'PINIA_CALL_ACTION'
  storeId: string
  actionName: string
  args: any[]
}

interface CheckDetectedMessage extends PiniaMessage {
  type: 'PINIA_CHECK_DETECTED'
}

interface BuildSearchIndexMessage extends PiniaMessage {
  type: 'PINIA_BUILD_SEARCH_INDEX'
}

let initialized = false

// Обработчики сообщений
const handlers: { [key: string]: (data: any) => void } = {
  'PINIA_GET_STORES_SUMMARY': handleGetStoresSummary,
  'PINIA_BUILD_SEARCH_INDEX': handleBuildSearchIndex,
  'PINIA_GET_STORE_STATE': handleGetStoreState,
  'PINIA_PATCH_STATE': handlePatchState,
  'PINIA_REPLACE_STATE': handleReplaceState,
  'PINIA_PATCH_GETTERS': handlePatchGetters,
  'PINIA_CALL_ACTION': handleCallAction,
  'PINIA_CHECK_DETECTED': handleCheckDetected
}

function handleMessage(event: MessageEvent) {
  if (
    event.source !== window ||
    !event.data ||
    typeof event.data !== 'object' ||
    typeof event.data.type !== 'string' ||
    !event.data.type.startsWith('PINIA_')
  ) return

  const handler = handlers[event.data.type]

  if (handler) {
    try {
      handler(event.data)
    } catch (e) {
      console.error(`[PiniaAPI] Error handling message type ${event.data.type}:`, e)
    }
  }
}

function handleGetStoresSummary(data: GetStoresSummaryMessage) {
  try {
    const summary = getAllStoresSummary()
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_STORES_SUMMARY_DATA',
      summary,
      detected: isPiniaDetected(),
      requestId: data.requestId
    }, '*')
  } catch (e) {
    console.error('[PiniaAPI] Error getting stores summary:', e)
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_STORES_SUMMARY_DATA',
      summary: {},
      detected: false,
      error: String(e),
      requestId: data.requestId
    }, '*')
  }
}

function handleBuildSearchIndex(data: BuildSearchIndexMessage) {
  try {
    const index = buildStoreSearchIndex()
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_SEARCH_INDEX_READY',
      index,
      requestId: data.requestId
    }, '*')
  } catch (e) {
    console.error('[PiniaAPI] Error building search index:', e)
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_SEARCH_INDEX_READY',
      index: [],
      error: String(e),
      requestId: data.requestId
    }, '*')
  }
}

function handleGetStoreState(data: GetStoreStateMessage) {
  let state = null, getters = {}, actions = {}

  try { state = getStoreState(data.storeId) } catch (e) {
    console.warn(`[PiniaAPI] Error getting state for ${data.storeId}:`, e)
  }
  try { getters = getStoreGetters(data.storeId) } catch (e) {
    console.warn(`[PiniaAPI] Error getting getters for ${data.storeId}:`, e)
  }
  try { actions = getStoreActions(data.storeId) } catch (e) {
    console.warn(`[PiniaAPI] Error getting actions for ${data.storeId}:`, e)
  }

  window.postMessage({
    __FROM_VUE_INSPECTOR__: true,
    type: 'PINIA_STORE_STATE_DATA',
    storeId: data.storeId,
    state,
    getters,
    actions,
    requestId: data.requestId
  }, '*')
}

function handlePatchState(data: PatchStateMessage) {
  try {
    const success = patchState(data.storeId, data.path, data.value)
    
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_PATCH_STATE_RESULT',
      storeId: data.storeId,
      path: data.path,
      success,
      requestId: data.requestId
    }, '*')
  } catch (e) {
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_PATCH_STATE_RESULT',
      storeId: data.storeId,
      path: data.path,
      success: false,
      error: String(e),
      requestId: data.requestId
    }, '*')
  }
}

function handleReplaceState(data: ReplaceStateMessage) {
  try {
    const success = replaceState(data.storeId, data.newState)
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_REPLACE_STATE_RESULT',
      storeId: data.storeId,
      success,
      requestId: data.requestId
    }, '*')
  } catch (e) {
    console.error('[PiniaAPI] PINIA_REPLACE_STATE error:', e)
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_REPLACE_STATE_RESULT',
      storeId: data.storeId,
      success: false,
      error: String(e),
      requestId: data.requestId
    }, '*')
  }
}

function handlePatchGetters(data: PatchGettersMessage) {
  try {
    const result = patchGetters(data.storeId, data.newGetters)
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_PATCH_GETTERS_RESULT',
      storeId: data.storeId,
      ...result,
      requestId: data.requestId
    }, '*')
  } catch (e) {
    console.error('[PiniaAPI] PINIA_PATCH_GETTERS error:', e)
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: 'PINIA_PATCH_GETTERS_RESULT',
      storeId: data.storeId,
      success: false,
      updated: [],
      error: String(e),
      requestId: data.requestId
    }, '*')
  }
}

function handleCallAction(data: CallActionMessage) {
  const { storeId, actionName, args = [] } = data

  Promise.resolve(callActionUnwrapped(storeId, actionName, ...args))
    .then(result => {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: 'PINIA_CALL_ACTION_RESULT',
        storeId,
        actionName,
        success: true,
        result,
        requestId: data.requestId
      }, '*')
    })
    .catch(e => {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: 'PINIA_CALL_ACTION_RESULT',
        storeId,
        actionName,
        success: false,
        error: String(e),
        requestId: data.requestId
      }, '*')
    })
}

function handleCheckDetected(data: CheckDetectedMessage) {
  const detected = isPiniaDetected()
  const storeCount = getStoresList().length
  
  window.postMessage({
    __FROM_VUE_INSPECTOR__: true,
    type: 'PINIA_DETECTED_RESULT',
    detected,
    storeCount,
    requestId: data.requestId
  }, '*')
}

// Форматирует время в строку
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Функция получения сводки по всем хранилищам (оптимизировано) - всегда получает свежие данные
function getAllStoresSummary(): Record<string, any> {
  const storeIds = getStoresList()

  if (storeIds.length === 0) {
    return {}
  }

  const summary: Record<string, any> = {}
  const now = Date.now()

  for (const storeId of storeIds) {
    try {
      const store = getStoreState(storeId)
      const stateKeys = store ? getStoreStateKeys(store as any).length : 0
      const getters = getStoreGetters(storeId)
      const getterKeys = getters ? getGetterKeys(getters as any).length : 0
      const actions = getStoreActions(storeId)
      const actionKeys = actions ? getActionKeys(actions as any).length : 0

      summary[storeId] = {
        id: storeId,
        baseId: normalizeStoreId(storeId),
        stateKeys,
        getterKeys,
        actions: actionKeys,
        lastUpdated: now,
        lastUpdatedFormatted: formatTimestamp(now)
      }
    } catch (e) {
      console.warn(`[PiniaAPI] Error processing store ${storeId}:`, e)
    }
  }
  return summary
}

/**
 * Инициализирует Pinia bridge - регистрирует message handlers
 */
export function initPiniaBridge() {
  if (initialized) return
  initialized = true

  // Регистрируем message handler
  window.addEventListener('message', handleMessage)

  // Инициализируем Pinia контекст
  waitForPinia(2000).then(pinia => {
    if (pinia) {
      updatePiniaContext()

      watchPiniaStores(pinia, () => {
        updatePiniaContext()
      })
    }
  })
}
