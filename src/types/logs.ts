/**
 * Logs Tab Types
 * Mirrors src/injected/logs/types.ts (the injected bundle cannot import from @/types)
 *
 * Stored events keep only primary data: the subject id is stored once in `key`, titles,
 * subtitles and other display fields are derived on read (features/logs/view.ts), store
 * changes are diffs against the previous state of the store, network events reference one
 * shared network entry.
 */

import type { HeaderEntry, NetworkEntry } from './network'

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

export interface LogEvent {
  id: string
  kind: LogKind
  /** Epoch ms */
  timestamp: number
  /** Subject id (store, component, request group...) and ignore-rule key */
  key: string
  level: LogLevel
  data: Record<string, any>
  /** Approximate serialized size (chars), used for the memory budget */
  size?: number
}

/**
 * Change store events:
 *  - `init` (Store initialized) / `snapshot` (Store snapshot) / `checkpoint` (compacted older
 *    changes): full `state`;
 *  - `change`: `changes` without old values (restored from the previous state); `state` only
 *    when the diff alone cannot be replayed exactly.
 */
export type StoreLogOp = 'init' | 'snapshot' | 'checkpoint' | 'change'

export interface NetworkLogData {
  entryId: string
}

/** Index into the full header list or a header that is not in it */
export type HeaderRef = number | HeaderEntry

/** Network entry as stored by Logs (one per request, shared by both network events) */
export interface StoredNetworkEntry extends Omit<NetworkEntry,
  'version' | 'name' | 'requestBody' | 'responseBody' | 'requestHeadersPageVisible' | 'responseHeadersPageVisible'> {
  /** References into the body pool: equal bodies are stored once */
  requestBodyRef?: string
  responseBodyRef?: string
  /** Page-visible (Classic) header lists as references into the full lists */
  requestHeadersVisible?: HeaderRef[]
  responseHeadersVisible?: HeaderRef[]
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
  ws: { label: 'WebSocket open', badgeClass: 'text-cyan-500 border-cyan-500/40 bg-cyan-500/10' },
  'ws-sent': { label: 'WebSocket sent', badgeClass: 'text-sky-400 border-sky-400/40 bg-sky-400/10' },
  'ws-received': { label: 'WebSocket received', badgeClass: 'text-green-500 border-green-500/40 bg-green-500/10' },
  'ws-closed': { label: 'WebSocket closed', badgeClass: 'text-orange-500 border-orange-500/40 bg-orange-500/10' },
  props: { label: 'Change props', badgeClass: 'text-teal-500 border-teal-500/40 bg-teal-500/10' },
  emit: { label: 'Emit', badgeClass: 'text-pink-500 border-pink-500/40 bg-pink-500/10' },
  store: { label: 'Change store', badgeClass: 'text-yellow-500 border-yellow-500/40 bg-yellow-500/10' },
  action: { label: 'Store action', badgeClass: 'text-purple-500 border-purple-500/40 bg-purple-500/10' },
  navigation: { label: 'Navigation', badgeClass: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
  error: { label: 'JS error', badgeClass: 'text-red-500 border-red-500/40 bg-red-500/10' },
}

export const LOG_KINDS = Object.keys(LOG_KIND_META) as LogKind[]

export const LOG_KIND_LABELS: Record<string, string> = Object.fromEntries(LOG_KINDS.map(k => [k, LOG_KIND_META[k].label]))
