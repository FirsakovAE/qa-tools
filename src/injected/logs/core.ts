/**
 * Logs core: event buffer, batching transport and command handling.
 *
 * Events are buffered in page context so the UI can fetch history when it connects
 * later (overlay opened, DevTools panel reconnected). The buffer is one chronological list
 * within a total memory budget; event groups can be switched off and the per-event size limit
 * is optional (settings come from the UI via LOGS_CONFIG_SYNC). Old store changes are folded
 * into checkpoints (see limits.ts).
 *
 * Every payload is sanitized here (safe plain JSON + masking) before it is stored or posted.
 * Live events are posted only while a UI is subscribed (heartbeat); otherwise they are just
 * buffered and delivered as history on the next subscribe.
 */

import type { LogEvent, LogEventInput, LogIgnoreKey, LogKind } from './types'
import {
  DEFAULT_LOGS_LIMITS,
  DEFAULT_LOGS_MASKING,
  isCaptured,
  maxEventChars,
  normalizeLimits,
  normalizeMasking,
  type LogsLimits,
} from './config'
import { createSanitizer, fitPayload, measureJson, type Sanitizer } from './sanitize'
import { enforceLogLimits } from './limits'

const FLUSH_INTERVAL_MS = 150
/** Longer than the UI heartbeat even under background-tab timer throttling (1/min) */
const SUBSCRIPTION_TTL_MS = 90_000
/** Per-event overhead of the envelope (id, kind, timestamp, level) in the size estimate */
const EVENT_OVERHEAD = 80

let buffer: LogEvent[] = []
let totalSize = 0
let queue: LogEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let paused = false
let ignored = new Set<string>()
let counter = 0
let initialized = false
let subscribedUntil = 0

let limits: LogsLimits = normalizeLimits(DEFAULT_LOGS_LIMITS)
let maskingJson = JSON.stringify(normalizeMasking(DEFAULT_LOGS_MASKING))
let sanitizer: Sanitizer = createSanitizer(DEFAULT_LOGS_MASKING)

const stateListeners = new Set<() => void>()
const resetListeners = new Set<() => void>()

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

function notify(listeners: Set<() => void>, what: string): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch (e) {
      console.error(`[injected/logs] ${what} listener failed:`, e)
    }
  }
}

// ============================================================================
// Buffer
// ============================================================================

function recount(): void {
  totalSize = 0
  for (const e of buffer) totalSize += e.size ?? 0
}

function enforceLimits(): void {
  if (totalSize <= limits.maxMemoryMB * 1024 * 1024) return
  const result = enforceLogLimits(buffer, limits, { inPlace: true })
  if (!result.changed) return
  buffer = result.list
  recount()
}

function clearBuffer(): void {
  buffer = []
  recount()
  queue = []
}

// ============================================================================
// Public API
// ============================================================================

export function isLogsPaused(): boolean {
  return paused
}

/** Masking rule for keys of values that are previewed as text (the masking of payloads does not reach them) */
export function isSensitiveLogKey(key: string): boolean {
  return sanitizer.isSensitiveKey(key)
}

/** Whether events of this group are logged at all (Options > Logs) */
export function isCaptureEnabled(kind: LogKind): boolean {
  return isCaptured(limits, kind)
}

/** The group is switched off, or this event is in the ignore list */
export function isIgnored(kind: LogKind, key: string): boolean {
  if (!isCaptured(limits, kind)) return true
  return ignored.size > 0 && ignored.has(ignoreId(kind, key))
}

/** Called on pause/resume, when ignore rules or logged groups change (trackers refresh stale snapshots) */
export function onLogsStateChanged(fn: () => void): void {
  stateListeners.add(fn)
}

/**
 * Called after the buffer was cleared or the masking changed: diff chains must restart from
 * a fresh full snapshot.
 */
export function onLogsReset(fn: () => void): void {
  resetListeners.add(fn)
}

/** Records an event; returns the stored (sanitized, compacted) event or null when skipped */
export function recordLog(input: LogEventInput): LogEvent | null {
  if (paused || isIgnored(input.kind, input.key)) return null
  const key = sanitizer.maskString(String(input.key ?? ''))
  if (key !== input.key && isIgnored(input.kind, key)) return null

  let data: Record<string, any>
  let size: number
  try {
    const sanitized = sanitizer.sanitize<Record<string, unknown>>(input.data, { partSizes: true })
    const fitted = fitPayload(sanitized.value ?? {}, sanitized.size, maxEventChars(limits), sanitized.parts)
    data = fitted.data
    size = fitted.size
    if (input.finalize) {
      data = input.finalize(data, key)
      size = measureJson(data)
    }
  } catch (e) {
    console.error('[injected/logs] sanitize failed:', e)
    data = { error: '[Payload could not be serialized]' }
    size = measureJson(data)
  }

  const event: LogEvent = {
    id: `log-${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind,
    timestamp: input.timestamp ?? Date.now(),
    key,
    level: input.level,
    data,
    size: size + key.length + EVENT_OVERHEAD,
  }

  buffer.push(event)
  totalSize += event.size ?? 0
  enforceLimits()

  if (isSubscribed()) {
    queue.push(event)
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS)
  }
  return event
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
      post('LOGS_EVENTS_DATA', { events: buffer, paused })
      break

    case 'LOGS_SUBSCRIBE':
      // Resync after a lapse: events recorded meanwhile were only buffered
      if (!subscribe()) post('LOGS_EVENTS_DATA', { events: buffer, paused })
      break

    case 'LOGS_CLEAR':
      clearBuffer()
      post('LOGS_CLEARED')
      notify(resetListeners, 'reset')
      break

    case 'LOGS_PAUSE':
      paused = true
      notify(stateListeners, 'state')
      post('LOGS_STATUS', { paused })
      break

    case 'LOGS_RESUME':
      paused = false
      notify(stateListeners, 'state')
      post('LOGS_STATUS', { paused })
      break

    case 'LOGS_IGNORE_SYNC': {
      const rules = Array.isArray(event.data.rules) ? (event.data.rules as LogIgnoreKey[]) : []
      ignored = new Set(rules.map(r => ignoreId(r.kind, r.key)))
      notify(stateListeners, 'state')
      break
    }

    case 'LOGS_CONFIG_SYNC': {
      const previousCapture = JSON.stringify(limits.capture)
      limits = normalizeLimits(event.data.limits)
      const masking = normalizeMasking(event.data.masking)
      const nextMaskingJson = JSON.stringify(masking)
      const maskingChanged = nextMaskingJson !== maskingJson
      maskingJson = nextMaskingJson
      sanitizer = createSanitizer(masking)
      enforceLimits()
      // Diffs masked differently than their base would not apply to it
      if (maskingChanged) notify(resetListeners, 'reset')
      if (JSON.stringify(limits.capture) !== previousCapture) notify(stateListeners, 'state')
      break
    }
  }
}

export function initLogsCore(): boolean {
  if (initialized) return false
  initialized = true
  window.addEventListener('message', handleCommand)
  post('LOGS_READY', { paused })
  return true
}
