<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Trash2, Pause, Play, SearchIcon, EyeOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FacetedFilter } from '@/components/ui/FacetedFilter'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { useCurlCopy } from '@/composables/useCurlCopy'
import { useRowSelection } from '@/composables/useRowSelection'
import type { LogEvent, LogKind } from '@/types/logs'
import { LOG_KINDS, LOG_KIND_META } from '@/types/logs'
import { toast } from '@/components/ui/Toaster'
import LogsTable from './LogsTable.vue'
import LogDetails from './LogDetails.vue'
import ExportLogsMenu from './ExportLogsMenu.vue'
import { useLogs } from './useLogs'
import { useLogsSearch } from './useLogsSearch'
import { exportLogEvent, exportLogs } from './exportLogs'
import { networkEntryOf, pairedNetworkEvent } from './view'
import { canCompressReport } from './report/compressSupport'
import { pendingLogsEvent } from './logsNavigation'

const emit = defineEmits<{
  (e: 'navigateToOptions', anchor: string): void
}>()

const settings = useInspectorSettingsSync()

const {
  events,
  source,
  totalCount,
  paused,
  ignoreRules,
  togglePause,
  clearEvents,
  getEvent,
  ignoreEvent,
} = useLogs()

const { curlCopied, copyCurl } = useCurlCopy(() => settings.value ?? undefined)

// ============================================================================
// Filters
// ============================================================================

const kindByLabel = Object.fromEntries(LOG_KINDS.map(k => [LOG_KIND_META[k].label, k])) as Record<string, LogKind>
const typeOptions = LOG_KINDS.map(k => LOG_KIND_META[k].label)
// All types are shown by default; deselecting every type shows nothing
const selectedTypes = ref<string[]>([...typeOptions])

const selectedKinds = computed(() => new Set(selectedTypes.value.map(l => kindByLabel[l])))
const allTypesSelected = computed(() => LOG_KINDS.every(k => selectedKinds.value.has(k)))

const kindFiltered = computed(() => {
  if (allTypesSelected.value) return events.value
  const kinds = selectedKinds.value
  return events.value.filter(e => kinds.has(e.kind))
})

const { searchTerm, filtered: filteredEvents, isSearching } = useLogsSearch(kindFiltered, source, settings)

const filteredCount = computed(() => filteredEvents.value.length)
const isFiltered = computed(() => isSearching.value || !allTypesSelected.value)

// ============================================================================
// Export
// ============================================================================

const rowSelection = useRowSelection(() => filteredEvents.value.map(e => e.id))

/** The other half of a Send request / Receive response pair, when it is in the log */
function httpPairId(id: string): string | null {
  const event = getEvent(id)
  if (!event || (event.kind !== 'request' && event.kind !== 'response')) return null
  const pair = pairedNetworkEvent(event, source.value, getEvent)
  if (!pair || pair.id === id || (pair.kind !== 'request' && pair.kind !== 'response')) return null
  return pair.id
}

/**
 * Checking a network event also checks its request or response.
 * Unchecking clears that pair, so the export count matches the file.
 */
function handleCheck(id: string, event: MouseEvent) {
  const before = rowSelection.checked.value
  rowSelection.toggle(id, event)
  const after = rowSelection.checked.value
  if (before === after) return

  const changed = new Set<string>([id])
  if (event.shiftKey) {
    for (const item of before) if (!after.has(item)) changed.add(item)
    for (const item of after) if (!before.has(item)) changed.add(item)
  }

  const next = new Set(after)
  let paired = false
  for (const item of changed) {
    const pair = httpPairId(item)
    if (!pair) continue
    if (next.has(item)) {
      if (!next.has(pair)) {
        next.add(pair)
        paired = true
      }
    } else if (next.has(pair)) {
      next.delete(pair)
      paired = true
    }
  }
  if (paired) rowSelection.replace(next)
}

const exportOptions = computed(() => ({ compress: canCompressReport() && settings.value?.logsExport?.compress !== false }))

/** Ticked rows, or every event passing the filters */
function eventsToExport(): LogEvent[] {
  if (rowSelection.count.value === 0) return filteredEvents.value
  const ids = new Set(rowSelection.checkedIds.value)
  return filteredEvents.value.filter(e => ids.has(e.id))
}

function handleExportLogs() {
  void exportLogs(eventsToExport(), source.value, exportOptions.value)
}

// ============================================================================
// Selection & actions
// ============================================================================

const selectedId = ref<string | null>(null)
const selectedEvent = computed(() => (selectedId.value ? getEvent(selectedId.value) ?? null : null))

/** Send request / Receive response events of one network entry */
function pairOf(event: LogEvent | null): LogEvent | null {
  return pairedNetworkEvent(event, source.value, getEvent)
}

const relatedEvent = computed(() => pairOf(selectedEvent.value))

const emptyMessage = computed(() => {
  if (selectedTypes.value.length === 0) return 'No event types selected — enable them in the Type filter'
  if (isFiltered.value && events.value.length > 0) return 'No events match the filters'
  return 'No events logged yet'
})

watch(events, list => {
  if (selectedId.value && !list.some(e => e.id === selectedId.value)) selectedId.value = null
})

const table = ref<InstanceType<typeof LogsTable> | null>(null)

