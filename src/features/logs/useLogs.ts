/**
 * Logs collector
 *
 * Module-level state + message listener, initialized once by Navigation so events are
 * collected regardless of the active tab.
 *
 * Sources:
 *  - injected logs module (`__LOGS__` broadcasts): props, emit, store, action, navigation, error
 *    (already sanitized and size-limited in page context)
 *  - existing network broadcasts (`__NETWORK__`): Send request / Receive response
 *    (sanitized here, the raw entries are shared with the Network tab)
 *
 * Memory: incoming events are committed in batches; each group is a ring buffer
 * (Options > Logs > limits) and the total approximate size is kept within the memory budget.
 */

import { ref, shallowRef, computed, watch } from 'vue'
import type { NetworkEntry } from '@/types/network'
import type { LogEvent, LogIgnoreRule, LogKind, NetworkRequestPart, NetworkResponsePart } from '@/types/logs'
import { LOG_KIND_META } from '@/types/logs'
import { inspectorState, useInspectorSettings } from '@/settings/useInspectorSettings'
import { postToContentScript } from '@/utils/postToContentScript'
import {
  LOG_LIMIT_KEYS,
  limitKeyForKind,
  normalizeLimits,
  normalizeMasking,
  type LogLimitKey,
} from '@/injected/logs/config'
import { createSanitizer, measureJson } from '@/injected/logs/sanitize'
import { sanitizeNetworkEntry } from './sanitizeNetwork'

const COMMIT_DELAY_MS = 100
const HEARTBEAT_MS = 10_000

const events = shallowRef<LogEvent[]>([])
const paused = ref(false)
const isReady = ref(false)
const memoryUsed = ref(0)

const byId = new Map<string, LogEvent>()
let pending: LogEvent[] = []
let commitTimer: ReturnType<typeof setTimeout> | null = null
/** Network history re-sent by NETWORK_ENTRIES_DATA must not resurrect cleared events */
let clearedAt = 0
let initialized = false
let readyRetryTimer: ReturnType<typeof setInterval> | null = null

const limits = computed(() => normalizeLimits(inspectorState.logsLimits))
const masking = computed(() => normalizeMasking(inspectorState.logsMasking))
const sanitizer = computed(() => createSanitizer(masking.value))

// ============================================================================
// Ignore rules
// ============================================================================

function ignoreId(kind: LogKind, key: string): string {
  return `${kind}\u0000${key}`
}

const ignoredIds = computed(() => {
  const rules = inspectorState.logsIgnoreRules ?? []
  return new Set(rules.map(r => ignoreId(r.kind, r.key)))
})

function isIgnored(event: Pick<LogEvent, 'kind' | 'key'>): boolean {
  return ignoredIds.value.size > 0 && ignoredIds.value.has(ignoreId(event.kind, event.key))
}

function sendCommand(type: string, data: Record<string, unknown> = {}): void {
  postToContentScript({ type, __VUE_INSPECTOR__: true, __LOGS_CMD__: true, ...data })
}

function syncIgnoreRules(): void {
  const rules = (inspectorState.logsIgnoreRules ?? []).map(r => ({ kind: r.kind, key: r.key }))
  sendCommand('LOGS_IGNORE_SYNC', { rules })
}

function syncConfig(): void {
  sendCommand('LOGS_CONFIG_SYNC', {
    limits: JSON.parse(JSON.stringify(limits.value)),
    masking: JSON.parse(JSON.stringify(masking.value)),
  })
}

// ============================================================================
// Event list (sorted by timestamp, ring per group + memory budget)
// ============================================================================

function eventSize(event: LogEvent): number {
  if (typeof event.size === 'number' && event.size > 0) return event.size
  return measureJson(event.data) + event.title.length + (event.subtitle?.length ?? 0) + 120
}

