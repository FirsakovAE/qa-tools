<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Trash2, Pause, Play, SearchIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import NetworkTable from './NetworkTable.vue'
import NetworkDetails, { type BreakpointEditData } from './NetworkDetails.vue'
import MockForm from './MockForm.vue'
import BreakpointForm from './BreakpointForm.vue'
import type { NetworkEntry } from '@/types/network'
import type { BaseInspectorSettings, BreakpointItem, MockRule } from '@/types/inspector'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useCurlCopy } from '@/composables/useCurlCopy'
import { 
  useNetworkEntries, 
  useNetworkSearch, 
  useBreakpointState,
  useMockState,
  useNetworkUIState,
  type BreakpointDraft
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
}>()

// ============================================================================
// Settings
// ============================================================================

const settings = ref<BaseInspectorSettings | null>(null)

const searchSettings = computed(() => ({
  byName: settings.value?.search?.byName ?? true,
  byLabel: settings.value?.search?.byLabel ?? false,
  byKey: settings.value?.search?.byKey ?? false,
  byValue: settings.value?.search?.byValue ?? false,
  debounce: settings.value?.search?.debounce ?? 300,
  minLength: settings.value?.search?.minLength ?? 2
}))

const activeBreakpoints = computed<BreakpointItem[]>(() => 
  settings.value?.breakpoints?.active ?? []
)

const activeMocks = computed<MockRule[]>(() => 
  settings.value?.mocks?.active ?? []
)

// ============================================================================
// Composables
// ============================================================================

// Network entries management
const {
  entries,
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

// Search
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
  () => searchSettings.value
)

// Breakpoint state
const breakpointState = useBreakpointState(
  () => activeBreakpoints.value,
  () => entries.value,
  {
    sendCommand,
    getEntry
  }
)

// Mock state
const mockState = useMockState(
  () => activeMocks.value,
  { sendCommand },
  () => entries.value
)

// cURL copy
const { copyCurl } = useCurlCopy()

// UI State (persisted at module level)
const { selectedEntryId } = useNetworkUIState()

// ============================================================================
// UI State
// ============================================================================

const mockFormMode = ref(false)
const mockFormEntry = ref<NetworkEntry | null>(null)
const breakpointFormMode = ref(false)
const breakpointFormEntry = ref<NetworkEntry | null>(null)

// Pending breakpoint from Navigation
const pendingBreakpointToProcess = ref<PendingBreakpointFromNav | null>(null)

// ============================================================================
// Computed
// ============================================================================

// Get all pending breakpoint IDs in order of arrival (by timestamp)
const pendingBreakpointIds = computed(() => {
  const pending = Array.from(breakpointState.pendingBreakpoints.value.entries())
  pending.sort((a, b) => a[1].timestamp - b[1].timestamp)
  return pending.map(([id]) => id)
})

// The entry that should be shown in the right panel
// User can browse other entries, but breakpoints need attention
const activeEntryId = computed(() => {
  // If user has selected an entry, show it (even if there are pending breakpoints)
  if (selectedEntryId.value) {
    return selectedEntryId.value
  }
  // If no selection but there are pending breakpoints, auto-show first one
  if (pendingBreakpointIds.value.length > 0) {
    return pendingBreakpointIds.value[0]
  }
  return null
})

