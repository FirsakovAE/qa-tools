/**
 * Модуль для детектирования экземпляра Pinia
 */

import type { PiniaInstance } from './types'

/**
 * Детектирует Pinia из window._s (Map)
 */
export function detectFromWindow(): PiniaInstance | null {
  try {
    if ((window as any)._s && (window as any)._s instanceof Map) {
      return {
        _s: (window as any)._s as Map<string, any>,
        $id: 'found-in-window'
      }
    }
  } catch (e) { /* ignore */ }

  return null
}

/**
 * Детектирует Pinia через Vue DevTools Hook
 */
export function detectFromDevtools(): PiniaInstance | null {
  try {
    const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (hook?.apps) {
      for (const app of hook.apps) {
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia ||
                      app.config?.globalProperties?.$pinia
        if (pinia && pinia._s) {
          return pinia
        }
      }
    }
  } catch (e) { /* ignore */ }
  
  return null
}

/**
 * Детектирует Pinia из корней Vue приложений
 */
export function detectFromVueRoots(): PiniaInstance | null {
  try {
    // Проверяем глобальный объект __VUE_INSPECTOR__ для доступа к findVueRoots
    const vueInspector = (window as any).__VUE_INSPECTOR__
    const findVueRoots = vueInspector?.findVueRoots || (() => [])
    const vueRoots = findVueRoots()

    for (const root of vueRoots) {
      if ((root as any).__vue_app__) {
        const app = (root as any).__vue_app__
        const pinia = app._context?.provides?.pinia ||
                      app._context?.config?.globalProperties?.$pinia ||
                      app.config?.globalProperties?.$pinia
        if (pinia && pinia._s) {
          return pinia
        }
      }
    }
  } catch (e) { /* ignore */ }

  return null
}

/**
 * Детектирует Pinia через сканирование window
 * ОТКЛЮЧЕНО: слишком ресурсоёмкая операция, вызывает утечку памяти
 * Pinia обычно находится через DevTools hook или Vue roots
 */
export function detectFromGlobalScan(): PiniaInstance | null {
  // Отключаем глобальный скан - слишком дорогая операция
  // Если Pinia не найдена через hook или roots, значит её нет
  return null
}

/**
 * Основная функция поиска Pinia, использующая все стратегии
 */
export function findPinia(): PiniaInstance | null {
  // Method 1: Check window._s (Map)
  let pinia = detectFromWindow()
  if (pinia) return pinia
  
  // Method 2: Check Vue DevTools Hook
  pinia = detectFromDevtools()
  if (pinia) return pinia
  
  // Method 3: Search in Vue app roots
  pinia = detectFromVueRoots()
  if (pinia) return pinia
  
  // Method 4: Search window properties
  pinia = detectFromGlobalScan()
  if (pinia) return pinia
  
  return null
}

// Хранит ID текущего timeout для возможности отмены
let waitForPiniaTimeoutId: ReturnType<typeof setTimeout> | null = null

/**
 * Отменяет ожидание Pinia (для cleanup)
 */
export function cancelWaitForPinia(): void {
  if (waitForPiniaTimeoutId !== null) {
    clearTimeout(waitForPiniaTimeoutId)
    waitForPiniaTimeoutId = null
  }
}

/**
 * Ожидает появления Pinia с таймаутом
 * Оптимизировано: увеличен интервал, уменьшен timeout по умолчанию
 */
export async function waitForPinia(
  timeout: number = 2000, // По умолчанию 2 секунды
  interval = 500 // Проверка каждые 500мс вместо 200мс
): Promise<PiniaInstance | null> {
  // Отменяем предыдущее ожидание если было
  cancelWaitForPinia()

  return new Promise(resolve => {
    const start = Date.now()

    const tick = () => {
      const pinia = findPinia()
      if (pinia) {
        waitForPiniaTimeoutId = null
        return resolve(pinia)
      }

      if (Date.now() - start > timeout) {
        waitForPiniaTimeoutId = null
        return resolve(null)
      }

      waitForPiniaTimeoutId = setTimeout(tick, interval)
    }

    tick()
  })
}

/**
 * Подписывается на изменения stores в Pinia
 */
export function watchPiniaStores(pinia: PiniaInstance, onUpdate: () => void): void {
  if (!pinia._s || !(pinia._s instanceof Map)) return

  const originalSet = pinia._s.set.bind(pinia._s)

  pinia._s.set = function (...args) {
    const result = originalSet(...args)
    onUpdate()
    return result
  }

  // Также подписываемся на удаление stores
  const originalDelete = pinia._s.delete.bind(pinia._s)

  pinia._s.delete = function (...args) {
    const result = originalDelete(...args)
    onUpdate()
    return result
  }
}

/**
 * Проверяет, доступна ли Pinia
 */
export function isPiniaDetected(): boolean {
  return findPinia() !== null
}