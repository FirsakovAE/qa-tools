import type { LogEvent, LogsExportFormat } from '@/types/logs'
import { LOG_KINDS, LOG_KIND_META } from '@/types/logs'
import { renderLogsReport, type LogsReportPayload } from './report/template'

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

function downloadJson(data: unknown, fileName: string): void {
  let json: string
  try {
    json = JSON.stringify(data, null, 2)
  } catch (e) {
    console.error('[logs/exportLogs] JSON.stringify failed:', fileName, e)
    return
  }
  download(json, 'application/json', fileName)
}

function toExportItem(event: LogEvent) {
  return {
    id: event.id,
    type: LOG_KIND_META[event.kind]?.label ?? event.kind,
    kind: event.kind,
    key: event.key,
    time: new Date(event.timestamp).toISOString(),
    level: event.level,
    title: event.title,
    subtitle: event.subtitle,
    data: event.data,
  }
}

/** `related` is the other half of a network event; both are exported as one file */
export function exportLogEvent(event: LogEvent, format: LogsExportFormat, related?: LogEvent | null): void {
  const isNetwork = event.kind === 'request' || event.kind === 'response'
  const events = related ? [event, related].sort((a, b) => a.timestamp - b.timestamp) : [event]
  const kind = isNetwork ? 'network' : event.kind.replace(/[^a-z]/gi, '')
  exportLogs(events, format, `log_${kind}_${fileStamp(events[0].timestamp)}`)
}

export function exportLogs(events: LogEvent[], format: LogsExportFormat = 'json', baseName?: string): void {
  const now = Date.now()
  const name = baseName ?? `logs_${fileStamp(now)}`
  const payload: LogsReportPayload = {
    info: {
      name: 'Vue Inspector Logs',
      exportedAt: new Date(now).toISOString(),
      count: events.length,
    },
    events: events.map(toExportItem),
  }
  if (format === 'html') {
    payload.info.kinds = Object.fromEntries(LOG_KINDS.map(k => [k, { label: LOG_KIND_META[k].label }]))
    let html: string
    try {
      html = renderLogsReport(payload)
    } catch (e) {
      console.error('[logs/exportLogs] report rendering failed:', e)
      return
    }
    download(html, 'text/html', `${name}.html`)
    return
  }
  downloadJson(payload, `${name}.json`)
}
