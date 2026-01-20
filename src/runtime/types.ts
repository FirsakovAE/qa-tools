/**
 * Runtime Adapter Interface
 * 
 * Контракт между core логикой и окружением выполнения.
 * Core не знает о chrome.* APIs - только об этом интерфейсе.
 */

export interface Message {
  type: string
  [key: string]: unknown
}

export type MessageHandler = (
  message: Message,
  respond: (response: unknown) => void
) => void | boolean

export type Unsubscribe = () => void

/**
 * Capabilities - что доступно в текущем runtime
 */
export interface RuntimeCapabilities {
  /** Есть background script для сложных операций */
  hasBackgroundScript: boolean
  /** Есть popup UI */
  hasPopup: boolean
  /** Может инспектировать другие вкладки */
  canInspectOtherTabs: boolean
  /** Может сохранять настройки между сессиями */
  hasPersistentStorage: boolean
  /** Режим работы для отображения в UI */
  mode: 'extension' | 'standalone'
}

/**
 * Storage interface - абстракция над хранилищем
 */
export interface RuntimeStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

/**
 * Runtime Adapter - абстракция над окружением выполнения
 */
export interface RuntimeAdapter {
  /** Уникальный идентификатор адаптера */
  readonly id: string
  
  /** Capabilities текущего runtime */
  readonly capabilities: RuntimeCapabilities
  
  /** Storage API */
  readonly storage: RuntimeStorage
  
  /**
   * Получить URL ресурса
   * @param path - относительный путь к ресурсу
   */
  getResourceURL(path: string): string

  /**
   * Получить manifest приложения
   */
  getManifest(): chrome.runtime.Manifest
  
  /**
   * Отправить сообщение в content script / injected script
   * @param message - сообщение для отправки
   * @param timeout - таймаут ожидания ответа (ms)
   */
  sendMessage<T = unknown>(message: Message, timeout?: number): Promise<T>
  
  /**
   * Подписаться на входящие сообщения
   * @param handler - обработчик сообщений
   * @returns функция отписки
   */
  onMessage(handler: MessageHandler): Unsubscribe
  
  /**
   * Выполнить callback когда runtime готов
   */
  onReady(callback: () => void): void
  
  /**
   * Очистка ресурсов при уничтожении
   */
  destroy(): void
}

/**
 * Factory для создания адаптера
 */
export type RuntimeAdapterFactory = () => RuntimeAdapter