/** Drops the oldest events beyond the group limits and the memory budget. Mutates `list`. */
function applyLimits(list: LogEvent[]): LogEvent[] {
  const counts = new Map<LogKind, number>()
  for (const e of list) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1)

  const excess = new Map<LogKind, number>()
  for (const [kind, count] of counts) {
    const over = count - limits.value.counts[limitKeyForKind(kind)]
    if (over > 0) excess.set(kind, over)
  }

  let kept = list
  if (excess.size > 0) {
    kept = []
    for (const e of list) {
      const over = excess.get(e.kind)
      if (over) {
        excess.set(e.kind, over - 1)
        byId.delete(e.id)
      } else {
        kept.push(e)
      }
    }
  }

  let total = 0
  for (const e of kept) total += e.size ?? 0
  const budget = limits.value.maxMemoryMB * 1024 * 1024
  let drop = 0
  while (total > budget && drop < kept.length) {
    total -= kept[drop].size ?? 0
    byId.delete(kept[drop].id)
    drop++
  }
  memoryUsed.value = total
  return drop > 0 ? kept.slice(drop) : kept
}

function commit(): void {
  commitTimer = null
  if (pending.length === 0) return
  const fresh = pending
  pending = []
  fresh.sort((a, b) => a.timestamp - b.timestamp)
  const current = events.value
  const next = current.concat(fresh)
  if (current.length > 0 && current[current.length - 1].timestamp > fresh[0].timestamp) {
    next.sort((a, b) => a.timestamp - b.timestamp)
  }
  events.value = applyLimits(next)
}

function scheduleCommit(): void {
  if (!commitTimer) commitTimer = setTimeout(commit, COMMIT_DELAY_MS)
}

function addEvents(incoming: LogEvent[]): void {
  let added = false
  for (const e of incoming) {
    if (!e || byId.has(e.id) || isIgnored(e)) continue
    const event = { ...e, size: eventSize(e) }
    byId.set(event.id, event)
    pending.push(event)
    added = true
  }
  if (added) scheduleCommit()
}

function upsertEvent(event: LogEvent): void {
  const existing = byId.get(event.id)
  if (!existing) {
    addEvents([event])
    return
  }
  byId.set(event.id, event)
  const idx = events.value.indexOf(existing)
  if (idx !== -1) {
    const next = events.value.slice()
    next[idx] = event
    events.value = next
  } else {
    const pIdx = pending.indexOf(existing)
    if (pIdx !== -1) pending[pIdx] = event
  }
}

function reapplyLimits(): void {
  commit()
  events.value = applyLimits(events.value.slice())
}

// ============================================================================
// Network → log events
// ============================================================================

export function networkLogKey(entry: Pick<NetworkEntry, 'method' | 'url' | 'path'>): string {
  let base = entry.path || entry.url
  try {
    const u = new URL(entry.url)
    base = `${u.origin}${u.pathname}`
  } catch { /* relative URL — keep path */ }
  return `${String(entry.method).toUpperCase()} ${base}`
}

function entryTimestamp(entry: NetworkEntry): number {
  const ts = Date.parse(entry.timestamp)
  return Number.isFinite(ts) ? ts : Date.now()
}

function sanitizedEntry(entry: NetworkEntry): { entry: NetworkEntry; size: number } {
  return sanitizeNetworkEntry(entry, sanitizer.value, limits.value.maxEventKB * 1024)
}

function requestPart(e: NetworkEntry): NetworkRequestPart {
  return {
    id: e.id, timestamp: e.timestamp, method: e.method, url: e.url, path: e.path, name: e.name,
    initiator: e.initiator, pending: e.pending,
    requestHeaders: e.requestHeaders, requestHeadersPageVisible: e.requestHeadersPageVisible,
    params: e.params, authorization: e.authorization, requestBody: e.requestBody,
  }
}

function responsePart(e: NetworkEntry): NetworkResponsePart {
  return {
    id: e.id, timestamp: e.timestamp, method: e.method, url: e.url, path: e.path, name: e.name,
    initiator: e.initiator, pending: e.pending,
    status: e.status, statusText: e.statusText, duration: e.duration, size: e.size, error: e.error,
    responseHeaders: e.responseHeaders, responseHeadersPageVisible: e.responseHeadersPageVisible,
    responseBody: e.responseBody,
  }
}

