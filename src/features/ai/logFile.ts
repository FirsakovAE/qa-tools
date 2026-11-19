/**
 * A Vue Inspector log the user attached to the current chat. It is not saved and it is not sent
 * as a file: while it is attached, the logs digest and the logs tools read it instead of the
 * live capture. A new chat or closing the app drops it.
 */

import { ref } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/components/ui/Toaster'
import { LOGS_REPORT_FORMAT, type LogsReportPayload } from '@/features/logs/report/template'

export interface AttachedLog {
  /** Name, size and time: a new pick of another file is a different log */
  id: string
  name: string
  payload: LogsReportPayload
}

/** The log attached to this chat, or none. Not written to storage. */
export const attachedLog = ref<AttachedLog | null>(null)

const DATA_BLOCK = /<script\b([^>]*\bid=["']qa-logs-data["'][^>]*)>([\s\S]*?)<\/script>/i

export function clearAttachedLog(): void {
  attachedLog.value = null
}

function isPayload(value: unknown): value is LogsReportPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as LogsReportPayload
  return payload.format === LOGS_REPORT_FORMAT && Array.isArray(payload.events) && !!payload.info && typeof payload.info === 'object'
}

async function ungzipBase64(b64: string): Promise<string> {
  if (typeof DecompressionStream !== 'function') throw new Error('gzip')
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
}

/** The report payload inside an exported HTML log, or a raw JSON payload */
async function readPayload(file: File): Promise<LogsReportPayload> {
  const text = await file.text()
  const block = DATA_BLOCK.exec(text)
  let json = text.trim()
  if (block) {
    const raw = block[2].trim()
    json = /data-encoding=["']gzip-base64["']/i.test(block[1]) ? await ungzipBase64(raw) : raw
  }
  const payload = JSON.parse(json) as unknown
  if (!isPayload(payload)) throw new Error('format')
  return payload
}

/** Replaces the attached log. A file that is not a Vue Inspector log is refused. */
export async function attachLogFile(file: File): Promise<void> {
  try {
    const payload = await readPayload(file)
    attachedLog.value = {
      id: `${file.name}\0${file.size}\0${file.lastModified}`,
      name: file.name,
      payload,
    }
  } catch (e) {
    const format = e instanceof SyntaxError || (e instanceof Error && e.message === 'format')
    toast.error(t(format ? 'ai.logBad' : 'ai.logReadFail'))
  }
}
