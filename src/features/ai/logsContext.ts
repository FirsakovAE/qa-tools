/**
 * Logs as the assistant sees them: a snapshot of the captured events in the report format,
 * the short AI digest of that snapshot and the full data of single events.
 *
 * Event ids `#N` are positions in the snapshot, the same numbering as the digest and the HTML report.
 */

import { createLogsRuntime, type LogsRuntime, type RuntimeEvent } from '@/injected/logs/runtime'
import { useLogs } from '@/features/logs/useLogs'
import { buildLogsReport, withNetworkPairs } from '@/features/logs/exportLogs'
import { buildAiDigest, type AiDigestOptions } from '@/features/logs/report/aiDigest'
import type { LogsReportPayload } from '@/features/logs/report/template'
import { stackCode } from './sources'
import { aiCredentials } from './credentials'
import { countMasked, privacySignature, protectPayload } from './privacy'

/** Timeline lines of the digest sent with a question; the rest is read with tools */
const DIGEST_TIMELINE = 250
const BODY_CHARS = 6000
const VALUE_CHARS = 8000
const RESULT_CHARS = 24000
const MAX_EVENTS_PER_CALL = 6
const MAX_SEARCH_RESULTS = 40
/** Values read from one event for search */
const MAX_LEAVES = 20_000
const MAX_GROUPS = 10
const SNIPPET_CHARS = 160
const STACK_CODE_CHARS = 5000
/** Events before / after an error that get_events lists so a race is visible without another call */
const ERROR_BEFORE = 6
const ERROR_AFTER = 12
const ERROR_LATER = 50
const SKIP_AROUND = new Set(['ws-sent', 'ws-received'])
/** Chars of a long value read per get_events call with `part` */
const PART_CHARS = 12000
const EVENT_PARTS = ['requestBody', 'responseBody', 'data'] as const
type EventPart = typeof EVENT_PARTS[number]

interface Row {
  index: number
  event: RuntimeEvent
  label: string
  title: string
  subtitle: string
}

export interface LogsSnapshot {
  signature: string
  /** Budget and privacy the digest was built with: a digest of new events must use the same */
  digestKey: string
  budget: Omit<AiDigestOptions, 'noGuide'>
  digest: string
  count: number
  /** Values masked in what the assistant can read */
  masked: number
  payload: LogsReportPayload
  rt: LogsRuntime
  rows: Row[]
  getEntry: (id: string) => Record<string, any> | undefined
  stores: ReturnType<LogsRuntime['indexStores']>
}

const hasOwn = (obj: unknown, key: string) => !!obj && Object.prototype.hasOwnProperty.call(obj, key)

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}... [${text.length - max} chars cut]` : text
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function compactBody(text: string): string {
  const t = text.trim()
  if (t[0] === '{' || t[0] === '[') {
    try {
      return JSON.stringify(JSON.parse(t))
    } catch { /* not JSON */ }
  }
  return t
}

let cached: LogsSnapshot | null = null
let logs: ReturnType<typeof useLogs> | null = null

/** Snapshot the tools read: the one taken for the current question, so ids stay stable while it runs */
function pinnedSnapshot(): LogsSnapshot {
  return cached ?? takeLogsSnapshot()
}

/**
 * Snapshot of the current logs. Building it (report, masking, digest) walks every event, so it is
 * reused while no event was added or dropped and no network entry changed (the pool size covers
 * a response or merged headers arriving for a logged request).
 */
export function takeLogsSnapshot(budget: Omit<AiDigestOptions, 'noGuide'> = { maxTimeline: DIGEST_TIMELINE }): LogsSnapshot {
  logs ??= useLogs()
  const { events, source } = logs
  const list = events.value
  const privacy = { masking: aiCredentials.masking, access: aiCredentials.access }
  const digestKey = [budget.maxTimeline, budget.maxChars, budget.bodyChars, privacySignature(privacy)].join(':')
  const signature = [list.length, list[0]?.id ?? '', list[list.length - 1]?.id ?? '', source.value.pool.size, digestKey].join(':')
  if (cached && cached.signature === signature) return cached

  const payload = protectPayload(buildLogsReport(withNetworkPairs(list, source.value), source.value), privacy)
  const masked = countMasked(payload)
  const rt = createLogsRuntime()
  const digest = buildAiDigest(payload, rt, { ...budget, noGuide: true })

  const network = payload.network ?? { entries: {}, bodies: {} }
  const entryCache = new Map<string, Record<string, any> | undefined>()
  const getEntry = (id: string) => {
    if (id == null || !hasOwn(network.entries, id)) return undefined
    if (!entryCache.has(id)) {
      entryCache.set(id, rt.resolveEntry({ ...network.entries[id], id }, ref => (hasOwn(network.bodies, ref) ? network.bodies[ref] : undefined)))
    }
    return entryCache.get(id)
  }

  const resolved: RuntimeEvent[] = payload.events.map(raw => {
    const data = rt.resolveValue(raw.data)
    return { ...raw, data: data && typeof data === 'object' ? data as Record<string, any> : {} }
  })
  const stores = rt.indexStores(resolved)
  const kindLabels: Record<string, string> = {}
  for (const [kind, meta] of Object.entries(payload.info.kinds ?? {})) kindLabels[kind] = meta.label
  const rows: Row[] = resolved.map((event, index) => {
    let title = event.key
    let subtitle = ''
    try {
      const d = rt.describe(event, { stores, getEntry })
      title = d.title
      subtitle = d.subtitle == null ? '' : String(d.subtitle)
    } catch { /* keep the key */ }
    return { index, event, label: rt.eventLabel(event, kindLabels), title, subtitle }
  })

  cached = { signature, digestKey, budget, digest, count: rows.length, masked, payload, rt, rows, getEntry, stores }
  return cached
}

/** The logs the model already has in this chat */
export interface SentLogs {
  digestKey: string
  count: number
  firstId: string
  lastId: string
}

export interface DigestUpdate {
  /** Text to attach; none when the model already has every event */
  digest?: string
  /** Set for a digest of the new events only: earlier digests in the chat stay valid */
  from?: number
  sent: SentLogs
}

/**
 * What to attach to a question. Logs only grew since the last digest of the chat (its first and
 * last events are still at their positions): only the new events, the ids stay the same.
 * Otherwise (cleared, trimmed, other masking or budget) the full digest, which replaces the old one.
 */
export function digestUpdate(snapshot: LogsSnapshot, sent: SentLogs | null, allowPartial: boolean): DigestUpdate {
  const { rows } = snapshot
  const next: SentLogs = { digestKey: snapshot.digestKey, count: rows.length, firstId: rows[0]?.event.id ?? '', lastId: rows[rows.length - 1]?.event.id ?? '' }
  const grown = !!sent && sent.count > 0 && sent.digestKey === snapshot.digestKey && rows.length >= sent.count
    && rows[0]?.event.id === sent.firstId && rows[sent.count - 1]?.event.id === sent.lastId
  if (grown && rows.length === sent!.count) return { sent: next }
  if (!grown || !allowPartial) return { digest: snapshot.digest, sent: next }
  const rt = createLogsRuntime()
  const digest = buildAiDigest(snapshot.payload, rt, { ...snapshot.budget, noGuide: true, fromIndex: sent!.count })
  return { digest, from: sent!.count, sent: next }
}

function rowLine(row: Row, t0: number): string {
  const ms = row.event.timestamp - t0
  const rel = ms < 1000 ? `+${Math.round(ms)}ms` : `+${(ms / 1000).toFixed(2)}s`
  return `#${row.index} ${rel} ${row.label} ${row.title}${row.subtitle ? ` | ${row.subtitle}` : ''}`
}

