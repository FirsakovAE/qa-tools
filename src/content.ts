// === GLOBAL GUARD ===
(function() {
  if ((window as any).__VUE_INSPECTOR_CONTENT_LOADED__) {
    return
  }
  ;(window as any).__VUE_INSPECTOR_CONTENT_LOADED__ = true

  // === URL GUARD ===
  function isForbiddenUrl(): boolean {
    const url = location.href
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('view-source:')
    )
  }

  if (isForbiddenUrl()) {
    return
  }

  // === CONTENT SCRIPT ===
  // Content script для взаимодействия с Vue на странице

// Инжектируем скрипт в контекст страницы для доступа к Vue
function injectScript(): void {
    // Проверяем, не загружен ли уже скрипт
    if (document.getElementById('vue-inspector-injected-script')) {
        injectedScriptLoaded = true
        return
    }

    // Проверяем, доступен ли уже injected script через window
    if ((window as any).__VUE_INSPECTOR_INJECTED__) {
        injectedScriptLoaded = true
        return
    }

    // Используем script tag для загрузки injected script
    const script = document.createElement('script')
    script.id = 'vue-inspector-injected-script'
    script.src = chrome.runtime.getURL('js/injected.js')
    script.onload = function() {
        injectedScriptLoaded = true
    }
    script.onerror = function() {
        // Удаляем script tag при ошибке, чтобы можно было попробовать снова
        const scriptEl = document.getElementById('vue-inspector-injected-script')
        if (scriptEl && scriptEl.parentNode) {
            scriptEl.parentNode.removeChild(scriptEl)
        }
        injectedScriptLoaded = false
    }
    ;(document.head || document.documentElement).appendChild(script)
}

// Флаг для предотвращения множественных проверок
let vueCheckInProgress = false
let detectionCompleted = false

// Счётчик попыток обнаружения и лимиты
let detectionAttempts = 0
const MAX_DETECTION_ATTEMPTS = 3 // Максимум 3 попытки (~9 секунд с интервалом 3 сек)
let detectionStopped = false // Флаг полной остановки детектирования

// Флаги функциональности - передаются в UI
interface FeatureFlags {
    hasVue: boolean
    hasPinia: boolean
    vueVersion: 2 | 3 | null
}

let featureFlags: FeatureFlags = {
    hasVue: false,
    hasPinia: false,
    vueVersion: null
}

// Флаги для инициализации
let injectedScriptLoaded = false
let uiInjected = false

/**
 * Передаёт флаги в iframe UI
 */
function sendFlagsToUI(): void {
    const iframe = document.getElementById('vue-inspector-ui') as HTMLIFrameElement
    if (iframe?.contentWindow) {
        // Используем новый формат с __VUE_INSPECTOR__ префиксом
        iframe.contentWindow.postMessage({
            __VUE_INSPECTOR__: true,
            broadcast: true,
            message: {
                type: 'VUE_INSPECTOR_FEATURE_FLAGS',
                flags: featureFlags
            }
        }, '*')
    }
}

// Переменные для подсветки элементов
let currentHighlightedElement: HTMLElement | null = null
let highlightOverlay: HTMLElement | null = null
let highlightRafId: number | null = null

/**
 * Универсальная функция для асинхронного IPC с injected script
 */
function requestWindow<T>(
  request: any,
  responseType: string,
  timeout = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2)
    let timeoutId: number | null = null

    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        typeof event.data === 'object' &&
        event.data !== null &&
        event.data.type === responseType &&
        event.data.requestId === requestId
      ) {
        cleanup()
        resolve(event.data as T)
      }
    }

    const cleanup = () => {
      window.removeEventListener('message', handler)
      if (timeoutId) clearTimeout(timeoutId)
    }

    window.addEventListener('message', handler)
    window.postMessage({ ...request, requestId }, '*')

    timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timeout'))
    }, timeout)
  })
}

/**
 * Стратегия поиска элемента для подсветки
 */
type HighlightStrategy = (componentPath: string) => HTMLElement | null

/**
 * Попытка подсветки через цепочку стратегий
 */
function tryHighlight(
  componentPath: string,
  strategies: HighlightStrategy[]
): HTMLElement | null {
  for (const strategy of strategies) {
    try {
      const el = strategy(componentPath)
      if (el instanceof HTMLElement) {
        return el
      }
    } catch (e) {
      // стратегия может фейлиться — это нормально
    }
  }
  return null
}

/**
 * Поиск элемента через Vue VNode
 */
