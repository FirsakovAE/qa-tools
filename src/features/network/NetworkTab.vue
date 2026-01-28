<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useCurlCopy } from '@/composables/useCurlCopy'
import { useDebounceFn } from '@vueuse/core'
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
import BreakpointDialog from './BreakpointDialog.vue'
import MockDialog from './MockDialog.vue'
import type { NetworkEntry, NetworkConfig } from '@/types/network'
import { DEFAULT_NETWORK_CONFIG } from '@/types/network'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import type { BaseInspectorSettings, BreakpointItem, BreakpointTrigger, MockRule } from '@/types/inspector'

// ============================================================================
// Props & Emits
// ============================================================================

interface PendingBreakpointFromNav {
  requestId: string
  trigger: 'request' | 'response'
  entry?: any // Raw entry data from injected script
}

const props = defineProps<{
  pendingBreakpoint?: PendingBreakpointFromNav | null
}>()

const emit = defineEmits<{
  (e: 'clearPendingBreakpoint'): void
}>()

// ============================================================================
// State
// ============================================================================

const entries = ref<NetworkEntry[]>([])
const paused = ref(false)
const config = ref<NetworkConfig>({ ...DEFAULT_NETWORK_CONFIG })
const selectedEntryId = ref<string | null>(null)
const isReady = ref(false)

// Search state
const searchTerm = ref('')
const settings = ref<BaseInspectorSettings | null>(null)

// cURL copy (shared logic with NetworkDetails)
const { copyCurl } = useCurlCopy()

// Search index for fast lookup (minimal CPU)
interface SearchIndexEntry {
  entryId: string
  name: string
  method: string
  requestBodyKeys: string[]
  requestBodyValues: string[]
  responseBodyKeys: string[]
  responseBodyValues: string[]
}
const searchIndex = ref<SearchIndexEntry[]>([])

// ============================================================================
// Breakpoint State
// ============================================================================

const breakpointDialogOpen = ref(false)
const breakpointDialogEntry = ref<NetworkEntry | null>(null)

// Mock dialog state (Map Local feature) - deprecated, keeping for fallback
const mockDialogOpen = ref(false)
const mockDialogEntry = ref<NetworkEntry | null>(null)

// Mock form mode (inline in right panel)
const mockFormMode = ref(false)
const mockFormEntry = ref<NetworkEntry | null>(null)

// Current breakpoint mode state
const breakpointMode = ref(false)
const breakpointTrigger = ref<'request' | 'response' | undefined>(undefined)
const breakpointEntryIds = ref<Set<string>>(new Set())

// Pending breakpoints (entries waiting for user action)
interface PendingBreakpoint {
  entryId: string
  trigger: 'request' | 'response'
  timestamp: number
}
const pendingBreakpoints = ref<Map<string, PendingBreakpoint>>(new Map())

// Breakpoint drafts - EDITABLE data separate from entries (source of truth for editing)
interface BreakpointDraft {
  entryId: string
  trigger: 'request' | 'response'
  params: Array<{ key: string; value: string }>
  requestHeaders: Array<{ name: string; value: string }>
  responseHeaders: Array<{ name: string; value: string }>
  requestBody: string
  responseBody: string
}
const breakpointDrafts = ref<Map<string, BreakpointDraft>>(new Map())

// ============================================================================
// Settings
// ============================================================================

// Load settings and sync breakpoints/mocks
onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
    
    // Initialize mocks if not present
    if (settings.value && !settings.value.mocks) {
      settings.value.mocks = { active: [], inactive: [] }
    }
    
    // Sync breakpoints and mocks to injected script after settings load
    // Use nextTick to ensure reactive updates are complete
    setTimeout(() => {
      syncBreakpointsToInjected()
      syncMocksToInjected()
    }, 100)
  } catch {
    // Use defaults
  }
})

// Store pending breakpoint to process after entries load
const pendingBreakpointToProcess = ref<PendingBreakpointFromNav | null>(null)

// Handle pending breakpoint from Navigation (when switching from another tab)
watch(() => props.pendingBreakpoint, (pending) => {
  if (pending) {
    console.log('[NetworkTab] Received pending breakpoint from Navigation:', pending)
    // Store it to process after component is ready
    pendingBreakpointToProcess.value = pending
    // Clear in parent immediately to prevent re-processing
    emit('clearPendingBreakpoint')
  }
}, { immediate: true })

