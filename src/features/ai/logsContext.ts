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

/** Timeline lines of the digest sent with a question; the rest is read with tools */
const DIGEST_TIMELINE = 250
const BODY_CHARS = 6000
const VALUE_CHARS = 8000
const RESULT_CHARS = 24000
const MAX_EVENTS_PER_CALL = 6
const MAX_SEARCH_RESULTS = 40
const STACK_CODE_CHARS = 5000
/** Events before / after an error that get_events lists so a race is visible without another call */
const ERROR_BEFORE = 6
const ERROR_AFTER = 12
const ERROR_LATER = 50
const SKIP_AROUND = new Set(['ws-sent', 'ws-received'])

interface Row {
  index: number
  event: RuntimeEvent
  label: string
  title: string
  subtitle: string
}

export interface LogsSnapshot {
  signature: string
  digest: string
  count: number
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

export function resetLogsSnapshot(): void {
  cached = null
}

/** Snapshot of the current logs; reused while no event was added or dropped */
export function takeLogsSnapshot(budget: Omit<AiDigestOptions, 'noGuide'> = { maxTimeline: DIGEST_TIMELINE }): LogsSnapshot {
  logs ??= useLogs()
  const { events, source } = logs
  const list = events.value
  const signature = `${list.length}:${list[0]?.id ?? ''}:${list[list.length - 1]?.id ?? ''}:${budget.maxTimeline}:${budget.maxChars}:${budget.bodyChars}`
  if (cached && cached.signature === signature) return cached

  const payload = buildLogsReport(withNetworkPairs(list, source.value), source.value)
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

  cached = { signature, digest, count: rows.length, payload, rt, rows, getEntry, stores }
  return cached
}

function rowLine(row: Row, t0: number): string {
  const ms = row.event.timestamp - t0
  const rel = ms < 1000 ? `+${Math.round(ms)}ms` : `+${(ms / 1000).toFixed(2)}s`
  return `#${row.index} ${rel} ${row.label} ${row.title}${row.subtitle ? ` | ${row.subtitle}` : ''}`
}

function bodyText(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  if (body.isBinary || body.media) return `[binary${body.media?.format ? ` ${body.media.format}` : ''}, ${body.originalSize ?? '?'} bytes]`
  if (typeof body.text !== 'string') return undefined
  const note = body.truncated ? ' [cut at capture]' : ''
  return cut(compactBody(body.text), BODY_CHARS) + note
}

function networkDetails(entry: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (value == null || value === '' || key.endsWith('Ref') || key === 'id') continue
    if (key === 'requestBody' || key === 'responseBody') {
      const text = bodyText(value)
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
    lines.push(entry ? `- network entry: ${cut(json(networkDetails(entry)), RESULT_CHARS)}` : '- network entry: not in the logs any more')
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
  lines.push(`- data: ${cut(json(event.data), VALUE_CHARS)}`)
  return lines.join('\n')
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

export async function getEvents(ids: unknown): Promise<string> {
  const snapshot = pinnedSnapshot()
  const list = (Array.isArray(ids) ? ids : [ids])
    .map(v => Number(String(v).replace(/^#/, '')))
    .filter(n => Number.isInteger(n))
    .slice(0, MAX_EVENTS_PER_CALL)
  if (!list.length) return 'Pass event ids as numbers, for example [12, 13].'
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

function searchableText(snapshot: LogsSnapshot, row: Row): string {
  const entryId = row.event.data?.entryId
  if (typeof entryId === 'string') {
    const entry = snapshot.getEntry(entryId)
    return entry ? json(networkDetails(entry)) : ''
  }
  return json(row.event.data)
}

export function searchLogs(query: unknown, kind?: unknown, limit?: unknown): string {
  const snapshot = pinnedSnapshot()
  const needle = String(query ?? '').trim().toLowerCase()
  if (!needle) return 'Pass a non-empty query.'
  const kindFilter = typeof kind === 'string' && kind ? kind.toLowerCase() : ''
  const max = Math.min(MAX_SEARCH_RESULTS, Math.max(1, Number(limit) || 20))
  const t0 = snapshot.rows[0]?.event.timestamp ?? 0
  const found: string[] = []
  let total = 0
  for (const row of snapshot.rows) {
    if (kindFilter && row.event.kind !== kindFilter && row.label.toLowerCase() !== kindFilter) continue
    const head = `${row.label} ${row.title} ${row.subtitle} ${row.event.key}`.toLowerCase()
    const inHead = head.includes(needle)
    if (!inHead && !searchableText(snapshot, row).toLowerCase().includes(needle)) continue
    total++
    if (found.length < max) found.push(`${rowLine(row, t0)}${inHead ? '' : '  (matched in data)'}`)
  }
  if (!total) return `No events match "${needle}".`
  return `${total} events match${total > found.length ? `, first ${found.length} shown` : ''}:\n${found.join('\n')}`
}
