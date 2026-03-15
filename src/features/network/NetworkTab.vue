<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Trash2, Pause, Play, SearchIcon, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FacetedFilter } from '@/components/ui/FacetedFilter'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import NetworkTable from './NetworkTable.vue'
import NetworkDetails from './NetworkDetails.vue'
import MockForm from './MockForm.vue'
import BreakpointForm from './BreakpointForm.vue'
import type { NetworkEntry } from '@/types/network'
import type { BaseInspectorSettings, BreakpointItem, MockRule } from '@/types/inspector'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useCurlCopy } from '@/composables/useCurlCopy'
import { downloadPostmanCollection } from '@/utils/networkUtils'
import { 
  useNetworkEntries, 
  useNetworkSearch, 
  useBreakpointState,
  useMockState,
  useNetworkUIState,
  useNetworkHandlers,
  type BreakpointDraft,
  type BreakpointEditData,
} from './composables'
import { deepClone } from './utils'

// ============================================================================
// Props & Emits
// ============================================================================

interface PendingBreakpointFromNav {
  requestId: string
  trigger: 'request' | 'response'
  entry?: any
}

const props = defineProps<{
  pendingBreakpoint?: PendingBreakpointFromNav | null
}>()

const emit = defineEmits<{
  (e: 'clearPendingBreakpoint'): void
  (e: 'navigateToOptions', anchor: string): void
}>()

// ============================================================================
// Settings
// ============================================================================

const settings = ref<BaseInspectorSettings | null>(null)

const searchSettings = computed(() => ({
  byPath: settings.value?.networkSearch?.byPath ?? true,
  byMethod: settings.value?.networkSearch?.byMethod ?? true,
  byStatus: settings.value?.networkSearch?.byStatus ?? false,
  byKey: settings.value?.networkSearch?.byKey ?? false,
  byValue: settings.value?.networkSearch?.byValue ?? false,
  debounce: settings.value?.searchParams?.debounce ?? 300,
  minLength: settings.value?.searchParams?.minLength ?? 2
}))

const activeBreakpoints = computed<BreakpointItem[]>(() => 
  settings.value?.breakpoints?.active ?? []
)

const activeMocks = computed<MockRule[]>(() => 
  settings.value?.mocks?.active ?? []
)

const allBreakpointsWithStatus = computed(() => [
  ...(settings.value?.breakpoints?.active ?? []).map(bp => ({ ...bp, isActive: true })),
  ...(settings.value?.breakpoints?.inactive ?? []).map(bp => ({ ...bp, isActive: false })),
])

const allMocksWithStatus = computed(() => [
  ...(settings.value?.mocks?.active ?? []).map(m => ({ ...m, isActive: true })),
  ...(settings.value?.mocks?.inactive ?? []).map(m => ({ ...m, isActive: false })),
])

// ============================================================================
// Composables
// ============================================================================

const {
  entries,
  entriesVersion,
  paused,
  isReady,
  totalCount,
  pendingCount,
  sendCommand,
  togglePause,
  clearEntries: clearEntriesBase,
  addEntry,
  getEntry,
  normalizeEntry
} = useNetworkEntries({
  onBreakpointHit: (requestId, trigger, entry) => {
    if (entry) {
      addEntry(normalizeEntry(entry))
    }
    breakpointState.handleBreakpointHit(requestId, trigger)
  }
})

type NetworkSearchKey = 'byPath' | 'byMethod' | 'byStatus' | 'byKey' | 'byValue'
const searchTypeMap: Record<string, NetworkSearchKey> = {
  'Path': 'byPath',
  'Method': 'byMethod',
  'Status code': 'byStatus',
  'Key': 'byKey',
  'Value': 'byValue',
}
const searchTypeOptions = Object.keys(searchTypeMap)

const selectedSearchTypes = computed<string[]>({
  get() {
    if (!settings.value?.networkSearch) return []
    return searchTypeOptions.filter(label => settings.value!.networkSearch[searchTypeMap[label]] as boolean)
  },
  set(selected: string[]) {
    if (!settings.value?.networkSearch) return
    for (const label of searchTypeOptions) {
      const key = searchTypeMap[label]
      ;(settings.value.networkSearch as any)[key] = selected.includes(label)
    }
  }
})