// Process pending breakpoint after entries are loaded
watch([() => isReady.value, pendingBreakpointToProcess], ([ready, pending]) => {
  if (ready && pending) {
    console.log('[NetworkTab] Processing pending breakpoint after ready:', pending)
    
    // If entry data is provided and not in list, add it
    if (pending.entry) {
      const existingIndex = entries.value.findIndex(e => e.id === pending.requestId)
      if (existingIndex === -1) {
        const entry = normalizeEntry(pending.entry)
        entries.value = [...entries.value, entry]
        addToIndex(entry)
        console.log('[NetworkTab] Added pending entry to list:', pending.requestId)
      }
    }
    
    // Activate breakpoint mode with the pending info
    handleBreakpointHit(pending.requestId, pending.trigger)
    
    // Clear the stored pending
    pendingBreakpointToProcess.value = null
  }
}, { immediate: true })

// Search settings from inspector settings
const searchSettings = computed(() => ({
  byName: settings.value?.search?.byName ?? true,
  byLabel: settings.value?.search?.byLabel ?? false, // Method
  byKey: settings.value?.search?.byKey ?? false,
  byValue: settings.value?.search?.byValue ?? false,
  debounce: settings.value?.search?.debounce ?? 300,
  minLength: settings.value?.search?.minLength ?? 2
}))

// Active breakpoints from settings
const activeBreakpoints = computed<BreakpointItem[]>(() => {
  return settings.value?.breakpoints?.active ?? []
})

// ============================================================================
// Breakpoint Matching Logic (UI-side)
// ============================================================================

/**
 * Match a NetworkEntry against a BreakpointItem
 * This parses the entry.url and compares against breakpoint fields
 */
function matchesBreakpoint(entry: NetworkEntry, bp: BreakpointItem): boolean {
  if (!bp.enabled) return false
  
  try {
    const urlObj = new URL(entry.url)
    
    // Check scheme (http, https)
    if (bp.scheme) {
      const urlScheme = urlObj.protocol.replace(':', '')
      if (urlScheme.toLowerCase() !== bp.scheme.toLowerCase()) {
        return false
      }
    }
    
    // Check host (supports wildcard *)
    if (bp.host) {
      const hostPattern = bp.host
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '.*') // Convert * to .*
      const hostRegex = new RegExp(`^${hostPattern}$`, 'i')
      if (!hostRegex.test(urlObj.hostname)) {
        return false
      }
    }
    
    // Check port (if specified)
    if (bp.port) {
      const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
      if (urlPort !== bp.port) {
        return false
      }
    }
    
    // Check path (startsWith, supports wildcard *)
    if (bp.path) {
      const pathPattern = bp.path
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '.*') // Convert * to .*
      const pathRegex = new RegExp(`^${pathPattern}`, 'i') // Starts with (partial match allowed)
      if (!pathRegex.test(urlObj.pathname)) {
        return false
      }
    }
    
    // Check query (partial match if specified)
    if (bp.query) {
      const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : ''
      if (!searchWithoutPrefix) return false
      
      // Support wildcard in query
      const queryPattern = bp.query
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      const queryRegex = new RegExp(queryPattern, 'i')
      if (!queryRegex.test(searchWithoutPrefix)) {
        return false
      }
    }
    
    return true
  } catch {
    return false
  }
}

/**
 * Find the first matching breakpoint for an entry
 */
function findMatchingBreakpoint(entry: NetworkEntry): BreakpointItem | null {
  for (const bp of activeBreakpoints.value) {
    if (matchesBreakpoint(entry, bp)) {
      return bp
    }
  }
  return null
}

/**
 * Computed set of entry IDs that match any active breakpoint
 * Used for highlighting rows in the table
 */
const entriesMatchingBreakpoints = computed<Set<string>>(() => {
  const matchingIds = new Set<string>()
  
  for (const entry of entries.value) {
    if (findMatchingBreakpoint(entry)) {
      matchingIds.add(entry.id)
    }
  }
  
  return matchingIds
})

