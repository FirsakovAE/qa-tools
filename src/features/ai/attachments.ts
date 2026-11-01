/**
 * Items the user attaches to the next question with Ask AI in the menus of the other tabs: a logs
 * event, a network request, the props of a component or a store. The data is taken when the item
 * is attached; masking, the logs id and truncation are applied when the question is sent.
 */

import { ref, toRaw } from 'vue'
import { getRuntimeAdapter } from '@/runtime'
import { toast } from '@/components/ui/Toaster'
import { useLogs } from '@/features/logs/useLogs'
import { describeLog, logLabel } from '@/features/logs/view'
import type { LogEvent } from '@/types/logs'
import type { NetworkEntry } from '@/types/network'
import type { PropsRow } from '@/features/props/types'

const LABEL_CHARS = 80

export type AiAttachment =
  | { kind: 'log'; key: string; label: string; eventId: string }
  | { kind: 'network'; key: string; label: string; entry: Record<string, any> }
  | { kind: 'props'; key: string; label: string; component: string; element: string; props: unknown }
  | { kind: 'store'; key: string; label: string; storeId: string; name: string; state: unknown; getters: unknown }

/** Items attached to the question being typed */
export const aiAttachments = ref<AiAttachment[]>([])
/** Grows on every Ask AI: the app opens the AI tab */
export const askAiRequest = ref(0)

function short(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > LABEL_CHARS ? `${t.slice(0, LABEL_CHARS - 1)}…` : t
}

/** Plain copy: reactive proxies and class instances do not go through masking */
function plain<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(toRaw(value) ?? null))
  } catch {
    return value
  }
}

function attach(item: AiAttachment): void {
  aiAttachments.value = [...aiAttachments.value.filter(a => a.key !== item.key), item]
  askAiRequest.value++
}

export function removeAttachment(key: string): void {
  aiAttachments.value = aiAttachments.value.filter(a => a.key !== key)
}

/** Takes the attached items for a question and empties the composer */
export function takeAttachments(): AiAttachment[] {
  const list = aiAttachments.value
  aiAttachments.value = []
  return list
}

export function askAiAboutLog(event: LogEvent): void {
  const { title } = describeLog(event, useLogs().source.value)
  attach({ kind: 'log', key: `log:${event.id}`, label: short(`${logLabel(event)} ${title}`), eventId: event.id })
}

export function askAiAboutRequest(entry: NetworkEntry): void {
  const what = entry.initiator === 'websocket' ? 'WS' : entry.method
  attach({ kind: 'network', key: `network:${entry.id}`, label: short(`${what} ${entry.name || entry.path || entry.url}`), entry: plain(entry) })
}

async function request<T>(message: Record<string, unknown>): Promise<T | undefined> {
  const adapter = getRuntimeAdapter()
  if (!adapter) return undefined
  return adapter.sendMessage<T>({ type: String(message.type), ...message }, 8000).catch(() => undefined)
}

export async function askAiAboutProps(row: PropsRow): Promise<void> {
  const res = row.id?.startsWith('uid:')
    ? await request<{ props?: Record<string, unknown> }>({ type: 'GET_COMPONENT_PROPS', componentUid: row.id, componentPathFallback: row.componentUid || undefined })
    : undefined
  const props = res?.props ?? row.props
  if (!props) {
    toast.error('Could not read the props of the component')
    return
  }
  const name = row.name || 'Component'
  attach({ kind: 'props', key: `props:${row.componentUid || row.id}`, label: short(`${name} props`), component: name, element: row.elementInfo, props: plain(props) })
}

export async function askAiAboutStore(storeId: string, name = storeId): Promise<void> {
  const res = await request<{ state?: unknown; getters?: unknown; error?: string }>({ type: 'PINIA_GET_STORE_STATE', storeId })
  if (!res || res.error || !('state' in res)) {
    toast.error(`Could not read the store ${name}`)
    return
  }
  attach({ kind: 'store', key: `store:${storeId}`, label: short(`Store ${name}`), storeId, name, state: plain(res.state ?? {}), getters: plain(res.getters ?? {}) })
}