const {
  searchTerm,
  filteredEntries,
  activeSearchTypes,
  addToIndex,
  removeFromIndex,
  clearIndex,
  rebuildIndex
} = useNetworkSearch(
  () => entries.value,
  () => searchSettings.value,
  entriesVersion
)

const breakpointState = useBreakpointState(
  () => activeBreakpoints.value,
  () => entries.value,
  { sendCommand, getEntry }
)

const mockState = useMockState(
  () => activeMocks.value,
  { sendCommand },
  () => entries.value
)

const { copyCurl } = useCurlCopy()
const { selectedEntryId } = useNetworkUIState()

// Pending breakpoint from Navigation
const pendingBreakpointToProcess = ref<PendingBreakpointFromNav | null>(null)

// ============================================================================
// Computed
// ============================================================================

const pendingBreakpointIds = computed(() => {
  const pending = Array.from(breakpointState.pendingBreakpoints.value.entries())
  pending.sort((a, b) => a[1].timestamp - b[1].timestamp)
  return pending.map(([id]) => id)
})

const activeEntryId = computed(() => {
  if (selectedEntryId.value) return selectedEntryId.value
  if (pendingBreakpointIds.value.length > 0) return pendingBreakpointIds.value[0]
  return null
})

const selectedEntry = computed(() => {
  void entriesVersion.value
  if (!activeEntryId.value) return null
  const entry = getEntry(activeEntryId.value)
  if (entry) {
    return deepClone({ ...entry, version: entry.version ?? 1 }) as NetworkEntry
  }
  const draft = breakpointState.getBreakpointDraft(activeEntryId.value)
  if (draft) {
    const fullUrl = `${draft.scheme}://${draft.host}${draft.path}`
    const constructedEntry: NetworkEntry = {
      id: draft.entryId,
      version: 1,
      timestamp: new Date().toISOString(),
      method: draft.method,
      url: fullUrl,
      path: draft.path,
      name: draft.path.split('/').pop() || draft.path,
      status: 0,
      statusText: 'Breakpoint',
      duration: 0,
      size: 0,
      requestHeaders: draft.requestHeaders.map(h => ({ name: h.name, value: h.value })),
      responseHeaders: draft.responseHeaders.map(h => ({ name: h.name, value: h.value })),
      params: draft.params,
      authorization: { type: 'None' },
      requestBody: draft.requestBody ? { text: draft.requestBody, contentType: 'application/json', originalSize: draft.requestBody.length, truncated: false, isBinary: false } : null,
      responseBody: draft.responseBody ? { text: draft.responseBody, contentType: 'application/json', originalSize: draft.responseBody.length, truncated: false, isBinary: false } : null,
      pending: true,
      initiator: 'fetch'
    }
    return constructedEntry
  }
  return null
})

const entriesCount = computed(() => filteredEntries.value.length)

const currentBreakpointDraft = computed<BreakpointDraft | null>(() => {
  if (!activeEntryId.value) return null
  return breakpointState.getBreakpointDraft(activeEntryId.value)
})

const isShowingPendingBreakpoint = computed(() => {
  return !!(activeEntryId.value && breakpointState.pendingBreakpoints.value.has(activeEntryId.value))
})

// ============================================================================
// Handlers (composable)
// ============================================================================

const handlers = useNetworkHandlers({
  settings,
  selectedEntryId,
  pendingBreakpointIds,
  activeBreakpoints,
  activeMocks,
  breakpointState,
  mockState,
  clearEntriesBase,
  clearIndex,
  copyCurl,
  activeEntryId,
})

const {
  mockFormMode,
  mockFormEntry,
  mockFormExisting,
  breakpointFormMode,
  breakpointFormEntry,
  breakpointFormExisting,
  clearEntries,
  selectEntry,
  deselectEntry,
  selectFirstPendingBreakpoint,
  handleSetBreakpoint,
  handleBreakpointFormBack,
  handleBreakpointConfirm,
  handleMockResponse,
  handleMockFormBack,
  handleMockConfirm,
  handleCopyCurl,
  handleToggleBreakpoint,
  handleDeleteBreakpoint,
  handleToggleMock,
  handleDeleteMock,
  handleApplyBreakpoint,
  handleCancelBreakpoint,
  handleDraftUpdate,
} = handlers

// ============================================================================
// Watchers
// ============================================================================