/**
 * Current breakpoint draft for selected entry
 * This is the SOURCE OF TRUTH for editing - not selectedEntry!
 */
const currentBreakpointDraft = computed<BreakpointDraft | null>(() => {
  if (!selectedEntryId.value) return null
  return breakpointDrafts.value.get(selectedEntryId.value) || null
})

/**
 * Handle draft updates from NetworkDetails
 */
function handleDraftUpdate(updates: Partial<BreakpointDraft>) {
  if (!selectedEntryId.value) return
  
  const draft = breakpointDrafts.value.get(selectedEntryId.value)
  if (!draft) return
  
  // Update draft in place
  breakpointDrafts.value.set(selectedEntryId.value, {
    ...draft,
    ...updates
  })
}

// ============================================================================
// Breakpoint Sync to Injected Script
// ============================================================================

/**
 * Convert BreakpointItem to BreakpointConfig format for injected script
 */
function convertBreakpointsForSync(breakpoints: BreakpointItem[]) {
  return breakpoints.map(bp => ({
    id: bp.id,
    scheme: bp.scheme,
    host: bp.host,
    port: bp.port,
    path: bp.path,
    query: bp.query,
    trigger: bp.trigger,
    enabled: bp.enabled
  }))
}

/**
 * Sync breakpoints to injected script
 */
function syncBreakpointsToInjected() {
  const breakpointsToSync = convertBreakpointsForSync(activeBreakpoints.value)
  // Use JSON.parse/stringify to ensure plain objects without Vue Proxy wrappers
  const plainBreakpoints = JSON.parse(JSON.stringify(breakpointsToSync))
  console.log('[VueInspector UI] Syncing breakpoints to injected:', plainBreakpoints.length)
  sendNetworkCommand('NETWORK_BREAKPOINTS_SYNC', {
    breakpoints: plainBreakpoints
  })
}

// Watch for breakpoint changes and sync to injected script
watch(activeBreakpoints, () => {
  syncBreakpointsToInjected()
}, { deep: true })

// ============================================================================
// Mock (Map Local) Sync to Injected Script
// ============================================================================

// Active mocks from settings
const activeMocks = computed<MockRule[]>(() => {
  return settings.value?.mocks?.active ?? []
})

/**
 * Convert MockRule to MockConfig format for injected script
 */
function convertMocksForSync(mocks: MockRule[]) {
  return mocks.map(m => ({
    id: m.id,
    enabled: m.enabled,
    scheme: m.scheme,
    host: m.host,
    port: m.port,
    path: m.path,
    query: m.query,
    method: m.method,
    status: m.status || 200,
    statusText: m.statusText || 'OK',
    headers: m.headers || [],
    body: m.body || '',
    delay: m.delay
  }))
}

/**
 * Sync mocks to injected script
 */
function syncMocksToInjected() {
  const mocksToSync = convertMocksForSync(activeMocks.value)
  const plainMocks = JSON.parse(JSON.stringify(mocksToSync))
  console.log('[VueInspector UI] 🎭 Syncing mocks to injected:', plainMocks.length)
  if (plainMocks.length > 0) {
    console.log('[VueInspector UI] 🎭 First mock:', {
      id: plainMocks[0].id,
      host: plainMocks[0].host,
      path: plainMocks[0].path,
      status: plainMocks[0].status,
      bodyLength: plainMocks[0].body?.length,
      headersCount: plainMocks[0].headers?.length
    })
  }
  sendNetworkCommand('NETWORK_MOCKS_SYNC', {
    mocks: plainMocks
  })
}

// Watch for mock changes and sync to injected script
watch(activeMocks, () => {
  syncMocksToInjected()
}, { deep: true })

/**
 * Handle mock response - show MockForm in right panel
 */
function handleMockResponse(entry: NetworkEntry) {
  // Select the entry and enter mock form mode
  selectedEntryId.value = entry.id
  mockFormEntry.value = entry
  mockFormMode.value = true
}

/**
 * Handle back from MockForm - return to details view
 */
function handleMockFormBack() {
  mockFormMode.value = false
  mockFormEntry.value = null
}

/**
 * Handle mock confirmation from dialog or form
 */
