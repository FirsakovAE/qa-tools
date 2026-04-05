// Фоновый скрипт для расширения
// NOTE: No imports from @/ — service worker is built as a single file without module support

function isExpectedExtensionError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '')
  return (
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('Extension context invalidated') ||
    msg.includes('disconnected port') ||
    msg.includes('Attempting to use a disconnected port') ||
    msg.includes('Port disconnected')
  )
}

// URL validation for injection
function isInjectableUrl(url?: string): boolean {
  return !!url && (
    url.startsWith('http://') ||
    url.startsWith('https://')
  )
}

// ===== НАСТРОЙКИ ХРАНЕНИЯ =====

// Интерфейс для настроек в IndexedDB
interface SettingsRecord {
  id: string
  settings: any
  version: string
  timestamp: number
}

// IndexedDB для хранения настроек (не очищается при очистке браузера)
class SettingsStorage {
  private db: IDBDatabase | null = null
  private readonly dbName = 'VueInspectorDB'
  private readonly storeName = 'settings'

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async saveSettings(settings: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const record: SettingsRecord = {
        id: 'user-settings',
        settings: settings,
        version: chrome.runtime.getManifest?.()?.version || '1.0.0',
        timestamp: Date.now()
      }

      const request = store.put(record)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async loadSettings(): Promise<any | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      const request = store.get('user-settings')

      request.onsuccess = () => {
        const record: SettingsRecord | undefined = request.result
        if (record) {
          resolve(record.settings)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async clearSettings(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const request = store.delete('user-settings')

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }
}

// Глобальный экземпляр хранилища настроек
const settingsStorage = new SettingsStorage()

// Per-tab static site flags
const staticSiteTabs = new Map<number, boolean>()

// ----- Network Advanced capture (chrome.webRequest) -----
let networkCaptureMode: 'saved' | 'advanced' = 'saved'

interface WebRequestCaptureRecord {
  url: string
  method: string
  requestHeaders: chrome.webRequest.HttpHeader[]
  responseHeaders: chrome.webRequest.HttpHeader[]
  time: number
}

const pendingChromeRequestMeta = new Map<string, {
  tabId: number
  url: string
  method: string
  requestHeaders: chrome.webRequest.HttpHeader[]
}>()

const webRequestCaptureQueues = new Map<number, WebRequestCaptureRecord[]>()

const WEBREQUEST_QUEUE_MAX = 80
const WEBREQUEST_CAPTURE_MAX_AGE_MS = 120_000

function normalizeUrlForWebRequestMatch(url: string): string {
  try {
    return new URL(url).href
  } catch {
    return url
  }
}

function chromeHeadersToInspectorHeaders(
  headers: chrome.webRequest.HttpHeader[] | undefined,
): Array<{ name: string; value: string }> {
  if (!headers?.length) return []
  const out: Array<{ name: string; value: string }> = []
  for (const h of headers) {
    if (h?.name == null) continue
    const raw = h.value
    const v = raw == null ? '' : String(raw)
    out.push({ name: h.name, value: v })
  }
  return out
}

function pruneCaptureQueue(tabId: number, queue: WebRequestCaptureRecord[]): WebRequestCaptureRecord[] {
  const now = Date.now()
  let next = queue.filter((r) => now - r.time < WEBREQUEST_CAPTURE_MAX_AGE_MS)
  while (next.length > WEBREQUEST_QUEUE_MAX) {
    next.shift()
  }
  webRequestCaptureQueues.set(tabId, next)
  return next
}

function pushCapture(tabId: number, rec: WebRequestCaptureRecord): void {
  let q = webRequestCaptureQueues.get(tabId) || []
  q.push(rec)
  q = pruneCaptureQueue(tabId, q)
}

function takeMatchingCapture(tabId: number, entry: any): WebRequestCaptureRecord | null {
  const q = webRequestCaptureQueues.get(tabId)
  if (!q?.length || !entry) return null
  const url = normalizeUrlForWebRequestMatch(String(entry.url || ''))
  const method = String(entry.method || 'GET').toUpperCase()
  const idx = q.findIndex((c) => c.url === url && c.method === method)
  if (idx === -1) return null
  const [cap] = q.splice(idx, 1)
  webRequestCaptureQueues.set(tabId, q)
  return cap || null
}

function applyWebRequestCaptureToEntry(entry: any, cap: WebRequestCaptureRecord): any {
  const reqPage = Array.isArray(entry.requestHeaders)
    ? entry.requestHeaders.map((h: any) => ({ name: String(h.name), value: String(h.value ?? '') }))
    : []
  const resPage = Array.isArray(entry.responseHeaders)
    ? entry.responseHeaders.map((h: any) => ({ name: String(h.name), value: String(h.value ?? '') }))
    : []
  return {
    ...entry,
    requestHeadersPageVisible: reqPage,
    responseHeadersPageVisible: resPage,
    requestHeaders: chromeHeadersToInspectorHeaders(cap.requestHeaders),
    responseHeaders: chromeHeadersToInspectorHeaders(cap.responseHeaders),
  }
}

async function waitForMatchingCapture(tabId: number, entry: any, maxWaitMs: number): Promise<WebRequestCaptureRecord | null> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const cap = takeMatchingCapture(tabId, entry)
    if (cap) return cap
    await new Promise((r) => setTimeout(r, 20))
  }
  return takeMatchingCapture(tabId, entry)
}

function onWebRequestBeforeSendHeaders(
  details: chrome.webRequest.OnBeforeSendHeadersDetails,
): chrome.webRequest.BlockingResponse | undefined {
  if (networkCaptureMode !== 'advanced') return undefined
  if (details.tabId == null || details.tabId < 0) return undefined
  if (details.type !== 'xmlhttprequest') return undefined
  pendingChromeRequestMeta.set(details.requestId, {
    tabId: details.tabId,
    url: details.url,
    method: details.method || 'GET',
    requestHeaders: details.requestHeaders || [],
  })
  return undefined
}

function onWebRequestHeadersReceived(
  details: chrome.webRequest.OnHeadersReceivedDetails,
): chrome.webRequest.BlockingResponse | undefined {
  if (networkCaptureMode !== 'advanced') return undefined
  if (details.tabId == null || details.tabId < 0) return undefined
  if (details.type !== 'xmlhttprequest') return undefined
  const pending = pendingChromeRequestMeta.get(details.requestId)
  pendingChromeRequestMeta.delete(details.requestId)
  if (!pending) return undefined
  const method = String(pending.method || details.method || 'GET').toUpperCase()
  const rec: WebRequestCaptureRecord = {
    url: normalizeUrlForWebRequestMatch(pending.url),
    method,
    requestHeaders: pending.requestHeaders,
    responseHeaders: details.responseHeaders || [],
    time: Date.now(),
  }
  pushCapture(pending.tabId, rec)
  return undefined
}

try {
  const wrFilter: chrome.webRequest.RequestFilter = { urls: ['<all_urls>'] }
  chrome.webRequest.onBeforeSendHeaders.addListener(
    onWebRequestBeforeSendHeaders,
    wrFilter,
    ['requestHeaders', 'extraHeaders'],
  )
  chrome.webRequest.onHeadersReceived.addListener(
    onWebRequestHeadersReceived,
    wrFilter,
    ['responseHeaders', 'extraHeaders'],
  )
} catch (e) {
  console.error('[background] webRequest listeners registration failed:', e)
}

async function refreshNetworkCaptureModeFromStorage(): Promise<void> {
  try {
    const settings = await loadSettingsWithFallback()
    networkCaptureMode = settings?.networkCaptureMode === 'advanced' ? 'advanced' : 'saved'
  } catch (e) {
    console.error('[background] refreshNetworkCaptureModeFromStorage failed:', e)
    networkCaptureMode = 'saved'
  }
}

void refreshNetworkCaptureModeFromStorage()

// DevTools panel search: panel connects here, devtools relays search via sendMessage
const SEARCH_PORT_NAME = 'vue-inspector-devtools-search'
let devtoolsSearchPort: chrome.runtime.Port | null = null

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SEARCH_PORT_NAME) return
  devtoolsSearchPort = port
  port.onDisconnect.addListener(() => {
    // Only clear if this is still the active port. Otherwise a stale disconnect
    // (Chrome can deliver disconnect after a newer port connected) would wipe
    // the new connection and break Ctrl+F search until DevTools is reopened.
    if (devtoolsSearchPort === port) {
      devtoolsSearchPort = null
    }
  })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  staticSiteTabs.delete(tabId)
})