const selectedEntry = computed(() => {
  if (!activeEntryId.value) return null
  
  // First try to find in entries
  const entry = entries.value.find(e => e.id === activeEntryId.value)
  if (entry) {
    return deepClone({ ...entry, version: entry.version ?? 1 }) as NetworkEntry
  }
  
  // If not found but we have a pending breakpoint, construct entry from draft
  const draft = breakpointState.getBreakpointDraft(activeEntryId.value)
  if (draft) {
    // Construct a minimal entry from draft for display
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

// Check if currently showing a pending breakpoint
const isShowingPendingBreakpoint = computed(() => {
  return !!(activeEntryId.value && breakpointState.pendingBreakpoints.value.has(activeEntryId.value))
})

// ============================================================================
// Watchers
// ============================================================================

// Rebuild search index when entries change
watch(entries, () => {
  rebuildIndex()
}, { deep: true })

// Handle pending breakpoint from Navigation
watch(() => props.pendingBreakpoint, (pending) => {
  if (pending) {
    pendingBreakpointToProcess.value = pending
    emit('clearPendingBreakpoint')
  }
}, { immediate: true })

// Process pending breakpoint after ready
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

// Sync breakpoints when settings change
watch(activeBreakpoints, () => {
  breakpointState.syncBreakpoints()
}, { deep: true })

// Sync mocks when settings change
watch(activeMocks, () => {
  mockState.syncMocks()
}, { deep: true })

// Auto-select first pending breakpoint when new breakpoints arrive
watch(pendingBreakpointIds, (newIds, oldIds) => {
  // If a new breakpoint was added
  if (newIds.length > (oldIds?.length ?? 0)) {
    const newBreakpointId = newIds.find(id => !oldIds?.includes(id))
    if (newBreakpointId) {
      // If no entry is selected or current selection is not a pending breakpoint, select the new one
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
    // Initial sync after settings load
    setTimeout(() => {
      breakpointState.syncBreakpoints()
      mockState.syncMocks()
    }, 100)
  } catch {
    // Use defaults
  }
})

// ============================================================================
// Handlers
// ============================================================================

function clearEntries() {
  clearEntriesBase()
  selectedEntryId.value = null
  clearIndex()
}

function selectEntry(id: string) {
  if (mockFormMode.value && mockFormEntry.value?.id !== id) {
    mockFormMode.value = false
    mockFormEntry.value = null
  }
  if (breakpointFormMode.value && breakpointFormEntry.value?.id !== id) {
    breakpointFormMode.value = false
    breakpointFormEntry.value = null
  }
  selectedEntryId.value = id
}

function deselectEntry() {
  // If there are pending breakpoints, switch to the first one instead of fully deselecting
  if (pendingBreakpointIds.value.length > 0) {
    selectedEntryId.value = pendingBreakpointIds.value[0]
  } else {
    selectedEntryId.value = null
  }
}

function selectFirstPendingBreakpoint() {
  if (pendingBreakpointIds.value.length > 0) {
    // Close any open forms
    mockFormMode.value = false
    mockFormEntry.value = null
    breakpointFormMode.value = false
    breakpointFormEntry.value = null
    // Select the first pending breakpoint
    selectedEntryId.value = pendingBreakpointIds.value[0]
  }
}

function handleSetBreakpoint(entry: NetworkEntry) {
  selectedEntryId.value = entry.id
  breakpointFormEntry.value = entry
  breakpointFormMode.value = true
}

function handleBreakpointFormBack() {
  breakpointFormMode.value = false
  breakpointFormEntry.value = null
}

function handleBreakpointConfirm(breakpoint: BreakpointItem) {
  if (!settings.value?.breakpoints) return
  settings.value.breakpoints.active.push(breakpoint)
  breakpointFormMode.value = false
  breakpointFormEntry.value = null
}

function handleMockResponse(entry: NetworkEntry) {
  selectedEntryId.value = entry.id
  mockFormEntry.value = entry
  mockFormMode.value = true
}

function handleMockFormBack() {
  mockFormMode.value = false
  mockFormEntry.value = null
}

function handleMockConfirm(mock: MockRule) {
  if (!settings.value) return
  if (!settings.value.mocks) {
    settings.value.mocks = { active: [], inactive: [] }
  }
  settings.value.mocks.active.push(mock)
  mockState.syncMocks()
  mockFormMode.value = false
  mockFormEntry.value = null
}

function handleCopyCurl(entry: NetworkEntry) {
  copyCurl(entry)
}

function handleApplyBreakpoint(data: BreakpointEditData) {
  breakpointState.applyBreakpoint(data.entryId)
  // After applying, switch to next pending breakpoint or deselect
  switchToNextBreakpointOrDeselect(data.entryId)
}

function handleCancelBreakpoint(entryId: string) {
  breakpointState.cancelBreakpoint(entryId)
  // After cancelling, switch to next pending breakpoint or deselect
  switchToNextBreakpointOrDeselect(entryId)
}

function switchToNextBreakpointOrDeselect(resolvedEntryId: string) {
  // Get remaining pending breakpoints (excluding the one just resolved)
  const remaining = pendingBreakpointIds.value.filter(id => id !== resolvedEntryId)
  if (remaining.length > 0) {
    // Switch to the next pending breakpoint
    selectedEntryId.value = remaining[0]
  } else {
    // No more pending breakpoints, deselect
    selectedEntryId.value = null
  }
}

function handleDraftUpdate(updates: Partial<BreakpointDraft>) {
  if (!activeEntryId.value) return
  breakpointState.updateDraft(activeEntryId.value, updates)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="shrink-0 flex items-center gap-2 p-2 border-b">
      <h3 class="text-lg font-semibold shrink-0">Network</h3>
      
      <!-- Search bar -->
      <div class="flex-1 max-w-xs relative">
        <Input
          v-model="searchTerm"
          placeholder="Search requests..."
          class="pl-8 h-8"
        />
        <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
      </div>
      
      <!-- Search type badges -->
      <div v-if="activeSearchTypes.length" class="flex items-center gap-1">
        <Badge v-for="item in activeSearchTypes" :key="item" variant="secondary" class="text-xs px-1.5 py-0">
          {{ item }}
        </Badge>
      </div>
      
      <div class="flex-1" />
      
      <!-- Status badges and controls -->
      <div class="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" class="font-mono">
          {{ entriesCount }}<span v-if="searchTerm && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
        </Badge>
        <Badge v-if="pendingCount > 0" variant="outline" class="text-yellow-500 border-yellow-500/30">
          {{ pendingCount }} pending
        </Badge>
        <Badge 
          v-if="pendingBreakpointIds.length > 0" 
          variant="outline" 
          class="text-amber-500 border-amber-500/30 animate-pulse cursor-pointer hover:bg-amber-500/10 transition-colors"
          @click="selectFirstPendingBreakpoint"
        >
          {{ pendingBreakpointIds.length }} breakpoint{{ pendingBreakpointIds.length > 1 ? 's' : '' }}
        </Badge>
        <Badge v-if="paused" variant="outline" class="text-orange-500 border-orange-500/30">
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
    <div class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden">
      <!-- Left: Table -->
      <div class="h-full min-h-0 overflow-hidden">
        <NetworkTable
          :entries="filteredEntries"
          :selected-id="selectedEntryId"
          :breakpoint-entry-ids="breakpointState.breakpointEntryIds.value"
          :breakpoint-matching-ids="breakpointState.entriesMatchingBreakpoints.value"
          :mock-matching-ids="mockState.entriesMatchingMocks.value"
          @select="selectEntry"
          @set-breakpoint="handleSetBreakpoint"
          @copy-curl="handleCopyCurl"
          @mock-response="handleMockResponse"
        />
      </div>
      
      <!-- Right: Details / MockForm / BreakpointForm -->
      <div class="h-full min-h-0 overflow-hidden border rounded-lg" :class="{ 
        'ring-2 ring-amber-500': isShowingPendingBreakpoint || breakpointFormMode,
        'ring-2 ring-purple-500': mockFormMode
      }">
        <MockForm
          v-if="mockFormMode && mockFormEntry"
          :entry="mockFormEntry"
          @back="handleMockFormBack"
          @confirm="handleMockConfirm"
        />
        
        <BreakpointForm
          v-else-if="breakpointFormMode && breakpointFormEntry"
          :entry="breakpointFormEntry"
          @back="handleBreakpointFormBack"
          @confirm="handleBreakpointConfirm"
        />
        
        <NetworkDetails
          v-else-if="selectedEntry"
          :entry="selectedEntry"
          :breakpoint-mode="isShowingPendingBreakpoint"
          :breakpoint-trigger="breakpointState.breakpointTrigger.value"
          :breakpoint-draft="currentBreakpointDraft"
          @back="deselectEntry"
          @cancel-breakpoint="handleCancelBreakpoint"
          @apply-breakpoint="handleApplyBreakpoint"
          @update-draft="handleDraftUpdate"
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
