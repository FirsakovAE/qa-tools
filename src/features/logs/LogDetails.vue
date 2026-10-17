<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowLeft, MoreHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/ContextMenu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { TooltipProvider } from '@/components/ui/tooltip'
import JsonEditor from '@/components/JsonEditor.vue'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import type { LogChange, LogEvent } from '@/types/logs'
import type { BodyContent, NetworkEntry } from '@/types/network'
import { formatBytes, formatDurationMs } from '@/types/network'
import { formatJsonPayload } from '@/utils/jsonGuards'
import { isOmittedValue, type OmittedValue } from '@/injected/logs/sanitize'
import LogActionsMenuContent from './LogActionsMenuContent.vue'
import { formatLogDateTime, previewValue, toPrettyJson } from './format'
import { hydrateLog, logBadgeClass, type LogsSource } from './view'

type SectionId =
  | 'overview' | 'changes' | 'before' | 'after' | 'state' | 'args' | 'result' | 'stack' | 'raw'
  | 'params' | 'requestHeaders' | 'requestBody' | 'responseHeaders' | 'responseBody' | 'messages'

const props = defineProps<{
  event: LogEvent
  /** Events and network entries the view is restored from */
  source: LogsSource
  /** Paired request/response event of the same network entry */
  related?: LogEvent | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'export', event: LogEvent): void
  (e: 'copyCurl', event: LogEvent): void
  (e: 'ignore', event: LogEvent): void
  (e: 'openRelated', event: LogEvent): void
}>()

useEscapeClose(computed(() => true), () => emit('back'))

const settings = useInspectorSettingsSync()
const jsonEditorImpl = computed(() => settings.value?.json?.editor ?? 'jsoneditor')
const jsonMode = ref<'text' | 'tree'>('text')
watch(settings, s => { if (s) jsonMode.value = s.json?.mode ?? 'text' }, { immediate: true })

function persistJsonMode(m: 'text' | 'tree') {
  jsonMode.value = m
  if (settings.value?.json) settings.value.json.mode = m
}

/** Event with restored fields (states, change values, network entry half) */
const hydrated = computed(() => hydrateLog(props.event, props.source))
const view = computed(() => hydrated.value.event)
const missing = computed(() => hydrated.value.missing)
const data = computed(() => view.value.data)
const isStoreBase = computed(() => props.event.kind === 'store' && data.value.op !== 'change')

/** Request or response half of the network entry */
const entry = computed<Partial<NetworkEntry> | null>(() => (data.value.entry as Partial<NetworkEntry> | undefined) ?? null)

const messageFrames = computed(() => {
  const frames = entry.value?.websocket?.frames ?? []
  const frameId = props.event.data?.frameId
  if (typeof frameId === 'string') return frames.filter(frame => frame.id === frameId)
  return frames
})

function frameText(frame: { kind: string; data: string }): string {
  if (frame.kind === 'binary') return frame.data
  return formatJsonPayload(frame.data)
}

const relatedLabel = computed(() => {
  if (!props.related) return undefined
  if (props.related.kind === 'ws-closed') return 'Open close event'
  if (props.related.kind === 'ws') return 'Open connection event'
  return props.related.kind === 'response' ? 'Open response event' : 'Open request event'
})

const changes = computed<LogChange[]>(() => (Array.isArray(data.value.changes) ? data.value.changes : []))

/** Explanation shown instead of a state that cannot be restored */
const unavailableNotice = computed(() => {
  const section = activeSection.value
  if (section === 'state' && missing.value.state) return 'The state was not saved (it could not be restored when older changes were compacted).'
  if (section === 'before' && missing.value.before) {
    return 'The state before this change cannot be restored: earlier events of this store are missing or incomplete. The changed values are shown in Changes.'
  }
  if (section === 'after' && missing.value.after) {
    return 'The state after this change cannot be restored: earlier events of this store are missing or incomplete. The changed values are shown in Changes.'
  }
  if (missing.value.entry && section !== 'raw') return 'The network entry of this event is no longer available.'
  return ''
})