function highlightByVueVNode(componentPath: string): HTMLElement | null {
  const inspector = (window as any).__VUE_INSPECTOR__
  if (!inspector?.findComponentByPath) return null

  const vnode = inspector.findComponentByPath(componentPath)
  if (!vnode) return null

  // Обработка настоящего vnode
  if (vnode.el instanceof HTMLElement) return vnode.el
  if (vnode.component?.subTree?.el instanceof HTMLElement) {
    return vnode.component.subTree.el
  }

  // Обработка искусственного объекта из поиска по имени
  if (vnode.component && vnode.component.element) {
    const elementInfo = vnode.component.element
    if (elementInfo.tagName && elementInfo.id) {
      const el = document.getElementById(elementInfo.id)
      if (el instanceof HTMLElement) return el
    }
    if (elementInfo.tagName && elementInfo.className) {
      const selector = elementInfo.className.trim().split(/\s+/).map((cls: string) => `.${cls}`).join('')
      const el = document.querySelector(`${elementInfo.tagName}${selector}`)
      if (el instanceof HTMLElement) return el
    }
    if (elementInfo.testId) {
      const el = document.querySelector(`[data-test-id="${elementInfo.testId}"]`)
      if (el instanceof HTMLElement) return el
    }
  }

  const walk = (children: any[]): HTMLElement | null => {
    for (const child of children) {
      if (child?.el instanceof HTMLElement) return child.el
      if (child?.component?.subTree?.el instanceof HTMLElement) {
        return child.component.subTree.el
      }
      if (Array.isArray(child?.children)) {
        const found = walk(child.children)
        if (found) return found
      }
    }
    return null
  }

  if (Array.isArray(vnode.component?.subTree?.children)) {
    return walk(vnode.component.subTree.children)
  }

  return null
}

/**
 * Поиск элемента через DOM селектор
 */
function highlightBySelector(componentPath: string): HTMLElement | null {
  const parts = componentPath.split('::')
  const selectorIndex = parts.findIndex(
    (p, i) => p.startsWith('#') || p.includes(' > ') || (p.includes('.') && i > 2)
  )

  if (selectorIndex === -1) return null

  let selector = parts.slice(selectorIndex).join('::').replace(/^::/, '')
  if (selector.includes('::text:')) {
    selector = selector.split('::text:')[0]
  }

  try {
    let el = document.querySelector(selector)
    if (el instanceof HTMLElement) return el

    // упрощение селектора
    const blacklist = ['animate-', 'transition-', 'backdrop-']
    let simplified = selector
    blacklist.forEach(cls => {
      simplified = simplified.replace(new RegExp(`\\.${cls}[a-zA-Z0-9_-]+`, 'g'), '')
    })

    if (simplified !== selector) {
      el = document.querySelector(simplified.trim())
      if (el instanceof HTMLElement) return el
    }
  } catch {}

  return null
}

/**
 * Поиск элемента по тексту
 */
function highlightByText(componentPath: string): HTMLElement | null {
  const expectedText = componentPath
    .split('::')
    .find(p => p.startsWith('text:'))
    ?.replace('text:', '')

  if (!expectedText || expectedText.length < 3) return null

  const candidates = Array.from(
    document.querySelectorAll('[data-test-id], span, a, p')
  ).filter(el => el.textContent?.trim() === expectedText)

  return candidates.length === 1 ? (candidates[0] as HTMLElement) : null
}

/**
 * Поиск элемента через список компонентов (async fallback)
 */
function highlightByComponentsList(
  componentPath: string,
  sendResponse: (r: any) => void
): boolean {
  let finished = false

  const finish = (payload: any) => {
    if (finished) return
    finished = true
    sendResponse(payload)
  }

  window.postMessage({ type: 'VUE_INSPECTOR_GET_COMPONENTS' }, '*')

  const handler = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'VUE_INSPECTOR_COMPONENTS_DATA') {
      return
    }

    window.removeEventListener('message', handler)

    const components = event.data.components || []
    const name = componentPath.split('::')[1]

    const match = components.find((c: any) => c.name === name)
    const el = match?.rootElement || match?.element

    if (el instanceof HTMLElement) {
      highlightElement(el)
      finish({ success: true })
    } else {
      finish({ success: false })
    }
  }

  window.addEventListener('message', handler)

  setTimeout(() => {
    window.removeEventListener('message', handler)
    if (!finished) {
      finish({ success: false, timeout: true })
    }
  }, 1500)

  return true
}

/**
 * Тип обработчика runtime сообщений
 */
type RuntimeHandler = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void

/**
 * Обработчики runtime сообщений по типам
 */
