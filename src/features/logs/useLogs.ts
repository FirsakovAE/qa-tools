/**
 * Logs collector
 *
 * Module-level state + message listener, initialized once by Navigation so events are
 * collected regardless of the active tab.
 *
 * Sources:
 *  - injected logs module (`__LOGS__` broadcasts): props, emit, store, action, navigation, error
 *    (already sanitized, size-limited and compacted in page context)
 *  - existing network broadcasts (`__NETWORK__`): Send request / Receive response. Both events
 *    reference one masked network entry in the network pool (see networkPool.ts).
 *
 * Memory: incoming events are committed in batches; the total approximate size (events +
 * network pool + snapshot pool, shared data counted once) is kept within the budget by dropping
 * the oldest events, old store changes are folded into checkpoints (Options > Logs).
 */

import { ref, shallowRef, computed, watch } from 'vue'
import type { NetworkEntry } from '@/types/network'
import type { LogEvent, LogIgnoreRule, LogKind } from '@/types/logs'
import { LOG_KIND_META } from '@/types/logs'
import { inspectorState, useInspectorSettings } from '@/settings/useInspectorSettings'
import { postToContentScript } from '@/utils/postToContentScript'
import {
  LOG_LIMIT_KEYS,
  isCaptured,
  limitKeyForKind,
  maxEventChars,
  normalizeLimits,
  normalizeMasking,
  type LogLimitKey,
} from '@/injected/logs/config'
import { createSanitizer, measureJson } from '@/injected/logs/sanitize'
import { checkpointThrough, countsTowardLimit, enforceLogLimits } from '@/injected/logs/limits'
import { logsRuntime as rt } from '@/injected/logs/runtime'
import { createSnapshotStore } from '@/injected/logs/snapshots'
import { sanitizeNetworkEntry } from './sanitizeNetwork'
import { createNetworkPool } from './networkPool'
import { centrifugeWillReconnect } from '@/features/network/centrifuge'
import type { LogsSource } from './view'

const COMMIT_DELAY_MS = 100
const HEARTBEAT_MS = 10_000
/** Size of a network event itself; its entry is counted by the pool */
const NETWORK_EVENT_SIZE = 120

const events = shallowRef<LogEvent[]>([])
const paused = ref(false)
const isReady = ref(false)
const memoryUsed = ref(0)
const pool = createNetworkPool()

const byId = new Map<string, LogEvent>()
let pending: LogEvent[] = []
let commitTimer: ReturnType<typeof setTimeout> | null = null
let poolChanged = false
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

function isWsKind(kind: string): boolean {
  return kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed'
}

function isNetworkEvent(event: LogEvent): boolean {
  return event.kind === 'request' || event.kind === 'response' || isWsKind(event.kind)
}

function eventSize(event: LogEvent): number {
  if (typeof event.size === 'number' && event.size > 0) return event.size
  return measureJson(event.data) + event.key.length + 80
}

function releaseEvent(event: LogEvent): void {
  byId.delete(event.id)
  if (isNetworkEvent(event) && typeof event.data?.entryId === 'string') pool.release(event.data.entryId)
}

/** Drops / folds the oldest events beyond the memory budget */
function applyLimits(list: LogEvent[]): LogEvent[] {
  const result = enforceLogLimits(list, limits.value, {
    extraSize: () => pool.size + snapshots.bytes,
    onDrop: releaseEvent,
    compactData: data => {
      const interned = snapshots.intern(data) as Record<string, any>
      rt.loadSnapshots(snapshots.peekPending())
      return { data: interned, size: measureJson(interned) }
    },
  })
  for (const event of result.removed) byId.delete(event.id)
  for (const event of result.added) byId.set(event.id, event)
  releaseSnapshots(result.list)
  let total = pool.size + snapshots.bytes
  for (const event of result.list) total += eventSize(event)
  memoryUsed.value = total
  return result.list
}