const sections = computed(() => {
  const list: Array<{ id: SectionId; label: string }> = []
  const kind = props.event.kind
  const en = entry.value
  const socket = kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed' || en?.initiator === 'websocket' || en?.method === 'WS'
  if ((kind === 'request' || kind === 'response' || kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed') && !en) {
    list.push({ id: 'overview', label: 'Overview' })
  } else if (socket && en) {
    list.push({ id: 'overview', label: 'Overview' })
    const responseHeaders = kind === 'response' || kind === 'ws-received' || kind === 'ws-closed'
    list.push({ id: responseHeaders ? 'responseHeaders' : 'requestHeaders', label: 'Headers' })
    const ownFrame = kind === 'ws-sent' || kind === 'ws-received'
    const count = ownFrame ? 1 : (en.websocket?.frames.length ?? 0)
    list.push({ id: 'messages', label: ownFrame ? 'Message' : (count ? `Messages (${count})` : 'Messages') })
  } else if (kind === 'request' && en) {
    list.push({ id: 'overview', label: 'Overview' })
    if (en.params?.length) list.push({ id: 'params', label: `Params (${en.params.length})` })
    list.push({ id: 'requestHeaders', label: 'Headers' })
    if (en.requestBody) list.push({ id: 'requestBody', label: 'Body' })
  } else if (kind === 'response' && en) {
    list.push({ id: 'overview', label: 'Overview' })
    list.push({ id: 'responseHeaders', label: 'Headers' })
    list.push({ id: 'responseBody', label: 'Body' })
  } else if (isStoreBase.value) {
    list.push({ id: 'overview', label: 'Overview' })
    list.push({ id: 'state', label: 'State' })
  } else if (kind === 'store' || kind === 'props') {
    list.push({ id: 'changes', label: `Changes (${changes.value.length}${data.value.changesTruncated ? '+' : ''})` })
    list.push({ id: 'before', label: 'Before' })
    list.push({ id: 'after', label: 'After' })
  } else if (kind === 'action') {
    list.push({ id: 'overview', label: 'Overview' })
    list.push({ id: 'args', label: 'Arguments' })
    list.push({ id: 'result', label: data.value.status === 'error' ? 'Error' : 'Result' })
  } else if (kind === 'emit') {
    list.push({ id: 'args', label: `Arguments (${Array.isArray(data.value.args) ? data.value.args.length : 0})` })
    list.push({ id: 'overview', label: 'Overview' })
  } else {
    list.push({ id: 'overview', label: 'Overview' })
    if (kind === 'error' && data.value.stack) list.push({ id: 'stack', label: 'Stack' })
  }
  list.push({ id: 'raw', label: 'Raw' })
  return list
})

const activeSection = ref<SectionId>('overview')

watch(
  () => props.event.id,
  () => {
    const ids = sections.value.map(s => s.id)
    if (!ids.includes(activeSection.value)) activeSection.value = ids[0]
  },
  { immediate: true },
)

function stackTruncatedLabel(info: { frames: number; kept: number; head?: number; tail?: number }): string {
  if (info.head && info.tail) {
    return `Truncated: first ${info.head} and last ${info.tail} of ${info.frames} frames kept`
  }
  return `Truncated: top ${info.kept} of ${info.frames} frames kept`
}

const overviewRows = computed<Array<{ label: string; value: string }>>(() => {
  const d = data.value
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Time', value: formatLogDateTime(props.event.timestamp) },
  ]
  const en = entry.value
  switch (props.event.kind) {
    case 'store':
      rows.push({ label: 'Store', value: String(d.storeId) })
      if (d.op === 'init') rows.push({ label: 'Recorded', value: 'Store created while logging (initial state)' })
      else if (d.op === 'snapshot') rows.push({ label: 'Recorded', value: 'Logging started on an existing store (current state)' })
      else if (d.op === 'checkpoint') rows.push({ label: 'Recorded', value: `State after ${d.compacted} older changes compacted by the limits` })
      break
    case 'ws':
    case 'ws-sent':
    case 'ws-received':
    case 'ws-closed':
    case 'request':
    case 'response':
      if (!en) {
        rows.push({ label: 'Request', value: props.event.key })
        break
      }
      rows.push({ label: 'URL', value: String(en.url ?? '') })
      rows.push({ label: 'Method', value: String(en.method) })
      if (en.initiator === 'websocket' || en.method === 'WS' || props.event.kind === 'ws' || props.event.kind === 'ws-sent' || props.event.kind === 'ws-received' || props.event.kind === 'ws-closed') {
        const socket = en.websocket
        if (props.event.kind === 'ws-sent' || props.event.kind === 'ws-received') {
          rows.push({ label: 'Direction', value: props.event.kind === 'ws-sent' ? 'Sent' : 'Received' })
        }
        if (props.event.kind === 'ws-closed' || props.event.kind === 'response' || (props.event.kind !== 'ws-sent' && props.event.kind !== 'ws-received' && socket?.state === 'closed')) {
          const code = socket?.closeCode
          const status = code ? `Closed ${code}` : (en.statusText || 'Closed')
          rows.push({ label: 'Status', value: status })
          if (socket?.closeReason) rows.push({ label: 'Reason', value: socket.closeReason })
          if (socket?.reconnect === false) rows.push({ label: 'Reconnect', value: 'No automatic reconnect' })
        } else {
          rows.push({ label: 'Status', value: 'Open' })
        }
        rows.push({ label: 'Messages', value: String(socket?.frames.length ?? 0) })
        rows.push({ label: 'Duration', value: formatDurationMs(en.duration ?? 0) })
        rows.push({ label: 'Size', value: formatBytes(en.size ?? 0) })
        break
      }
      if (props.event.kind === 'response') {
        rows.push({ label: 'Status', value: en.error ? `Failed: ${en.error}` : `${en.status} ${en.statusText || ''}`.trim() })
        rows.push({ label: 'Duration', value: formatDurationMs(en.duration ?? 0) })
        rows.push({ label: 'Size', value: formatBytes(en.size ?? 0) })
      } else {
        rows.push({ label: 'Initiator', value: String(en.initiator) })
        if (en.authorization && en.authorization.type !== 'None') rows.push({ label: 'Authorization', value: String(en.authorization.type) })
      }
      break
    case 'action':
      rows.push({ label: 'Store', value: String(d.storeId) })
      rows.push({ label: 'Action', value: String(d.action) })
      rows.push({ label: 'Status', value: String(d.status) })
      rows.push({ label: 'Duration', value: formatDurationMs(Number(d.duration)) })
      break
    case 'emit':
      rows.push({ label: 'Component', value: String(d.component) })
      rows.push({ label: 'Event', value: String(d.event) })
      rows.push({ label: 'Listener', value: d.once ? 'once' : 'regular' })
      if (d.uid !== undefined) rows.push({ label: 'uid', value: String(d.uid) })
      if (d.parents) rows.push({ label: 'Parents', value: String(d.parents) })
      break
    case 'navigation':
      rows.push({ label: 'Type', value: String(d.navType) })
      rows.push({ label: 'From', value: String(d.from || '—') })
      rows.push({ label: 'To', value: String(d.to) })
      break
    case 'error':
      rows.push({ label: 'Source', value: String(d.source) })
      if (d.name) rows.push({ label: 'Name', value: String(d.name) })
      rows.push({ label: 'Message', value: String(d.message) })
      if (d.filename) rows.push({ label: 'Location', value: `${d.filename}:${d.lineno ?? 0}:${d.colno ?? 0}` })
      if (d.stackTruncated) rows.push({ label: 'Stack', value: stackTruncatedLabel(d.stackTruncated) })
      if (d.suppressedBefore) rows.push({ label: 'Suppressed', value: `${d.suppressedBefore} earlier console errors (more than 50 per second)` })
      break
  }
  return rows
})