function handleMockConfirm(mock: MockRule) {
  if (!settings.value) return
  
  // Initialize mocks if not present
  if (!settings.value.mocks) {
    settings.value.mocks = { active: [], inactive: [] }
  }
  
  // Add mock to active list
  settings.value.mocks.active.push(mock)
  
  console.log('[VueInspector UI] 🎭 Mock created:', mock.id, 'for', mock.host, mock.path)
  console.log('[VueInspector UI] 🎭 Mock body length:', mock.body?.length, 'headers:', mock.headers?.length)
  
  // Force sync to injected script immediately
  syncMocksToInjected()
  
  // Close dialog (deprecated)
  mockDialogOpen.value = false
  mockDialogEntry.value = null
  
  // Close mock form mode and return to details
  mockFormMode.value = false
  mockFormEntry.value = null
}

/**
 * Handle breakpoint hit - pause request and open details
 */
function handleBreakpointHit(entryId: string, trigger: 'request' | 'response') {
  // Find the entry to create draft from
  const entry = entries.value.find(e => e.id === entryId)
  
  // Add to pending breakpoints
  pendingBreakpoints.value.set(entryId, {
    entryId,
    trigger,
    timestamp: Date.now()
  })
  
  // Track this entry as having a breakpoint
  breakpointEntryIds.value.add(entryId)
  
  // Create breakpoint draft - this is the SOURCE OF TRUTH for editing
  // Isolated from entries[] updates
  if (entry) {
    breakpointDrafts.value.set(entryId, {
      entryId,
      trigger,
      params: JSON.parse(JSON.stringify(entry.params || [])),
      requestHeaders: JSON.parse(JSON.stringify(entry.requestHeaders || [])),
      responseHeaders: JSON.parse(JSON.stringify(entry.responseHeaders || [])),
      requestBody: entry.requestBody?.text || '',
      responseBody: entry.responseBody?.text || ''
    })
    console.log('[NetworkTab] Created breakpoint draft for:', entryId)
  }
  
  // Select the entry to show details
  selectedEntryId.value = entryId
  
  // Enable breakpoint mode
  breakpointMode.value = true
  breakpointTrigger.value = trigger
  
  // Try to expand/focus the app if minimized
  tryExpandApp()
}

/**
 * Try to expand the app if minimized (iframe communication)
 */
function tryExpandApp() {
  window.parent?.postMessage({
    __VUE_INSPECTOR__: true,
    message: {
      type: 'EXPAND_INSPECTOR',
      __VUE_INSPECTOR__: true
    }
  }, '*')
}

/**
 * Handle breakpoint dialog open
 */
function handleSetBreakpoint(entry: NetworkEntry) {
  breakpointDialogEntry.value = entry
  breakpointDialogOpen.value = true
}

function handleCopyCurl(entry: NetworkEntry) {
  copyCurl(entry)
}

/**
 * Handle breakpoint confirmation from dialog
 */
function handleBreakpointConfirm(breakpoint: BreakpointItem) {
  if (!settings.value?.breakpoints) return
  
  // Add breakpoint to active list
  settings.value.breakpoints.active.push(breakpoint)
  
  // Close dialog
  breakpointDialogOpen.value = false
  breakpointDialogEntry.value = null
}

/**
 * Handle apply from NetworkDetails (resume request with modifications)
 * Uses breakpointDrafts as SOURCE OF TRUTH - not the data parameter!
 */
