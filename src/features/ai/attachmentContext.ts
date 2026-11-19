/**
 * Attached items (Ask AI) as they go with the question: masked by the AI settings, cut to the
 * tool result size, with the `#N` of the logs event when the item is in the logs. A text file
 * goes whole when it is small, otherwise as an overview for the file tools.
 */

import { aiCredentials } from './credentials'
import { maskText, protectAppData, protectNetworkEntry } from './privacy'
import { eventAttachment, findEventRef, networkAttachment, type LogsSnapshot } from './logsContext'
import { fileOverview } from './fileTools'
import { getTextFile } from './textFiles'
import type { AiAttachment } from './attachments'

const KIND_NAMES: Record<AiAttachment['kind'], string> = {
  log: 'logs event',
  network: 'network request',
  props: 'component props',
  store: 'store',
  file: 'text file',
}

/** A file up to this size goes whole with the question, like a short paste */
const FILE_INLINE_CHARS = 8000
const FILE_OUTLINE_CHARS = 3000

function appData(value: unknown): string {
  return JSON.stringify(protectAppData(value, { masking: aiCredentials.masking, access: aiCredentials.access }))
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}... [${text.length - max} chars cut]` : text
}

function xmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function inlineChars(max: number, tools: boolean): number {
  return tools ? Math.min(FILE_INLINE_CHARS, Math.floor(max / 2)) : max
}

/** How a file goes with the question, for the context step */
export function fileDelivery(item: AiAttachment, max: number, tools: boolean): 'whole' | 'overview' | 'cut' | undefined {
  if (item.kind !== 'file') return undefined
  const file = getTextFile(item.fileId)
  if (!file || file.text.length <= inlineChars(max, tools)) return 'whole'
  return tools ? 'overview' : 'cut'
}

interface AttachmentBody {
  ref?: number
  text: string
  /** Extra attributes of the attachment tag */
  attrs?: string
}

async function attachmentBody(item: AiAttachment, snapshot: LogsSnapshot, max: number, tools: boolean): Promise<AttachmentBody> {
  switch (item.kind) {
    case 'log': {
      const ref = findEventRef(snapshot, e => e.id === item.eventId)
      return ref === undefined ? { text: 'The event is no longer in the logs.' } : { ref, text: await eventAttachment(snapshot, ref, max) }
    }
    case 'network': {
      const id = item.entry.id
      const ws = item.entry.initiator === 'websocket'
      const ref = findEventRef(snapshot, e => e.data?.entryId === id && e.kind === (ws ? 'ws' : 'request'))
        ?? findEventRef(snapshot, e => e.data?.entryId === id)
      if (ref !== undefined) return { ref, text: await eventAttachment(snapshot, ref, max) }
      const entry = protectNetworkEntry(item.entry, { masking: aiCredentials.masking, access: aiCredentials.access })
      return { text: `Not in the logs; the entry from the Network tab:\n${networkAttachment(entry, max)}` }
    }
    case 'props':
      return { text: cut(`Component ${item.component}, element ${item.element}\nProps now: ${appData(item.props)}`, max) }
    case 'store': {
      const ref = findEventRef(snapshot, e => e.kind === 'store' && (e.key === item.storeId || e.key === item.name), true)
      const lines = [`State now: ${appData(item.state)}`]
      if (item.getters && Object.keys(item.getters as object).length) lines.push(`Getters now: ${appData(item.getters)}`)
      if (ref !== undefined) lines.push(`Latest logged change of this store: #${ref}`)
      return { text: cut(lines.join('\n'), max) }
    }
    case 'file': {
      const file = getTextFile(item.fileId)
      if (!file) return { text: 'The file is no longer attached.' }
      const { complete, text } = fileOverview(file, { inline: inlineChars(max, tools), outline: Math.min(FILE_OUTLINE_CHARS, Math.floor(max / 2)), tools })
      return { text: maskText(text, aiCredentials.masking), attrs: ` file="${file.id}" complete="${complete}"` }
    }
  }
}

/** `tools`: the model can call tools, so a big file goes as an overview, not cut */
export async function attachmentsText(items: AiAttachment[], snapshot: LogsSnapshot, max: number, tools = true): Promise<string> {
  const parts: string[] = []
  for (const item of items) {
    const { ref, text, attrs = '' } = await attachmentBody(item, snapshot, max, tools)
    parts.push(`<attachment type="${KIND_NAMES[item.kind]}" name="${xmlAttr(item.label)}"${attrs}${ref !== undefined ? ` event="#${ref}"` : ''}>\n${text}\n</attachment>`)
  }
  return parts.join('\n\n')
}
