<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { SearchIcon, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import PiniaTable from './PiniaTable.vue'
import PiniaDetails from './PiniaDetails.vue'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useRuntime } from '@/runtime'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { deepSearchKey, deepSearchValue } from '@/features/props'

const runtime = useRuntime()

// ============================================================================
// Types
// ============================================================================

interface StoreEntry {
  id: string
  baseId: string
  stateKeys: number
  getterKeys: number
  lastUpdated?: number
  lastUpdatedFormatted?: string
  // Lazy-loaded for key/value search
  state?: Record<string, any>
  getters?: Record<string, any>
}

// ============================================================================
// State
// ============================================================================

const entries = ref<StoreEntry[]>([])
const selectedStoreId = ref<string | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref<string>('')

// Search state
const searchTerm = ref('')
const settings = ref<InspectorSettings | null>(null)

// Track which stores have their data loaded (for key/value search)
const storesDataLoaded = ref(false)
const isLoadingStoreData = ref(false)

// ============================================================================
// Settings
// ============================================================================

onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
  } catch { /* use defaults */ }
})

// Search settings from inspector settings
const searchSettings = computed(() => ({
  byName: settings.value?.search?.byName ?? true,
  byKey: settings.value?.search?.byKey ?? false,
  byValue: settings.value?.search?.byValue ?? false,
  debounce: settings.value?.search?.debounce ?? 300,
  minLength: settings.value?.search?.minLength ?? 2
}))

// ============================================================================
// Data loading
// ============================================================================

function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Pull-only model: load stores summary via request-response
async function loadStoresSummary() {
  isLoading.value = true
  error.value = null

  try {
    // Check content script availability
    let contentScriptReady = false
    try {
      const pingResponse = await runtime.sendMessage<{ pong?: boolean }>({ type: 'PING' })
      if (pingResponse?.pong) {
        contentScriptReady = true
      }
    } catch {
      contentScriptReady = false
    }

    if (!contentScriptReady) {
      isLoading.value = false
      return
    }

    // Request store summary
    const response = await runtime.sendMessage<{
      type: string
      summary?: Record<string, StoreEntry>
      detected?: boolean
      error?: string
    }>({
      type: 'PINIA_GET_STORES_SUMMARY'
    })
    
    if (response?.summary) {
      entries.value = Object.values(response.summary)
      lastUpdated.value = formatDateTime(new Date())
      isLoading.value = false
      // Reset store data loaded flag - data needs to be reloaded for key/value search
      storesDataLoaded.value = false
      
      // If key/value search is active, reload store data immediately
      if (needsStoreData.value) {
        loadAllStoresData()
      }
    } else if (response?.error) {
      error.value = response.error
      isLoading.value = false
    } else {
      // Fallback timeout
      setTimeout(() => {
        if (isLoading.value) {
          isLoading.value = false
          if (entries.value.length === 0) {
            error.value = 'Timeout: Pinia stores not found or not initialized'
          }
        }
      }, 3000)
    }

  } catch (err: any) {
    const errorMessage = err.message || 'Failed to load stores'

    if (errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('Receiving end does not exist')) {
      error.value = null
    } else {
      error.value = 'Failed to load Pinia stores. Make sure Pinia is installed and initialized.'
    }

    isLoading.value = false
  }
}

// Load state/getters data for all stores (for key/value search)
async function loadAllStoresData() {
  if (storesDataLoaded.value || isLoadingStoreData.value) return
  if (entries.value.length === 0) return
  
  isLoadingStoreData.value = true
  
  try {
    // Load data for each store in parallel
    const loadPromises = entries.value.map(async (store) => {
      try {
        const response = await runtime.sendMessage<{
          state?: any
          getters?: any
          error?: string
        }>({
          type: 'PINIA_GET_STORE_STATE',
          storeId: store.id
        })
        
        if (response) {
          // Update store entry with state/getters
          if ('state' in response) {
            store.state = response.state ?? {}
          }
          if ('getters' in response) {
            store.getters = response.getters ?? {}
          }
        }
      } catch {
        // Ignore individual store errors
      }
    })
    
    await Promise.all(loadPromises)
    storesDataLoaded.value = true
  } finally {
    isLoadingStoreData.value = false
  }
}

// Auto-refresh logic
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

function startAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
  }
  
  if (settings.value?.updates?.autoRefresh && settings.value?.updates?.autoRefreshInterval) {
    autoRefreshTimer = setInterval(() => {
      if (!isLoading.value) {
        loadStoresSummary()
      }
    }, settings.value.updates.autoRefreshInterval)
  }
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

watch(() => settings.value?.updates?.autoRefresh, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    if (newValue) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }
})

watch(() => settings.value?.updates?.autoRefreshInterval, (newValue, oldValue) => {
  if (newValue !== oldValue && settings.value?.updates?.autoRefresh) {
    startAutoRefresh()
  }
})

