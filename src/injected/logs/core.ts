/**
 * Logs core: event buffer, batching transport and command handling.
 *
 * Events are buffered in page context so the UI can fetch history when it connects
 * later (overlay opened, DevTools panel reconnected). The buffer is a ring per event group
 * plus a total memory budget (limits come from the UI settings via LOGS_CONFIG_SYNC).
 *
 * Every payload is sanitized here (safe plain JSON + masking) before it is stored or posted.
 * Live events are posted only while a UI is subscribed (heartbeat); otherwise they are just
 * buffered and delivered as history on the next subscribe.
 */

import type { LogEvent, LogEventInput, LogIgnoreKey, LogKind } from './types'
import {
  DEFAULT_LOGS_LIMITS,
  DEFAULT_LOGS_MASKING,
  limitKeyForKind,
  normalizeLimits,
  normalizeMasking,
  type LogsLimits,
} from './config'
import { createSanitizer, fitPayload, measureJson, type Sanitized, type Sanitizer } from './sanitize'

const FLUSH_INTERVAL_MS = 150
/** Longer than the UI heartbeat even under background-tab timer throttling (1/min) */
const SUBSCRIPTION_TTL_MS = 90_000

const rings = new Map<LogKind, LogEvent[]>()
let totalSize = 0
let queue: LogEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let paused = false
let ignored = new Set<string>()
let counter = 0
let initialized = false
let subscribedUntil = 0

let limits: LogsLimits = normalizeLimits(DEFAULT_LOGS_LIMITS)
let sanitizer: Sanitizer = createSanitizer(DEFAULT_LOGS_MASKING)
/** Store snapshots are immutable copies owned by the tracker: "after" is reused as next "before" */
let snapshotMemo = new WeakMap<object, Sanitized>()

const stateListeners = new Set<() => void>()

function ignoreId(kind: LogKind, key: string): string {
  return `${kind}\u0000${key}`
}

function post(type: string, data: Record<string, unknown> = {}): void {
  const message = { type, __FROM_VUE_INSPECTOR__: true, __LOGS__: true, ...data }
  try {
    window.postMessage(message, '*')
  } catch (e) {
    // Payloads are sanitized to plain JSON; a JSON round-trip is the last-resort fallback
    try {
      window.postMessage(JSON.parse(JSON.stringify(message)), '*')
    } catch {
      console.error('[injected/logs] postMessage failed:', type, e)
    }
  }
}

function isSubscribed(): boolean {
  return Date.now() < subscribedUntil
}

function flush(): void {
  flushTimer = null
  if (queue.length === 0) return
  const events = queue
  queue = []
  if (isSubscribed()) post('LOGS_EVENTS', { events })
}

function notifyStateChanged(): void {
  for (const fn of stateListeners) {
    try {
      fn()
    } catch (e) {
      console.error('[injected/logs] state listener failed:', e)
    }
  }
}

// ============================================================================
// Ring buffer
// ============================================================================

function evictOldest(): boolean {
  let oldestRing: LogEvent[] | null = null
  for (const ring of rings.values()) {
    if (ring.length > 0 && (!oldestRing || ring[0].timestamp < oldestRing[0].timestamp)) oldestRing = ring
  }
  const removed = oldestRing?.shift()
  if (!removed) return false
  totalSize -= removed.size ?? 0
  return true
}

function enforceLimits(): void {
  for (const [kind, ring] of rings) {
    const max = limits.counts[limitKeyForKind(kind)]
    if (ring.length > max) {
      for (const e of ring.splice(0, ring.length - max)) totalSize -= e.size ?? 0
    }
  }
  const budget = limits.maxMemoryMB * 1024 * 1024
  while (totalSize > budget && evictOldest()) { /* evict */ }
}

