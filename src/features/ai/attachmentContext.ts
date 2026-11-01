/**
 * Attached items (Ask AI) as they go with the question: masked by the AI settings, cut to the
 * tool result size, with the `#N` of the logs event when the item is in the logs.
 */

import { aiCredentials } from './credentials'
import { protectAppData, protectNetworkEntry } from './privacy'
import { eventAttachment, findEventRef, networkAttachment, type LogsSnapshot } from './logsContext'
import type { AiAttachment } from './attachments'

const KIND_NAMES: Record<AiAttachment['kind'], string> = {
  log: 'logs event',
  network: 'network request',
  props: 'component props',
  store: 'store',
}

function appData(value: unknown): string {
  return JSON.stringify(protectAppData(value, { masking: aiCredentials.masking, access: aiCredentials.access }))
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}... [${text.length - max} chars cut]` : text
}

async function attachmentBody(item: AiAttachment, snapshot: LogsSnapshot, max: number): Promise<{ ref?: number; text: string }> {
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
  }
}

export async function attachmentsText(items: AiAttachment[], snapshot: LogsSnapshot, max: number): Promise<string> {
  const parts: string[] = []
  for (const item of items) {
    const { ref, text } = await attachmentBody(item, snapshot, max)
    const name = item.label.replace(/"/g, "'")
    parts.push(`<attachment type="${KIND_NAMES[item.kind]}" name="${name}"${ref !== undefined ? ` event="#${ref}"` : ''}>\n${text}\n</attachment>`)
  }
  return parts.join('\n\n')
}
