/**
 * Logs limits and masking config shared by the injected bundle and the UI (no imports allowed).
 */

export type LogLimitKey = 'network' | 'props' | 'emit' | 'store' | 'action' | 'navigation' | 'error'

export interface LogsLimits {
  /** Event groups that are logged at all (network: both request and response events) */
  capture: Record<LogLimitKey, boolean>
  /** Total budget for buffered events (approximate serialized size) */
  maxMemoryMB: number
  /** Off: payloads are kept whole. On: larger parts are omitted and network bodies are truncated to `maxEventKB` */
  limitEventSize: boolean
  maxEventKB: number
}

export interface LogsMasking {
  enabled: boolean
  /** Object keys / header / param names containing these words are masked */
  keys: string[]
  /** Mask JWTs, Bearer/Basic credentials and card numbers inside any string */
  valuePatterns: boolean
}

export const LOG_LIMIT_KEYS: LogLimitKey[] = ['network', 'props', 'emit', 'store', 'action', 'navigation', 'error']

export const DEFAULT_LOGS_LIMITS: LogsLimits = {
  capture: { network: true, props: true, emit: true, store: true, action: true, navigation: true, error: true },
  maxMemoryMB: 20,
  limitEventSize: false,
  maxEventKB: 512,
}

export const LOG_LIMIT_BOUNDS = {
  memoryMB: { min: 8, max: 1024 },
  eventKB: { min: 16, max: 16384 },
}

export const DEFAULT_MASK_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'sessionid',
  'privatekey',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
  'ssn',
  'otp',
]

export const DEFAULT_LOGS_MASKING: LogsMasking = {
  enabled: true,
  keys: [...DEFAULT_MASK_KEYS],
  valuePatterns: true,
}

export function limitKeyForKind(kind: string): LogLimitKey {
  return kind === 'request' || kind === 'response' ? 'network' : (kind as LogLimitKey)
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeLimits(raw: Partial<LogsLimits> | null | undefined): LogsLimits {
  const capture = {} as Record<LogLimitKey, boolean>
  const { memoryMB, eventKB } = LOG_LIMIT_BOUNDS
  for (const key of LOG_LIMIT_KEYS) capture[key] = raw?.capture?.[key] !== false
  return {
    capture,
    maxMemoryMB: clampInt(raw?.maxMemoryMB, memoryMB.min, memoryMB.max, DEFAULT_LOGS_LIMITS.maxMemoryMB),
    limitEventSize: raw?.limitEventSize === true,
    maxEventKB: clampInt(raw?.maxEventKB, eventKB.min, eventKB.max, DEFAULT_LOGS_LIMITS.maxEventKB),
  }
}

/** Per-event size limit in characters; Infinity when payloads are kept whole */
export function maxEventChars(limits: LogsLimits): number {
  return limits.limitEventSize ? limits.maxEventKB * 1024 : Infinity
}

export function isCaptured(limits: LogsLimits, kind: string): boolean {
  return limits.capture[limitKeyForKind(kind)] !== false
}

export function normalizeMasking(raw: Partial<LogsMasking> | null | undefined): LogsMasking {
  const keys = Array.isArray(raw?.keys)
    ? raw!.keys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map(k => k.trim())
    : [...DEFAULT_MASK_KEYS]
  return {
    enabled: raw?.enabled !== false,
    keys,
    valuePatterns: raw?.valuePatterns !== false,
  }
}
