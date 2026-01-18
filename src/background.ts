// Фоновый скрипт для расширения

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
        version: settings.version || '1.0.0',
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

// Функция для синхронизации настроек между IndexedDB и chrome.storage.local
async function syncSettingsToChromeStorage(settings: any) {
  try {
    await chrome.storage.local.set({
      'vue-inspector-settings': settings,
      'vue-inspector-settings-version': settings.version || '1.0.0'
    })
  } catch (error) {
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
        // Content script не готов или не существует
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
    }

})

// Обработчик клика по иконке расширения - открываем popup
chrome.action.onClicked.addListener((tab) => {
    // Popup открывается автоматически при клике на иконку
})

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
        case 'PINIA_SEARCH_INDEX_READY':
            // Пересылаем Pinia сообщения в popup (если открыт)
            try {
                chrome.runtime.sendMessage(message).catch(() => {
                    // Popup не открыт - это нормально
                })
            } catch {
                // Receiver не существует - это нормально
            }
            break

        case 'GET_SETTINGS':
            // Загружаем настройки из IndexedDB с fallback на chrome.storage.local
            loadSettingsWithFallback()
                .then(settings => {
                    sendResponse(settings || {})
                })
                .catch(error => {
                    sendResponse({})
                })
            return true // Указываем, что ответ будет асинхронным

        case 'UPDATE_SETTINGS':
            // Сохраняем настройки в IndexedDB и синхронизируем в chrome.storage.local
            saveSettings(message.settings)
                .then(() => {
                    sendResponse({ success: true })
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message })
                })
            return true // Асинхронный ответ

        case 'RESET_SETTINGS':
            // Очищаем настройки из IndexedDB
            settingsStorage.clearSettings()
                .then(async () => {
                    // Также очищаем из chrome.storage.local
                    await chrome.storage.local.remove(['vue-inspector-settings', 'vue-inspector-settings-version'])
                    sendResponse({ success: true })
                })
                .catch(error => {
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
                    .catch(error => {
                        sendResponse({ ready: false, error: (error as Error).message })
                    })
                return true // Асинхронный ответ
            }
            break

        case 'HIGHLIGHT_ELEMENT':
            // Пересылаем сообщение в content script для подсветки элемента
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
    }

    sendResponse({ success: true })
})