/** Context line for store/props headers */
const contextLine = computed(() => {
  const d = data.value
  if (props.event.kind === 'store' && !isStoreBase.value) {
    const parts = [`Mutation: ${d.mutationType || 'direct'}`]
    if (Array.isArray(d.actions) && d.actions.length) parts.push(`Action: ${d.actions.join(', ')}`)
    return parts.join(' · ')
  }
  if (props.event.kind === 'props' || props.event.kind === 'emit') {
    const parts = [`uid ${d.uid}`]
    if (d.parents) parts.push(`Parents: ${d.parents}`)
    return parts.join(' · ')
  }
  return ''
})

/** Name/value rows of the Params and Headers sections */
const pairRows = computed<Array<{ name: string; value: string }> | null>(() => {
  const en = entry.value
  if (!en) return null
  switch (activeSection.value) {
    case 'params': return (en.params ?? []).map(p => ({ name: p.key, value: p.value }))
    case 'requestHeaders': return (en.requestHeaders ?? []).map(h => ({ name: h.name, value: h.value }))
    case 'responseHeaders': return (en.responseHeaders ?? []).map(h => ({ name: h.name, value: h.value }))
    default: return null
  }
})

const body = computed<BodyContent | null | undefined>(() => {
  if (activeSection.value === 'requestBody') return entry.value?.requestBody ?? null
  if (activeSection.value === 'responseBody') return entry.value?.responseBody ?? null
  return undefined
})