// Visibility handler
let isVisible = true
const visibilityHandler = (event: MessageEvent) => {
  if (event.data?.__VUE_INSPECTOR__ && event.data.broadcast && 
      event.data.message?.type === 'VUE_INSPECTOR_VISIBILITY_CHANGED') {
    isVisible = event.data.message.visible
    if (isVisible && settings.value?.updates?.autoRefresh) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }
}

// ============================================================================
// Filtering
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

// Trigger data loading when key/value search is active
const needsStoreData = computed(() => 
  (searchSettings.value.byKey || searchSettings.value.byValue) && 
  debouncedSearchTerm.value.trim().length > 0
)

// Watch for when we need store data
watch(needsStoreData, (needs) => {
  if (needs && !storesDataLoaded.value) {
    loadAllStoresData()
  }
})

// Filter stores
const filteredEntries = computed(() => {
  const q = debouncedSearchTerm.value.toLowerCase().trim()
  if (!q) return entries.value
  
  return entries.value.filter(store => {
    // Search by name
    if (searchSettings.value.byName && store.baseId?.toLowerCase().includes(q)) {
      return true
    }
    
    // Search by key in state/getters (deep search)
    if (searchSettings.value.byKey) {
      if (store.state && deepSearchKey(store.state, q)) {
        return true
      }
      if (store.getters && deepSearchKey(store.getters, q)) {
        return true
      }
    }
    
    // Search by value in state/getters (deep search)
    if (searchSettings.value.byValue) {
      if (store.state && deepSearchValue(store.state, q)) {
        return true
      }
      if (store.getters && deepSearchValue(store.getters, q)) {
        return true
      }
    }
    
    return false
  })
})

// Active search types for badges
const activeSearchTypes = computed(() => {
  const types: string[] = []
  if (searchSettings.value.byName) types.push('Name')
  if (searchSettings.value.byKey) types.push('Key')
  if (searchSettings.value.byValue) types.push('Value')
  return types
})

// ============================================================================
// Computed
// ============================================================================

const selectedStore = computed(() => {
  if (!selectedStoreId.value) return null
  return entries.value.find(s => s.id === selectedStoreId.value) || null
})

const entriesCount = computed(() => filteredEntries.value.length)
const totalCount = computed(() => entries.value.length)

// ============================================================================
// Actions
// ============================================================================

function selectStore(store: StoreEntry) {
  selectedStoreId.value = store.id
}

function deselectStore() {
  selectedStoreId.value = null
}

async function handleRefresh() {
  if (isLoading.value) return
  await loadStoresSummary()
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  window.addEventListener('message', visibilityHandler)
  loadStoresSummary()
  
  // Start auto-refresh if enabled
  if (settings.value?.updates?.autoRefresh) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  window.removeEventListener('message', visibilityHandler)
  stopAutoRefresh()
})
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Toolbar -->
      <div class="shrink-0 flex items-center gap-2 p-2 border-b">
        <!-- Left: Title -->
        <h3 class="text-lg font-semibold shrink-0">
          Stores
        </h3>
        
        <!-- Search bar -->
        <div class="flex-1 max-w-xs relative">
          <Input
            v-model="searchTerm"
            placeholder="Search stores..."
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
            <span v-if="isLoadingStoreData" class="text-muted-foreground">...</span>
            <template v-else>
              {{ entriesCount }}<span v-if="searchTerm && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
            </template>
          </Badge>
          
          <!-- Refresh button -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :disabled="isLoading"
                @click="handleRefresh"
              >
                <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Refresh
            </TooltipContent>
          </Tooltip>
          
          <!-- Updated time -->
          <span class="text-xs text-muted-foreground whitespace-nowrap">
            {{ isLoading ? 'Loading...' : lastUpdated }}
          </span>
        </div>
      </div>
      
      <!-- Content -->
      <div class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden">
        <!-- Left: Table -->
        <div class="h-full min-h-0 overflow-hidden">
          <PiniaTable
            :entries="filteredEntries"
            :selected-id="selectedStoreId"
            @select="selectStore"
          />
        </div>
        
        <!-- Right: Details -->
        <div class="h-full min-h-0 overflow-hidden border rounded-lg">
          <PiniaDetails
            v-if="selectedStore"
            :key="selectedStore.id"
            :store="selectedStore"
            @back="deselectStore"
          />
          
          <div
            v-else
            class="h-full flex items-center justify-center text-muted-foreground"
          >
            Select a store to see details
          </div>
        </div>
      </div>
      
      <!-- Error overlay -->
      <div
        v-if="error"
        class="absolute inset-0 z-10 bg-background/80 flex items-center justify-center text-destructive text-sm"
      >
        {{ error }}
      </div>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