// Функция для синхронизации настроек между IndexedDB и chrome.storage.local
async function syncSettingsToChromeStorage(settings: any) {
  try {
    await chrome.storage.local.set({
      'vue-inspector-settings': settings,
      'vue-inspector-settings-version': chrome.runtime.getManifest?.()?.version || '1.0.0'
    })
  } catch (error) {
    console.error('[background] syncSettingsToChromeStorage failed:', error)
  }
}

// Функция для загрузки настроек с приоритетом IndexedDB
async function loadSettingsWithFallback(): Promise<any> {
  try {
    // Сначала пытаемся загрузить из IndexedDB (не очищается)
    let settings = await settingsStorage.loadSettings()

    if (settings) {
      // Синхронизируем в chrome.storage.local для совместимости
      await syncSettingsToChromeStorage(settings)
      return settings
    }

    // Fallback: пытаемся загрузить из chrome.storage.local
    const chromeStorage = await chrome.storage.local.get(['vue-inspector-settings'])
    settings = chromeStorage['vue-inspector-settings']

    if (settings) {
      // Сохраняем в IndexedDB для защиты от будущих очисток
      await settingsStorage.saveSettings(settings)
      return settings
    }

    return null
  } catch (error) {
    console.error('[background] loadSettingsWithFallback failed:', error)
    return null
  }
}

