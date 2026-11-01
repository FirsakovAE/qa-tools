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
/**
 * Ids that link an event to its network entry and frame. They hold no user data, and an entry id
 * (`net-<Date.now()>-<n>`) can pass the card number check: masked, the event loses its entry.
 */
const LINK_KEYS = ['entryId', 'frameId'] as const
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

/** Classic (bookmark) headers: indexes into the full list, or header objects when the index was missed */
function classicHeaders(full: unknown, refs: unknown): { name: string; value: string }[] | undefined {
  if (!Array.isArray(refs)) return undefined
  const list = Array.isArray(full) ? full : []
  const out: { name: string; value: string }[] = []
  for (const ref of refs) {
    const header = typeof ref === 'number' ? list[ref] : ref
    if (header && typeof header === 'object' && typeof (header as { name?: unknown }).name === 'string') {
      out.push(header as { name: string; value: string })
    }
  }
  return out
}

/** WebRequest adds CORS headers the page never sees. The model gets the bookmark header list. */
function keepClassicHeaders(entry: Record<string, any>, side: 'request' | 'response'): void {
  const headers = side === 'request' ? 'requestHeaders' : 'responseHeaders'
  const visible = side === 'request' ? 'requestHeadersVisible' : 'responseHeadersVisible'
  const page = side === 'request' ? 'requestHeadersPageVisible' : 'responseHeadersPageVisible'
  if (Array.isArray(entry[visible])) entry[headers] = classicHeaders(entry[headers], entry[visible]) ?? []
  else if (Array.isArray(entry[page])) entry[headers] = entry[page]
  delete entry[visible]
  delete entry[page]
}

function keepLinks(clean: Record<string, unknown>, raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  for (const key of LINK_KEYS) {
    const value = (raw as Record<string, unknown>)[key]
    if (value !== undefined) clean[key] = value
  }
}

function protectEntry(raw: Record<string, any>, s: Sanitizer, privacy: AiPrivacy): Record<string, any> {
  const { access, masking } = privacy
  const entry = s.sanitize<Record<string, any>>(raw).value
  if (raw.id !== undefined) entry.id = raw.id
  const rawFrames: any[] | undefined = raw.websocket?.frames
  if (Array.isArray(rawFrames)) {
    entry.websocket.frames.forEach((frame: any, i: number) => { if (rawFrames[i]?.id !== undefined) frame.id = rawFrames[i].id })
  }
  if (!access.headers) {
    delete entry.requestHeaders
    delete entry.responseHeaders
    delete entry.requestHeadersVisible
    delete entry.responseHeadersVisible
    delete entry.requestHeadersPageVisible
    delete entry.responseHeadersPageVisible
    delete entry.authorization
    entry.headers = HIDDEN
  } else {
    keepClassicHeaders(entry, 'request')
    keepClassicHeaders(entry, 'response')
    if (entry.authorization && typeof entry.authorization === 'object') {
      for (const field of ['token', 'username']) {
        if (entry.authorization[field]) entry.authorization[field] = MASK
      }
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
    keepLinks(data, e.data)
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

/** A Network tab entry with its bodies inline (one that is not in the logs), protected like the logs payload */
export function protectNetworkEntry(raw: Record<string, any>, privacy: AiPrivacy): Record<string, any> {
  const s = sanitizerFor(privacy.masking)
  const entry = protectEntry(raw, s, privacy)
  for (const key of ['requestBody', 'responseBody']) {
    const body = raw[key]
    if (!body) continue
    if (!privacy.access.bodies) delete entry[key]
    else if (typeof body.text === 'string' && !body.isBinary) entry[key].text = maskBodyText(body.text, s, privacy.masking)
  }
  return entry
}

/** Live app values (component state, stores): masked by the AI mask list; only types when app data is off */
export function protectAppData(value: unknown, privacy: AiPrivacy): unknown {
  const clean = sanitizerFor(privacy.masking).sanitize(value).value
  return privacy.access.appData ? clean : redact(clean)
}

/** Masked values in a protected payload, for the context note */
export function countMasked(value: unknown): number {
  if (typeof value === 'string') return value.includes('[MASKED') ? (value.match(/\[MASKED(?: JWT| CARD)?\]/g)?.length ?? 0) : 0
  if (!value || typeof value !== 'object') return 0
  let n = 0
  for (const child of Object.values(value as Record<string, unknown>)) n += countMasked(child)
  return n
}