const runtimeHandlers: Record<string, RuntimeHandler> = {
  PING(message, sender, sendResponse) {
    sendResponse({ pong: true, ready: true })
    return true
  },

  // Возвращаем кэшированные флаги
  VUE_INSPECTOR_GET_FLAGS(message, sender, sendResponse) {
    // Если флаги уже получены - возвращаем их сразу
    if (detectionCompleted) {
      sendResponse({
        type: 'VUE_INSPECTOR_FEATURE_FLAGS',
        flags: featureFlags
      })
      return true
    }
    
    // Иначе запрашиваем у injected script и отвечаем позже
    window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*')
    
    // Ждём результат детекции
    const checkInterval = setInterval(() => {
      if (detectionCompleted) {
        clearInterval(checkInterval)
        sendResponse({
          type: 'VUE_INSPECTOR_FEATURE_FLAGS',
          flags: featureFlags
        })
      }
    }, 100)
    
    // Таймаут через 3 секунды
    setTimeout(() => {
      clearInterval(checkInterval)
      if (!detectionCompleted) {
        sendResponse({
          type: 'VUE_INSPECTOR_FEATURE_FLAGS',
          flags: { hasVue: false, hasPinia: false, vueVersion: null }
        })
      }
    }, 3000)
    
    return true // Асинхронный ответ
  },
  
  GET_FEATURE_FLAGS(message, sender, sendResponse) {
    // Алиас для VUE_INSPECTOR_GET_FLAGS
    return runtimeHandlers.VUE_INSPECTOR_GET_FLAGS(message, sender, sendResponse)
  },

  UNHIGHLIGHT_ELEMENT(message, sender, sendResponse) {
    try {
      unhighlightElement()
      sendResponse({ success: true })
    } catch (error) {
      sendResponse({ success: false, error: String(error) })
    }
    return true
  },


  GET_COMPONENTS(message, sender, sendResponse) {
    const inspector = (window as any).__VUE_INSPECTOR__
    sendResponse({ components: inspector?.getComponents?.() || [] })
    return true
  },


  HIGHLIGHT_ELEMENT(message, sender, sendResponse) {
    const { componentPath } = message

    const element = tryHighlight(componentPath, [
      highlightByVueVNode,
      highlightBySelector,
      highlightByText
    ])

    if (element) {
      highlightElement(element)
      sendResponse({ success: true })
      return true
    }

    // async fallback через компоненты
    return highlightByComponentsList(componentPath, sendResponse)

  },

  UPDATE_COMPONENT_PROPS(message, sender, sendResponse) {
    // Передаем запрос на обновление пропсов в injected script
    requestWindow({
      type: 'VUE_INSPECTOR_UPDATE_PROPS',
      componentPath: message.componentUid, // Используем path как идентификатор
      props: message.props
    }, 'VUE_INSPECTOR_UPDATE_PROPS_RESULT', 5000)
      .then((response: any) => {
        sendResponse({ success: response.success || false, error: response.error })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })

    return true // Указываем, что ответ будет асинхронным
  },

  GET_COMPONENT_PROPS(message, sender, sendResponse) {
    // Запрашиваем пропсы компонента через injected script
    requestWindow({
      type: 'VUE_INSPECTOR_GET_COMPONENT_PROPS',
      componentPath: message.componentUid
    }, 'VUE_INSPECTOR_COMPONENT_PROPS_DATA', 3000)
      .then((response: any) => {
        sendResponse({ props: response.props || {} })
      })
      .catch(() => {
        sendResponse({ props: {} })
      })

    return true
  },

  COLLECT_VUE_COMPONENTS(message, sender, sendResponse) {
    // ПРИОРИТЕТ: Используем window.__VUE_INSPECTOR__ API напрямую, если доступен
    const inspector = (window as any).__VUE_INSPECTOR__
    if (inspector && typeof inspector.getComponents === 'function') {
      try {
        const components = inspector.getComponents()
        sendResponse({ components: components || [] })
        return true
      } catch (e) {
        // Продолжаем с postMessage как fallback
      }
    }

    // Fallback: Запрашиваем компоненты через injected script через postMessage
    requestWindow({ type: 'VUE_INSPECTOR_GET_COMPONENTS' }, 'VUE_INSPECTOR_COMPONENTS_DATA', 3000)
      .then((response: any) => {
        sendResponse({ components: response.components || [] })
      })
      .catch(() => {
        // Пробуем получить компоненты напрямую из DOM как fallback
        try {
          const components = collectVueComponentsFromDOM()
          sendResponse({ components })
        } catch (error) {
          sendResponse({ components: [], error: String(error) })
        }
      })

    return true // Указываем, что ответ будет асинхронным
  },

  // === PINIA API MESSAGE HANDLERS ===
  // Все handlers возвращают данные через sendResponse для UI iframe
  // И также отправляют в background через chrome.runtime для popup/devtools

  PINIA_GET_STORES_SUMMARY(message, sender, sendResponse) {
    requestWindow({ type: 'PINIA_GET_STORES_SUMMARY' }, 'PINIA_STORES_SUMMARY_DATA', 2000)
      .then((response: any) => {
        const result = {
          type: 'PINIA_STORES_SUMMARY_DATA',
          summary: response.summary || {},
          detected: response.detected || false,
          error: response.error
        }
        // Отправляем в background для popup
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        // Возвращаем через sendResponse для UI iframe
        sendResponse(result)
      })
      .catch((error) => {
        const result = {
          type: 'PINIA_STORES_SUMMARY_DATA',
          summary: {},
          detected: false,
          error: error.message
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })

    return true
  },

  PINIA_GET_STORE_STATE(message, sender, sendResponse) {
    requestWindow({
      type: 'PINIA_GET_STORE_STATE',
      storeId: message.storeId
    }, 'PINIA_STORE_STATE_DATA', 2000)
      .then((response: any) => {
        const result = {
          type: 'PINIA_STORE_STATE_DATA',
          storeId: response.storeId,
          state: response.state,
          getters: response.getters,
          error: response.error
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })
      .catch(() => {
        const result = {
          type: 'PINIA_STORE_STATE_DATA',
          storeId: message.storeId,
          state: null,
          error: 'Timeout'
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })

    return true
  },

  PINIA_BUILD_SEARCH_INDEX(message, sender, sendResponse) {
    requestWindow({ type: 'PINIA_BUILD_SEARCH_INDEX' }, 'PINIA_SEARCH_INDEX_READY', 2000)
      .then((response: any) => {
        const result = {
          type: 'PINIA_SEARCH_INDEX_READY',
          index: response.index || [],
          error: response.error
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })
      .catch(() => {
        const result = {
          type: 'PINIA_SEARCH_INDEX_READY',
          index: [],
          error: 'Timeout'
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })

    return true
  },

  PINIA_PATCH_STATE(message, sender, sendResponse) {
    requestWindow({
      type: 'PINIA_PATCH_STATE',
      storeId: message.storeId,
      path: message.path,
      value: message.value
    }, 'PINIA_PATCH_STATE_RESULT', 2000)
      .then((response: any) => {
        const result = {
          type: 'PINIA_PATCH_STATE_RESULT',
          storeId: response.storeId,
          path: response.path,
          success: response.success,
          error: response.error
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })
      .catch(() => {
        sendResponse({ type: 'PINIA_PATCH_STATE_RESULT', success: false, error: 'Timeout' })
      })

    return true
  },

  PINIA_REPLACE_STATE(message, sender, sendResponse) {
    requestWindow({
      type: 'PINIA_REPLACE_STATE',
      storeId: message.storeId,
      newState: message.newState
    }, 'PINIA_REPLACE_STATE_RESULT', 2000)
      .then((response: any) => {
        const result = {
          type: 'PINIA_REPLACE_STATE_RESULT',
          storeId: response.storeId,
          success: response.success,
          error: response.error
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })
      .catch(() => {
        sendResponse({ type: 'PINIA_REPLACE_STATE_RESULT', success: false, error: 'Timeout' })
      })

    return true
  },

  PINIA_PATCH_GETTERS(message, sender, sendResponse) {
    requestWindow({
      type: 'PINIA_PATCH_GETTERS',
      storeId: message.storeId,
      newGetters: message.newGetters
    }, 'PINIA_PATCH_GETTERS_RESULT', 2000)
      .then((response: any) => {
        const result = {
          type: 'PINIA_PATCH_GETTERS_RESULT',
          storeId: response.storeId,
          success: response.success,
          updated: response.updated,
          overridden: response.overridden,
          error: response.error
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })
      .catch(() => {
        sendResponse({ type: 'PINIA_PATCH_GETTERS_RESULT', success: false, error: 'Timeout' })
      })

    return true
  },

  PINIA_CALL_ACTION(message, sender, sendResponse) {
    requestWindow({
      type: 'PINIA_CALL_ACTION',
      storeId: message.storeId,
      actionName: message.actionName,
      args: message.args || []
    }, 'PINIA_CALL_ACTION_RESULT', 5000) // 5 seconds for actions (may take longer)
      .then((response: any) => {
        const result = {
          type: 'PINIA_CALL_ACTION_RESULT',
          storeId: response.storeId,
          actionName: response.actionName,
          success: response.success,
          result: response.result,
          error: response.error
        }
        try { chrome.runtime?.sendMessage?.(result) } catch {}
        sendResponse(result)
      })
      .catch(() => {
        sendResponse({ type: 'PINIA_CALL_ACTION_RESULT', success: false, error: 'Timeout' })
      })

    return true
  }
}

/**
 * Строит CSS селектор из информации об элементе.
 * Исключает нестабильные классы и ограничивает количество классов.
 */
function buildSelectorFromElementInfo(elementInfo: any): string | null {
    if (!elementInfo) return null

    const parts: string[] = []

    if (elementInfo.tagName) {
        parts.push(elementInfo.tagName.toLowerCase())
    }

    if (elementInfo.id) {
        // Экранируем специальные символы в ID
        const escapedId = elementInfo.id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
        parts.push(`#${escapedId}`)
    }

    if (elementInfo.className) {
        const classes = elementInfo.className.trim().split(/\s+/)
        // Фильтруем классы с невалидными символами и исключаем нестабильные
        const validClasses = classes.filter((cls: string) => {
            // Проверяем что класс содержит только допустимые символы для CSS селекторов
            return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls) &&
                   !cls.includes('animate-') &&
                   !cls.includes('transition-') &&
                   !cls.includes('backdrop-')
        })
        if (validClasses.length > 0) {
            parts.push(...validClasses.slice(0, 3).map((cls: string) => `.${cls}`))
        }
    }

    if (elementInfo.testId) {
        // Экранируем специальные символы в data-test-id
        const escapedTestId = elementInfo.testId.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
        parts.push(`[data-test-id="${escapedTestId}"]`)
    }

    return parts.length > 0 ? parts.join('') : null
}

// Запускает детекцию Vue/Pinia через injected script
function runDetection(): void {
    // Если уже проверяем или детектирование завершено/остановлено - пропускаем
    if (vueCheckInProgress || detectionCompleted || detectionStopped) {
        return
    }

    // Увеличиваем счётчик попыток
    detectionAttempts++
    
    // Если превысили лимит попыток - останавливаем детекцию БЕЗ загрузки скрипта
    if (detectionAttempts > MAX_DETECTION_ATTEMPTS) {
        stopDetection()
        // Отмечаем детекцию как завершённую с нулевыми флагами
        detectionCompleted = true
        featureFlags = { hasVue: false, hasPinia: false, vueVersion: null }
        return
    }

    vueCheckInProgress = true
    
    // Инжектируем скрипт если ещё не загружен
    if (!injectedScriptLoaded) {
        injectScript()
        injectedScriptLoaded = true
    }
    
    // Отправляем запрос на детекцию через injected script
    window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
        vueCheckInProgress = false
    }, 1000)
}

// Останавливает все процессы детектирования для экономии ресурсов
function stopDetection(): void {
    if (detectionStopped) return
    detectionStopped = true
    
    // Очищаем timeout если есть
    if (checkTimeout) {
        clearTimeout(checkTimeout)
        checkTimeout = null
    }
}

// Обработчик ответа от injected script
function handleInjectedMessage(event: MessageEvent): void {
    // Проверяем, что сообщение от нашей страницы
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
        return
    }

    // Сообщения должны быть от нашего injected script
    if (!event.data.__FROM_VUE_INSPECTOR__) {
        return
    }

    if (event.data.type === 'VUE_INSPECTOR_READY') {
        // Скрипт готов - запрашиваем флаги
        window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*')
        return
    }

    // Обработка результата детекции
    if (event.data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
        const { hasVue, hasPinia, vueVersion } = event.data
        
        // Сохраняем флаги
        featureFlags = { hasVue, hasPinia, vueVersion }
        detectionCompleted = true
        
        // ВСЕГДА останавливаем детекцию после получения результата
        stopDetection()
        
        // Передаём флаги в UI
        sendFlagsToUI()
        
        // Если Vue НЕ найден - удаляем listener, он больше не нужен
        // Это экономит ресурсы на сайтах без Vue
        if (!hasVue) {
            window.removeEventListener('message', handleInjectedMessage)
            messageListenerAdded = false
        }
        
        // Уведомляем background
        try {
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({
                    type: 'VUE_INSPECTOR_FLAGS',
                    flags: featureFlags,
                    url: window.location.href
                }).catch(() => {})
            }
        } catch (e) {}
        
        return
    }

    // Старый формат для совместимости
    if (event.data.type === 'VUE_INSPECTOR_VUE_DETECTED') {
        const { detected } = event.data
        
        if (detected && !featureFlags.hasVue) {
            featureFlags.hasVue = true
            sendFlagsToUI()
        }
    }
}

// Слушаем сообщения от injected script (добавляется один раз)
// Listener активен только пока не завершится детекция
let messageListenerAdded = false
function addMessageListenerIfNeeded(): void {
    if (messageListenerAdded) return
    messageListenerAdded = true
    window.addEventListener('message', handleInjectedMessage)
}

// Создаем overlay для подсветки элементов
function createHighlightOverlay(): void {
    if (highlightOverlay) return

    highlightOverlay = document.createElement('div')
    highlightOverlay.id = 'vue-inspector-highlight-overlay'
    highlightOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 999998;
        border: 3px solid #8b5cf6;
        background-color: rgba(139, 92, 246, 0.1);
        box-shadow:
            0 0 0 1px rgba(139, 92, 246, 0.4),
            0 0 20px rgba(139, 92, 246, 0.3),
            inset 0 0 20px rgba(139, 92, 246, 0.1);
        transition: all 0.2s ease-in-out;
        border-radius: 4px;
    `
    document.body.appendChild(highlightOverlay)
}

function highlightElement(element: HTMLElement): void {
    if (!element) return

    createHighlightOverlay()
    currentHighlightedElement = element
    updateHighlightPosition()
}

function updateHighlightPosition(): void {
    if (!currentHighlightedElement || !highlightOverlay) return
    if (highlightRafId) return

    highlightRafId = requestAnimationFrame(() => {
        highlightRafId = null

        if (!currentHighlightedElement || !highlightOverlay) return

        const rect = currentHighlightedElement.getBoundingClientRect()

        highlightOverlay.style.display = 'block'
        highlightOverlay.style.left = rect.left + 'px'
        highlightOverlay.style.top = rect.top + 'px'
        highlightOverlay.style.width = rect.width + 'px'
        highlightOverlay.style.height = rect.height + 'px'
    })
}

function unhighlightElement(): void {
    if (highlightOverlay) {
        highlightOverlay.style.display = 'none'
    }
    currentHighlightedElement = null
}


// Функция для сбора Vue компонентов (использует логику из realDataService)
function collectVueComponentsFromDOM(): any[] {
    const components: any[] = []
    
    interface VueHTMLElement extends HTMLElement {
        __vue_app__?: any
        __vue__?: any
        _vnode?: any
    }

    function findVueRoots(): VueHTMLElement[] {
        const vueRoots: VueHTMLElement[] = []

        document.querySelectorAll<HTMLElement>('[__vue_app__]').forEach(el => {
            const vEl = el as VueHTMLElement
            if (vEl.__vue_app__ && !vueRoots.includes(vEl)) {
                vueRoots.push(vEl)
            }
        })

        if (vueRoots.length === 0) {
            const possibleContainers = document.querySelectorAll<HTMLElement>(
                'div, main, section, article, #app, #root, [class*="app"], [class*="vue"], [id*="app"]'
            )

            possibleContainers.forEach(el => {
                const vEl = el as VueHTMLElement
                if (vEl.__vue_app__ || vEl.__vue__ || vEl._vnode) {
                    if (!vueRoots.includes(vEl)) {
                        vueRoots.push(vEl)
                    }
                }
            })
        }

        return vueRoots
    }

    function extractRootVNode(root: VueHTMLElement): any {
        if (root.__vue_app__) {
            return root.__vue_app__._instance?.root ?? root.__vue_app__._container?._vnode ?? root._vnode
        } else if (root.__vue__) {
            return root.__vue__.$root ?? root.__vue__
        }
        return root._vnode
    }

    const vueRoots = findVueRoots()
    if (vueRoots.length === 0) {
        return []
    }

    vueRoots.forEach((root, rootIndex) => {
        const rootVNode = extractRootVNode(root)
        if (!rootVNode) {
            return
        }

        const collectComponents = (vnode: any, path = '', depth = 0) => {
            if (!vnode || depth > 25) return

            if (vnode.component) {
                const component = {
                    vnode,
                    component: vnode.component,
                    name:
                        vnode.component.type?.name ||
                        vnode.component.type?.__name ||
                        vnode.component.type?.displayName ||
                        'Anonymous',
                    props: vnode.component.props || {},
                    setupState: vnode.component.setupState,
                    depth,
                    path: `root${rootIndex}.${path}`,
                    element: vnode.el ?? null,
                    hasProps: vnode.component.props
                        ? Object.keys(vnode.component.props).length > 0
                        : false,
                    propsCount: vnode.component.props
                        ? Object.keys(vnode.component.props).length
                        : 0,
                    rootIndex,
                    rootElement: root
                }
                components.push(component)
            }

            if (Array.isArray(vnode.children)) {
                vnode.children.forEach((child: any, i: number) => {
                    collectComponents(child, `${path}.children[${i}]`, depth + 1)
                })
            }

            if (vnode.component?.subTree) {
                collectComponents(vnode.component.subTree, `${path}.component.subTree`, depth + 1)
            }
        }

        collectComponents(rootVNode, 'root', 0)
    })

    return components
}

// Слушаем сообщения от popup или background скриптов через dispatcher
try {
  if (!chrome?.runtime?.id) return
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = runtimeHandlers[message?.type]

    if (!handler) {
      sendResponse({ received: true })
      return true
    }

    try {
      return handler(message, sender, sendResponse) ?? true
    } catch (error) {
      sendResponse({ success: false, error: String(error) })
      return true
    }
  })
} catch (error) {
}

// === UI IFRAME MESSAGE BRIDGE ===
// Слушаем сообщения от UI iframe (injected_ui) через postMessage
// UI iframe использует __VUE_INSPECTOR__ префикс
const UI_MESSAGE_PREFIX = '__VUE_INSPECTOR__'

let uiBridgeInitialized = false

// Named handler для возможности удаления
function uiBridgeMessageHandler(event: MessageEvent): void {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (!data[UI_MESSAGE_PREFIX]) return
  
  // Проверяем, что сообщение от нашего iframe (получаем свежую ссылку)
  const currentIframe = document.getElementById('vue-inspector-ui') as HTMLIFrameElement | null
  if (!currentIframe?.contentWindow) return
  if (event.source !== currentIframe.contentWindow) return
  
  const requestId = data.requestId
  const message = data.message
  
  if (!message || !message.type) return

  // Получаем handler из runtimeHandlers
  const handler = runtimeHandlers[message.type]
  
  if (handler) {
    // Создаём sendResponse функцию для ответа в iframe
    const sendResponse = (response: any) => {
      if (currentIframe?.contentWindow) {
        currentIframe.contentWindow.postMessage({
          [UI_MESSAGE_PREFIX]: true,
          responseId: requestId,
          response
        }, '*')
      }
    }
    
    try {
      // Вызываем handler (sender фейковый, т.к. это не chrome messaging)
      handler(message, {} as chrome.runtime.MessageSender, sendResponse)
    } catch (error) {
      sendResponse({ success: false, error: String(error) })
    }
  } else {
    // Нет handler'а - пересылаем в injected script
    const sendResponse = (response: any) => {
      if (currentIframe?.contentWindow) {
        currentIframe.contentWindow.postMessage({
          [UI_MESSAGE_PREFIX]: true,
          responseId: requestId,
          response
        }, '*')
      }
    }
    
    // Пересылаем в injected script и ждём ответа
    requestWindow(message, getExpectedResponseType(message.type), 5000)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }))
  }
}

function setupUIMessageBridge(): void {
  if (uiBridgeInitialized) return
  uiBridgeInitialized = true
  window.addEventListener('message', uiBridgeMessageHandler)
}

function removeUIMessageBridge(): void {
  if (!uiBridgeInitialized) return
  uiBridgeInitialized = false
  window.removeEventListener('message', uiBridgeMessageHandler)
}

// Маппинг типов запросов -> типов ответов для injected script
function getExpectedResponseType(requestType: string): string {
  const map: Record<string, string> = {
    'COLLECT_VUE_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
    'VUE_INSPECTOR_GET_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
    'VUE_INSPECTOR_GET_COMPONENT_PROPS': 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
    'VUE_INSPECTOR_UPDATE_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
    'UPDATE_COMPONENT_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
    'PINIA_GET_STORES_SUMMARY': 'PINIA_STORES_SUMMARY_DATA',
    'PINIA_GET_STORE_STATE': 'PINIA_STORE_STATE_DATA',
    'PINIA_PATCH_STATE': 'PINIA_PATCH_STATE_RESULT',
    'PINIA_REPLACE_STATE': 'PINIA_REPLACE_STATE_RESULT',
    'PINIA_PATCH_GETTERS': 'PINIA_PATCH_GETTERS_RESULT',
    'PINIA_CALL_ACTION': 'PINIA_CALL_ACTION_RESULT',
    'PINIA_CHECK_DETECTED': 'PINIA_DETECTED_RESULT',
    'PINIA_BUILD_SEARCH_INDEX': 'PINIA_SEARCH_INDEX_READY',
    'VUE_INSPECTOR_GET_FLAGS': 'VUE_INSPECTOR_DETECTION_RESULT',
    'VUE_INSPECTOR_CHECK_VUE': 'VUE_INSPECTOR_DETECTION_RESULT'
  }
  return map[requestType] || requestType + '_RESULT'
}

// НЕ инициализируем bridge сразу - он будет создан при создании UI iframe
// setupUIMessageBridge() вызывается из injectUI() после создания iframe

// Функция для отправки broadcast сообщений в UI
function broadcastToUI(message: any): void {
  const iframe = document.getElementById('vue-inspector-ui') as HTMLIFrameElement | null
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage({
      [UI_MESSAGE_PREFIX]: true,
      broadcast: true,
      message
    }, '*')
  }
}

// Инициализация - НИЧЕГО не загружаем автоматически!
// Все тяжёлые ресурсы загружаются только при клике на шеврон
function init(): void {
    // Останавливаем любую детекцию сразу - она будет запущена при открытии панели
    detectionStopped = true
    detectionCompleted = true
    
    // Флаги по умолчанию - неизвестно (будут определены при открытии панели)
    featureFlags = { hasVue: false, hasPinia: false, vueVersion: null }
}

// Переменные для совместимости (больше не используются активно)
let checkTimeout: number | null = null;

// Функция-заглушка для совместимости
function startObserving(): void {
    // Больше не наблюдаем за DOM - ресурсы загружаются только по требованию
}

// Обработчики событий для обновления позиции подсветки
function setupHighlightEventListeners(): void {
    window.addEventListener('scroll', updateHighlightPosition, { passive: true } as AddEventListenerOptions)
    window.addEventListener('resize', updateHighlightPosition)
}

// Очистка при выгрузке страницы
function cleanup(): void {
    unhighlightElement()
    if (highlightOverlay && highlightOverlay.parentNode) {
        highlightOverlay.parentNode.removeChild(highlightOverlay)
        highlightOverlay = null
    }
    
    // Очищаем все таймауты
    if (checkTimeout) {
        clearTimeout(checkTimeout)
        checkTimeout = null
    }
    
    // Удаляем все event listeners
    window.removeEventListener('message', handleInjectedMessage)
    window.removeEventListener('scroll', updateHighlightPosition, { passive: true } as AddEventListenerOptions)
    window.removeEventListener('resize', updateHighlightPosition)
    removeUIMessageBridge()
    
    // Останавливаем детектирование
    detectionStopped = true
    
    window.removeEventListener('beforeunload', cleanup)
}

window.addEventListener('beforeunload', cleanup)

function injectInspectorUI() {
  if (document.getElementById('vue-inspector-host')) return

  // Состояние и константы
  let isCollapsed = true
  let height = 360
  const MIN_HEIGHT = 120
  const MAX_OFFSET = 80
  let iframeLoaded = false // ВАЖНО: iframe загружается лениво!

  // Создаем root wrapper
  const root = document.createElement('div')
  root.id = 'vue-inspector-root'
  root.style.cssText = `
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100vw;
    z-index: 1000000;
    pointer-events: none;
  `

  // Создаем host-контейнер (только для iframe)
  const host = document.createElement('div')
  host.id = 'vue-inspector-host'
  host.style.cssText = `
    position: relative;
    width: 100%;
    height: 0px;
    overflow: hidden;
    pointer-events: none;
  `

  // Создаем iframe БЕЗ src - загрузим позже при открытии
  const iframe = document.createElement('iframe')
  iframe.id = 'vue-inspector-ui'
  // НЕ устанавливаем src сразу! Это экономит ~1GB памяти на сайтах без Vue

  iframe.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    pointer-events: auto;
    display: none;
  `

  let detectionDone = false
  
  // Обработчик результата детекции - удаляет listener после получения
  const handleDetectionForUI = (event: MessageEvent) => {
    if (event.data?.type === 'VUE_INSPECTOR_DETECTION_RESULT' && !detectionDone) {
      detectionDone = true
      
      // ВАЖНО: удаляем listener чтобы не было утечки
      window.removeEventListener('message', handleDetectionForUI)
      
      // Всегда отправляем флаги в UI
      sendFlagsToUI()
    }
  }
  
  // Функция для ленивой загрузки ресурсов
  const loadResourcesIfNeeded = () => {
    if (iframeLoaded) return
    iframeLoaded = true
    
    // Инициализируем bridge для UI (только когда iframe создан)
    setupUIMessageBridge()
    
    // Слушаем результат детекции (один раз)
    window.addEventListener('message', handleDetectionForUI)
    
    // Добавляем глобальный listener для сообщений (если ещё не добавлен)
    addMessageListenerIfNeeded()
    
    // 1. Загружаем injected script (для детекции)
    if (!injectedScriptLoaded) {
      injectScript()
      injectedScriptLoaded = true
    }
    
    // 2. Загружаем iframe с UI (всегда - вкладки скроются сами)
    iframe.src = chrome.runtime.getURL('injected_ui/index.html')
    iframe.style.display = 'block'
    
    iframe.onload = () => {
      // Сбрасываем флаги для детекции
      detectionStopped = false
      detectionCompleted = false
      detectionAttempts = 0
      
      // Запрашиваем детекцию
      window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')
    }
  }

  // Создаем кнопку сворачивания (sibling, не child)
  const toggle = document.createElement('button')
  toggle.style.cssText = `
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #111;
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  // CSS шеврон вместо текстового символа
  const chevron = document.createElement('div')
  chevron.style.cssText = `
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid white;
    transition: transform 0.2s ease;
    transform: rotate(180deg);
  `
  toggle.appendChild(chevron)

  const updateCollapsedState = () => {
    if (isCollapsed) {
      host.style.height = '0px'
      iframe.style.display = 'none'
      toggle.style.bottom = '0px'
    } else {
      host.style.height = `${height}px`
      iframe.style.display = 'block'
      toggle.style.bottom = `${height}px`
    }
  }

  toggle.onclick = () => {
    isCollapsed = !isCollapsed
    chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
    
    // ЛЕНИВАЯ ЗАГРУЗКА: загружаем ВСЕ ресурсы только при первом открытии
    if (!isCollapsed) {
      loadResourcesIfNeeded()
    }
    
    updateCollapsedState()
    
    // Уведомляем iframe о состоянии видимости (для паузы auto-refresh)
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        __VUE_INSPECTOR__: true,
        broadcast: true,
        message: {
          type: 'VUE_INSPECTOR_VISIBILITY_CHANGED',
          visible: !isCollapsed
        }
      }, '*')
    }
    
    // ЭКОНОМИЯ РЕСУРСОВ: если Vue не найден и панель свёрнута - выгружаем iframe
    // Это освобождает ~300-500MB RAM на сайтах без Vue
    if (isCollapsed && !featureFlags.hasVue && iframeLoaded) {
      // Полностью выгружаем iframe - удаляем src и очищаем
      iframe.src = 'about:blank'
      iframeLoaded = false
      
      // Удаляем message bridge listener (будет создан заново при следующем открытии)
      removeUIMessageBridge()
    }
  }

  // Создаем resize handle
  const resizeHandle = document.createElement('div')
  resizeHandle.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 6px;
    cursor: ns-resize;
    pointer-events: auto;
  `

  // Логика resize через pointer events
  let dragging = false
  let startY = 0
  let startHeight = 0

  resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault()
    dragging = true
    startY = e.clientY
    startHeight = height

    document.body.style.userSelect = 'none'
    host.classList.add('dragging')

    // захватываем все pointer события для resizeHandle
    resizeHandle.setPointerCapture(e.pointerId)

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return
      height = Math.min(
        window.innerHeight - MAX_OFFSET,
        Math.max(MIN_HEIGHT, startHeight + (startY - ev.clientY))
      )
      host.style.height = `${height}px`
      toggle.style.bottom = `${height}px`
    }

    const onPointerUp = (ev: PointerEvent) => {
      dragging = false
      document.body.style.userSelect = ''
      host.classList.remove('dragging')

      resizeHandle.releasePointerCapture(ev.pointerId)
      resizeHandle.removeEventListener('pointermove', onPointerMove)
      resizeHandle.removeEventListener('pointerup', onPointerUp)
    }

    resizeHandle.addEventListener('pointermove', onPointerMove)
    resizeHandle.addEventListener('pointerup', onPointerUp)
  })

  // Собираем структуру
  host.appendChild(iframe)
  host.appendChild(resizeHandle)
  root.appendChild(host)
  root.appendChild(toggle)
  document.documentElement.appendChild(root)
}

// Инициализация content script
function initializeContentScript(): void {
  init()
  
  // UI показываем ВСЕГДА - шеврон должен быть на всех сайтах
  // Вкладки внутри UI показываются в зависимости от флагов
  if (!uiInjected) {
    uiInjected = true
    injectInspectorUI()
  }
  
  startObserving()
  setupHighlightEventListeners()
}

initializeContentScript()
})()
