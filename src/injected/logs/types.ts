/**
 * Logs module types (inlined — injected bundle must not import from @/types)
 */

export type LogKind =
  | 'request'
  | 'response'
  | 'ws'
  | 'ws-sent'
  | 'ws-received'
  | 'ws-closed'
  | 'props'
  | 'emit'
  | 'store'
  | 'action'
  | 'navigation'
  | 'error'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogChange {
  path: string
  type: 'added' | 'removed' | 'changed'
  before?: unknown
  after?: unknown
}

/** Stored event: titles and other display fields are derived on read (see runtime.ts) */
export interface LogEvent {
  id: string
  kind: LogKind
  timestamp: number
  /** Subject id (store, component, request group...) and ignore-rule key */
  key: string
  level: LogLevel
  data: Record<string, any>
  /** Approximate serialized size (chars), used for the memory budget */
  size?: number
}

export interface LogIgnoreKey {
  kind: LogKind
  key: string
}

export type LogEventInput = Omit<LogEvent, 'id' | 'timestamp' | 'size'> & {
  timestamp?: number
  /**
   * Runs on the sanitized and size-limited payload before it is stored: drops what can be
   * derived from the parts that survived the limits.
   */
  finalize?: (data: Record<string, any>, key: string) => Record<string, any>
}
