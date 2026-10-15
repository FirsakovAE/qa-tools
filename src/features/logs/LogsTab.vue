<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Trash2, Pause, Play, SearchIcon, EyeOff, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FacetedFilter } from '@/components/ui/FacetedFilter'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
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
import { useLogs, ignoreRuleLabel } from './useLogs'
import { useLogsSearch } from './useLogsSearch'
import { exportLogEvent, exportLogs } from './exportLogs'
import { networkEntryOf, pairedNetworkEvent } from './view'

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
  removeIgnoreRule,
  clearIgnoreRules,
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

function handleExportLogs() {
  if (rowSelection.count.value === 0) {
    exportLogs(filteredEvents.value, source.value)
    return
  }
  const ids = new Set(rowSelection.checkedIds.value)
  exportLogs(filteredEvents.value.filter(e => ids.has(e.id)), source.value)
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

function handleExport(event: LogEvent) {
  exportLogEvent(event, source.value)
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

        <Popover v-if="ignoreRules.length > 0">
          <PopoverTrigger as-child>
            <Badge
              variant="outline"
              class="whitespace-nowrap cursor-pointer text-muted-foreground border-muted-foreground/35 hover:bg-muted/50"
            >
              <EyeOff class="h-3 w-3" />
              <span class="ml-1">{{ ignoreRules.length }}</span><span class="badge-label">ignored</span>
            </Badge>
          </PopoverTrigger>
          <PopoverContent class="w-96 p-0" align="end">
            <div class="flex items-center justify-between px-3 py-2 border-b">
              <span class="text-sm font-medium">Ignored events</span>
              <Button variant="ghost" size="sm" class="h-7 text-xs" @click="clearIgnoreRules">
                Clear all
              </Button>
            </div>
            <div class="max-h-72 overflow-y-auto py-1">
              <div
                v-for="rule in ignoreRules"
                :key="rule.id"
                class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50"
              >
                <Badge
                  variant="outline"
                  class="text-[10px] px-1.5 py-0 whitespace-nowrap shrink-0"
                  :class="LOG_KIND_META[rule.kind]?.badgeClass"
                >
                  {{ LOG_KIND_META[rule.kind]?.label ?? rule.kind }}
                </Badge>
                <span class="flex-1 min-w-0 truncate font-mono text-xs" :title="ignoreRuleLabel(rule)">{{ rule.key }}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 shrink-0"
                  title="Log these events again"
                  @click="removeIgnoreRule(rule.id)"
                >
                  <X class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

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
      <div class="h-full min-h-0 overflow-hidden outline-none" tabindex="-1" @keydown="rowSelection.handleKeydown">
        <LogsTable
          :events="filteredEvents"
          :source="source"
          :selected-id="selectedId"
          :checked-ids="rowSelection.checked.value"
          :header-check-state="rowSelection.headerState.value"
          @check="rowSelection.toggle"
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