function handleApplyBreakpoint(data: BreakpointEditData) {
  const entryId = data.entryId
  const pending = pendingBreakpoints.value.get(entryId)
  const draft = breakpointDrafts.value.get(entryId)
  
  console.log('[NetworkTab] Apply breakpoint:', { entryId, trigger: pending?.trigger })
  console.log('[NetworkTab] Using draft:', draft)
  
  // Build modifications from DRAFT (not from data parameter!)
  const modifications: Record<string, any> = {}
  
  if (draft && pending) {
    if (pending.trigger === 'request') {
      // Request breakpoint - can modify request data
      if (draft.requestHeaders?.length) {
        modifications.requestHeaders = draft.requestHeaders
      }
      if (draft.params?.length) {
        modifications.params = draft.params
      }
      if (draft.requestBody) {
        modifications.requestBody = draft.requestBody
      }
    } else if (pending.trigger === 'response') {
      // Response breakpoint - can modify response data
      if (draft.responseHeaders?.length) {
        modifications.responseHeaders = draft.responseHeaders
      }
      if (draft.responseBody) {
        modifications.responseBody = draft.responseBody
      }
    }
  }
  
  console.log('[NetworkTab] Sending modifications:', modifications)
  
  // Send resume command with modifications to injected script
  // Use JSON serialization to ensure plain objects without Vue Proxy wrappers
  const plainModifications = Object.keys(modifications).length > 0 
    ? JSON.parse(JSON.stringify(modifications)) 
    : undefined
  
  sendNetworkCommand('NETWORK_BREAKPOINT_RESUME', {
    requestId: entryId,
    modifications: plainModifications
  })
  
  // Clean up
  pendingBreakpoints.value.delete(entryId)
  breakpointEntryIds.value.delete(entryId)
  breakpointDrafts.value.delete(entryId)
  
  // Reset breakpoint mode if no more pending
  if (pendingBreakpoints.value.size === 0) {
    breakpointMode.value = false
    breakpointTrigger.value = undefined
  }
  
  // Deselect entry
  selectedEntryId.value = null
}

// ============================================================================
// Search Index (minimal CPU via event-based updates)
// ============================================================================

function extractJsonKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return []
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    keys.push(fullKey.toLowerCase())
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...extractJsonKeys(obj[key], fullKey))
    }
  }
  return keys
}

function extractJsonValues(obj: any): string[] {
  if (!obj || typeof obj !== 'object') return []
  const values: string[] = []
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val !== null && val !== undefined) {
      if (typeof val === 'object') {
        values.push(...extractJsonValues(val))
      } else {
        values.push(String(val).toLowerCase())
      }
    }
  }
  return values
}

function buildIndexEntry(entry: NetworkEntry): SearchIndexEntry {
  let requestBodyKeys: string[] = []
  let requestBodyValues: string[] = []
  let responseBodyKeys: string[] = []
  let responseBodyValues: string[] = []
  
  try {
    if (entry.requestBody?.text) {
      const parsed = JSON.parse(entry.requestBody.text)
      requestBodyKeys = extractJsonKeys(parsed)
      requestBodyValues = extractJsonValues(parsed)
    }
  } catch { /* ignore */ }
  
  try {
    if (entry.responseBody?.text) {
      const parsed = JSON.parse(entry.responseBody.text)
      responseBodyKeys = extractJsonKeys(parsed)
      responseBodyValues = extractJsonValues(parsed)
    }
  } catch { /* ignore */ }
  
  return {
    entryId: entry.id,
    name: entry.path.toLowerCase(),
    method: entry.method.toLowerCase(),
    requestBodyKeys,
    requestBodyValues,
    responseBodyKeys,
    responseBodyValues
  }
}

function addToIndex(entry: NetworkEntry) {
  // Remove old entry if exists
  searchIndex.value = searchIndex.value.filter(e => e.entryId !== entry.id)
  // Add new
  searchIndex.value.push(buildIndexEntry(entry))
}

function removeFromIndex(entryId: string) {
  searchIndex.value = searchIndex.value.filter(e => e.entryId !== entryId)
}

function clearIndex() {
  searchIndex.value = []
}

function rebuildIndex() {
  searchIndex.value = entries.value.map(buildIndexEntry)
}

// ============================================================================
// Filtered Entries (using index for speed)
// ============================================================================

const debouncedSearchTerm = ref('')

const updateDebouncedSearch = useDebounceFn((term: string) => {
  debouncedSearchTerm.value = term
}, searchSettings.value.debounce)

watch(searchTerm, (term) => {
  if (term.length >= searchSettings.value.minLength || term.length === 0) {
    updateDebouncedSearch(term)
  }
})

