/**
 * Safe serialization + masking for log payloads. Shared by the injected bundle and the UI.
 *
 * `sanitize` always returns a new plain-JSON structure (inputs may be shared and are never
 * mutated): cycles, functions, symbols, bigints, DOM nodes, binary data and Vue internals
 * (VNodes, component instances, apps) are converted to placeholders; values of sensitive keys
 * are masked. Strings are kept whole: the size is bounded by the optional per-event limit.
 */

import type { LogsMasking } from './config'
import { logsRuntime } from './runtime'

export const MASK = '[MASKED]'

const MAX_DEPTH = 100
const KEY_CACHE_LIMIT = 5000

const JWT_RE = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g
const AUTH_SCHEME_RE = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9\-._~+/]{8,}=*/g
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g
/** Cheap pre-check: a string without any of these cannot match the patterns above */
const PATTERN_HINT_RE = /eyJ|Bearer|Basic|Token|\d[ -]?\d[ -]?\d[ -]?\d/
const QUERY_PARAM_RE = /([?&;#])([^=&#?\s]+)=([^&#\s]*)/g

export interface Sanitized<T = unknown> {
  value: T
  /** Approximate serialized size in characters */
  size: number
  /** Sizes of top-level object keys (only with `{ partSizes: true }`) */
  parts?: Record<string, number>
}

export interface SanitizeOptions {
  partSizes?: boolean
}

export interface Sanitizer {
  readonly masking: LogsMasking
  sanitize<T = unknown>(value: unknown, options?: SanitizeOptions): Sanitized<T>
  maskString(value: string): string
  isSensitiveKey(key: string): boolean
}

function compact(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function luhnValid(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** Object keys along a diff path (array indexes skipped) */
function pathKeys(path: string): string[] {
  const segments = logsRuntime.parsePath(path)
  if (segments) return segments.filter((s): s is string => typeof s === 'string')
  const dot = path.lastIndexOf('.')
  return [dot === -1 ? path : path.slice(dot + 1)]
}

/** VNodes, component instances (Vue 3 internal / public, Vue 2) and apps reference the whole app */
function vueInternal(obj: Record<string, unknown>): string | null {
  if (obj.__v_isVNode === true) return 'VNode'
  if (obj._isVue === true || (obj.$ && typeof obj.$ === 'object' && 'subTree' in (obj.$ as object))) return 'Component'
  if (typeof obj.uid === 'number' && 'subTree' in obj && 'vnode' in obj) return 'Component'
  if (obj._context && typeof obj.mount === 'function') return 'App'
  return null
}

export function createSanitizer(masking: LogsMasking): Sanitizer {
  const keyMasking = masking.enabled && masking.keys.length > 0
  const patternMasking = masking.enabled && masking.valuePatterns

  // Short words (<= 4 chars, e.g. "pwd", "otp") must match a whole word of the key
  const longPatterns: string[] = []
  const shortPatterns = new Set<string>()
  for (const raw of masking.keys) {
    const c = compact(raw)
    if (!c) continue
    if (c.length <= 4) shortPatterns.add(c)
    else longPatterns.push(c)
  }

  const keyCache = new Map<string, boolean>()

  function isSensitiveKey(key: string): boolean {
    if (!keyMasking || typeof key !== 'string' || !key) return false
    const cached = keyCache.get(key)
    if (cached !== undefined) return cached
    const c = compact(key)
    let result = longPatterns.some(p => c.includes(p))
    if (!result && shortPatterns.size > 0) {
      result = shortPatterns.has(c) || words(key).some(w => shortPatterns.has(w))
    }
    if (keyCache.size >= KEY_CACHE_LIMIT) keyCache.clear()
    keyCache.set(key, result)
    return result
  }

  function maskQuery(value: string): string {
    return value.replace(QUERY_PARAM_RE, (match, sep: string, name: string) => {
      let decoded = name
      try {
        decoded = decodeURIComponent(name)
      } catch { /* keep raw */ }
      return isSensitiveKey(decoded) ? `${sep}${name}=${MASK}` : match
    })
  }

  function maskString(value: string): string {
    if (!masking.enabled || typeof value !== 'string' || value.length < 8) return value
    let out = value
    if (patternMasking && PATTERN_HINT_RE.test(out)) {
      out = out
        .replace(JWT_RE, '[MASKED JWT]')
        .replace(AUTH_SCHEME_RE, (_m, scheme: string) => `${scheme} ${MASK}`)
        .replace(CARD_RE, m => {
          const digits = m.replace(/\D/g, '')
          return digits.length >= 13 && luhnValid(digits) ? '[MASKED CARD]' : m
        })
    }
    if (keyMasking && out.includes('=') && /[?&;#]/.test(out)) out = maskQuery(out)
    return out
  }

  function sanitize<T = unknown>(input: unknown, options?: SanitizeOptions): Sanitized<T> {
    let size = 0
    const seen = new WeakSet<object>()
    const parts: Record<string, number> | undefined = options?.partSizes ? {} : undefined

    const str = (s: string): string => {
      const out = maskString(s)
      size += out.length + 2
      return out
    }

    const walk = (value: unknown, depth: number): unknown => {
      switch (typeof value) {
        case 'string':
          return str(value)
        case 'number':
          size += 8
          return Number.isFinite(value) ? value : String(value)
        case 'boolean':
          size += 5
          return value
        case 'undefined':
          size += 4
          return undefined
        case 'bigint':
          return str(`${value}n`)
        case 'symbol':
          return str(value.toString())
        case 'function':
          return str(`[Function ${(value as { name?: string }).name || 'anonymous'}]`)
      }
      if (value === null) {
        size += 4
        return null
      }

      let obj = value as Record<string, unknown>
      // Vue refs / reactive proxies are read through their raw targets (no proxy traps)
      try {
        if (obj.__v_isRef === true) return walk('_rawValue' in obj ? obj._rawValue : obj.value, depth)
        const raw = obj.__v_raw
        if (raw && typeof raw === 'object' && raw !== obj) obj = raw as Record<string, unknown>
      } catch {
        return str('[Unreadable]')
      }
      if (seen.has(obj)) return str('[Circular]')
      if (depth >= MAX_DEPTH) return str('[Max depth]')

      try {
        if (obj instanceof Date) return str(Number.isNaN(obj.getTime()) ? 'Invalid Date' : obj.toISOString())
        if (obj instanceof RegExp) return str(String(obj))
        if (typeof (obj as { nodeType?: unknown }).nodeType === 'number') {
          return str(`[DOM ${String((obj as { nodeName?: unknown }).nodeName ?? 'node')}]`)
        }
        if (typeof window !== 'undefined' && obj === (window as unknown)) return str('[Window]')
        if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
          const bytes = (obj as ArrayBuffer).byteLength
          return str(`[${obj.constructor?.name ?? 'Binary'} ${bytes} bytes]`)
        }
        if (typeof Blob !== 'undefined' && obj instanceof Blob) return str(`[Blob ${obj.type || 'unknown'} ${obj.size} bytes]`)
        const internal = vueInternal(obj)
        if (internal) return str(`[Vue ${internal}]`)
      } catch {
        return str('[Unreadable]')
      }

      seen.add(obj)
      try {
        if (obj instanceof Error) {
          size += 2
          return { name: str(obj.name), message: str(obj.message), stack: obj.stack ? str(obj.stack) : undefined }
        }
        if (obj instanceof Map) return walk(Object.fromEntries(Array.from(obj.entries()).map(([k, v]) => [String(k), v])), depth)
        if (obj instanceof Set) return walk(Array.from(obj), depth)

        if (Array.isArray(obj)) {
          size += 2
          const out = new Array(obj.length)
          for (let i = 0; i < obj.length; i++) {
            size += 1
            out[i] = walk(obj[i], depth + 1)
          }
          return out
        }

        size += 2
        const out: Record<string, unknown> = {}
        let keys: string[]
        try {
          keys = Object.keys(obj)
        } catch {
          return str('[Unreadable]')
        }

        // `{ name|key, value }` pairs (headers, params, form fields) and diff entries are
        // masked by the name they describe, not by their own keys
        const pairName = typeof obj.name === 'string' ? obj.name : typeof obj.key === 'string' ? obj.key : null
        const maskPairValue = pairName !== null && 'value' in obj && isSensitiveKey(pairName)
        const isChange = typeof obj.path === 'string' && (obj.type === 'added' || obj.type === 'removed' || obj.type === 'changed')
        // Any sensitive key along the path: the state masks that whole subtree too
        const maskChange = isChange && keyMasking && pathKeys(obj.path as string).some(isSensitiveKey)

        for (const key of keys) {
          let child: unknown
          try {
            child = obj[key]
          } catch {
            child = '[Unreadable]'
          }
          size += key.length + 3
          const partStart = size
          const shouldMask =
            (maskPairValue && key === 'value') ||
            (maskChange && (key === 'before' || key === 'after')) ||
            (!isChange && key !== 'name' && key !== 'key' && isSensitiveKey(key))
          if (shouldMask && child !== null && child !== undefined && child !== '') {
            out[key] = str(MASK)
          } else {
            out[key] = walk(child, depth + 1)
          }
          if (parts && depth === 0) parts[key] = size - partStart
        }
        return out
      } finally {
        seen.delete(obj)
      }
    }

    const value = walk(input, 0) as T
    return parts ? { value, size, parts } : { value, size }
  }

  return { masking, sanitize, maskString, isSensitiveKey }
}

/** Serialized size estimate for values that are already plain JSON */
export function measureJson(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return 0
  }
}

export interface OmittedValue {
  __omitted: true
  /** `size`: dropped by the per-event limit; `unavailable`: could not be restored */
  reason: 'size' | 'unavailable'
  size: number
}

export function isOmittedValue(value: unknown): value is OmittedValue {
  return !!value && typeof value === 'object' && (value as OmittedValue).__omitted === true
}

/**
 * Keeps an event payload within `maxChars`: the largest top-level parts are replaced with an
 * `__omitted` marker until the rest fits. Small metadata fields are never dropped.
 */
export function fitPayload(
  data: Record<string, unknown>,
  size: number,
  maxChars: number,
  partSizes?: Record<string, number>,
): { data: Record<string, unknown>; size: number; limited: boolean } {
  if (size <= maxChars) return { data, size, limited: false }
  const parts = Object.keys(data)
    .map(key => ({ key, size: partSizes?.[key] ?? measureJson(data[key]) }))
    .filter(p => p.size > 1024)
    .sort((a, b) => b.size - a.size)
  const out = { ...data }
  let total = size
  for (const part of parts) {
    if (total <= maxChars) break
    const marker: OmittedValue = { __omitted: true, reason: 'size', size: part.size }
    out[part.key] = marker
    total -= part.size - 60
  }
  out.__sizeLimited = { originalSize: size, limit: maxChars }
  return { data: out, size: Math.max(total, 0), limited: true }
}