// Функция для сохранения настроек
async function saveSettings(settings: any) {
  try {
    // Сохраняем в IndexedDB (основное хранилище)
    await settingsStorage.saveSettings(settings)

    // Синхронизируем в chrome.storage.local для совместимости с popup
    await syncSettingsToChromeStorage(settings)

  } catch (error) {
    console.error('[background] saveSettings failed:', error)
  }
}

// Функция для проверки наличия content script в вкладке
async function checkContentScriptReady(tabId: number): Promise<boolean> {
    try {
        // Проверяем, что вкладка существует и активна
        const tab = await chrome.tabs.get(tabId)
        if (!tab) {
            return false
        }

        // Проверяем статус вкладки - должна быть загружена
        if (tab.status !== 'complete') {
            return false
        }

        // Проверяем, что URL доступен для content scripts
        const url = tab.url || tab.pendingUrl
        if (!isInjectableUrl(url)) {
            return false
        }

        // Проверяем наличие content script через ping с таймаутом
        const pingResponse = await Promise.race([
            chrome.tabs.sendMessage(tabId, { type: 'PING' }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Ping timeout')), 1000)
            )
        ])

        return pingResponse?.ready === true
    } catch (error) {
        console.error('[background] checkContentScriptReady failed:', error)
        return false
    }
}

// Функция для отправки сообщений с повторными попытками
async function sendMessageWithRetry(tabId: number, message: any, messageType: string, maxRetries = 3) {
    // Сначала проверяем, что content script существует и готов
    const isReady = await checkContentScriptReady(tabId)
    if (!isReady) {
        return
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            await chrome.tabs.sendMessage(tabId, message)
            return // Успешно отправили
        } catch (error) {
            const errorMessage = (error as Error)?.message || 'Unknown error'

            // "Receiving end does not exist" - это нормально, content script не загружен
            if (errorMessage.includes('Receiving end does not exist')) {
                return // Не повторяем попытки
            }


            // Если это финальная попытка, логируем как ошибку
            if (attempt === maxRetries - 1) {
                console.error('[background] sendMessageWithRetry failed:', error)
            }

            if (attempt < maxRetries - 1) {
                // Ждем перед следующей попыткой (экспоненциальная задержка)
                await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt)))
            }
        }
    }
}

// Обработчик установки
chrome.runtime.onInstalled.addListener(async () => {

    // Инициализируем IndexedDB для настроек
    try {
        await settingsStorage.init()
    } catch (error) {
        console.error('[background] settingsStorage.init failed:', error)
    }

    await refreshNetworkCaptureModeFromStorage()

})

// NOTE: Расширение теперь работает через injected UI без popup
// Action API больше не используется