/** A long value of event #N cut to `max`, with the get_events call that reads on from there */
function cutPart(text: string, max: number, ref: number | undefined, part: EventPart): string {
  if (text.length <= max) return text
  if (ref === undefined) return cut(text, max)
  return `${text.slice(0, max)}... [${text.length - max} more chars: get_events ids=[${ref}] part=${part} offset=${max}]`
}

function bodyText(body: any, ref?: number, part: EventPart = 'responseBody'): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  if (body.isBinary || body.media) return `[binary${body.media?.format ? ` ${body.media.format}` : ''}, ${body.originalSize ?? '?'} bytes]`
  if (typeof body.text !== 'string') return undefined
  const note = body.truncated ? ' [cut at capture]' : ''
  return cutPart(compactBody(body.text), BODY_CHARS, ref, part) + note
}

function networkDetails(entry: Record<string, any>, ref?: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (value == null || value === '' || key.endsWith('Ref') || key === 'id') continue
    if (key === 'requestBody' || key === 'responseBody') {
      const text = bodyText(value, ref, key)
      if (text !== undefined) out[key] = text
      continue
    }
    if (key === 'websocket' && value && typeof value === 'object') {
      const frames = Array.isArray(value.frames) ? value.frames : []
      out.websocket = {
        ...value,
        frames: frames.slice(-20).map((f: any) => ({ ...f, data: typeof f?.data === 'string' ? cut(f.data, 800) : f?.data })),
        framesTotal: frames.length,
      }
      continue
    }
    out[key] = value
  }
  return out
}

function eventDetails(snapshot: LogsSnapshot, row: Row): string {
  const { event } = row
  const t0 = snapshot.rows[0]?.event.timestamp ?? 0
  const lines = [`## ${rowLine(row, t0)}`, `- time: ${new Date(event.timestamp).toISOString()}, level: ${event.level}, key: ${event.key}`]
  if (event.kind === 'error') {
    const nearby = aroundError(snapshot, row.index)
    if (nearby) lines.push(nearby)
  }
  const entryId = event.data?.entryId
  if (typeof entryId === 'string') {
    const entry = snapshot.getEntry(entryId)
    lines.push(entry ? `- network entry: ${cut(json(networkDetails(entry, row.index)), RESULT_CHARS)}` : '- network entry: not in the logs any more')
    return lines.join('\n')
  }
  if (event.kind === 'store' && event.data?.op === 'change') {
    const states = snapshot.rt.restoreStoreChange(event, snapshot.stores)
    const changes = Array.isArray(event.data.changes) ? event.data.changes.map((c: any) => snapshot.rt.fillChange(c, states)) : []
    lines.push(`- changes: ${cut(json(changes), VALUE_CHARS)}`)
    if (states.afterKnown) lines.push(`- store state after: ${cut(json(states.after), VALUE_CHARS)}`)
    const rest = { ...event.data }
    delete rest.changes
    delete rest.state
    delete rest.before
    lines.push(`- data: ${cut(json(rest), VALUE_CHARS)}`)
    return lines.join('\n')
  }
  lines.push(`- data: ${cutPart(json(event.data), VALUE_CHARS, row.index, 'data')}`)
  return lines.join('\n')
}