watch(entriesVersion, () => { rebuildIndex() })

watch(() => props.pendingBreakpoint, (pending) => {
  if (pending) {
    pendingBreakpointToProcess.value = pending
    emit('clearPendingBreakpoint')
  }
}, { immediate: true })

watch([isReady, pendingBreakpointToProcess], ([ready, pending]) => {
  if (ready && pending) {
    if (pending.entry) {
      const existingIndex = entries.value.findIndex(e => e.id === pending.requestId)
      if (existingIndex === -1) {
        addEntry(normalizeEntry(pending.entry))
        addToIndex(normalizeEntry(pending.entry))
      }
    }
    breakpointState.handleBreakpointHit(pending.requestId, pending.trigger)
    selectedEntryId.value = pending.requestId
    pendingBreakpointToProcess.value = null
  }
}, { immediate: true })

watch(activeBreakpoints, () => { breakpointState.syncBreakpoints() }, { deep: true })
watch(activeMocks, () => { mockState.syncMocks() }, { deep: true })

watch(pendingBreakpointIds, (newIds, oldIds) => {
  if (newIds.length > (oldIds?.length ?? 0)) {
    const newBreakpointId = newIds.find(id => !oldIds?.includes(id))
    if (newBreakpointId) {
      if (!selectedEntryId.value || !newIds.includes(selectedEntryId.value)) {
        selectedEntryId.value = newBreakpointId
      }
    }
  }
}, { immediate: true })

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
    if (settings.value && !settings.value.mocks) {
      settings.value.mocks = { active: [], inactive: [] }
    }
    setTimeout(() => {
      breakpointState.syncBreakpoints()
      mockState.syncMocks()
    }, 100)
  } catch {
    // Use defaults
  }
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="shrink-0 flex flex-wrap items-center gap-2 p-2 border-b toolbar-container" :class="{ 'toolbar-hide-on-details': selectedEntry || mockFormMode || breakpointFormMode }">
      <!-- Left block: Title + Search + Filter + Export (inline) -->
      <div class="flex items-center gap-2 toolbar-left-block">
        <h3 class="text-lg font-semibold shrink-0 toolbar-title">Network</h3>
        
        <!-- Search bar (stays left) -->
        <div class="flex-1 min-w-[155px] max-w-xs relative">
          <Input
            v-model="searchTerm"
            placeholder="Search requests..."
            class="pl-8 h-8"
          />
          <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
        </div>
        
        <!-- Search by + subsequent elements (right-aligned when header wraps to 2 rows) -->
        <div class="flex items-center gap-2 toolbar-row1-right">
          <!-- Search type filter -->
          <FacetedFilter
            v-model="selectedSearchTypes"
            title="Search by"
            :options="searchTypeOptions"
          />

          <!-- Export (inline — hidden when toolbar is narrow) -->
          <div class="export-inline">
            <TooltipProvider>
              <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  :disabled="filteredEntries.length === 0"
                  @click="downloadPostmanCollection(filteredEntries)"
                >
                  <Upload class="h-3.5 w-3.5" />
                  <span class="text-xs font-medium">Export Collection</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Export filtered requests as Postman collection
              </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      
      <!-- Right block: Status badges and controls -->
      <div class="flex items-center gap-2 shrink-0 ml-auto toolbar-right-block">
        <!-- Export (wrapped — shown when toolbar is narrow) -->
        <div class="hidden export-wrapped">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  :disabled="filteredEntries.length === 0"
                  @click="downloadPostmanCollection(filteredEntries)"
                >
                  <Upload class="h-3.5 w-3.5" />
                  <span class="text-xs font-medium">Export Collection</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Export filtered requests as Postman collection
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="hidden flex-1 export-spacer" />

        <Badge variant="secondary" class="font-mono">
          {{ entriesCount }}<span v-if="searchTerm && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
        </Badge>
        <Badge v-if="pendingCount > 0" variant="outline" class="whitespace-nowrap text-yellow-500 border-yellow-500/30">
          {{ pendingCount }}<span class="badge-label">pending</span>
        </Badge>
        <Badge 
          v-if="pendingBreakpointIds.length > 0" 
          variant="outline" 
          class="whitespace-nowrap text-amber-500 border-amber-500/30 animate-pulse cursor-pointer hover:bg-amber-500/10 transition-colors"
          @click="selectFirstPendingBreakpoint"
        >
          {{ pendingBreakpointIds.length }}<span class="badge-label">bp</span>
        </Badge>
        <Badge 
          v-if="activeBreakpoints.length > 0" 
          variant="outline" 
          class="whitespace-nowrap text-amber-500 border-amber-500/30 cursor-pointer hover:bg-amber-500/10 transition-colors"
          @click="emit('navigateToOptions', 'breakpoints-section')"
        >
          {{ activeBreakpoints.length }}<span class="badge-label">bp</span>
        </Badge>
        <Badge 
          v-if="activeMocks.length > 0" 
          variant="outline" 
          class="whitespace-nowrap text-purple-500 border-purple-500/30 cursor-pointer hover:bg-purple-500/10 transition-colors"
          @click="emit('navigateToOptions', 'mocks-section')"
        >
          {{ activeMocks.length }}<span class="badge-label">mock</span>
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
              {{ paused ? 'Resume recording' : 'Pause recording' }}
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
                @click="clearEntries"
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
      <!-- Left: Table -->
      <div class="h-full min-h-0 overflow-hidden">
        <NetworkTable
          :entries="filteredEntries"
          :selected-id="selectedEntryId"
          :breakpoint-entry-ids="breakpointState.breakpointEntryIds.value"
          :breakpoint-matching-ids="breakpointState.entriesMatchingBreakpoints.value"
          :mock-matching-ids="mockState.entriesMatchingMocks.value"
          :all-breakpoints="allBreakpointsWithStatus"
          :all-mocks="allMocksWithStatus"
          @select="selectEntry"
          @set-breakpoint="handleSetBreakpoint"
          @copy-curl="handleCopyCurl"
          @mock-response="handleMockResponse"
          @toggle-breakpoint="handleToggleBreakpoint"
          @delete-breakpoint="handleDeleteBreakpoint"
          @toggle-mock="handleToggleMock"
          @delete-mock="handleDeleteMock"
        />
      </div>
      
      <!-- Right: Details / MockForm / BreakpointForm -->
      <div class="h-full min-h-0 overflow-hidden border rounded-lg details-panel" :class="{ 
        'ring-2 ring-amber-500': isShowingPendingBreakpoint || breakpointFormMode,
        'ring-2 ring-purple-500': mockFormMode,
        'details-active': selectedEntry || mockFormMode || breakpointFormMode
      }">
        <MockForm
          v-if="mockFormMode && mockFormEntry"
          :entry="mockFormEntry"
          :existing-mock="mockFormExisting ?? undefined"
          @back="handleMockFormBack"
          @confirm="handleMockConfirm"
        />
        
        <BreakpointForm
          v-else-if="breakpointFormMode && breakpointFormEntry"
          :entry="breakpointFormEntry"
          :existing-breakpoint="breakpointFormExisting ?? undefined"
          @back="handleBreakpointFormBack"
          @confirm="handleBreakpointConfirm"
        />
        
        <NetworkDetails
          v-else-if="selectedEntry"
          :entry="selectedEntry"
          :breakpoint-mode="isShowingPendingBreakpoint"
          :breakpoint-trigger="breakpointState.breakpointTrigger.value"
          :breakpoint-draft="currentBreakpointDraft"
          :breakpoint-matching-ids="breakpointState.entriesMatchingBreakpoints.value"
          :mock-matching-ids="mockState.entriesMatchingMocks.value"
          :all-breakpoints="allBreakpointsWithStatus"
          :all-mocks="allMocksWithStatus"
          @back="deselectEntry"
          @cancel-breakpoint="handleCancelBreakpoint"
          @apply-breakpoint="handleApplyBreakpoint"
          @update-draft="handleDraftUpdate"
          @copy-curl="handleCopyCurl"
          @set-breakpoint="handleSetBreakpoint"
          @mock-response="handleMockResponse"
          @toggle-breakpoint="handleToggleBreakpoint"
          @delete-breakpoint="handleDeleteBreakpoint"
          @toggle-mock="handleToggleMock"
          @delete-mock="handleDeleteMock"
        />
        
        <div
          v-else
          class="h-full flex items-center justify-center text-muted-foreground"
        >
          Select a request to see details
        </div>
      </div>
    </div>
  </div>
</template>