// Обработчик сообщений от content script и popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    switch (message.type) {
        case 'VUE_DETECTED':
            break

        case 'PINIA_DETECTED':
            break

        case 'PINIA_STORES_SUMMARY_DATA':
        case 'PINIA_STORE_STATE_DATA':
        case 'PINIA_PATCH_STATE_RESULT':
        case 'PINIA_REPLACE_STATE_RESULT':
        case 'PINIA_PATCH_GETTERS_RESULT':
        case 'PINIA_CALL_ACTION_RESULT':
            // Пересылаем Pinia сообщения в popup (если открыт)
            try {
                chrome.runtime.sendMessage(message).catch((e) => {
                    if (!isExpectedExtensionError(e)) console.error('[background] Pinia relay sendMessage failed:', e)
                })
            } catch (e) {
                if (!isExpectedExtensionError(e)) console.error('[background] Pinia relay sendMessage threw:', e)
            }
            break

        case 'SET_STATIC_SITE':
            if (sender.tab?.id != null) {
                staticSiteTabs.set(sender.tab.id, !!message.isStatic)
            }
            break

        case 'IS_STATIC_SITE':
            sendResponse({ isStatic: staticSiteTabs.get(message.tabId) ?? false })
            return false

        case 'GET_DISPLAY_MODE':
            loadSettingsWithFallback()
                .then(settings => {
                    sendResponse({
                        displayMode: settings?.displayMode || 'overlay',
                        autoRun: settings?.autoRun || null,
                    })
                })
                .catch((e) => {
                    console.error('[background] GET_DISPLAY_MODE loadSettings failed:', e)
                    sendResponse({ displayMode: 'overlay', autoRun: null })
                })
            return true

        case 'GET_SETTINGS':
            // Загружаем настройки из IndexedDB с fallback на chrome.storage.local
            loadSettingsWithFallback()
                .then(settings => {
                    sendResponse(settings || {})
                })
                .catch((error) => {
                    console.error('[background] GET_SETTINGS loadSettings failed:', error)
                    sendResponse({})
                })
            return true // Указываем, что ответ будет асинхронным

        case 'UPDATE_SETTINGS':
            // Сохраняем настройки в IndexedDB и синхронизируем в chrome.storage.local
            saveSettings(message.settings)
                .then(() => {
                    if (message.settings && typeof message.settings === 'object') {
                        networkCaptureMode = message.settings.networkCaptureMode === 'advanced' ? 'advanced' : 'saved'
                    }
                    sendResponse({ success: true })
                })
                .catch((error) => {
                    console.error('[background] UPDATE_SETTINGS saveSettings failed:', error)
                    sendResponse({ success: false, error: error.message })
                })
            return true // Асинхронный ответ

        case 'NETWORK_MERGE_WEBREQUEST_HEADERS': {
            if (networkCaptureMode !== 'advanced' || message.entry == null) {
                sendResponse({ entry: message.entry })
                return false
            }
            const mergeTabId = sender.tab?.id
            if (mergeTabId == null) {
                sendResponse({ entry: message.entry })
                return false
            }
            ;(async () => {
                try {
                    const cap = await waitForMatchingCapture(mergeTabId, message.entry, 480)
                    if (!cap) {
                        sendResponse({ entry: message.entry })
                        return
                    }
                    sendResponse({ entry: applyWebRequestCaptureToEntry(message.entry, cap) })
                } catch (e) {
                    console.error('[background] NETWORK_MERGE_WEBREQUEST_HEADERS failed:', e)
                    sendResponse({ entry: message.entry })
                }
            })()
            return true
        }

        case 'RESET_SETTINGS':
            // Очищаем настройки из IndexedDB
            settingsStorage.clearSettings()
                .then(async () => {
                    // Также очищаем из chrome.storage.local
                    await chrome.storage.local.remove(['vue-inspector-settings', 'vue-inspector-settings-version'])
                    await refreshNetworkCaptureModeFromStorage()
                    sendResponse({ success: true })
                })
                .catch((error) => {
                    console.error('[background] RESET_SETTINGS clearSettings failed:', error)
                    sendResponse({ success: false, error: error.message })
                })
            return true // Асинхронный ответ

        case 'SETTINGS_UPDATED':
            // Сообщение о том, что настройки обновились
            break

        case 'PING_CONTENT_SCRIPT':
            // Проверяем готовность content script
            if (message.tabId) {
                checkContentScriptReady(message.tabId)
                    .then(isReady => {
                        sendResponse({ ready: isReady })
                    })
                    .catch((error) => {
                        console.error('[background] PING_CONTENT_SCRIPT failed:', error)
                        sendResponse({ ready: false, error: (error as Error).message })
                    })
                return true // Асинхронный ответ
            }
            break

        case 'HIGHLIGHT_BY_UID':
            // Пересылаем сообщение в content script для подсветки по UID
            if (message.tabId) {
                sendMessageWithRetry(message.tabId, {
                    type: 'HIGHLIGHT_BY_UID',
                    uid: message.uid
                }, 'HIGHLIGHT_BY_UID')
            }
            break

        case 'HIGHLIGHT_ELEMENT':
            // Legacy: пересылаем сообщение в content script для подсветки элемента
            if (message.tabId) {
                sendMessageWithRetry(message.tabId, {
                    type: 'HIGHLIGHT_ELEMENT',
                    componentPath: message.componentPath
                }, 'HIGHLIGHT_ELEMENT')
            }
            break

        case 'UNHIGHLIGHT_ELEMENT':
            // Пересылаем сообщение в content script для снятия подсветки
            if (message.tabId) {
                sendMessageWithRetry(message.tabId, {
                    type: 'UNHIGHLIGHT_ELEMENT'
                }, 'UNHIGHLIGHT_ELEMENT')
            }
            break

        case 'RELAY_DEVTOOLS_SEARCH':
            if (devtoolsSearchPort) {
                devtoolsSearchPort.postMessage({
                    type: 'DEVTOOLS_SEARCH',
                    action: message.action ?? '',
                    query: message.query ?? ''
                })
            }
            break
    }

    sendResponse({ success: true })
})