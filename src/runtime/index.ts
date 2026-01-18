/**
 * Runtime Module - публичный API
 */

// Types
export type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeStorage,
  Message,
  MessageHandler,
  Unsubscribe,
  RuntimeAdapterFactory
} from './types'

// Context (для использования в core)
export {
  useRuntime,
  useCapabilities,
  hasCapability,
  isRuntimeReady,
  getRuntimeAdapter
} from './context'

// Adapters (для bootstrap)
export { createExtensionAdapter } from './extension/adapter'
export { createStandaloneAdapter } from './standalone/adapter'
export type { StandaloneAdapterConfig } from './standalone/adapter'

// Bootstrap (internal - используется только в entry points)
export { setRuntimeAdapter } from './context'
