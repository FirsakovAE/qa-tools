/**
 * Главный entry point для injected скрипта
 * Выполняет детекцию и загружает модули
 * 
 * ВАЖНО: Не используем dynamic imports, т.к. они не работают 
 * когда скрипт загружен cross-origin (standalone mode)
 */

import { detect, type DetectionResult } from './detector'
// Статические импорты - всё бандлится в один файл
import { initPropsModule } from './props/index'
import { initPiniaModule } from './pinia/index'

// Храним результат детекции глобально
let detectionResult: DetectionResult | null = null
let propsModuleLoaded = false
let piniaModuleLoaded = false
let detectionSent = false // Флаг: был ли отправлен результат детекции

/**
 * Отправляет результат детекции в content script
 */
function sendDetectionResult(result: DetectionResult) {
  window.postMessage({
    type: 'VUE_INSPECTOR_DETECTION_RESULT',
    __FROM_VUE_INSPECTOR__: true,
    ...result
  }, '*')
}

/**
 * Инициализирует модуль props если Vue обнаружен
 */
function loadPropsModule() {
  if (propsModuleLoaded || !detectionResult?.hasVue) return
  propsModuleLoaded = true
  initPropsModule()
}

/**
 * Инициализирует модуль pinia если Pinia обнаружен
 */
function loadPiniaModule() {
  if (piniaModuleLoaded || !detectionResult?.hasPinia) return
  piniaModuleLoaded = true
  initPiniaModule()
}

/**
 * Обработчик сообщений от content script
 */
function handleMessage(event: MessageEvent) {
  if (event.source !== window || !event.data || typeof event.data !== 'object') {
    return
  }
  
  const { type } = event.data
  
  // Запрос на проверку Vue
  if (type === 'VUE_INSPECTOR_CHECK_VUE') {
    // Если детекция уже выполнена - просто отправляем сохранённый результат
    if (detectionResult && detectionSent) {
      sendDetectionResult(detectionResult)
      return
    }
    
    // Выполняем детекцию только один раз
    if (!detectionResult) {
      detectionResult = detect()
    }
    
    // Отправляем результат
    sendDetectionResult(detectionResult)
    detectionSent = true
    
    // Отправляем также старый формат для совместимости
    window.postMessage({
      type: 'VUE_INSPECTOR_VUE_DETECTED',
      __FROM_VUE_INSPECTOR__: true,
      detected: detectionResult.hasVue,
      url: window.location.href,
      hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
      hasVue2: detectionResult.vueVersion === 2
    }, '*')
    
    // Загружаем модули если нужно
    if (detectionResult.hasVue) {
      loadPropsModule()
    }
    if (detectionResult.hasPinia) {
      loadPiniaModule()
    }
    
    return
  }
  
  // Запрос на получение флагов (для UI)
  if (type === 'VUE_INSPECTOR_GET_FLAGS') {
    // Просто отправляем сохранённый результат (детекция уже выполнена при инициализации)
    if (detectionResult) {
      sendDetectionResult(detectionResult)
    }
    return
  }
}

// Регистрируем обработчик сообщений
window.addEventListener('message', handleMessage)

// Выполняем начальную детекцию ОДИН раз
detectionResult = detect()
detectionSent = true

// Если Vue найден - сразу загружаем props модуль
if (detectionResult.hasVue) {
  loadPropsModule()
}

// Если Pinia найден - сразу загружаем pinia модуль
if (detectionResult.hasPinia) {
  loadPiniaModule()
}

// Отправляем результат детекции
sendDetectionResult(detectionResult)

// Также отправляем старый формат для совместимости
window.postMessage({
  type: 'VUE_INSPECTOR_VUE_DETECTED',
  __FROM_VUE_INSPECTOR__: true,
  detected: detectionResult.hasVue,
  url: window.location.href,
  hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
  hasVue2: detectionResult.vueVersion === 2
}, '*')

// Сигнал готовности
window.postMessage({
  type: 'VUE_INSPECTOR_READY',
  __FROM_VUE_INSPECTOR__: true
}, '*')

// Если Vue НЕ найден - удаляем обработчик сообщений
// На сайтах без Vue нам не нужно слушать сообщения - экономим ресурсы
if (!detectionResult.hasVue) {
  window.removeEventListener('message', handleMessage)
}

// Экспортируем для отладки
;(window as any).__VUE_INSPECTOR_DETECTION__ = () => detectionResult