// Each event stores only its own half; the other half is emptied before sanitizing so it
// costs nothing in the size budget.
function requestEvent(raw: NetworkEntry): LogEvent {
  const { entry: sanitized, size } = sanitizedEntry({ ...raw, responseHeaders: [], responseHeadersPageVisible: undefined, responseBody: null })
  const entry = requestPart(sanitized)
  return {
    id: `net-req-${raw.id}`,
    kind: 'request',
    timestamp: entryTimestamp(raw),
    key: networkLogKey(raw),
    level: 'info',
    title: `${entry.method} ${entry.path || entry.url}`,
    subtitle: entry.url,
    data: { entry },
    size: size + 200,
  }
}

function responseEvent(raw: NetworkEntry): LogEvent {
  const { entry: sanitized, size } = sanitizedEntry({
    ...raw, requestHeaders: [], requestHeadersPageVisible: undefined, params: [], authorization: { type: 'None' }, requestBody: null,
  })
  const entry = responsePart(sanitized)
  const failed = !!raw.error || raw.status === 0 || raw.status >= 400
  const status = raw.error ? `Failed: ${entry.error}` : `${raw.status} ${raw.statusText ?? ''}`.trim()
  return {
    id: `net-res-${raw.id}`,
    kind: 'response',
    timestamp: entryTimestamp(raw) + (raw.duration || 0),
    key: networkLogKey(raw),
    level: failed ? (raw.status >= 400 && raw.status < 500 ? 'warn' : 'error') : 'info',
    title: `${entry.method} ${entry.path || entry.url}`,
    subtitle: status,
    data: { entry },
    size: size + 200,
  }
}

function processNetworkMessage(msg: any): void {
  if (paused.value) return

  switch (msg.type) {
    case 'NETWORK_ENTRY_CAPTURED':
      if (msg.entry && !byId.has(`net-req-${msg.entry.id}`)) addEvents([requestEvent(msg.entry)])
      break

    // Request breakpoint applied: show the request that was actually sent
    case 'NETWORK_ENTRY_MODIFIED':
      if (msg.entry) upsertEvent(requestEvent(msg.entry))
      break

    case 'NETWORK_ENTRY_UPDATED':
      if (msg.entry && !msg.entry.pending) {
        // Request data is final here (breakpoint edits included)
        upsertEvent(requestEvent(msg.entry))
        upsertEvent(responseEvent(msg.entry))
      }
      break

    case 'NETWORK_ENTRIES_DATA':
      if (Array.isArray(msg.entries)) {
        const seeded: LogEvent[] = []
        for (const entry of msg.entries as NetworkEntry[]) {
          if (entryTimestamp(entry) < clearedAt) continue
          if (!byId.has(`net-req-${entry.id}`)) seeded.push(requestEvent(entry))
          if (!entry.pending && !byId.has(`net-res-${entry.id}`)) seeded.push(responseEvent(entry))
        }
        addEvents(seeded)
      }
      break
  }
}

// ============================================================================
// Logs module messages
// ============================================================================

function markReady(): void {
  isReady.value = true
  if (readyRetryTimer) {
    clearInterval(readyRetryTimer)
    readyRetryTimer = null
  }
}

function requestHistory(): void {
  syncConfig()
  syncIgnoreRules()
  sendCommand('LOGS_GET_EVENTS')
}

function processLogsMessage(msg: any): void {
  switch (msg.type) {
    case 'LOGS_READY':
      requestHistory()
      break

    case 'LOGS_EVENTS':
      if (Array.isArray(msg.events) && !paused.value) addEvents(msg.events)
      break

    case 'LOGS_EVENTS_DATA':
      markReady()
      if (typeof msg.paused === 'boolean') paused.value = msg.paused
      if (Array.isArray(msg.events)) {
        addEvents(msg.events.filter((e: LogEvent) => e.timestamp >= clearedAt))
      }
      break

    case 'LOGS_STATUS':
      if (typeof msg.paused === 'boolean') paused.value = msg.paused
      break
  }
}

function handleMessage(event: MessageEvent): void {
  const data = event.data
  if (!data || typeof data !== 'object') return

  let msg: any = null
  if (data.__VUE_INSPECTOR__ && data.broadcast && data.message) msg = data.message
  else if (data.__FROM_VUE_INSPECTOR__) msg = data
  if (!msg) return

  if (msg.type === 'DEVTOOLS_RECONNECTED') {
    requestHistory()
    return
  }
  if (msg.__LOGS__) processLogsMessage(msg)
  else if (msg.__NETWORK__) processNetworkMessage(msg)
}

