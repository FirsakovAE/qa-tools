/**
 * Console tracker: logs `console.error` calls of the inspected page as JS error events.
 *
 * The caller is found from the call-site stack, not from the text: calls made by Vue Inspector
 * (its own diagnostics, e.g. a failed fetch already shown as a network event) or by browser
 * extensions are skipped, while the page's own messages are kept, also when they are written
 * from a callback that the network interceptor invoked. When another console wrapper (e.g. an
 * error tracker) sits on top of this one, an inspector-prefixed message with an inspector frame
 * in the stack is still treated as internal.
 */

import { isCaptureEnabled, isLogsPaused, isSensitiveLogKey } from './core'
import { locationOf, recordError } from './errors'
import { MASK } from './sanitize'
import { compactStack, isForeignUrl, isInspectorUrl, parseFrames } from './stack'

const MAX_PER_SECOND = 50
const MAX_MESSAGE_CHARS = 2000
const PREVIEW_KEYS = 10
/** Prefixes of Vue Inspector's own messages (secondary signal, see above) */
const INSPECTOR_PREFIX_RE = /^\[(?:injected|content|runtime|standalone|VueInspector|Vue Inspector)\b/
/** `capture` and the console wrapper */
const OWN_FRAMES = 2
const MARK = '__vueInspectorConsole'

let initialized = false
let reporting = false
let windowStart = 0
let windowCount = 0
let suppressed = 0

function preview(value: unknown, nested = false): string {
  if (typeof value === 'string') return nested ? JSON.stringify(value) : value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (value === null || typeof value !== 'object') return String(value)
  if (nested) return Array.isArray(value) ? `Array(${value.length})` : '{…}'
  try {
    if (Array.isArray(value)) {
      const items = value.slice(0, PREVIEW_KEYS).map(v => preview(v, true))
      return `[${items.join(', ')}${value.length > PREVIEW_KEYS ? ', …' : ''}]`
    }
    const keys = Object.keys(value)
    const items = keys.slice(0, PREVIEW_KEYS).map(k => `${k}: ${isSensitiveLogKey(k) ? MASK : preview((value as Record<string, unknown>)[k], true)}`)
    return `{${items.join(', ')}${keys.length > PREVIEW_KEYS ? ', …' : ''}}`
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/** Console-like message: format specifiers of the first string are applied, other args are appended */
function formatMessage(args: unknown[]): string {
  let rest = args
  const parts: string[] = []
  if (typeof args[0] === 'string') {
    let i = 1
    parts.push(args[0].replace(/%[sdifoOjc%]/g, token => {
      if (token === '%%') return '%'
      if (i >= args.length) return token
      const value = args[i++]
      if (token === '%c') return ''
      if (token === '%d' || token === '%i') return String(parseInt(String(value), 10))
      if (token === '%f') return String(parseFloat(String(value)))
      return preview(value)
    }))
    rest = args.slice(i)
  }
  for (const value of rest) parts.push(preview(value))
  const message = parts.join(' ').trim()
  return message.length > MAX_MESSAGE_CHARS ? `${message.slice(0, MAX_MESSAGE_CHARS)}…` : message
}

function isInternalCall(callSite: string, message: string): boolean {
  const frames = parseFrames(callSite)
  const caller = frames[OWN_FRAMES]
  if (caller && isForeignUrl(caller.url)) return true
  if (!INSPECTOR_PREFIX_RE.test(message)) return false
  // No usable stack, or a foreign console wrapper between the inspector and this one
  return !caller || frames.slice(OWN_FRAMES).some(f => isInspectorUrl(f.url))
}

function allowedByRate(): boolean {
  const now = Date.now()
  if (now - windowStart > 1000) {
    windowStart = now
    windowCount = 0
  }
  if (++windowCount <= MAX_PER_SECOND) return true
  suppressed++
  return false
}

function capture(args: unknown[]): void {
  if (isLogsPaused() || !isCaptureEnabled('error')) return
  const callSite = new Error().stack ?? ''
  const message = formatMessage(args) || '(empty console.error)'
  if (isInternalCall(callSite, message) || !allowedByRate()) return

  const error = args.find((a): a is Error => a instanceof Error)
  const site = compactStack(callSite, { dropLeadingInspector: true, header: false })
  const extra: Record<string, unknown> = {
    ...locationOf(error?.stack ?? site.stack),
  }
  // Non-text arguments are kept as data (errors are already in the message and stack)
  if (args.some(a => a !== null && typeof a === 'object' && !(a instanceof Error))) {
    extra.args = args.map(a => (a instanceof Error ? { name: a.name, message: a.message } : a))
  }
  if (suppressed > 0) {
    extra.suppressedBefore = suppressed
    suppressed = 0
  }
  if (!error?.stack) Object.assign(extra, site)
  recordError('console.error', { message, name: error?.name, stack: error?.stack }, extra)
}

export function initConsoleLogs(): void {
  if (initialized) return
  initialized = true
  const original = console.error
  if (typeof original !== 'function' || (original as unknown as Record<string, unknown>)[MARK]) return

  const wrapped = function (this: unknown, ...args: unknown[]) {
    if (!reporting) {
      reporting = true
      try {
        capture(args)
      } catch { /* never break the page's console */ } finally {
        reporting = false
      }
    }
    return original.apply(this, args)
  }
  Object.defineProperty(wrapped, MARK, { value: true })
  console.error = wrapped
}
