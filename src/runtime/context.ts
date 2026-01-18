/**
 * Runtime Context
 * 
 * Глобальный контекст для доступа к текущему runtime адаптеру.
 * Инициализируется один раз при bootstrap.
 */

import type { RuntimeAdapter, RuntimeCapabilities } from './types'

let currentAdapter: RuntimeAdapter | null = null

/**
 * Устанавливает текущий runtime адаптер
 * Вызывается только из bootstrap
 */
export function setRuntimeAdapter(adapter: RuntimeAdapter): void {
  if (currentAdapter) {
    currentAdapter.destroy()
  }
  currentAdapter = adapter
}

/**
 * Получает текущий runtime адаптер
 * Выбрасывает ошибку если адаптер не инициализирован
 */
export function useRuntime(): RuntimeAdapter {
  if (!currentAdapter) {
    throw new Error('[Runtime] Adapter not initialized. Call bootstrap() first.')
  }
  return currentAdapter
}

/**
 * Получает текущий runtime адаптер без выбрасывания ошибки
 * Возвращает null если адаптер не инициализирован
 * Используется в сервисах которые могут запускаться до инициализации runtime
 */
export function getRuntimeAdapter(): RuntimeAdapter | null {
  return currentAdapter
}

/**
 * Проверяет, инициализирован ли runtime
 */
export function isRuntimeReady(): boolean {
  return currentAdapter !== null
}

/**
 * Получает capabilities текущего runtime
 */
export function useCapabilities(): RuntimeCapabilities {
  return useRuntime().capabilities
}

/**
 * Проверяет доступность capability
 */
export function hasCapability<K extends keyof RuntimeCapabilities>(
  key: K
): RuntimeCapabilities[K] {
  return useRuntime().capabilities[key]
}