function commit(): void {
  commitTimer = null
  if (pending.length === 0) {
    if (poolChanged) events.value = applyLimits(events.value)
    poolChanged = false
    return
  }
  poolChanged = false
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

/** A page checkpoint is redundant when this list still holds the change it was folded through */
function isRedundantCheckpoint(event: LogEvent): boolean {
  const through = checkpointThrough(event)
  if (!through) return false
  if (byId.has(through)) return true
  const newer = (e: LogEvent) => e.kind === 'store' && e.key === event.key && !!checkpointThrough(e) && e.timestamp >= event.timestamp
  return events.value.some(newer) || pending.some(newer)
}

function addEvents(incoming: LogEvent[]): void {
  let added = false
  for (const e of incoming) {
    if (!e || byId.has(e.id) || isIgnored(e) || isRedundantCheckpoint(e)) continue
    const event = { ...e, size: eventSize(e) }
    byId.set(event.id, event)
    if (isNetworkEvent(event)) pool.retain(event.data.entryId)
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

function requestEvent(entry: NetworkEntry, key: string): LogEvent {
  return {
    id: `net-req-${entry.id}`,
    kind: 'request',
    timestamp: entryTimestamp(entry),
    key,
    level: 'info',
    data: { entryId: entry.id },
    size: NETWORK_EVENT_SIZE,
  }
}

function responseEvent(entry: NetworkEntry, key: string): LogEvent {
  const failed = !!entry.error || entry.status === 0 || entry.status >= 400
  const level: LogEvent['level'] = failed ? (entry.status >= 400 && entry.status < 500 ? 'warn' : 'error') : 'info'
  return {
    id: `net-res-${entry.id}`,
    kind: 'response',
    timestamp: entryTimestamp(entry) + (entry.duration || 0),
    key,
    level,
    data: { entryId: entry.id },
    size: NETWORK_EVENT_SIZE,
  }
}

function withReconnect(entry: NetworkEntry): NetworkEntry {
  const reconnect = centrifugeWillReconnect(entry)
  if (reconnect !== false || !entry.websocket) return entry
  return { ...entry, websocket: { ...entry.websocket, reconnect: false } }
}

function wsLevel(entry: NetworkEntry): LogEvent['level'] {
  const code = entry.websocket?.closeCode
  const clean = code === 1000 || code === 1001 || code === 1005 || code == null
  if (entry.websocket?.reconnect === false || entry.error) return 'error'
  return clean ? 'info' : 'warn'
}

/**
 * One pooled connection. Opening, each frame and the close are their own events and all
 * point at that entry. A duration tick while the socket stays quiet does not add a row.
 */
function ingestWebSocket(raw: NetworkEntry): void {
  if (!isCaptured(limits.value, 'ws')) return
  const prepared = withReconnect(raw)
  const key = networkLogKey({ ...prepared, url: sanitizer.value.maskString(prepared.url ?? ''), path: sanitizer.value.maskString(prepared.path ?? '') })
  const openId = `net-ws-${prepared.id}`
  const closeId = `net-ws-close-${prepared.id}`
  const closed = prepared.websocket?.state === 'closed'
  const frames = prepared.websocket?.frames ?? []
  const needOpen = !byId.has(openId) && !isIgnored({ kind: 'ws', key })
  const needClose = closed && !byId.has(closeId) && !isIgnored({ kind: 'ws-closed', key })
  const freshFrames = frames.filter(frame => {
    const kind: LogKind = frame.direction === 'sent' ? 'ws-sent' : 'ws-received'
    return !byId.has(`net-ws-${prepared.id}-${frame.id}`) && !isIgnored({ kind, key })
  })
  if (!needOpen && !needClose && freshFrames.length === 0) return

  const { entry, fixedSize } = sanitizeNetworkEntry(prepared, sanitizer.value, maxEventChars(limits.value))
  pool.put(entry, fixedSize)
  if (needOpen) {
    upsertEvent({
      id: openId,
      kind: 'ws',
      timestamp: entryTimestamp(entry),
      key,
      level: 'info',
      data: { entryId: entry.id },
      size: NETWORK_EVENT_SIZE,
    })
  }
  for (const frame of freshFrames) {
    upsertEvent({
      id: `net-ws-${entry.id}-${frame.id}`,
      kind: frame.direction === 'sent' ? 'ws-sent' : 'ws-received',
      timestamp: frame.time || entryTimestamp(entry),
      key,
      level: 'info',
      data: { entryId: entry.id, frameId: frame.id },
      size: NETWORK_EVENT_SIZE,
    })
  }
  if (needClose) {
    upsertEvent({
      id: closeId,
      kind: 'ws-closed',
      timestamp: entryTimestamp(entry) + (entry.duration || 0),
      key,
      level: wsLevel(entry),
      data: { entryId: entry.id },
      size: NETWORK_EVENT_SIZE,
    })
  }
  pool.collect(entry.id)
  poolChanged = true
  scheduleCommit()
}

/**
 * Stores the masked entry once and adds / refreshes its events. `request` / `response`:
 * `add` only adds a missing event, `upsert` also replaces an existing one (new data).
 */
function ingestNetworkEntry(raw: NetworkEntry, request: 'add' | 'upsert' | null, response: 'add' | 'upsert' | null): void {
  if (!isCaptured(limits.value, 'request')) return
  const key = networkLogKey({ ...raw, url: sanitizer.value.maskString(raw.url ?? ''), path: sanitizer.value.maskString(raw.path ?? '') })
  const wantRequest = request && !isIgnored({ kind: 'request', key }) && (request === 'upsert' || !byId.has(`net-req-${raw.id}`))
  const wantResponse = response && !isIgnored({ kind: 'response', key }) && (response === 'upsert' || !byId.has(`net-res-${raw.id}`))
  if (!wantRequest && !wantResponse) return

  const { entry, fixedSize } = sanitizeNetworkEntry(raw, sanitizer.value, maxEventChars(limits.value))
  pool.put(entry, fixedSize)
  // New event objects: views derived from the previous entry data are cached per event
  if (wantRequest || byId.has(`net-req-${entry.id}`)) upsertEvent(requestEvent(entry, key))
  if (wantResponse || byId.has(`net-res-${entry.id}`)) upsertEvent(responseEvent(entry, key))
  pool.collect(entry.id)
  // The pool may have grown without new events (bodies of a completed request)
  poolChanged = true
  scheduleCommit()
}

function processNetworkMessage(msg: any): void {
  if (paused.value) return
  if (msg.entry?.initiator === 'websocket') {
    if (msg.type === 'NETWORK_ENTRY_CAPTURED' || msg.type === 'NETWORK_ENTRY_UPDATED') ingestWebSocket(msg.entry)
    return
  }

  switch (msg.type) {
    case 'NETWORK_ENTRY_CAPTURED':
      if (msg.entry) ingestNetworkEntry(msg.entry, 'add', null)
      break

    // Request breakpoint applied: show the request that was actually sent
    case 'NETWORK_ENTRY_MODIFIED':
      if (msg.entry) ingestNetworkEntry(msg.entry, 'upsert', null)
      break

    case 'NETWORK_ENTRY_UPDATED':
      // Request data is final here (breakpoint edits included)
      if (msg.entry && !msg.entry.pending) ingestNetworkEntry(msg.entry, 'upsert', 'upsert')
      break

    case 'NETWORK_ENTRIES_DATA':
      if (Array.isArray(msg.entries)) {
        for (const entry of msg.entries as NetworkEntry[]) {
          if (entryTimestamp(entry) < clearedAt) continue
          if (entry.initiator === 'websocket') {
            ingestWebSocket(entry)
            continue
          }
          ingestNetworkEntry(entry, 'add', entry.pending ? null : 'add')
        }
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
      acceptLogSnapshots(msg.snapshots)
      if (Array.isArray(msg.events) && !paused.value) addEvents(msg.events)
      break

    case 'LOGS_EVENTS_DATA':
      markReady()
      acceptLogSnapshots(msg.snapshots)
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

const snapshots = createSnapshotStore()

function releaseSnapshots(kept?: LogEvent[]): void {
  const roots: unknown[] = []
  for (const event of kept ?? events.value) roots.push(event.data)
  if (!kept) for (const event of pending) roots.push(event.data)
  snapshots.collect(roots)
  rt.replaceSnapshots(snapshots.all())
}

/** Merges snapshot entries carried with a log message */
function acceptLogSnapshots(map: unknown): void {
  snapshots.load(map)
  rt.loadSnapshots(map)
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
    if (e.kind !== 'response' && countsTowardLimit(e)) counts[limitKeyForKind(e.kind)]++
  }
  return { counts, memoryUsed: memoryUsed.value }
})

export function useLogs() {
  initLogsCollector()

  const snapshotPool = {
    get: (id: string) => snapshots.get(id),
    reachable: (roots: unknown[]) => snapshots.reachable(roots),
  }

  /** All events of the live buffer (ignored ones included: store chains need them) */
  const source = computed<LogsSource>(() => ({ events: events.value, pool, snapshotPool }))

  const visibleEvents = computed(() => {
    const list = source.value.events
    if (ignoredIds.value.size === 0) return list
    return list.filter(e => !isIgnored(e))
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
    pool.clear()
    releaseSnapshots()
    memoryUsed.value = pool.size + snapshots.bytes
    sendCommand('LOGS_CLEAR')
  }

  function getEvent(id: string): LogEvent | undefined {
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
    source,
    totalCount: computed(() => visibleEvents.value.length),
    paused,
    isReady,
    ignoreRules,
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
