import type { LogEvent, LogKind, LogLevel, StoredNetworkEntry } from '@/types/logs'
import { LOG_KINDS } from '@/types/logs'
import type { NetworkEntry } from '@/types/network'
import type { Sanitizer } from '@/injected/logs/sanitize'
import { logsRuntime as rt } from '@/injected/logs/runtime'
import type { ImportedLogs } from './useLogs'
import { createNetworkPool, type NetworkPool } from './networkPool'
import { sanitizeNetworkEntry } from './sanitizeNetwork'
import { extractLogsReportData, isLogsReportHtml, LOGS_REPORT_FORMAT, LOGS_REPORT_VERSION } from './report/template'

/** HTML reports; JSON is accepted for files exported by older versions */
export const IMPORT_ACCEPT = '.html,.htm,.json,text/html,application/json'

export const MAX_IMPORT_FILE_MB = 100
export const MAX_IMPORT_EVENTS = 50_000

const KINDS = new Set<string>(LOG_KINDS)
const LEVELS = new Set<LogLevel>(['info', 'warn', 'error'])
const MAX_TEXT = 2000

export class LogsImportError extends Error {}

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function timestampOf(item: Record<string, unknown>): number | null {
  if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) return item.timestamp
  if (typeof item.time === 'string') {
    const ts = Date.parse(item.time)
    if (Number.isFinite(ts)) return ts
  }
  return null
}

interface ExtractedFile {
  version: number
  items: unknown[]
  exportedAt?: string
  network?: { entries: Record<string, unknown>; bodies: Record<string, unknown> }
}

/**
 * Accepts the Export Logs payload (version 2, or version 1 from older JSON / HTML exports),
 * a single exported event, or a plain array of events.
 */
function extractFile(json: unknown): ExtractedFile {
  if (Array.isArray(json)) return { version: 1, items: json }
  if (isObject(json)) {
    if (json.format === LOGS_REPORT_FORMAT) {
      const version = Number(json.version)
      if (!Number.isInteger(version) || version < 1) throw new LogsImportError('The logs file has an unknown format version.')
      if (version > LOGS_REPORT_VERSION) {
        throw new LogsImportError(`The logs file was exported by a newer version (format ${version}). Update Vue Inspector to open it.`)
      }
    }
    if (Array.isArray(json.events)) {
      const info = json.info as Record<string, unknown> | undefined
      const network = isObject(json.network)
        ? { entries: isObject(json.network.entries) ? json.network.entries : {}, bodies: isObject(json.network.bodies) ? json.network.bodies : {} }
        : undefined
      return {
        version: json.format === LOGS_REPORT_FORMAT ? Number(json.version) : 1,
        items: json.events,
        exportedAt: typeof info?.exportedAt === 'string' ? info.exportedAt : undefined,
        network,
      }
    }
    if (typeof json.kind === 'string' && json.data) return { version: 1, items: [json] }
  }
  throw new LogsImportError('Not a logs file: expected an HTML report exported from the Logs tab (or an older JSON export).')
}

/** Full entry with every field the views read, from possibly partial file data */
function completeEntry(raw: Record<string, any>): NetworkEntry {
  return {
    ...raw,
    id: String(raw.id),
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date(0).toISOString(),
    method: text(raw.method, 20) || 'GET',
    url: text(raw.url, 20_000),
    path: text(raw.path, 20_000),
    name: text(raw.name, 500),
    initiator: text(raw.initiator, 50) || 'other',
    status: Number(raw.status) || 0,
    statusText: text(raw.statusText, 200),
    duration: Number(raw.duration) || 0,
    size: Number(raw.size) || 0,
    pending: !!raw.pending,
    requestHeaders: Array.isArray(raw.requestHeaders) ? raw.requestHeaders : [],
    responseHeaders: Array.isArray(raw.responseHeaders) ? raw.responseHeaders : [],
    params: Array.isArray(raw.params) ? raw.params : [],
    authorization: isObject(raw.authorization) ? raw.authorization : { type: 'None' },
    requestBody: isObject(raw.requestBody) ? raw.requestBody : null,
    responseBody: isObject(raw.responseBody) ? raw.responseBody : null,
  } as NetworkEntry
}