function bufferedEvents(): LogEvent[] {
  const all: LogEvent[] = []
  for (const ring of rings.values()) all.push(...ring)
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

function clearBuffer(): void {
  rings.clear()
  totalSize = 0
  queue = []
}

// ============================================================================
// Public API
// ============================================================================

export function isLogsPaused(): boolean {
  return paused
}

export function isIgnored(kind: LogKind, key: string): boolean {
  return ignored.size > 0 && ignored.has(ignoreId(kind, key))
}

/** Sanitizer with the current masking settings (for previews built before recordLog) */
export function getSanitizer(): Sanitizer {
  return sanitizer
}

/** Called on pause/resume and when ignore rules change (trackers refresh stale snapshots) */
export function onLogsStateChanged(fn: () => void): void {
  stateListeners.add(fn)
}

export function recordLog(input: LogEventInput): void {
  if (paused || isIgnored(input.kind, input.key)) return

  let data: Record<string, unknown>
  let size: number
  try {
    const memo = input.kind === 'store' ? snapshotMemo : undefined
    const sanitized = sanitizer.sanitize<Record<string, unknown>>(input.data, { partSizes: true, memo })
    const fitted = fitPayload(sanitized.value ?? {}, sanitized.size, limits.maxEventKB * 1024, sanitized.parts)
    data = fitted.data
    size = fitted.size
  } catch (e) {
    console.error('[injected/logs] sanitize failed:', e)
    data = { error: '[Payload could not be serialized]' }
    size = measureJson(data)
  }

  const title = sanitizer.maskString(String(input.title ?? ''))
  const subtitle = input.subtitle === undefined ? undefined : sanitizer.maskString(String(input.subtitle))
  const event: LogEvent = {
    ...input,
    title,
    subtitle,
    data,
    size: size + title.length + (subtitle?.length ?? 0) + 120,
    id: `log-${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: input.timestamp ?? Date.now(),
  }

  let ring = rings.get(event.kind)
  if (!ring) rings.set(event.kind, (ring = []))
  ring.push(event)
  totalSize += event.size ?? 0
  enforceLimits()

  if (!isSubscribed()) return
  queue.push(event)
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS)
}

function subscribe(): boolean {
  const wasSubscribed = isSubscribed()
  subscribedUntil = Date.now() + SUBSCRIPTION_TTL_MS
  return wasSubscribed
}

function handleCommand(event: MessageEvent): void {
  if (event.source !== window || !event.data) return
  const { type, __VUE_INSPECTOR__, __LOGS_CMD__ } = event.data
  if (!__VUE_INSPECTOR__ || !__LOGS_CMD__) return

  switch (type) {
    case 'LOGS_GET_EVENTS':
      subscribe()
      post('LOGS_EVENTS_DATA', { events: bufferedEvents(), paused })
      break

    case 'LOGS_SUBSCRIBE':
      // Resync after a lapse: events recorded meanwhile were only buffered
      if (!subscribe()) post('LOGS_EVENTS_DATA', { events: bufferedEvents(), paused })
      break

    case 'LOGS_CLEAR':
      clearBuffer()
      post('LOGS_CLEARED')
      break

    case 'LOGS_PAUSE':
      paused = true
      notifyStateChanged()
      post('LOGS_STATUS', { paused })
      break

    case 'LOGS_RESUME':
      paused = false
      notifyStateChanged()
      post('LOGS_STATUS', { paused })
      break

    case 'LOGS_IGNORE_SYNC': {
      const rules = Array.isArray(event.data.rules) ? (event.data.rules as LogIgnoreKey[]) : []
      ignored = new Set(rules.map(r => ignoreId(r.kind, r.key)))
      notifyStateChanged()
      break
    }

    case 'LOGS_CONFIG_SYNC':
      limits = normalizeLimits(event.data.limits)
      sanitizer = createSanitizer(normalizeMasking(event.data.masking))
      snapshotMemo = new WeakMap()
      enforceLimits()
      break
  }
}

export function initLogsCore(): boolean {
  if (initialized) return false
  initialized = true
  window.addEventListener('message', handleCommand)
  post('LOGS_READY', { paused })
  return true
}