/** Full text of one long value of an event, as get_events shows it cut */
function partText(snapshot: LogsSnapshot, row: Row, part: EventPart): { text: string; capture?: boolean } | string {
  if (part === 'data') return { text: json(row.event.data) }
  const entryId = row.event.data?.entryId
  const entry = typeof entryId === 'string' ? snapshot.getEntry(entryId) : undefined
  if (!entry) return `#${row.index} is not a network event with bodies; use part=data.`
  const body = entry[part]
  if (body && typeof body === 'object' && (body.isBinary || body.media)) return `#${row.index} ${part} is binary: ${bodyText(body)}`
  if (!body || typeof body !== 'object' || typeof body.text !== 'string' || !body.text) {
    return `#${row.index} has no ${part}${entry.bodies ? ' (bodies are hidden by the access settings)' : ''}.`
  }
  return { text: compactBody(body.text), capture: !!body.truncated }
}

/** A long value of one event from `offset`, PART_CHARS at a time */
function eventPart(snapshot: LogsSnapshot, n: number, part: EventPart, offset: number): string {
  const row = snapshot.rows[n]
  if (!row) return `No such event #${n} (the logs have #0..#${snapshot.count - 1}).`
  const found = partText(snapshot, row, part)
  if (typeof found === 'string') return found
  const { text, capture } = found
  const from = Math.min(Math.max(0, offset), text.length)
  const to = Math.min(text.length, from + PART_CHARS)
  const out = [`## #${n} ${part}, chars ${from}-${to} of ${text.length}`, text.slice(from, to)]
  if (to < text.length) out.push(`[More: get_events ids=[${n}] part=${part} offset=${to}]`)
  else out.push(`[End of ${part}.${capture ? ' It was cut when captured (Options → Logs → Limit event size): the rest was not stored.' : ''}]`)
  return out.join('\n')
}

function lastNavigation(snapshot: LogsSnapshot, index: number): Row | undefined {
  for (let i = index - 1; i >= 0; i--) {
    if (snapshot.rows[i].event.kind === 'navigation') return snapshot.rows[i]
  }
}

function actionStore(row: Row): string {
  const key = String(row.event.key || '')
  const dot = key.lastIndexOf('.')
  return dot > 0 ? key.slice(0, dot) : key
}

function isEmptyAction(row: Row): boolean {
  const result = row.event.data?.result
  if (result == null) return true
  return typeof result === 'object' && result.data == null
}

function rowRef(row: Row): string {
  return `#${row.index} ${row.label} ${row.title}${row.subtitle ? ` | ${row.subtitle}` : ''}`
}

/** First later actions / store changes where the same store's data is no longer null */
function laterFilled(snapshot: LogsSnapshot, index: number): Row[] {
  const stores = new Set<string>()
  for (let i = Math.max(0, index - ERROR_BEFORE); i < index; i++) {
    if (snapshot.rows[i].event.kind === 'action') stores.add(actionStore(snapshot.rows[i]))
  }
  const found: Row[] = []
  const seen = new Set<string>()
  const end = Math.min(snapshot.count, index + ERROR_LATER)
  for (let i = index + 1; i < end && found.length < 4; i++) {
    const row = snapshot.rows[i]
    const kind = row.event.kind === 'action' && stores.has(actionStore(row)) && !isEmptyAction(row)
      ? `action:${actionStore(row)}`
      : row.event.kind === 'store' && stores.has(row.event.key) && /\.data\b/.test(row.subtitle)
        ? `store:${row.event.key}`
        : ''
    if (!kind || seen.has(kind)) continue
    seen.add(kind)
    found.push(row)
  }
  return found
}

function aroundIds(snapshot: LogsSnapshot, index: number, extra: number[]): Set<number> {
  const ids = new Set<number>(extra)
  const from = Math.max(0, index - ERROR_BEFORE)
  const to = Math.min(snapshot.count - 1, index + ERROR_AFTER)
  for (let i = from; i <= to; i++) {
    if (i !== index && !SKIP_AROUND.has(snapshot.rows[i].event.kind)) ids.add(i)
  }
  for (const i of [...ids]) {
    const entryId = snapshot.rows[i].event.kind === 'request' ? snapshot.rows[i].event.data?.entryId : undefined
    if (typeof entryId !== 'string') continue
    const resp = snapshot.rows.findIndex((r, j) => j > i && r.event.kind === 'response' && r.event.data?.entryId === entryId)
    if (resp >= 0) ids.add(resp)
  }
  return ids
}

function aroundError(snapshot: LogsSnapshot, index: number): string {
  const page = lastNavigation(snapshot, index)
  const filled = laterFilled(snapshot, index)
  const filledIds = new Set(filled.map(r => r.index))
  const ids = aroundIds(snapshot, index, [page?.index, ...filledIds].filter((n): n is number => n != null))
  const t0 = snapshot.rows[0]?.event.timestamp ?? 0
  const head = [
    page && `- Page: #${page.index} ${page.title} (last navigation before this error)`,
    filled.length && `- Data later: ${filled.map(rowRef).join('; ')}`,
  ].filter(Boolean) as string[]
  const lines = [...ids].sort((a, b) => a - b).map(i => {
    const mark = i === page?.index ? 'page' : filledIds.has(i) ? 'filled' : i > index ? 'after' : 'before'
    return `${rowLine(snapshot.rows[i], t0)}  [${mark}]`
  })
  if (!head.length && !lines.length) return ''
  return `${head.join('\n')}${lines.length ? `\n- around #${index}:\n${lines.join('\n')}` : ''}`
}

