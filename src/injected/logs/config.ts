/**
 * Logs limits and masking config shared by the injected bundle and the UI (no imports allowed).
 */

export type LogLimitKey = 'network' | 'props' | 'emit' | 'store' | 'action' | 'navigation' | 'error'

export interface LogsLimits {
  /** Ring buffer size per event group (network: per request and per response events) */
  counts: Record<LogLimitKey, number>
  /** Total budget for buffered events (approximate serialized size) */
  maxMemoryMB: number
  /** Larger payload parts are omitted (network bodies are truncated) */
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
  counts: { network: 500, props: 1000, emit: 1000, store: 1000, action: 1000, navigation: 200, error: 200 },
  maxMemoryMB: 64,
  maxEventKB: 512,
}

export const LOG_LIMIT_BOUNDS = {
  count: { min: 10, max: 20000 },
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
  const counts = {} as Record<LogLimitKey, number>
  const { count, memoryMB, eventKB } = LOG_LIMIT_BOUNDS
  for (const key of LOG_LIMIT_KEYS) {
    counts[key] = clampInt(raw?.counts?.[key], count.min, count.max, DEFAULT_LOGS_LIMITS.counts[key])
  }
  return {
    counts,
    maxMemoryMB: clampInt(raw?.maxMemoryMB, memoryMB.min, memoryMB.max, DEFAULT_LOGS_LIMITS.maxMemoryMB),
    maxEventKB: clampInt(raw?.maxEventKB, eventKB.min, eventKB.max, DEFAULT_LOGS_LIMITS.maxEventKB),
  }
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
