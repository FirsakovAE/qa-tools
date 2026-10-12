import type { LogEvent, LogKind, LogLevel } from '@/types/logs'
import { LOG_KINDS } from '@/types/logs'
import type { Sanitizer } from '@/injected/logs/sanitize'
import type { ImportedLogs } from './useLogs'
import { extractLogsReportData, isLogsReportHtml } from './report/template'

export const IMPORT_ACCEPT = '.json,.html,.htm,application/json,text/html'

export const MAX_IMPORT_FILE_MB = 100
export const MAX_IMPORT_EVENTS = 50_000

const KINDS = new Set<string>(LOG_KINDS)
const LEVELS = new Set<LogLevel>(['info', 'warn', 'error'])
const MAX_TEXT = 2000

export class LogsImportError extends Error {}

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function timestampOf(item: Record<string, unknown>): number | null {
  if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) return item.timestamp
  if (typeof item.time === 'string') {
    const ts = Date.parse(item.time)
    if (Number.isFinite(ts)) return ts
  }
  return null
}

/** Accepts the Export Logs file (JSON or HTML report data), a single exported event, or a plain array of events */
function extractItems(json: unknown): { items: unknown[]; exportedAt?: string } {
  if (Array.isArray(json)) return { items: json }
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    if (Array.isArray(obj.events)) {
      const info = obj.info as Record<string, unknown> | undefined
      return { items: obj.events, exportedAt: typeof info?.exportedAt === 'string' ? info.exportedAt : undefined }
    }
    if (typeof obj.kind === 'string' && obj.data) return { items: [obj] }
  }
  throw new LogsImportError('Not a logs file: expected an Export Logs file (JSON / HTML) or an exported event.')
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

  const { items, exportedAt } = extractItems(json)
  const events: LogEvent[] = []
  const usedIds = new Set<string>()
  let skipped = 0

  for (const raw of items.slice(0, MAX_IMPORT_EVENTS)) {
    const item = raw as Record<string, unknown>
    const timestamp = item && typeof item === 'object' ? timestampOf(item) : null
    if (!item || typeof item !== 'object' || !KINDS.has(item.kind as string) || timestamp === null || !item.data || typeof item.data !== 'object') {
      skipped++
      continue
    }
    let id = text(item.id, 200) || `imported-${events.length}`
    if (usedIds.has(id)) id = `${id}-${events.length}`
    usedIds.add(id)

    // Files may come from other sources or older versions: sanitize with current masking
    const { value: data, size } = sanitizer.sanitize<Record<string, unknown>>(item.data)
    const title = sanitizer.maskString(text(item.title) || '(untitled)')
    const subtitle = typeof item.subtitle === 'string' ? sanitizer.maskString(text(item.subtitle)) : undefined
    events.push({
      id,
      kind: item.kind as LogKind,
      timestamp,
      key: text(item.key, 500) || title,
      level: LEVELS.has(item.level as LogLevel) ? (item.level as LogLevel) : 'info',
      title,
      subtitle,
      data,
      size,
    })
  }
  skipped += Math.max(0, items.length - MAX_IMPORT_EVENTS)

  if (events.length === 0) throw new LogsImportError('The file contains no valid log events.')
  events.sort((a, b) => a.timestamp - b.timestamp)
  return { fileName: file.name, exportedAt, events, skipped }
}