function eventStack(event: RuntimeEvent): string {
  const data = event.data
  if (typeof data?.stack === 'string') return data.stack
  return typeof data?.error?.stack === 'string' ? data.error.stack : ''
}

/** Code at the stack frames, once per distinct stack of the call */
async function withStackCode(details: string, stack: string, seen: Set<string>): Promise<string> {
  if (!stack || seen.has(stack)) return details
  seen.add(stack)
  try {
    const code = await stackCode(stack)
    return code ? `${details}\n- code at the stack frames:\n${cut(code, STACK_CODE_CHARS)}` : details
  } catch {
    return details
  }
}

/** `#N` of the first (or last) event of the snapshot that matches */
export function findEventRef(snapshot: LogsSnapshot, match: (event: RuntimeEvent) => boolean, last = false): number | undefined {
  const index = last ? snapshot.rows.findLastIndex(r => match(r.event)) : snapshot.rows.findIndex(r => match(r.event))
  return index === -1 ? undefined : index
}

/** Full data of one event the user attached to a question, as get_events gives it */
export async function eventAttachment(snapshot: LogsSnapshot, ref: number, max: number): Promise<string> {
  const row = snapshot.rows[ref]
  return cut(await withStackCode(eventDetails(snapshot, row), eventStack(row.event), new Set()), max)
}

/** A protected network entry that is not in the logs, in the format of get_events */
export function networkAttachment(entry: Record<string, any>, max: number): string {
  return cut(json(networkDetails(entry)), max)
}