/** Message shown instead of a body that can't be rendered */
const bodyNotice = computed(() => {
  const b = body.value
  if (b === undefined) return ''
  if (!b || (!b.text && !b.formData?.length)) return entry.value?.pending ? 'Response is pending' : 'No body'
  if (b.isBinary) return activeSection.value === 'responseBody' ? '' : `Binary content (${b.contentType || 'unknown'})`
  return ''
})

function bodyBlock(b: BodyContent): { text: string; language: string } {
  if (b.formData?.length) return { text: toPrettyJson(b.formData), language: 'json' }
  const text = String(b.text ?? '')
  const trimmed = text.trim()
  if (/json/i.test(b.contentType || '') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return { text: JSON.stringify(JSON.parse(trimmed), null, 2), language: 'json' } } catch { /* not JSON */ }
  }
  return { text, language: 'plain' }
}

const binaryPreview = computed(() =>
  activeSection.value === 'responseBody' && body.value?.isBinary ? body.value : null
)

const jsonBlock = computed(() => {
  const d = data.value
  if (body.value && !body.value.isBinary && !bodyNotice.value) return bodyBlock(body.value)
  switch (activeSection.value) {
    case 'before': return { text: toPrettyJson(d.before), language: 'json' }
    case 'after': return { text: toPrettyJson(d.after), language: 'json' }
    case 'state': return { text: toPrettyJson(d.state), language: 'json' }
    case 'args': return { text: toPrettyJson(d.args ?? []), language: 'json' }
    case 'result': return { text: toPrettyJson(d.status === 'error' ? d.error : d.result ?? null), language: 'json' }
    case 'stack': return { text: String(d.stack ?? ''), language: 'plain' }
    case 'raw': return { text: toPrettyJson(view.value), language: 'json' }
    default: return null
  }
})

/** Payload part dropped by the per-event size limit (shown instead of the JSON block) */
const omittedPart = computed<OmittedValue | null>(() => {
  const d = data.value
  const value =
    activeSection.value === 'before' ? d.before
    : activeSection.value === 'after' ? d.after
    : activeSection.value === 'state' ? d.state
    : activeSection.value === 'args' ? d.args
    : activeSection.value === 'result' ? (d.status === 'error' ? d.error : d.result)
    : activeSection.value === 'changes' ? d.changes
    : undefined
  return isOmittedValue(value) ? value : null
})

