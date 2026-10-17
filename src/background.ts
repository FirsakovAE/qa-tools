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
const WS_HANDSHAKE_KEY = 'vueInspectorWsHandshakes'
const WS_HANDSHAKE_MAX = 30
const WS_HANDSHAKE_MAX_AGE_MS = 6 * 60 * 60 * 1000

interface WsHandshakeRecord {
  url: string
  requestHeaders: chrome.webRequest.HttpHeader[]
  responseHeaders: chrome.webRequest.HttpHeader[]
  time: number
}

let wsHandshakes: Map<number, WsHandshakeRecord[]> | null = null
let wsHandshakeLoad: Promise<Map<number, WsHandshakeRecord[]>> | null = null
let wsPersistTimer: ReturnType<typeof setTimeout> | 0 = 0

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

function isWebSocketEntry(entry: { initiator?: string; method?: string } | null | undefined): boolean {
  return entry?.initiator === 'websocket' || String(entry?.method || '').toUpperCase() === 'WS'
}

function loadWsHandshakes(): Promise<Map<number, WsHandshakeRecord[]>> {
  if (wsHandshakes) return Promise.resolve(wsHandshakes)
  if (wsHandshakeLoad) return wsHandshakeLoad
  wsHandshakeLoad = (async () => {
    const map = new Map<number, WsHandshakeRecord[]>()
    try {
      const stored = await chrome.storage.session.get(WS_HANDSHAKE_KEY)
      const raw = stored?.[WS_HANDSHAKE_KEY]
      if (raw && typeof raw === 'object') {
        for (const [tabId, list] of Object.entries(raw as Record<string, WsHandshakeRecord[]>)) {
          if (Array.isArray(list)) map.set(Number(tabId), list)
        }
      }
    } catch (e) {
      console.error('[background] loadWsHandshakes failed:', e)
    }
    wsHandshakes = map
    return map
  })()
  return wsHandshakeLoad
}

function scheduleWsPersist(): void {
  if (wsPersistTimer) return
  wsPersistTimer = setTimeout(() => {
    wsPersistTimer = 0
    void persistWsHandshakes()
  }, 50)
}

async function persistWsHandshakes(): Promise<void> {
  if (!wsHandshakes) return
  const raw: Record<string, WsHandshakeRecord[]> = {}
  for (const [tabId, list] of wsHandshakes) raw[String(tabId)] = list
  try {
    await chrome.storage.session.set({ [WS_HANDSHAKE_KEY]: raw })
  } catch (e) {
    console.error('[background] persistWsHandshakes failed:', e)
  }
}

async function rememberWsHandshake(tabId: number, rec: WsHandshakeRecord): Promise<void> {
  const map = await loadWsHandshakes()
  const now = Date.now()
  const list = (map.get(tabId) || []).filter((item) => now - item.time < WS_HANDSHAKE_MAX_AGE_MS)
  list.push(rec)
  while (list.length > WS_HANDSHAKE_MAX) list.shift()
  map.set(tabId, list)
  scheduleWsPersist()
}

async function peekWsHandshake(tabId: number, url: string): Promise<WsHandshakeRecord | null> {
  const map = await loadWsHandshakes()
  const list = map.get(tabId)
  if (!list?.length) return null
  const href = normalizeUrlForWebRequestMatch(url)
  const now = Date.now()
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i]
    if (now - item.time >= WS_HANDSHAKE_MAX_AGE_MS) continue
    if (item.url === href) return item
  }
  return null
}

function applyWsHandshake(entry: any, cap: WsHandshakeRecord): any {
  return {
    ...entry,
    requestHeaders: chromeHeadersToInspectorHeaders(cap.requestHeaders),
    responseHeaders: chromeHeadersToInspectorHeaders(cap.responseHeaders),
  }
}

function onWebRequestBeforeSendHeaders(
  details: chrome.webRequest.OnBeforeSendHeadersDetails,
): chrome.webRequest.BlockingResponse | undefined {
  if (details.tabId == null || details.tabId < 0) return undefined
  if (details.type === 'websocket') {
    pendingChromeRequestMeta.set(details.requestId, {
      tabId: details.tabId,
      url: details.url,
      method: 'GET',
      requestHeaders: details.requestHeaders || [],
    })
    return undefined
  }
  if (networkCaptureMode !== 'advanced') return undefined
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
  if (details.tabId == null || details.tabId < 0) return undefined
  if (details.type === 'websocket') {
    const pending = pendingChromeRequestMeta.get(details.requestId)
    pendingChromeRequestMeta.delete(details.requestId)
    void rememberWsHandshake(details.tabId, {
      url: normalizeUrlForWebRequestMatch(pending?.url || details.url),
      requestHeaders: pending?.requestHeaders || [],
      responseHeaders: details.responseHeaders || [],
      time: Date.now(),
    })
    return undefined
  }
  if (networkCaptureMode !== 'advanced') return undefined
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
  if (!wsHandshakes?.has(tabId)) return
  wsHandshakes.delete(tabId)
  scheduleWsPersist()
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

// ----- AI: OpenRouter sign-in (OAuth PKCE) -----

function base64Url(bytes: Uint8Array): string {
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Opens the OpenRouter consent page and exchanges the returned code for a key of the user */
async function openRouterSignIn(): Promise<{ key: string }> {
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)))
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    const challenge = base64Url(new Uint8Array(digest))
    const callback = chrome.identity.getRedirectURL('openrouter')
    const authUrl = `https://openrouter.ai/auth?${new URLSearchParams({
        callback_url: callback,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    })}`
    const redirected = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true })
    const code = redirected ? new URL(redirected).searchParams.get('code') : null
    if (!code) throw new Error('Sign-in was cancelled')
    const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || typeof data?.key !== 'string') {
        throw new Error(data?.error?.message || `OpenRouter returned ${res.status}`)
    }
    return { key: data.key }
}

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
            const mergeTabId = sender.tab?.id
            if (message.entry == null || mergeTabId == null) {
                sendResponse({ entry: message.entry })
                return false
            }
            if (isWebSocketEntry(message.entry)) {
                ;(async () => {
                    try {
                        const cap = await peekWsHandshake(mergeTabId, String(message.entry.url || ''))
                        sendResponse({ entry: cap ? applyWsHandshake(message.entry, cap) : message.entry })
                    } catch (e) {
                        console.error('[background] NETWORK_MERGE_WEBREQUEST_HEADERS websocket failed:', e)
                        sendResponse({ entry: message.entry })
                    }
                })()
                return true
            }
            if (networkCaptureMode !== 'advanced') {
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

        case 'NETWORK_MERGE_WEBREQUEST_ENTRIES': {
            const entriesTabId = sender.tab?.id
            const entries = Array.isArray(message.entries) ? message.entries : null
            if (!entries || entriesTabId == null) {
                sendResponse({ entries: message.entries })
                return false
            }
            ;(async () => {
                try {
                    const next = []
                    for (const entry of entries) {
                        if (!isWebSocketEntry(entry)) {
                            next.push(entry)
                            continue
                        }
                        const cap = await peekWsHandshake(entriesTabId, String(entry?.url || ''))
                        next.push(cap ? applyWsHandshake(entry, cap) : entry)
                    }
                    sendResponse({ entries: next })
                } catch (e) {
                    console.error('[background] NETWORK_MERGE_WEBREQUEST_ENTRIES failed:', e)
                    sendResponse({ entries })
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

        case 'AI_OPENROUTER_SIGN_IN':
            openRouterSignIn()
                .then(sendResponse)
                .catch((error) => sendResponse({ error: String((error as Error)?.message || error) }))
            return true

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