const filteredEntries = computed(() => {
  const q = debouncedSearchTerm.value.toLowerCase().trim()
  if (!q) return entries.value
  
  const matchedIds = new Set<string>()
  
  for (const idx of searchIndex.value) {
    let matched = false
    
    // Search by Name
    if (searchSettings.value.byName && idx.name.includes(q)) {
      matched = true
    }
    
    // Search by Method (label)
    if (!matched && searchSettings.value.byLabel && idx.method.includes(q)) {
      matched = true
    }
    
    // Search by Key (Request + Response JSON keys)
    if (!matched && searchSettings.value.byKey) {
      if (idx.requestBodyKeys.some(k => k.includes(q)) ||
          idx.responseBodyKeys.some(k => k.includes(q))) {
        matched = true
      }
    }
    
    // Search by Value (Request + Response JSON values)
    if (!matched && searchSettings.value.byValue) {
      if (idx.requestBodyValues.some(v => v.includes(q)) ||
          idx.responseBodyValues.some(v => v.includes(q))) {
        matched = true
      }
    }
    
    if (matched) {
      matchedIds.add(idx.entryId)
    }
  }
  
  return entries.value.filter(e => matchedIds.has(e.id))
})

// Active search types for badges
const activeSearchTypes = computed(() => {
  const types: string[] = []
  if (searchSettings.value.byName) types.push('Name')
  if (searchSettings.value.byLabel) types.push('Method')
  if (searchSettings.value.byKey) types.push('Key')
  if (searchSettings.value.byValue) types.push('Value')
  return types
})

// ============================================================================
// Computed
// ============================================================================

// Deep copy using JSON to ensure Vue sees a new object on each update
// This guarantees proper reactivity when entry.version changes
// Using JSON.parse/stringify instead of structuredClone to handle any non-cloneable objects
const selectedEntry = computed(() => {
  if (!selectedEntryId.value) return null
  const entry = entries.value.find(e => e.id === selectedEntryId.value)
  if (!entry) return null
  // Ensure entry has version field (for backwards compatibility)
  const entryWithVersion = { ...entry, version: entry.version ?? 1 }
  try {
    return JSON.parse(JSON.stringify(entryWithVersion)) as NetworkEntry
  } catch {
    // Fallback to shallow copy if JSON fails
    return { ...entryWithVersion }
  }
})

const entriesCount = computed(() => filteredEntries.value.length)
const totalCount = computed(() => entries.value.length)

const pendingCount = computed(() => 
  entries.value.filter(e => e.pending).length
)

// ============================================================================
// IPC Communication
// ============================================================================

/**
 * Send command to injected network module via content script
 */
function sendNetworkCommand(type: string, data: Record<string, any> = {}): void {
  window.parent?.postMessage({
    __VUE_INSPECTOR__: true,
    message: {
      type,
      __VUE_INSPECTOR__: true,
      __NETWORK_CMD__: true,
      ...data
    }
  }, '*')
}

/**
 * Handle incoming network messages
 */
function handleNetworkMessage(event: MessageEvent): void {
  const data = event.data
  
  // Handle broadcast format from content script
  if (data?.__VUE_INSPECTOR__ && data.broadcast && data.message?.__NETWORK__) {
    processNetworkMessage(data.message)
    return
  }
  
  // Handle direct format
  if (data?.__FROM_VUE_INSPECTOR__ && data.__NETWORK__) {
    processNetworkMessage(data)
  }
}

/**
 * Normalize entry to ensure it has a version field
 */
function normalizeEntry(entry: any): NetworkEntry {
  return { ...entry, version: entry.version ?? 1 }
}

/**
 * Process network message
 */