/** A list argument given as an array, a JSON array text, or `[a, b]` / `a, b` */
function listArg(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'number') return [value]
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return value.trim().replace(/^\[|\]$/g, '').split(',').map(v => v.trim().replace(/^["'`]|["'`]$/g, '')).filter(Boolean)
}

function idsArg(value: unknown): number[] {
  return listArg(value).map(v => Number(String(v).trim().replace(/^#/, ''))).filter(n => Number.isInteger(n) && n >= 0)
}

/** Rows of the ids, with the other row of a request / response pair: both show the same entry */
function rowsOfIds(snapshot: LogsSnapshot, ids: number[]): Row[] {
  const picked = new Set<number>()
  for (const n of ids) {
    const row = snapshot.rows[n]
    if (!row) continue
    picked.add(n)
    const entryId = row.event.data?.entryId
    if ((row.event.kind !== 'request' && row.event.kind !== 'response') || typeof entryId !== 'string') continue
    for (const other of snapshot.rows) {
      if ((other.event.kind === 'request' || other.event.kind === 'response') && other.event.data?.entryId === entryId) picked.add(other.index)
    }
  }
  return [...picked].sort((a, b) => a - b).map(n => snapshot.rows[n])
}

export async function getEvents(ids: unknown, part?: unknown, offset?: unknown): Promise<string> {
  const snapshot = pinnedSnapshot()
  const list = idsArg(ids).slice(0, MAX_EVENTS_PER_CALL)
  if (!list.length) return 'Pass event ids as numbers, for example [12, 13].'
  if (part !== undefined && part !== null && part !== '') {
    if (!EVENT_PARTS.includes(part as EventPart)) return `part must be one of ${EVENT_PARTS.join(', ')}.`
    return eventPart(snapshot, list[0], part as EventPart, Math.floor(Number(offset) || 0))
  }
  const stacks = new Set<string>()
  const parts: string[] = []
  for (const n of list) {
    const row = snapshot.rows[n]
    if (!row) {
      parts.push(`## #${n}\nNo such event (the logs have #0..#${snapshot.count - 1}).`)
      continue
    }
    parts.push(await withStackCode(eventDetails(snapshot, row), eventStack(row.event), stacks))
  }
  return cut(parts.join('\n\n'), RESULT_CHARS)
}

/** One value of an event with its path: `responseBody.data.items[3].id = 29058` */
interface Leaf {
  path: string
  /** Last property name on the path (array indexes skipped) */
  key: string
  value: string
}

const leafCache = new WeakMap<Row, Leaf[]>()

function addLeaves(value: unknown, path: string, key: string, out: Leaf[], depth = 0): void {
  if (out.length >= MAX_LEAVES) return
  if (value === null || typeof value !== 'object') {
    if (value !== undefined) out.push({ path, key, value: String(value) })
    return
  }
  if (depth > 60) return
  if (Array.isArray(value)) {
    // Header / param / form lists: `{ name|key, value }` items are read as `list.<name>`
    const first = value[0]
    if (first && typeof first === 'object' && 'value' in first && typeof ((first as { name?: unknown; key?: unknown }).name ?? (first as { key?: unknown }).key) === 'string') {
      for (const item of value) {
        if (item && typeof item === 'object' && 'value' in item) {
          const name = String((item as { name?: unknown; key?: unknown }).name ?? (item as { key?: unknown }).key ?? path)
          addLeaves((item as { value: unknown }).value, `${path}.${name}`, name, out, depth + 1)
        } else addLeaves(item, `${path}[${out.length}]`, key, out, depth + 1)
      }
      return
    }
    value.forEach((item, i) => addLeaves(item, `${path}[${i}]`, key, out, depth + 1))
    return
  }
  const obj = value as Record<string, unknown>
  // A store / props change reads as the changed path itself
  if (typeof obj.path === 'string' && ('after' in obj || 'before' in obj)) {
    const changeKey = obj.path.replace(/\[\d+\]/g, '').split('.').pop() || key
    if ('after' in obj) addLeaves(obj.after, obj.path, changeKey, out, depth + 1)
    if ('before' in obj) addLeaves(obj.before, `${obj.path} (before)`, changeKey, out, depth + 1)
    return
  }
  for (const [k, v] of Object.entries(obj)) addLeaves(v, path ? `${path}.${k}` : k, k, out, depth + 1)
}

/**
 * JSON that may be cut (a body cut at capture): parsed up to the last complete value, with the
 * open objects and arrays closed. `repaired` tells that the tail was dropped.
 */
function parseJsonLenient(text: string): { value: unknown; repaired: boolean } | undefined {
  const t = text.trim()
  if (t[0] !== '{' && t[0] !== '[') return undefined
  try {
    return { value: JSON.parse(t), repaired: false }
  } catch { /* cut or not JSON */ }
  let stack = ''
  let inString = false
  let escaped = false
  let cutAt = -1
  let cutStack = ''
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') stack += c
    else if (c === '}' || c === ']') stack = stack.slice(0, -1)
    else if (c === ',' && stack) {
      cutAt = i
      cutStack = stack
    }
  }
  if (cutAt < 0) return undefined
  const closers = [...cutStack].reverse().map(c => (c === '{' ? '}' : ']')).join('')
  try {
    return { value: JSON.parse(t.slice(0, cutAt) + closers), repaired: true }
  } catch {
    return undefined
  }
}

/** Body text as values: parsed JSON, form fields, or the text itself */
function addTextLeaves(text: string, path: string, out: Leaf[]): void {
  const t = text.trim()
  const parsed = parseJsonLenient(t)
  if (parsed) {
    addLeaves(parsed.value, path, path, out)
    return
  }
  if (/^[^\s=&]+=[^\s&]*(&[^\s=&]+=[^\s&]*)*$/.test(t)) {
    try {
      for (const [k, v] of new URLSearchParams(t)) out.push({ path: `${path}.${k}`, key: k, value: v })
      return
    } catch { /* keep the text */ }
  }
  out.push({ path, key: path, value: text })
}

function addBodyLeaves(body: any, path: string, out: Leaf[]): void {
  if (!body || typeof body !== 'object' || body.isBinary || body.media) return
  if (Array.isArray(body.formData) && body.formData.length) addLeaves(body.formData, path, path, out)
  else if (typeof body.text === 'string' && body.text) addTextLeaves(body.text, path, out)
}

/** Values of a network event: its own side of the exchange, so a request and its response do not repeat each other */
function networkLeaves(row: Row, entry: Record<string, any>): Leaf[] {
  const out: Leaf[] = []
  const kind = row.event.kind
  const add = (key: string, value: unknown) => {
    if (value != null && value !== '') out.push({ path: key, key, value: String(value) })
  }
  add('method', entry.method)
  add('url', entry.url)
  if (kind === 'request' || kind === 'ws') {
    addLeaves(entry.requestHeaders, 'requestHeaders', 'requestHeaders', out)
    addLeaves(entry.params, 'params', 'params', out)
    addBodyLeaves(entry.requestBody, 'requestBody', out)
    if (typeof entry.headers === 'string') add('headers', entry.headers)
  }
  if (kind === 'response' || kind === 'ws-closed') {
    add('status', entry.status)
    add('error', entry.error)
    addLeaves(entry.responseHeaders, 'responseHeaders', 'responseHeaders', out)
    addBodyLeaves(entry.responseBody, 'responseBody', out)
    add('closeCode', entry.websocket?.closeCode)
    add('closeReason', entry.websocket?.closeReason)
  }
  if (kind === 'ws-sent' || kind === 'ws-received') {
    const frames: any[] = Array.isArray(entry.websocket?.frames) ? entry.websocket.frames : []
    const frameId = row.event.data?.frameId
    for (const frame of frames) {
      if (frame?.id === frameId && typeof frame.data === 'string') addTextLeaves(frame.data, 'message', out)
    }
  }
  return out
}

function rowLeaves(snapshot: LogsSnapshot, row: Row): Leaf[] {
  let leaves = leafCache.get(row)
  if (leaves) return leaves
  const entryId = row.event.data?.entryId
  const entry = typeof entryId === 'string' ? snapshot.getEntry(entryId) : undefined
  if (entry) {
    leaves = networkLeaves(row, entry)
  } else {
    leaves = []
    addLeaves(row.event.data, 'data', 'data', leaves)
  }
  leafCache.set(row, leaves)
  return leaves
}

interface SearchArgs {
  query?: unknown
  key?: unknown
  value?: unknown
  exact?: unknown
  kind?: unknown
  ids?: unknown
  limit?: unknown
  offset?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

/** `dealId`: that property anywhere; `data.items.id`: a path ending (indexes ignored); `~deal`: a name containing the text */
function keyMatcher(spec: string): ((leaf: Leaf) => boolean) | null {
  if (!spec) return null
  const lower = spec.toLowerCase()
  if (lower.startsWith('~')) {
    const part = lower.slice(1)
    return leaf => leaf.key.toLowerCase().includes(part)
  }
  if (/[.[]/.test(lower)) {
    const suffix = lower.replace(/\[\d*\]/g, '')
    return leaf => {
      const path = leaf.path.toLowerCase().replace(/\[\d+\]/g, '')
      return path === suffix || path.endsWith(`.${suffix}`)
    }
  }
  return leaf => leaf.key.toLowerCase() === lower
}

function excerpt(value: string, needle: string): string {
  if (value.length <= SNIPPET_CHARS) return value
  const at = needle ? value.toLowerCase().indexOf(needle) : -1
  if (at < 0) return `${value.slice(0, SNIPPET_CHARS)}...`
  const from = Math.max(0, at - SNIPPET_CHARS / 2)
  return `${from ? '...' : ''}${value.slice(from, from + SNIPPET_CHARS)}${from + SNIPPET_CHARS < value.length ? '...' : ''}`
}

function groupName(snapshot: LogsSnapshot, row: Row): string {
  const entryId = row.event.data?.entryId
  const entry = typeof entryId === 'string' ? snapshot.getEntry(entryId) : undefined
  if (entry) return `${row.label} ${entry.method ?? ''} ${entry.path || String(entry.url ?? '').split('?')[0]}`.replace(/\s+/g, ' ')
  return `${row.label} ${row.event.key}`
}

/**
 * Events by text (title, URL, any value or property name) and / or by property: `key` and `value`
 * match single values of bodies, headers, params, messages and app data, read whole (not cut).
 * Results name the matching paths; many matches are grouped by endpoint and paged with `offset`.
 */
export function searchLogs(args: SearchArgs): string {
  const snapshot = pinnedSnapshot()
  const query = text(args.query).toLowerCase()
  const keySpec = text(args.key)
  const valueSpec = text(args.value).toLowerCase()
  if (!query && !keySpec && !valueSpec) return 'Pass query, key or value.'
  const exact = args.exact === true
  const matchKey = keyMatcher(keySpec)
  const matchValue = valueSpec
    ? (leaf: Leaf) => (exact ? leaf.value.toLowerCase() === valueSpec : leaf.value.toLowerCase().includes(valueSpec))
    : null
  const kindFilter = typeof args.kind === 'string' && args.kind ? args.kind.toLowerCase() : ''
  const limit = Math.min(MAX_SEARCH_RESULTS, Math.max(1, Number(args.limit) || 20))
  const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
  const t0 = snapshot.rows[0]?.event.timestamp ?? 0
  const ids = idsArg(args.ids)
  const rows = ids.length ? rowsOfIds(snapshot, ids) : snapshot.rows
  if (ids.length && !rows.length) return `No such events (the logs have #0..#${snapshot.count - 1}).`

  const matches: { row: Row; leaves: Leaf[]; inHead: boolean }[] = []
  for (const row of rows) {
    if (kindFilter && row.event.kind !== kindFilter && row.label.toLowerCase() !== kindFilter) continue
    const leaves = rowLeaves(snapshot, row)
    let hits = matchKey || matchValue ? leaves.filter(l => (!matchKey || matchKey(l)) && (!matchValue || matchValue(l))) : []
    if ((matchKey || matchValue) && !hits.length) continue
    let inHead = false
    if (query) {
      inHead = `${row.label} ${row.title} ${row.subtitle} ${row.event.key}`.toLowerCase().includes(query)
      const queryHits = (hits.length ? hits : leaves).filter(l => l.value.toLowerCase().includes(query) || l.path.toLowerCase().includes(query))
      if (!inHead && !queryHits.length) continue
      if (!matchKey && !matchValue) hits = queryHits
      else if (!inHead) hits = queryHits
    }
    matches.push({ row, leaves: hits, inHead })
  }

  const what = [query && `"${query}"`, keySpec && `key ${keySpec}`, valueSpec && `value ${exact ? '= ' : '~ '}"${valueSpec}"`].filter(Boolean).join(', ')
  if (!matches.length) return `No events match ${what}${ids.length ? ` in ${rows.map(r => `#${r.index}`).join(', ')}` : ''}.`
  const page = matches.slice(offset, offset + limit)
  const needle = valueSpec || query
  const lines = page.map(({ row, leaves, inHead }) => {
    const shown = leaves.map(l => `    ${l.path} = ${excerpt(l.value, needle)}`)
    return [`${rowLine(row, t0)}${inHead && !leaves.length ? '  (matched in title)' : ''}`, ...shown].join('\n')
  })
  const out = [`${matches.length} event${matches.length === 1 ? '' : 's'} match ${what}${matches.length > page.length ? ` (showing ${offset + 1}-${offset + page.length})` : ''}:`, ...lines]

  const groups = new Map<string, number[]>()
  for (const m of matches) {
    const name = groupName(snapshot, m.row)
    const ids = groups.get(name)
    if (ids) ids.push(m.row.index)
    else groups.set(name, [m.row.index])
  }
  if (groups.size > 1 && matches.length > 3) {
    const list = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
    out.push('', 'By endpoint / source:')
    for (const [name, ids] of list.slice(0, MAX_GROUPS)) {
      out.push(`- ${name}: ${ids.length} (${ids.slice(0, 5).map(i => `#${i}`).join(', ')}${ids.length > 5 ? ', ...' : ''})`)
    }
    if (list.length > MAX_GROUPS) out.push(`- ... ${list.length - MAX_GROUPS} more groups`)
  }
  if (offset + page.length < matches.length) out.push('', `More: call again with offset=${offset + page.length}, or narrow with kind, key or a longer value.`)
  return out.join('\n')
}

const FIND_LIMIT = 50
const FIND_MAX_LIMIT = 200
const ITEM_CHARS = 400
/** Properties that name an item, shown when the whole item is too long */
const ID_KEYS = ['id', 'key', 'name', 'code', 'title', 'label', 'type']

interface JsonPart {
  part: string
  value: unknown
  /** The body was cut at capture: the items after the last complete one are missing */
  repaired: boolean
}

const jsonPartsCache = new WeakMap<Row, JsonPart[]>()

/** JSON values of an event: its own body or WebSocket message, or the event data */
function jsonParts(snapshot: LogsSnapshot, row: Row): JsonPart[] {
  let parts = jsonPartsCache.get(row)
  if (parts) return parts
  parts = []
  const entryId = row.event.data?.entryId
  const entry = typeof entryId === 'string' ? snapshot.getEntry(entryId) : undefined
  const addText = (part: string, text: unknown) => {
    if (typeof text !== 'string' || !text) return
    const parsed = parseJsonLenient(text)
    if (parsed) parts!.push({ part, ...parsed })
  }
  if (entry) {
    const kind = row.event.kind
    if (kind === 'request') addText('requestBody', entry.requestBody?.text)
    if (kind === 'response') addText('responseBody', entry.responseBody?.text)
    if (kind === 'ws-sent' || kind === 'ws-received') {
      const frame = (entry.websocket?.frames ?? []).find((f: any) => f?.id === row.event.data?.frameId)
      addText('message', frame?.data)
    }
  } else {
    parts.push({ part: 'data', value: row.event.data, repaired: false })
  }
  jsonPartsCache.set(row, parts)
  return parts
}

/** Arrays that hold objects, with their paths (`data.groups[2].filters`) */
function objectArrays(value: unknown, path: string, out: { path: string; items: unknown[] }[], depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 40) return
  if (Array.isArray(value)) {
    if (value.some(v => v && typeof v === 'object' && !Array.isArray(v))) out.push({ path, items: value })
    value.forEach((v, i) => objectArrays(v, `${path}[${i}]`, out, depth + 1))
    return
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) objectArrays(v, path ? `${path}.${k}` : k, out, depth + 1)
}

/** `a.b[2].c` inside an item */
function valueAt(item: unknown, path: string): unknown {
  let current: any = item
  for (const step of path.split(/\.|\[(\d+)\]/).filter(Boolean)) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[step]
  }
  return current
}

type Condition = { key: string; test: (item: unknown) => boolean; label: string }

/** `value`: equal (true matches "true"); `~text` contains; `!value` not equal; `>n` `<n` `>=n` `<=n`; `*` has the property; `!*` lacks it */
function condition(key: string, spec: unknown): Condition {
  const label = `${key} ${typeof spec === 'string' && /^(~|!|>|<|\*)/.test(spec) ? spec : `= ${JSON.stringify(spec)}`}`
  const lower = (v: unknown) => (v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v)).toLowerCase()
  const matchOne = (actual: unknown, test: (v: unknown) => boolean) => (Array.isArray(actual) ? actual.some(test) : test(actual))
  let test: (actual: unknown) => boolean
  if (spec === '*') test = actual => actual !== undefined
  else if (spec === '!*') test = actual => actual === undefined
  else if (typeof spec === 'string' && spec.startsWith('~')) {
    const part = spec.slice(1).toLowerCase()
    test = actual => actual !== undefined && matchOne(actual, v => lower(v).includes(part))
  } else if (typeof spec === 'string' && /^(>=|<=|>|<)-?\d/.test(spec)) {
    const [, op, num] = spec.match(/^(>=|<=|>|<)(.+)$/)!
    const n = Number(num)
    test = actual => matchOne(actual, v => {
      const x = Number(v)
      if (v === null || v === '' || Number.isNaN(x)) return false
      return op === '>' ? x > n : op === '<' ? x < n : op === '>=' ? x >= n : x <= n
    })
  } else if (typeof spec === 'string' && spec.startsWith('!')) {
    const other = spec.slice(1).toLowerCase()
    test = actual => !matchOne(actual, v => lower(v) === other)
  } else {
    const expected = lower(spec)
    test = actual => actual !== undefined && matchOne(actual, v => lower(v) === expected)
  }
  return { key, label, test: item => test(valueAt(item, key)) }
}

/** `{ "isVisibleByDefault": true }`, or the text `isVisibleByDefault=true, type=~select` */
function parseWhere(where: unknown): Condition[] {
  if (typeof where === 'string' && where.trim().startsWith('{')) {
    try {
      where = JSON.parse(where)
    } catch {}
  }
  if (where && typeof where === 'object' && !Array.isArray(where)) {
    return Object.entries(where as Record<string, unknown>).map(([k, v]) => condition(k, v))
  }
  if (typeof where !== 'string' || !where.trim()) return []
  return where.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean).map(pair => {
    const m = pair.match(/^([^=!<>~]+?)\s*(=|!=|>=|<=|>|<|~)\s*(.*)$/)
    if (!m) return condition(pair.trim(), '*')
    const [, key, op, raw] = m
    const value = raw.trim().replace(/^["']|["']$/g, '')
    return condition(key.trim(), op === '=' ? value : op === '!=' ? `!${value}` : `${op}${value}`)
  })
}

function itemLine(item: unknown, fields: string[], conditions: Condition[]): string {
  if (fields.length) {
    const picked: Record<string, unknown> = {}
    for (const f of fields) picked[f] = valueAt(item, f)
    return cut(json(picked), ITEM_CHARS)
  }
  const whole = json(item)
  if (whole.length <= ITEM_CHARS || !item || typeof item !== 'object') return cut(whole, ITEM_CHARS)
  const keys = Object.keys(item as object)
  const shown = [...new Set([...ID_KEYS.filter(k => keys.includes(k)), ...conditions.map(c => c.key)])]
  const picked: Record<string, unknown> = {}
  for (const k of shown) picked[k] = valueAt(item, k)
  return `${cut(json(picked), ITEM_CHARS)} (+${Math.max(0, keys.length - shown.length)} more keys; pass fields)`
}

interface FindArgs {
  ids?: unknown
  kind?: unknown
  path?: unknown
  where?: unknown
  fields?: unknown
  limit?: unknown
  offset?: unknown
}

/**
 * Items of arrays in logged JSON (bodies, WebSocket messages, event data) that match property
 * conditions, listed with their index: one call instead of reading an array item by item.
 */
export function findItems(args: FindArgs): string {
  const snapshot = pinnedSnapshot()
  const conditions = parseWhere(args.where)
  const pathSpec = typeof args.path === 'string' ? args.path.trim().replace(/\[\d*\]/g, '').toLowerCase() : ''
  const fields = listArg(args.fields).map(f => String(f).trim()).filter(Boolean)
  if (!conditions.length && !pathSpec) return 'Pass where (property conditions) and / or path (the array).'
  const kindFilter = typeof args.kind === 'string' && args.kind ? args.kind.toLowerCase() : ''
  const ids = idsArg(args.ids)
  const rows = ids.length ? rowsOfIds(snapshot, ids) : snapshot.rows
  if (ids.length && !rows.length) return `No such events (the logs have #0..#${snapshot.count - 1}).`
  const limit = Math.min(FIND_MAX_LIMIT, Math.max(1, Number(args.limit) || FIND_LIMIT))
  const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
  const t0 = snapshot.rows[0]?.event.timestamp ?? 0

  const groups: { head: string; matches: { index: number; item: unknown }[] }[] = []
  const searched = new Map<number, Map<string, number>>()
  let total = 0
  for (const row of rows) {
    if (kindFilter && row.event.kind !== kindFilter && row.label.toLowerCase() !== kindFilter) continue
    const rowArrays = new Map<string, number>()
    searched.set(row.index, rowArrays)
    for (const { part, value, repaired } of jsonParts(snapshot, row)) {
      const arrays: { path: string; items: unknown[] }[] = []
      objectArrays(value, part, arrays)
      for (const { path, items } of arrays) {
        const plainPath = path.replace(/\[\d+\]/g, '[]')
        if (!rowArrays.has(plainPath)) rowArrays.set(plainPath, items.length)
        if (pathSpec) {
          const plain = path.replace(/\[\d+\]/g, '').toLowerCase()
          if (plain !== pathSpec && !plain.endsWith(`.${pathSpec}`)) continue
        }
        const matches = items
          .map((item, index) => ({ index, item }))
          .filter(({ item }) => item && typeof item === 'object' && conditions.every(c => c.test(item)))
        if (!matches.length) continue
        total += matches.length
        const note = repaired ? '; the body was cut at capture, later items were not stored' : ''
        groups.push({ head: `${rowLine(row, t0)}\n  ${path}: ${items.length} items, ${matches.length} match${note}`, matches })
      }
    }
  }
  const what = [conditions.map(c => c.label).join(' and '), pathSpec && `in ${pathSpec}`].filter(Boolean).join(' ')
  if (!total) {
    const out = [`No array items match ${what}${ids.length ? ` in ${[...searched.keys()].map(n => `#${n}`).join(', ') || ids.map(n => `#${n}`).join(', ')}` : ''}.`]
    if (ids.length) {
      for (const [index, arrays] of searched) {
        const list = [...arrays.entries()].slice(0, 12).map(([p, n]) => `${p} (${n})`)
        out.push(`- #${index} ${snapshot.rows[index].label}: ${list.length ? `arrays of objects ${list.join(', ')}${arrays.size > 12 ? ', ...' : ''}` : 'no JSON arrays of objects'}`)
      }
      if (!searched.size) out.push(`- no event of kind ${kindFilter} among them`)
    }
    out.push('Check the array path and the property name (search_logs key=<name> shows the paths), or drop ids / kind to search every event.')
    return out.join('\n')
  }

  const out = [`${total} item${total === 1 ? '' : 's'} match ${what} in ${groups.length} array${groups.length === 1 ? '' : 's'}${total > limit ? ` (showing ${offset + 1}-${Math.min(total, offset + limit)})` : ''}:`]
  let seen = 0
  for (const group of groups) {
    const from = Math.max(0, offset - seen)
    const room = offset + limit - Math.max(seen, offset)
    seen += group.matches.length
    if (from >= group.matches.length || room <= 0) continue
    out.push(group.head)
    for (const { index, item } of group.matches.slice(from, from + room)) out.push(`    [${index}] ${itemLine(item, fields, conditions)}`)
  }
  if (offset + limit < total) out.push('', `More: call again with offset=${offset + limit}.`)
  return cut(out.join('\n'), RESULT_CHARS)
}
