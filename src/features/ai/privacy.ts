/**
 * What the assistant may send to the provider. Applied on top of the Logs masking: the logs
 * snapshot is masked and cut down to the data scopes the user allowed before the digest is
 * built and before any tool reads it, and every tool result gets a last text pass (page code too).
 */

import { createSanitizer, MASK, type Sanitizer } from '@/injected/logs/sanitize'
import type { LogsReportPayload } from '@/features/logs/report/template'
import type { AiAccess, AiMasking } from './credentials'

export interface AiPrivacy {
  masking: AiMasking
  access: AiAccess
}

const HIDDEN = '[hidden by AI access settings]'
/** Events whose data is app state rather than network traffic */
const APP_KINDS = new Set(['props', 'emit', 'store', 'action'])
/** Names kept when app data values are hidden: they describe the event, not the user's data */
const STRUCTURE_KEYS = new Set([
  'op', 'type', 'path', 'kind', 'store', 'storeId', 'id', 'uid', 'name', 'event', 'component', 'componentName',
  'file', 'level', 'entryId', 'frameId', '__snap', '__snapLit', 'action', 'status', 'duration',
])
/** `name: "value"`, `"name": "value"`, `name = 'value'` in any text, page code included */
const ASSIGNMENT_RE = /(["'`]?)([A-Za-z_$][\w$-]{1,60})\1(\s*[:=]\s*)(["'`])([^"'`\n]{4,})\4/g
/** `Name: value` header lines */
const HEADER_LINE_RE = /^(\s*)([A-Za-z][\w-]{1,60})(:[ \t]+)(\S.*)$/gm

let cache: { signature: string; sanitizer: Sanitizer } | null = null

function sanitizerFor(masking: AiMasking): Sanitizer {
  const signature = `${masking.valuePatterns}:${masking.keys.join('\u0000')}`
  if (cache?.signature !== signature) {
    cache = { signature, sanitizer: createSanitizer({ enabled: true, keys: masking.keys, valuePatterns: masking.valuePatterns }) }
  }
  return cache.sanitizer
}

export function privacySignature(privacy: AiPrivacy): string {
  const { access, masking } = privacy
  return [access.headers, access.bodies, access.appData, masking.valuePatterns, masking.keys.join(',')].join('|')
}

/** Masks sensitive values in free text: key/value pairs by the mask list, header lines, tokens, cards, query params */
export function maskText(text: string, masking: AiMasking): string {
  if (!text) return text
  const s = sanitizerFor(masking)
  const out = text
    .replace(ASSIGNMENT_RE, (match, q: string, name: string, sep: string, vq: string) =>
      s.isSensitiveKey(name) ? `${q}${name}${q}${sep}${vq}${MASK}${vq}` : match)
    .replace(HEADER_LINE_RE, (match, indent: string, name: string, sep: string) =>
      s.isSensitiveKey(name) ? `${indent}${name}${sep}${MASK}` : match)
  return s.maskString(out)
}

function maskBodyText(text: string, s: Sanitizer, masking: AiMasking): string {
  const t = text.trim()
  if (t[0] === '{' || t[0] === '[') {
    try {
      return JSON.stringify(s.sanitize(JSON.parse(t)).value)
    } catch { /* not JSON */ }
  }
  return maskText(text, masking)
}

/** Values replaced with their type; structural names and paths stay */
function redact(value: unknown, key = ''): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return STRUCTURE_KEYS.has(key) ? value : `[${typeof value}]`
  if (Array.isArray(value)) return value.map(v => redact(v, key))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redact(v, k)
  return out
}

function collectRefs(value: unknown, pool: Record<string, unknown>, out: Set<string>, depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 100) return
  const ref = (value as { __snap?: unknown }).__snap
  if (typeof ref === 'string') {
    if (out.has(ref)) return
    out.add(ref)
    collectRefs(pool[ref], pool, out, depth + 1)
    return
  }
  for (const child of Object.values(value as Record<string, unknown>)) collectRefs(child, pool, out, depth + 1)
}

function protectEntry(raw: Record<string, any>, s: Sanitizer, privacy: AiPrivacy): Record<string, any> {
  const { access, masking } = privacy
  const entry = s.sanitize<Record<string, any>>(raw).value
  if (!access.headers) {
    delete entry.requestHeaders
    delete entry.responseHeaders
    delete entry.requestHeadersVisible
    delete entry.responseHeadersVisible
    delete entry.authorization
    entry.headers = HIDDEN
  } else if (entry.authorization && typeof entry.authorization === 'object') {
    for (const field of ['token', 'username']) {
      if (entry.authorization[field]) entry.authorization[field] = MASK
    }
  }
  const frames: any[] | undefined = entry.websocket?.frames
  if (Array.isArray(frames)) {
    for (const frame of frames) {
      if (typeof frame?.data !== 'string' || !frame.data) continue
      frame.data = access.bodies ? (frame.kind === 'binary' ? frame.data : maskBodyText(frame.data, s, masking)) : HIDDEN
    }
  }
  if (!access.bodies) {
    delete entry.requestBodyRef
    delete entry.responseBodyRef
    entry.bodies = HIDDEN
  }
  return entry
}

/**
 * Copy of a report payload for the assistant: masked with the AI mask list and limited to
 * the allowed scopes. The original payload (Logs tab, HTML export) is not changed.
 */
export function protectPayload(payload: LogsReportPayload, privacy: AiPrivacy): LogsReportPayload {
  const s = sanitizerFor(privacy.masking)
  const { access, masking } = privacy
  const appData = (data: unknown) => (access.appData ? data : redact(data))

  const events = payload.events.map(e => {
    const data = s.sanitize<Record<string, unknown>>(e.data).value ?? {}
    return { ...e, data: (APP_KINDS.has(e.kind) ? appData(data) : data) as typeof e.data }
  })
  const pool = payload.snapshots ?? {}
  // Pooled values that other events (errors, navigation) reference keep their values
  const shared = new Set<string>()
  if (!access.appData) {
    for (const e of payload.events) if (!APP_KINDS.has(e.kind)) collectRefs(e.data, pool, shared)
  }
  const snapshots: Record<string, unknown> = {}
  for (const [id, value] of Object.entries(pool)) {
    const clean = s.sanitize(value).value
    snapshots[id] = shared.has(id) ? clean : appData(clean)
  }

  const network = payload.network ?? { entries: {}, bodies: {} }
  const entries: Record<string, any> = {}
  for (const [id, entry] of Object.entries(network.entries)) entries[id] = protectEntry(entry as Record<string, any>, s, privacy)
  const bodies: Record<string, any> = {}
  if (access.bodies) {
    for (const [ref, body] of Object.entries(network.bodies)) {
      const clean = s.sanitize<Record<string, any>>(body).value
      if (typeof body?.text === 'string' && !body.isBinary) clean.text = maskBodyText(body.text, s, masking)
      bodies[ref] = clean
    }
  }
  return { ...payload, events, snapshots, network: { entries, bodies } as LogsReportPayload['network'] }
}

/** Masked values in a protected payload, for the context note */
export function countMasked(value: unknown): number {
  if (typeof value === 'string') return value.includes('[MASKED') ? (value.match(/\[MASKED(?: JWT| CARD)?\]/g)?.length ?? 0) : 0
  if (!value || typeof value !== 'object') return 0
  let n = 0
  for (const child of Object.values(value as Record<string, unknown>)) n += countMasked(child)
  return n
}