function processNetworkMessage(msg: any): void {
  const { type } = msg
  
  switch (type) {
    case 'NETWORK_READY':
      isReady.value = true
      if (typeof msg.paused === 'boolean') {
        paused.value = msg.paused
      }
      sendNetworkCommand('NETWORK_GET_ENTRIES')
      break
      
    case 'NETWORK_ENTRY_CAPTURED':
      if (msg.entry && !paused.value) {
        const entry = normalizeEntry(msg.entry)
        const existingIndex = entries.value.findIndex(e => e.id === entry.id)
        if (existingIndex === -1) {
          entries.value = [...entries.value, entry]
          addToIndex(entry)
          
          if (entries.value.length > config.value.maxEntries) {
            const removed = entries.value[0]
            entries.value = entries.value.slice(-config.value.maxEntries)
            removeFromIndex(removed.id)
          }
        }
      }
      break
      
    case 'NETWORK_ENTRY_UPDATED':
      if (msg.entry) {
        const entry = normalizeEntry(msg.entry)
        const index = entries.value.findIndex(e => e.id === entry.id)
        
        if (index !== -1) {
          const newEntries = [...entries.value]
          newEntries[index] = entry
          entries.value = newEntries
          addToIndex(entry) // Update index
        } else if (!paused.value) {
          entries.value = [...entries.value, entry]
          addToIndex(entry)
        }
      }
      break
      
    // ========================================
    // BREAKPOINT MESSAGES FROM INJECTED SCRIPT
    // ========================================
    
    case 'NETWORK_BREAKPOINT_HIT':
      // A breakpoint was triggered in the injected script
      // The request is NOW PAUSED waiting for resume
      if (msg.requestId && msg.trigger) {
        // If entry data is provided and not in list, add it
        // This ensures the entry is visible even if NETWORK_ENTRY_CAPTURED hasn't arrived yet
        if (msg.entry) {
          const existingIndex = entries.value.findIndex(e => e.id === msg.requestId)
          if (existingIndex === -1) {
            const entry = normalizeEntry(msg.entry)
            entries.value = [...entries.value, entry]
            addToIndex(entry)
            console.log('[NetworkTab] Added breakpoint entry to list:', msg.requestId)
          }
        }
        
        handleBreakpointHit(msg.requestId, msg.trigger)
      }
      break
      
    case 'NETWORK_BREAKPOINT_RESUMED':
      // Breakpoint was resumed (request continued)
      if (msg.requestId) {
        pendingBreakpoints.value.delete(msg.requestId)
        breakpointEntryIds.value.delete(msg.requestId)
        
        if (pendingBreakpoints.value.size === 0) {
          breakpointMode.value = false
          breakpointTrigger.value = undefined
        }
      }
      break
      
    case 'NETWORK_BREAKPOINTS_SYNCED':
      // Confirmation that breakpoints were synced to injected script
      console.log('[VueInspector UI] Breakpoints synced confirmed:', msg.count, 'breakpoints')
      break
      
    case 'NETWORK_MOCKS_SYNCED':
      // Confirmation that mocks were synced to injected script
      console.log('[VueInspector UI] 🎭 Mocks synced confirmed:', msg.count, 'mocks')
      break
      
    case 'NETWORK_MOCK_APPLIED':
      // A mock was applied (request was intercepted and fake response returned)
      console.log('[VueInspector UI] 🎭 Mock applied for request:', msg.requestId, 'mockId:', msg.mockId)
      break
      
    case 'NETWORK_ENTRIES_DATA':
      isReady.value = true
      if (msg.entries && Array.isArray(msg.entries)) {
        // Normalize all entries to ensure they have version
        const newEntries = msg.entries.map(normalizeEntry)
        
        // Preserve any breakpoint entries that might not be in the new list yet
        // (paused requests might not have been logged to the main entries list)
        const breakpointEntryIdsToPreserve = new Set(breakpointEntryIds.value)
        const existingBreakpointEntries = entries.value.filter(
          e => breakpointEntryIdsToPreserve.has(e.id) && !newEntries.some((ne: NetworkEntry) => ne.id === e.id)
        )
        
        if (existingBreakpointEntries.length > 0) {
          console.log('[NetworkTab] Preserving breakpoint entries:', existingBreakpointEntries.map(e => e.id))
          entries.value = [...newEntries, ...existingBreakpointEntries]
        } else {
          entries.value = newEntries
        }
        rebuildIndex()
      }
      break
      
    case 'NETWORK_STATUS':
      isReady.value = true
      if (typeof msg.paused === 'boolean') {
        paused.value = msg.paused
      }
      break
      
    case 'NETWORK_PAUSED':
      paused.value = true
      break
      
    case 'NETWORK_RESUMED':
      paused.value = false
      break
      
    case 'NETWORK_CLEARED':
      entries.value = []
      selectedEntryId.value = null
      clearIndex()
      break
  }
}

// ============================================================================
// Actions
// ============================================================================

function togglePause() {
  if (paused.value) {
    paused.value = false
    sendNetworkCommand('NETWORK_RESUME')
  } else {
    paused.value = true
    sendNetworkCommand('NETWORK_PAUSE')
  }
}