function changeTypeClass(type: LogChange['type']): string {
  if (type === 'added') return 'text-green-500 border-green-500/40'
  if (type === 'removed') return 'text-red-500 border-red-500/40'
  return 'text-yellow-500 border-yellow-500/40'
}
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col">
      <!-- Header (right click opens the actions menu) -->
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div class="shrink-0 flex items-center gap-3 p-3 border-b">
            <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('back')">
              <ArrowLeft class="h-4 w-4" />
            </Button>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 min-w-0">
                <Badge variant="outline" class="text-xs whitespace-nowrap" :class="logBadgeClass(event)">
                  {{ view.label }}
                </Badge>
                <span class="font-semibold truncate" :title="view.title">{{ view.title }}</span>
              </div>
              <div class="text-sm truncate text-muted-foreground" :title="contextLine || view.subtitle">
                {{ contextLine || view.subtitle || formatLogDateTime(event.timestamp) }}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" size="icon" class="log-details-menu h-8 w-8 shrink-0">
                  <MoreHorizontal class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <LogActionsMenuContent
                variant="dropdown"
                :event="event"
                :related-label="relatedLabel"
                @export="emit('export', $event)"
                @copy-curl="emit('copyCurl', $event)"
                @ignore="emit('ignore', $event)"
                @open-related="emit('openRelated', $event)"
              />
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <LogActionsMenuContent
          variant="context"
          :event="event"
          :related-label="relatedLabel"
          @export="emit('export', $event)"
          @copy-curl="emit('copyCurl', $event)"
          @ignore="emit('ignore', $event)"
          @open-related="emit('openRelated', $event)"
        />
      </ContextMenu>

      <!-- Section tabs -->
      <ScrollArea class="shrink-0 border-b bg-muted/30">
        <div class="flex items-center gap-1 p-1 w-max">
          <button
            v-for="section in sections"
            :key="section.id"
            class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap"
            :class="{
              'bg-secondary text-secondary-foreground': activeSection === section.id,
              'hover:bg-secondary/50 text-muted-foreground': activeSection !== section.id
            }"
            @click="activeSection = section.id"
          >
            {{ section.label }}
          </button>
        </div>
      </ScrollArea>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <!-- Size-limited part -->
        <div v-if="omittedPart" class="h-full flex items-center justify-center p-6">
          <p class="max-w-md text-center text-sm text-muted-foreground">
            This part ({{ formatBytes(omittedPart.size) }}) was not saved: it exceeds the per-event limit of
            {{ formatBytes((data.__sizeLimited as { limit?: number } | undefined)?.limit ?? 0) }}.
            Increase “Max event size” in Options › Logs to keep it.
          </p>
        </div>

        <!-- State that cannot be restored -->
        <div v-else-if="unavailableNotice" class="h-full flex items-center justify-center p-6">
          <p class="max-w-md text-center text-sm text-muted-foreground">{{ unavailableNotice }}</p>
        </div>

        <!-- Overview -->
        <ScrollArea v-else-if="activeSection === 'overview'" class="h-full">
          <div class="p-3">
            <Table class="log-details-table">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">Name</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in overviewRows" :key="row.label">
                  <TableCell class="font-mono text-xs py-2 align-top">{{ row.label }}</TableCell>
                  <TableCell class="font-mono text-xs py-2 align-top">{{ row.value }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        <!-- Params / headers -->
        <ScrollArea v-else-if="pairRows" class="h-full">
          <div class="p-3">
            <div v-if="pairRows.length === 0" class="text-sm text-muted-foreground text-center py-8">
              {{ activeSection === 'params' ? 'No params' : 'No headers' }}
            </div>
            <Table v-else class="log-details-table">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">Name</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, i) in pairRows" :key="i">
                  <TableCell class="font-mono text-xs py-2 align-top">{{ row.name }}</TableCell>
                  <TableCell class="font-mono text-xs py-2 align-top">{{ row.value }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        <div v-else-if="binaryPreview" class="shrink-0 flex items-center gap-2 px-3 py-2 border-b">
          <span class="text-sm text-muted-foreground">{{ binaryPreview.contentType || 'application/octet-stream' }}</span>
          <span class="text-xs text-muted-foreground">({{ formatBytes(binaryPreview.originalSize) }})</span>
          <Badge variant="outline" class="text-xs">Binary</Badge>
        </div>

        <!-- Body that can't be shown -->
        <div v-else-if="bodyNotice" class="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
          {{ bodyNotice }}
        </div>

        <!-- Changes (diff) -->
        <ScrollArea v-else-if="activeSection === 'changes'" class="h-full">
          <div class="p-3">
            <div v-if="changes.length === 0" class="text-sm text-muted-foreground text-center py-8">
              No changes
            </div>
            <Table v-else class="log-details-table">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">Path</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(c, i) in changes" :key="i">
                  <TableCell class="font-mono text-xs py-2 align-top">
                    <div>{{ c.path }}</div>
                    <Badge variant="outline" class="mt-1 text-[10px] px-1.5 py-0 font-sans uppercase" :class="changeTypeClass(c.type)">
                      {{ c.type }}
                    </Badge>
                  </TableCell>
                  <TableCell class="font-mono text-xs py-2 align-top">
                    <div v-if="c.type !== 'added'" class="text-red-500/90">
                      − <template v-if="'before' in c">{{ previewValue(c.before) }}</template>
                      <span v-else class="italic text-muted-foreground">not available</span>
                    </div>
                    <div v-if="c.type !== 'removed'" class="text-green-500/90">
                      + <template v-if="'after' in c">{{ previewValue(c.after) }}</template>
                      <span v-else class="italic text-muted-foreground">not available</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div v-if="data.changesTruncated" class="pt-3 text-xs text-muted-foreground">
              Too many changes — list is truncated. See Before / After for full state.
            </div>
          </div>
        </ScrollArea>

        <ScrollArea v-else-if="activeSection === 'messages'" class="h-full">
          <div class="p-3 space-y-2">
            <div v-if="!messageFrames.length" class="text-sm text-muted-foreground text-center py-8">
              {{ event.data?.frameId ? 'This message is no longer in the connection log.' : 'No messages' }}
            </div>
            <div v-for="frame in messageFrames" :key="frame.id" class="rounded-md border px-3 py-2">
              <div class="flex items-center gap-2 text-xs">
                <span :class="frame.direction === 'sent' ? 'text-sky-400' : 'text-green-500'">
                  {{ frame.direction === 'sent' ? 'Sent' : 'Received' }}
                </span>
                <span class="text-muted-foreground">{{ formatBytes(frame.size) }}</span>
              </div>
              <pre v-if="frame.data" class="mt-1 mb-0 whitespace-pre-wrap break-all font-mono text-xs">{{ frameText(frame) }}</pre>
            </div>
          </div>
        </ScrollArea>

        <!-- JSON / text blocks -->
        <div v-else-if="jsonBlock" class="h-full flex flex-col">
          <div v-if="body?.truncated" class="shrink-0 px-3 py-2 border-b text-xs text-amber-500">
            Body truncated ({{ formatBytes(body.originalSize) }} originally)
          </div>
          <div class="flex-1 min-h-0">
            <JsonEditor
              :key="`${event.id}-${activeSection}`"
              :model-value="jsonBlock.text"
              :language="jsonBlock.language"
              :editable="false"
              :show-copy="true"
              :editor="jsonEditorImpl"
              :mode="jsonMode"
              :full-height="true"
              class="h-full"
              @update:mode="persistJsonMode"
            />
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.log-details-table :deep(td) {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
