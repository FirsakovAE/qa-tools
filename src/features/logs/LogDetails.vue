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
import { useI18n } from '@/i18n'

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

const { t } = useI18n()

useEscapeClose(computed(() => true), () => emit('back'))

const settings = useInspectorSettingsSync()
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
  if (props.related.kind === 'ws-closed') return t('log.openClose')
  if (props.related.kind === 'ws') return t('log.openConnection')
  return props.related.kind === 'response' ? t('log.openResponse') : t('log.openRequest')
})

const changes = computed<LogChange[]>(() => (Array.isArray(data.value.changes) ? data.value.changes : []))

/** Explanation shown instead of a state that cannot be restored */
const unavailableNotice = computed(() => {
  const section = activeSection.value
  if (section === 'state' && missing.value.state) return t('log.stateNotSaved')
  if (section === 'before' && missing.value.before) return t('log.beforeMissing')
  if (section === 'after' && missing.value.after) return t('log.afterMissing')
  if (missing.value.entry && section !== 'raw') return t('log.entryGone')
  return ''
})

const sections = computed(() => {
  const list: Array<{ id: SectionId; label: string }> = []
  const kind = props.event.kind
  const en = entry.value
  const socket = kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed' || en?.initiator === 'websocket' || en?.method === 'WS'
  const overview = () => ({ id: 'overview' as const, label: t('common.overview') })
  if ((kind === 'request' || kind === 'response' || kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed') && !en) {
    list.push(overview())
  } else if (socket && en) {
    list.push(overview())
    const responseHeaders = kind === 'response' || kind === 'ws-received' || kind === 'ws-closed'
    list.push({ id: responseHeaders ? 'responseHeaders' : 'requestHeaders', label: t('common.headers') })
    const ownFrame = kind === 'ws-sent' || kind === 'ws-received'
    const count = ownFrame ? 1 : (en.websocket?.frames.length ?? 0)
    const messages = t('log.messages')
    list.push({ id: 'messages', label: ownFrame ? t('common.message') : (count ? `${messages} (${count})` : messages) })
  } else if (kind === 'request' && en) {
    list.push(overview())
    if (en.params?.length) list.push({ id: 'params', label: t('log.params', { n: en.params.length }) })
    list.push({ id: 'requestHeaders', label: t('common.headers') })
    if (en.requestBody) list.push({ id: 'requestBody', label: t('common.body') })
  } else if (kind === 'response' && en) {
    list.push(overview())
    list.push({ id: 'responseHeaders', label: t('common.headers') })
    list.push({ id: 'responseBody', label: t('common.body') })
  } else if (isStoreBase.value) {
    list.push(overview())
    list.push({ id: 'state', label: t('common.state') })
  } else if (kind === 'store' || kind === 'props') {
    list.push({ id: 'changes', label: data.value.changesTruncated ? t('log.changesMore', { n: changes.value.length }) : t('log.changes', { n: changes.value.length }) })
    list.push({ id: 'before', label: t('common.before') })
    list.push({ id: 'after', label: t('common.after') })
  } else if (kind === 'action') {
    list.push(overview())
    list.push({ id: 'args', label: t('common.arguments') })
    list.push({ id: 'result', label: data.value.status === 'error' ? t('common.error') : t('common.result') })
  } else if (kind === 'emit') {
    const argCount = Array.isArray(data.value.args) ? data.value.args.length : 0
    list.push({ id: 'args', label: `${t('common.arguments')} (${argCount})` })
    list.push(overview())
  } else {
    list.push(overview())
    if (kind === 'error' && data.value.stack) list.push({ id: 'stack', label: t('common.stack') })
  }
  list.push({ id: 'raw', label: t('common.raw') })
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
    return t('log.truncEnds', { head: info.head, tail: info.tail, frames: info.frames })
  }
  return t('log.truncTop', { kept: info.kept, frames: info.frames })
}

const overviewRows = computed<Array<{ label: string; value: string }>>(() => {
  const d = data.value
  const rows: Array<{ label: string; value: string }> = [
    { label: t('common.time'), value: formatLogDateTime(props.event.timestamp) },
  ]
  const en = entry.value
  switch (props.event.kind) {
    case 'store':
      rows.push({ label: t('common.store'), value: String(d.storeId) })
      if (d.op === 'init') rows.push({ label: t('log.recorded'), value: t('log.recordedInit') })
      else if (d.op === 'snapshot') rows.push({ label: t('log.recorded'), value: t('log.recordedSnapshot') })
      else if (d.op === 'checkpoint') rows.push({ label: t('log.recorded'), value: t('log.recordedCheckpoint', { n: d.compacted }) })
      break
    case 'ws':
    case 'ws-sent':
    case 'ws-received':
    case 'ws-closed':
    case 'request':
    case 'response':
      if (!en) {
        rows.push({ label: t('common.request'), value: props.event.key })
        break
      }
      rows.push({ label: t('picker.url'), value: String(en.url ?? '') })
      rows.push({ label: t('common.method'), value: String(en.method) })
      if (en.initiator === 'websocket' || en.method === 'WS' || props.event.kind === 'ws' || props.event.kind === 'ws-sent' || props.event.kind === 'ws-received' || props.event.kind === 'ws-closed') {
        const socket = en.websocket
        if (props.event.kind === 'ws-sent' || props.event.kind === 'ws-received') {
          rows.push({ label: t('log.direction'), value: props.event.kind === 'ws-sent' ? t('common.sent') : t('common.received') })
        }
        if (props.event.kind === 'ws-closed' || props.event.kind === 'response' || (props.event.kind !== 'ws-sent' && props.event.kind !== 'ws-received' && socket?.state === 'closed')) {
          const code = socket?.closeCode
          const status = code ? t('status.closedCode', { code }) : (en.statusText || t('status.closed'))
          rows.push({ label: t('common.status'), value: status })
          if (socket?.closeReason) rows.push({ label: t('common.reason'), value: socket.closeReason })
          if (socket?.reconnect === false) rows.push({ label: t('log.reconnect'), value: t('log.noReconnect') })
        } else {
          rows.push({ label: t('common.status'), value: t('log.open') })
        }
        rows.push({ label: t('log.messages'), value: String(socket?.frames.length ?? 0) })
        rows.push({ label: t('common.duration'), value: formatDurationMs(en.duration ?? 0) })
        rows.push({ label: t('general.size'), value: formatBytes(en.size ?? 0) })
        break
      }
      if (props.event.kind === 'response') {
        rows.push({ label: t('common.status'), value: en.error ? t('log.failed', { message: en.error }) : `${en.status} ${en.statusText || ''}`.trim() })
        rows.push({ label: t('common.duration'), value: formatDurationMs(en.duration ?? 0) })
        rows.push({ label: t('general.size'), value: formatBytes(en.size ?? 0) })
      } else {
        rows.push({ label: t('log.initiator'), value: String(en.initiator) })
        if (en.authorization && en.authorization.type !== 'None') rows.push({ label: t('log.authorization'), value: String(en.authorization.type) })
      }
      break
    case 'action':
      rows.push({ label: t('common.store'), value: String(d.storeId) })
      rows.push({ label: t('common.action'), value: String(d.action) })
      rows.push({ label: t('common.status'), value: String(d.status) })
      rows.push({ label: t('common.duration'), value: formatDurationMs(Number(d.duration)) })
      break
    case 'emit':
      rows.push({ label: t('common.component'), value: String(d.component) })
      rows.push({ label: t('common.event'), value: String(d.event) })
      rows.push({ label: t('log.listener'), value: d.once ? t('log.listenerOnce') : t('log.listenerRegular') })
      if (d.uid !== undefined) rows.push({ label: 'uid', value: String(d.uid) })
      if (d.parents) rows.push({ label: t('log.parents'), value: String(d.parents) })
      break
    case 'navigation':
      rows.push({ label: t('common.type'), value: String(d.navType) })
      rows.push({ label: t('common.from'), value: String(d.from || '—') })
      rows.push({ label: t('common.to'), value: String(d.to) })
      break
    case 'click':
      rows.push({ label: t('editor.text'), value: String(d.text || '—') })
      if (d.selector) rows.push({ label: t('log.selector'), value: String(d.selector) })
      if (d.id) rows.push({ label: t('log.id'), value: String(d.id) })
      if (d.testId) rows.push({ label: String(d.testAttr || 'data-testid'), value: String(d.testId) })
      if (d.ariaLabel) rows.push({ label: 'aria-label', value: String(d.ariaLabel) })
      if (d.title) rows.push({ label: 'title', value: String(d.title) })
      if (d.href) rows.push({ label: 'href', value: String(d.href) })
      if (d.type) rows.push({ label: 'type', value: String(d.type) })
      else if (d.inputType) rows.push({ label: t('log.input'), value: String(d.inputType) })
      if (d.className) rows.push({ label: 'class', value: String(d.className) })
      rows.push({ label: 'XPath', value: String(d.xpath || '—') })
      if (d.tag) rows.push({ label: t('log.tag'), value: String(d.tag) })
      break
    case 'error':
      rows.push({ label: t('common.source'), value: String(d.source) })
      if (d.name) rows.push({ label: t('general.name'), value: String(d.name) })
      rows.push({ label: t('common.message'), value: String(d.message) })
      if (d.filename) rows.push({ label: t('common.location'), value: `${d.filename}:${d.lineno ?? 0}:${d.colno ?? 0}` })
      if (d.stackTruncated) rows.push({ label: t('common.stack'), value: stackTruncatedLabel(d.stackTruncated) })
      if (d.suppressedBefore) rows.push({ label: t('log.suppressedLabel'), value: t('log.suppressed', { n: d.suppressedBefore }) })
      break
  }
  return rows
})

/** Context line for store/props headers */
const contextLine = computed(() => {
  const d = data.value
  if (props.event.kind === 'store' && !isStoreBase.value) {
    const parts = [t('log.mutation', { type: d.mutationType || 'direct' })]
    if (Array.isArray(d.actions) && d.actions.length) parts.push(`${t('common.action')}: ${d.actions.join(', ')}`)
    return parts.join(' · ')
  }
  if (props.event.kind === 'props' || props.event.kind === 'emit') {
    const parts = [`uid ${d.uid}`]
    if (d.parents) parts.push(`${t('log.parents')}: ${d.parents}`)
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
  if (!b || (!b.text && !b.formData?.length)) return entry.value?.pending ? t('log.responsePending') : t('log.noBody')
  if (b.isBinary) return activeSection.value === 'responseBody' ? '' : t('log.binaryTyped', { contentType: b.contentType || 'unknown' })
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
            {{ t('log.partDropped', { size: formatBytes(omittedPart.size), limit: formatBytes((data.__sizeLimited as { limit?: number } | undefined)?.limit ?? 0) }) }}
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
                  <TableHead class="w-1/3">{{ t('general.name') }}</TableHead>
                  <TableHead>{{ t('common.value') }}</TableHead>
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
              {{ activeSection === 'params' ? t('log.noParams') : t('log.noHeaders') }}
            </div>
            <Table v-else class="log-details-table">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">{{ t('general.name') }}</TableHead>
                  <TableHead>{{ t('common.value') }}</TableHead>
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
          <Badge variant="outline" class="text-xs">{{ t('common.binary') }}</Badge>
        </div>

        <!-- Body that can't be shown -->
        <div v-else-if="bodyNotice" class="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
          {{ bodyNotice }}
        </div>

        <!-- Changes (diff) -->
        <ScrollArea v-else-if="activeSection === 'changes'" class="h-full">
          <div class="p-3">
            <div v-if="changes.length === 0" class="text-sm text-muted-foreground text-center py-8">
              {{ t('common.noChanges') }}
            </div>
            <Table v-else class="log-details-table">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">{{ t('common.path') }}</TableHead>
                  <TableHead>{{ t('common.change') }}</TableHead>
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
                      <span v-else class="italic text-muted-foreground">{{ t('log.notAvailable') }}</span>
                    </div>
                    <div v-if="c.type !== 'removed'" class="text-green-500/90">
                      + <template v-if="'after' in c">{{ previewValue(c.after) }}</template>
                      <span v-else class="italic text-muted-foreground">{{ t('log.notAvailable') }}</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div v-if="data.changesTruncated" class="pt-3 text-xs text-muted-foreground">
              {{ t('log.tooManyChanges') }}
            </div>
          </div>
        </ScrollArea>

        <ScrollArea v-else-if="activeSection === 'messages'" class="h-full">
          <div class="p-3 space-y-2">
            <div v-if="!messageFrames.length" class="text-sm text-muted-foreground text-center py-8">
              {{ event.data?.frameId ? t('log.messageGone') : t('log.noMessages') }}
            </div>
            <div v-for="frame in messageFrames" :key="frame.id" class="rounded-md border px-3 py-2">
              <div class="flex items-center gap-2 text-xs">
                <span :class="frame.direction === 'sent' ? 'text-sky-400' : 'text-green-500'">
                  {{ frame.direction === 'sent' ? t('common.sent') : t('common.received') }}
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
            {{ t('log.bodyTruncated', { size: formatBytes(body.originalSize) }) }}
          </div>
          <div class="flex-1 min-h-0">
            <JsonEditor
              :key="`${event.id}-${activeSection}`"
              :model-value="jsonBlock.text"
              :language="jsonBlock.language"
              :editable="false"
              :show-copy="true"
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