function clearEntries() {
  entries.value = []
  selectedEntryId.value = null
  clearIndex()
  sendNetworkCommand('NETWORK_CLEAR')
}

function selectEntry(id: string) {
  // Exit mock form mode when selecting a different entry
  if (mockFormMode.value && mockFormEntry.value?.id !== id) {
    mockFormMode.value = false
    mockFormEntry.value = null
  }
  selectedEntryId.value = id
}

function deselectEntry() {
  selectedEntryId.value = null
}

// ============================================================================
// Lifecycle
// ============================================================================

let statusCheckInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  window.addEventListener('message', handleNetworkMessage)
  
  sendNetworkCommand('NETWORK_GET_STATUS')
  sendNetworkCommand('NETWORK_GET_ENTRIES')
  
  let retryCount = 0
  statusCheckInterval = setInterval(() => {
    if (isReady.value || retryCount > 10) {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
        statusCheckInterval = null
      }
      return
    }
    retryCount++
    sendNetworkCommand('NETWORK_GET_STATUS')
    sendNetworkCommand('NETWORK_GET_ENTRIES')
  }, 500)
})

onUnmounted(() => {
  window.removeEventListener('message', handleNetworkMessage)
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="shrink-0 flex items-center gap-2 p-2 border-b">
      <!-- Left: Title -->
      <h3 class="text-lg font-semibold shrink-0">
        Network
      </h3>
      
      <!-- Search bar -->
      <div class="flex-1 max-w-xs relative">
        <Input
          v-model="searchTerm"
          placeholder="Search requests..."
          class="pl-8 h-8"
        />
        <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
      </div>
      
      <!-- Search type badges (always visible) -->
      <div v-if="activeSearchTypes.length" class="flex items-center gap-1">
        <Badge v-for="item in activeSearchTypes" :key="item" variant="secondary" class="text-xs px-1.5 py-0">
          {{ item }}
        </Badge>
      </div>
      
      <!-- Spacer -->
      <div class="flex-1" />
      
      <!-- Right: Status badges and controls -->
      <div class="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" class="font-mono">
          {{ entriesCount }}<span v-if="searchTerm && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
        </Badge>
        <Badge v-if="pendingCount > 0" variant="outline" class="text-yellow-500 border-yellow-500/30">
          {{ pendingCount }} pending
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
          :breakpoint-entry-ids="breakpointEntryIds"
          :breakpoint-matching-ids="entriesMatchingBreakpoints"
          @select="selectEntry"
          @set-breakpoint="handleSetBreakpoint"
          @copy-curl="handleCopyCurl"
          @mock-response="handleMockResponse"
        />
      </div>
      
      <!-- Right: Details / MockForm -->
      <div class="h-full min-h-0 overflow-hidden border rounded-lg" :class="{ 
        'ring-2 ring-amber-500': breakpointMode && selectedEntryId && pendingBreakpoints.has(selectedEntryId),
        'ring-2 ring-purple-500': mockFormMode
      }">
        <!-- Mock Form Mode -->
        <MockForm
          v-if="mockFormMode && mockFormEntry"
          :entry="mockFormEntry"
          @back="handleMockFormBack"
          @confirm="handleMockConfirm"
        />
        
        <!-- Network Details Mode -->
        <NetworkDetails
          v-else-if="selectedEntry"
          :entry="selectedEntry"
          :breakpoint-mode="breakpointMode && pendingBreakpoints.has(selectedEntry.id)"
          :breakpoint-trigger="breakpointTrigger"
          :breakpoint-draft="currentBreakpointDraft"
          @back="deselectEntry"
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
    
    <!-- Breakpoint Dialog -->
    <BreakpointDialog
      v-model:open="breakpointDialogOpen"
      :entry="breakpointDialogEntry"
      @confirm="handleBreakpointConfirm"
      @cancel="breakpointDialogEntry = null"
    />
    
    <!-- Mock Dialog (Map Local feature) -->
    <MockDialog
      v-model:open="mockDialogOpen"
      :entry="mockDialogEntry"
      @confirm="handleMockConfirm"
      @cancel="mockDialogEntry = null"
    />
  </div>
</template>