import type { LogEvent, StoredNetworkEntry } from '@/types/logs'
import { LOG_KINDS, LOG_KIND_META } from '@/types/logs'
import type { BodyContent } from '@/types/network'
import { logsRuntime as rt, type RuntimeChange } from '@/injected/logs/runtime'
import {
  LOGS_REPORT_FORMAT,
  LOGS_REPORT_VERSION,
  renderLogsReport,
  type LogsReportPayload,
  type ReportEvent,
} from './report/template'
import type { LogsSource } from './view'

function fileStamp(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

function download(content: string, type: string, fileName: string): void {
  try {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[logs/exportLogs] download failed:', fileName, e)
  }
}

const REQUEST_ONLY: Array<keyof StoredNetworkEntry> = ['requestHeaders', 'requestHeadersVisible', 'params', 'authorization', 'requestBodyRef']
const RESPONSE_ONLY: Array<keyof StoredNetworkEntry> = [
  'status', 'statusText', 'duration', 'size', 'error', 'responseHeaders', 'responseHeadersVisible', 'responseBodyRef',
]

/**
 * A store change whose previous store event is not exported cannot be replayed from the file:
 * it gets its full state, the old values of its changes and, when the changes cannot be
 * reverted exactly, the state before.
 */
function materializeStoreChange(event: LogEvent, stores: ReturnType<typeof rt.indexStores>): Record<string, any> {
  const data = event.data
  const states = rt.restoreStoreChange(event, stores)
  const changes: RuntimeChange[] = Array.isArray(data.changes) ? data.changes.map((c: RuntimeChange) => rt.fillChange(c, states)) : []
  const out: Record<string, any> = { ...data, changes }
  if (states.afterKnown) out.state = states.after
  if (states.beforeKnown && states.afterKnown) {
    const exact = !data.changesTruncated && rt.applyChanges(rt.clone(states.after), changes, true).exact
    if (!exact) out.before = states.before
  } else if (states.beforeKnown) {
    out.before = states.before
  }
  return out
}

function storeEventsData(events: LogEvent[], source: LogsSource): Map<LogEvent, Record<string, any>> {
  const out = new Map<LogEvent, Record<string, any>>()
  const exported = new Set<unknown>(events)
  const stores = rt.indexStores(source.events)
  for (const event of events) {
    if (event.kind !== 'store' || rt.storeOp(event) !== 'change' || event.data?.op === undefined) continue
    const chain = stores.chains.get(event.key)
    const index = stores.position.get(event)
    const previous = chain && index !== undefined && index > 0 ? chain[index - 1] : undefined
    if (previous && exported.has(previous)) continue
    out.set(event, materializeStoreChange(event, stores))
  }
  return out
}

/** Entries of the exported network events, without the half no exported event shows */
function networkSubset(events: LogEvent[], source: LogsSource): NonNullable<LogsReportPayload['network']> {
  const halves = new Map<string, { request: boolean; response: boolean }>()
  for (const event of events) {
    if (event.kind !== 'request' && event.kind !== 'response') continue
    const id = event.data?.entryId
    if (typeof id !== 'string') continue
    const h = halves.get(id) ?? { request: false, response: false }
    h[event.kind] = true
    halves.set(id, h)
  }

  const entries: Record<string, StoredNetworkEntry> = {}
  const bodies: Record<string, BodyContent> = {}
  const renumbered = new Map<string, string>()
  const bodyRef = (ref: string | undefined): string | undefined => {
    if (!ref) return undefined
    let next = renumbered.get(ref)
    if (!next) {
      const body = source.pool.getBody(ref)
      if (!body) return undefined
      next = `b${renumbered.size + 1}`
      renumbered.set(ref, next)
      bodies[next] = body
    }
    return next
  }

  for (const [id, h] of halves) {
    const stored = source.pool.getStored(id)
    if (!stored) continue
    const entry: StoredNetworkEntry = { ...stored }
    if (!h.request) for (const field of REQUEST_ONLY) delete entry[field]
    if (!h.response) for (const field of RESPONSE_ONLY) delete entry[field]
    const requestRef = bodyRef(entry.requestBodyRef)
    const responseRef = bodyRef(entry.responseBodyRef)
    if (requestRef) entry.requestBodyRef = requestRef
    else delete entry.requestBodyRef
    if (responseRef) entry.responseBodyRef = responseRef
    else delete entry.responseBodyRef
    entries[id] = entry
  }
  return { entries, bodies }
}

/** Report data for `events` (chronological) read from `source` */
export function buildLogsReport(events: LogEvent[], source: LogsSource, now = Date.now()): LogsReportPayload {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const storeData = storeEventsData(sorted, source)
  const items: ReportEvent[] = sorted.map(e => ({
    id: e.id,
    kind: e.kind,
    timestamp: e.timestamp,
    key: e.key,
    level: e.level,
    data: storeData.get(e) ?? e.data,
  }))
  return {
    format: LOGS_REPORT_FORMAT,
    version: LOGS_REPORT_VERSION,
    info: {
      name: 'Vue Inspector Logs',
      exportedAt: new Date(now).toISOString(),
      count: items.length,
      kinds: Object.fromEntries(LOG_KINDS.map(k => [k, { label: LOG_KIND_META[k].label }])),
    },
    events: items,
    network: networkSubset(sorted, source),
  }
}

/** Adds the other half (request / response) of every exported network event */
export function withNetworkPairs(events: LogEvent[], source: LogsSource): LogEvent[] {
  const wanted = new Set<string>()
  for (const event of events) {
    if ((event.kind === 'request' || event.kind === 'response') && typeof event.data?.entryId === 'string') {
      wanted.add(event.data.entryId)
    }
  }
  if (wanted.size === 0) return events
  const included = new Set(events)
  const out = events.slice()
  for (const event of source.events) {
    if (included.has(event) || (event.kind !== 'request' && event.kind !== 'response')) continue
    if (wanted.has(event.data?.entryId)) out.push(event)
  }
  return out
}

export function exportLogEvent(event: LogEvent, source: LogsSource): void {
  const isNetwork = event.kind === 'request' || event.kind === 'response'
  const events = withNetworkPairs([event], source)
  const kind = isNetwork ? 'network' : event.kind.replace(/[^a-z]/gi, '')
  exportLogs(events, source, `log_${kind}_${fileStamp(Math.min(...events.map(e => e.timestamp)))}`)
}

/** Network events are exported with their pair (request + response) */
export function exportLogs(events: LogEvent[], source: LogsSource, baseName?: string): void {
  const now = Date.now()
  const name = baseName ?? `logs_${fileStamp(now)}`
  let html: string
  try {
    html = renderLogsReport(buildLogsReport(withNetworkPairs(events, source), source, now))
  } catch (e) {
    console.error('[logs/exportLogs] report rendering failed:', e)
    return
  }
  download(html, 'text/html', `${name}.html`)
}