// An event opened from another tab (AI answers): filters that hide it are cleared
watch(pendingLogsEvent, id => {
  if (!id) return
  pendingLogsEvent.value = null
  if (!getEvent(id)) {
    toast.error('The event is no longer in the logs')
    return
  }
  selectedId.value = id
  const shown = () => filteredEvents.value.some(e => e.id === id)
  if (shown()) {
    void nextTick(() => table.value?.reveal(id))
    return
  }
  searchTerm.value = ''
  selectedTypes.value = [...typeOptions]
  // The search term is applied after its debounce
  const stop = watch(filteredEvents, () => {
    if (!shown()) return
    stop()
    void nextTick(() => table.value?.reveal(id))
  })
}, { immediate: true })

function handleExport(event: LogEvent) {
  void exportLogEvent(event, source.value, exportOptions.value)
}

function handleCopyCurl(event: LogEvent) {
  // Both events share the entry, so a response event also has its request data
  const entry = networkEntryOf(event, source.value)
  if (!entry) {
    toast.error('The network entry of this event is no longer in the logs')
    return
  }
  copyCurl(entry)
}

function handleIgnore(event: LogEvent) {
  if (selectedId.value === event.id) selectedId.value = null
  ignoreEvent(event)
}

function handleClear() {
  selectedId.value = null
  rowSelection.clear()
  clearEvents()
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="shrink-0 flex flex-wrap items-center gap-2 p-2 border-b toolbar-container" :class="{ 'toolbar-hide-on-details': selectedEvent }">
      <div class="flex items-center gap-2 toolbar-left-block">
        <h3 class="text-lg font-semibold shrink-0 toolbar-title">Logs</h3>

        <div class="flex-1 min-w-[155px] max-w-xs relative">
          <Input
            v-model="searchTerm"
            placeholder="Search events..."
            class="pl-8 h-8"
          />
          <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
        </div>

        <div class="flex items-center gap-2 toolbar-row1-right">
          <FacetedFilter
            v-model="selectedTypes"
            title="Type"
            :options="typeOptions"
            :max-badges="1"
            all-label="All"
          >
            <template #footer>
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 flex-1 text-xs"
                  :disabled="allTypesSelected"
                  @click="selectedTypes = [...typeOptions]"
                >
                  Select all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 flex-1 text-xs"
                  :disabled="selectedTypes.length === 0"
                  @click="selectedTypes = []"
                >
                  Clear
                </Button>
              </div>
            </template>
          </FacetedFilter>

          <div class="export-inline flex items-center gap-2">
            <ExportLogsMenu :count="filteredEvents.length" :selected="rowSelection.count.value" @export="handleExportLogs" />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0 ml-auto toolbar-right-block">
        <div class="hidden export-wrapped space-x-2">
          <ExportLogsMenu :count="filteredEvents.length" :selected="rowSelection.count.value" @export="handleExportLogs" />
        </div>
        <div class="hidden flex-1 export-spacer" />

        <Badge variant="secondary" class="font-mono">
          {{ filteredCount }}<span v-if="isFiltered && filteredCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
        </Badge>

        <Badge
          v-if="ignoreRules.length > 0"
          variant="outline"
          class="whitespace-nowrap cursor-pointer text-muted-foreground border-muted-foreground/35 hover:bg-muted/50"
          @click="emit('navigateToOptions', 'logs-ignore-section')"
        >
          <EyeOff class="h-3 w-3" />
          <span class="ml-1">{{ ignoreRules.length }}</span><span class="badge-label">ignored</span>
        </Badge>

        <Badge v-if="paused" variant="outline" class="whitespace-nowrap text-orange-500 border-orange-500/30">
          Paused
        </Badge>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :class="{ 'text-orange-500': paused }"
                @click="togglePause"
              >
                <Pause v-if="!paused" class="h-4 w-4" />
                <Play v-else class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {{ paused ? 'Resume logging' : 'Pause logging' }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :disabled="totalCount === 0"
                @click="handleClear"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Clear all
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden responsive-panels">
      <div class="h-full min-h-0 overflow-hidden">
        <LogsTable
          ref="table"
          :events="filteredEvents"
          :source="source"
          :selected-id="selectedId"
          :checked-ids="rowSelection.checked.value"
          :header-check-state="rowSelection.headerState.value"
          @check="handleCheck"
          @check-all="rowSelection.toggleAll"
          :empty-message="emptyMessage"
          @select="selectedId = $event"
          @export="handleExport"
          @copy-curl="handleCopyCurl"
          @ignore="handleIgnore"
        />
      </div>

      <div
        class="h-full min-h-0 overflow-hidden border rounded-lg details-panel"
        :class="{ 'details-active': selectedEvent }"
      >
        <LogDetails
          v-if="selectedEvent"
          :event="selectedEvent"
          :source="source"
          :related="relatedEvent"
          @back="selectedId = null"
          @export="handleExport"
          @copy-curl="handleCopyCurl"
          @ignore="handleIgnore"
          @open-related="relatedEvent && (selectedId = relatedEvent.id)"
        />
        <div
          v-else
          class="h-full flex items-center justify-center text-muted-foreground"
        >
          Select an event to see details
        </div>
      </div>
    </div>
  </div>
</template>