/** Version 1 network events hold their half of the entry; both halves form one entry */
function legacyEntries(items: unknown[]): Map<string, Record<string, any>> {
  const entries = new Map<string, Record<string, any>>()
  for (const item of items) {
    if (!isObject(item) || (item.kind !== 'request' && item.kind !== 'response')) continue
    const half = isObject(item.data) ? item.data.entry : undefined
    if (!isObject(half) || half.id === undefined) continue
    const id = String(half.id)
    entries.set(id, { ...entries.get(id), ...half, id })
  }
  return entries
}

function addEntry(pool: NetworkPool, raw: Record<string, any>, sanitizer: Sanitizer): void {
  // Files may come from other sources or older versions: mask with the current settings
  const { entry, fixedSize } = sanitizeNetworkEntry(completeEntry(raw), sanitizer, Number.MAX_SAFE_INTEGER)
  pool.put(entry, fixedSize)
}

export async function parseLogsFile(file: File, sanitizer: Sanitizer): Promise<ImportedLogs> {
  if (file.size > MAX_IMPORT_FILE_MB * 1024 * 1024) {
    throw new LogsImportError(`File is too large (max ${MAX_IMPORT_FILE_MB} MB).`)
  }
  const content = await file.text()
  let json: unknown
  if (isLogsReportHtml(content)) {
    try {
      json = extractLogsReportData(content)
    } catch {
      throw new LogsImportError('The HTML report is damaged: its embedded data is not valid JSON.')
    }
    if (json === null) throw new LogsImportError('The HTML report is damaged: embedded data not found.')
  } else if (/^\s*</.test(content)) {
    throw new LogsImportError('This HTML file is not a logs report exported from the Logs tab.')
  } else {
    try {
      json = JSON.parse(content)
    } catch {
      throw new LogsImportError('File is not valid JSON.')
    }
  }

  const parsed = extractFile(json)
  const pool = createNetworkPool()
  const entryIds: string[] = []
  if (parsed.version >= 2 && parsed.network) {
    const { entries, bodies } = parsed.network
    for (const [id, stored] of Object.entries(entries)) {
      if (!isObject(stored)) continue
      const resolved = rt.resolveEntry({ ...(stored as StoredNetworkEntry), id }, ref => (isObject(bodies[ref]) ? bodies[ref] : undefined))
      addEntry(pool, resolved, sanitizer)
      entryIds.push(id)
    }
  } else {
    for (const entry of legacyEntries(parsed.items).values()) {
      addEntry(pool, entry, sanitizer)
      entryIds.push(entry.id)
    }
  }

  const events: LogEvent[] = []
  const usedIds = new Set<string>()
  let skipped = 0

  for (const raw of parsed.items.slice(0, MAX_IMPORT_EVENTS)) {
    const item = raw as Record<string, unknown>
    const timestamp = isObject(item) ? timestampOf(item) : null
    if (!isObject(item) || !KINDS.has(item.kind as string) || timestamp === null || !isObject(item.data)) {
      skipped++
      continue
    }
    let id = text(item.id, 200) || `imported-${events.length}`
    if (usedIds.has(id)) id = `${id}-${events.length}`
    usedIds.add(id)

    const kind = item.kind as LogKind
    // Version 1 events without a key are grouped by their stored title
    const key = sanitizer.maskString(text(item.key, 500) || text(item.title)) || '(untitled)'
    let data: Record<string, any>
    let size: number
    if (kind === 'request' || kind === 'response') {
      const entryId = isObject(item.data.entry) ? String(item.data.entry.id) : text(item.data.entryId, 200)
      data = { entryId }
      size = 120
      pool.retain(entryId)
    } else {
      const sanitized = sanitizer.sanitize<Record<string, any>>(item.data)
      data = sanitized.value
      size = sanitized.size
    }
    events.push({
      id,
      kind,
      timestamp,
      key,
      level: LEVELS.has(item.level as LogLevel) ? (item.level as LogLevel) : 'info',
      data,
      size,
    })
  }
  skipped += Math.max(0, parsed.items.length - MAX_IMPORT_EVENTS)
  for (const id of entryIds) pool.collect(id)

  if (events.length === 0) throw new LogsImportError('The file contains no valid log events.')
  events.sort((a, b) => a.timestamp - b.timestamp)
  return { fileName: file.name, exportedAt: parsed.exportedAt, version: parsed.version, events, pool, skipped }
}
