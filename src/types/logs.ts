/**
 * Logs Tab Types
 * Mirrors src/injected/logs/types.ts (the injected bundle cannot import from @/types)
 */

import type { NetworkEntry } from './network'

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

export type LogsExportFormat = 'json' | 'html'

export const DEFAULT_LOGS_EXPORT_FORMAT: LogsExportFormat = 'html'

/** Stored settings may hold the removed 'ask' value */
export function normalizeExportFormat(value: unknown): LogsExportFormat {
  return value === 'json' || value === 'html' ? value : DEFAULT_LOGS_EXPORT_FORMAT
}

export const LOGS_EXPORT_FORMATS: Array<{ value: LogsExportFormat; label: string; description: string }> = [
  { value: 'json', label: 'JSON', description: 'Raw events for re-import or tooling' },
  { value: 'html', label: 'HTML', description: 'Static report that opens in any browser and can be re-imported' },
]

export interface LogChange {
  path: string
  type: 'added' | 'removed' | 'changed'
  before?: unknown
  after?: unknown
}

export interface LogEvent {
  id: string
  kind: LogKind
  /** Epoch ms */
  timestamp: number
  /** Ignore-rule key: events with the same kind + key belong to one ignorable group */
  key: string
  level: LogLevel
  title: string
  subtitle?: string
  data: Record<string, unknown>
  /** Approximate serialized size (chars), used for the memory budget */
  size?: number
}

/** Fields both network events keep to identify the request */
type NetworkIdentity = 'id' | 'timestamp' | 'method' | 'url' | 'path' | 'name' | 'initiator' | 'pending'

/** "Send request" event: only what was sent */
export type NetworkRequestPart = Pick<NetworkEntry,
  NetworkIdentity | 'requestHeaders' | 'requestHeadersPageVisible' | 'params' | 'authorization' | 'requestBody'>

/** "Receive response" event: only what came back */
export type NetworkResponsePart = Pick<NetworkEntry,
  NetworkIdentity | 'status' | 'statusText' | 'duration' | 'size' | 'error' | 'responseHeaders' | 'responseHeadersPageVisible' | 'responseBody'>

export interface NetworkLogData {
  entry: NetworkRequestPart | NetworkResponsePart
}

export interface ChangeLogData {
  changes: LogChange[]
  changesTruncated?: boolean
  before: unknown
  after: unknown
}

/** Persisted rule: events matching kind + key are dropped and not logged */
export interface LogIgnoreRule {
  id: string
  kind: LogKind
  key: string
  addedAt: string
}

export interface LogKindMeta {
  label: string
  /** Tailwind classes for the type badge */
  badgeClass: string
}

export const LOG_KIND_META: Record<LogKind, LogKindMeta> = {
  request: { label: 'Send request', badgeClass: 'text-sky-500 border-sky-500/40 bg-sky-500/10' },
  response: { label: 'Receive response', badgeClass: 'text-green-500 border-green-500/40 bg-green-500/10' },
  props: { label: 'Change props', badgeClass: 'text-teal-500 border-teal-500/40 bg-teal-500/10' },
  emit: { label: 'Emit', badgeClass: 'text-pink-500 border-pink-500/40 bg-pink-500/10' },
  store: { label: 'Change store', badgeClass: 'text-yellow-500 border-yellow-500/40 bg-yellow-500/10' },
  action: { label: 'Store action', badgeClass: 'text-purple-500 border-purple-500/40 bg-purple-500/10' },
  navigation: { label: 'Navigation', badgeClass: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
  error: { label: 'JS error', badgeClass: 'text-red-500 border-red-500/40 bg-red-500/10' },
}

export const LOG_KINDS = Object.keys(LOG_KIND_META) as LogKind[]