/** Start collecting events. Safe to call multiple times. */
export function initLogsCollector(): void {
  if (initialized) return
  initialized = true
  window.addEventListener('message', handleMessage)

  watch(() => inspectorState.logsIgnoreRules, syncIgnoreRules, { deep: true })
  watch([limits, masking], () => {
    syncConfig()
    reapplyLimits()
  }, { deep: true })

  void useInspectorSettings().catch(() => { /* defaults stay in effect */ })

  requestHistory()
  postToContentScript({ type: 'NETWORK_GET_ENTRIES', __VUE_INSPECTOR__: true, __NETWORK_CMD__: true })

  // Keeps the page streaming live events; without it the page only buffers them
  setInterval(() => sendCommand('LOGS_SUBSCRIBE'), HEARTBEAT_MS)

  let retries = 0
  readyRetryTimer = setInterval(() => {
    if (isReady.value || ++retries > 10) {
      if (readyRetryTimer) clearInterval(readyRetryTimer)
      readyRetryTimer = null
      return
    }
    requestHistory()
  }, 500)
}

// ============================================================================
// Imported logs (read-only view of an exported file)
// ============================================================================

export interface ImportedLogs {
  fileName: string
  exportedAt?: string
  events: LogEvent[]
  skipped: number
}

const imported = shallowRef<ImportedLogs | null>(null)

export function setImportedLogs(value: ImportedLogs | null): void {
  imported.value = value
}

// ============================================================================
// Composable
// ============================================================================

export interface LogsStats {
  counts: Record<LogLimitKey, number>
  memoryUsed: number
}

export const logsStats = computed<LogsStats>(() => {
  const counts = Object.fromEntries(LOG_LIMIT_KEYS.map(k => [k, 0])) as Record<LogLimitKey, number>
  for (const e of events.value) {
    const key = limitKeyForKind(e.kind)
    if (e.kind !== 'response') counts[key]++
  }
  return { counts, memoryUsed: memoryUsed.value }
})

export function useLogs() {
  initLogsCollector()

  const sourceEvents = computed(() => imported.value?.events ?? events.value)

  const visibleEvents = computed(() => {
    if (ignoredIds.value.size === 0) return sourceEvents.value
    return sourceEvents.value.filter(e => !isIgnored(e))
  })

  function togglePause() {
    paused.value = !paused.value
    sendCommand(paused.value ? 'LOGS_PAUSE' : 'LOGS_RESUME')
  }

  function clearEvents() {
    clearedAt = Date.now()
    byId.clear()
    pending = []
    events.value = []
    memoryUsed.value = 0
    sendCommand('LOGS_CLEAR')
  }

  function getEvent(id: string): LogEvent | undefined {
    if (imported.value) return imported.value.events.find(e => e.id === id)
    return byId.get(id)
  }

  function ignoreEvent(event: LogEvent) {
    if (isIgnored(event)) return
    if (!Array.isArray(inspectorState.logsIgnoreRules)) inspectorState.logsIgnoreRules = []
    const rule: LogIgnoreRule = {
      id: `log-ignore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: event.kind,
      key: event.key,
      addedAt: new Date().toISOString(),
    }
    inspectorState.logsIgnoreRules.push(rule)
  }

  function removeIgnoreRule(id: string) {
    inspectorState.logsIgnoreRules = (inspectorState.logsIgnoreRules ?? []).filter(r => r.id !== id)
  }

  function clearIgnoreRules() {
    inspectorState.logsIgnoreRules = []
  }

  const ignoreRules = computed(() => inspectorState.logsIgnoreRules ?? [])

  return {
    events: visibleEvents,
    totalCount: computed(() => visibleEvents.value.length),
    paused,
    isReady,
    ignoreRules,
    imported,
    sanitizer,
    togglePause,
    clearEvents,
    getEvent,
    ignoreEvent,
    removeIgnoreRule,
    clearIgnoreRules,
  }
}

export function ignoreRuleLabel(rule: Pick<LogIgnoreRule, 'kind' | 'key'>): string {
  return `${LOG_KIND_META[rule.kind]?.label ?? rule.kind}: ${rule.key}`
}
