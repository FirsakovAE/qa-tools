/**
 * Logs module types (inlined — injected bundle must not import from @/types)
 */

export type LogKind =
  | 'request'
  | 'response'
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

export interface LogEvent {
  id: string
  kind: LogKind
  timestamp: number
  /** Ignore-rule key (kind + key identify a group of similar events) */
  key: string
  level: LogLevel
  title: string
  subtitle?: string
  data: Record<string, unknown>
  /** Approximate serialized size (chars), used for the memory budget */
  size?: number
}

export interface LogIgnoreKey {
  kind: LogKind
  key: string
}

export type LogEventInput = Omit<LogEvent, 'id' | 'timestamp' | 'size'> & { timestamp?: number }
