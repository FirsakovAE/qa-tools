<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { SearchIcon, RefreshCw, Star } from 'lucide-vue-next'
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
import PropsTable from './PropsTable.vue'
import ComponentDetails from './prop-details/ComponentDetails.vue'
import type { TreeNodeModel } from '@/types/tree'
import type { BaseInspectorSettings, FavoriteItem } from '@/types/inspector'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useTreeData } from '@/hooks/useTreeData'
import { useRuntime } from '@/runtime'
import { safeRuntime, safeTabs, safeStorage } from '@/utils/extensionBridge'
import { isInFavorites, findMatchingFavorite, matchFavoriteIds } from '@/utils/favoritesMatcher'
import { likeMatch } from '@/utils/likeMatch'
import { 
  type PropsRow, 
  createPropsRow, 
  updateRowsVisibility,
  sortRowsByFavorite 
} from './types'

const runtime = useRuntime()

// ============================================================================
// State - OPTIMIZED MODEL
// ============================================================================

// STABLE rows array - reference NEVER changes, only row.visible mutates
const rows = shallowRef<PropsRow[]>([])

// Trigger for forcing re-render after visibility mutation
const visibilityVersion = ref(0)

const selectedNode = ref<TreeNodeModel | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref<string>('')

// Search state
const searchTerm = ref('')
const debouncedSearchTerm = ref('')
const settings = ref<BaseInspectorSettings | null>(null)

// Favorites (pass full objects for proper matching)
const favorites = computed(() => {
  if (!settings.value?.favorites) return []
  return settings.value.favorites
})

// Search settings from inspector settings
const searchSettings = computed(() => ({
  byName: settings.value?.propsSearch?.byName ?? true,
  byLabel: settings.value?.propsSearch?.byLabel ?? false,
  byRootElement: settings.value?.propsSearch?.byRootElement ?? false,
  byKey: settings.value?.propsSearch?.byKey ?? false,
  byValue: settings.value?.propsSearch?.byValue ?? false,
  debounce: settings.value?.searchParams?.debounce ?? 300,
  minLength: settings.value?.searchParams?.minLength ?? 2
}))

// Search type options for FacetedFilter
type PropsSearchKey = 'byName' | 'byLabel' | 'byRootElement' | 'byKey' | 'byValue'
const propsSearchTypeMap: Record<string, PropsSearchKey> = {
  'Name': 'byName',
  'Label': 'byLabel',
  'Root': 'byRootElement',
  'Key': 'byKey',
  'Value': 'byValue',
}
const propsSearchTypeOptions = Object.keys(propsSearchTypeMap)

const selectedSearchTypes = computed<string[]>({
  get() {
    if (!settings.value?.propsSearch) return []
    return propsSearchTypeOptions.filter(label => settings.value!.propsSearch[propsSearchTypeMap[label]] as boolean)
  },
  set(selected: string[]) {
    if (!settings.value?.propsSearch) return
    for (const label of propsSearchTypeOptions) {
      const key = propsSearchTypeMap[label]
      ;(settings.value.propsSearch as any)[key] = selected.includes(label)
    }
  }
})

// ============================================================================
// Helper functions - MUST BE DEFINED BEFORE watches that use them
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

function buildElementSelector(
  tag: string,
  elId?: string,
  cls?: string,
  testId?: string
): string {
  let sel = tag.toLowerCase()
  if (elId) sel += '#' + elId
  if (cls) sel += '.' + cls.trim().replace(/\s+/g, '.')
  if (testId) sel += `[${testId}]`
  return sel
}

function getElementInfo(node: TreeNodeModel): string {
  if (node.element) {
    if (node.element instanceof HTMLElement) {
      return buildElementSelector(
        node.element.tagName,
        node.element.id || undefined,
        node.element.className || undefined,
        node.element.getAttribute?.('data-testid') || undefined
      )
    } else if (node.element.tagName) {
      return buildElementSelector(
        node.element.tagName,
        node.element.id,
        node.element.className,
        node.element.testId
      )
    }
  }

  if (node.rootElement?.tagName) {
    return buildElementSelector(
      node.rootElement.tagName,
      node.rootElement.id,
      node.rootElement.className,
      node.rootElement.testId
    )
  }

  return 'Logic only'
}

function getNodeId(node: TreeNodeModel): string {
  if (node.componentUid) return node.componentUid
  if (node.id && node.id.includes('::')) return node.id
  return `${node.name}::${getElementInfo(node)}`
}

function isFavoriteNode(node: TreeNodeModel): boolean {
  if (!settings.value?.favorites?.length) return false
  const id = getNodeId(node)
  return isInFavorites(id, settings.value.favorites)
}

function isBlockedNode(node: TreeNodeModel): boolean {
  if (!settings.value?.blacklist) return false
  const { active, inactive } = settings.value.blacklist
  if (!active?.length) return false
  const name = node.name || ''
  if (inactive?.some((rule: string) => likeMatch(name, rule))) return false
  return active.some((rule: string) => likeMatch(name, rule))
}

function applyFilters() {
  updateRowsVisibility(rows.value, {
    searchTerm: debouncedSearchTerm.value,
    searchByName: searchSettings.value.byName,
    searchByRootElement: searchSettings.value.byRootElement,
    searchByKey: searchSettings.value.byKey,
    searchByValue: searchSettings.value.byValue
  })

  // Trigger re-render (cheap - just increments a number)
  visibilityVersion.value++
}

let updatingFavorites = false

function updateFavoriteFlags() {
  if (updatingFavorites) return
  updatingFavorites = true

  try {
    if (!settings.value?.favorites?.length) {
      for (const row of rows.value) row.isFavoriteFlag = false
      visibilityVersion.value++
      return
    }

    for (const row of rows.value) row.isFavoriteFlag = false

    const nodeIdUpdates: Array<{ fav: FavoriteItem; newNodeId: string }> = []

    for (const fav of settings.value.favorites) {
      const candidates = rows.value.filter(r => {
        const sid = getNodeId(r)
        return matchFavoriteIds(sid, fav.id)
      })

      if (candidates.length === 0) continue

      if (candidates.length === 1) {
        candidates[0].isFavoriteFlag = true
        if (fav.nodeId && fav.nodeId !== candidates[0].id) {
          nodeIdUpdates.push({ fav, newNodeId: candidates[0].id })
        }
        continue
      }

      // Multiple candidates — use nodeId to pick the right one
      if (fav.nodeId) {
        const exact = candidates.find(r => r.id === fav.nodeId)
        if (exact) {
          exact.isFavoriteFlag = true
          continue
        }
      }

      // nodeId stale or missing — mark first candidate
      candidates[0].isFavoriteFlag = true
      nodeIdUpdates.push({ fav, newNodeId: candidates[0].id })
    }

    sortRowsByFavorite(rows.value)
    visibilityVersion.value++

    // Apply nodeId updates outside the reactive pass to avoid triggering watchers
    if (nodeIdUpdates.length > 0) {
      for (const { fav, newNodeId } of nodeIdUpdates) {
        fav.nodeId = newNodeId
      }
      try {
        const settingsToSave = JSON.parse(JSON.stringify(settings.value))
        runtime.storage.set('vue-inspector-settings', settingsToSave).catch(() => {})
      } catch { /* ignore */ }
    }
  } finally {
    updatingFavorites = false
  }
}

// ============================================================================
// Settings
// ============================================================================

onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
  } catch { /* use defaults */ }
})

// Sync favorite flags on any favorites mutation (add/remove from table,
// details panel, settings load, or external storage change).
// Works identically in all modes (extension, devtools, standalone).
watch(favorites, () => {
  if (rows.value.length) {
    updateFavoriteFlags()
  }
}, { deep: true })

// Re-filter rows when blacklist changes
watch(
  () => settings.value?.blacklist,
  () => {
    if (!rows.value.length || !treeData.value?.length) return
    const newRows = treeData.value
      .filter(node => !isBlockedNode(node as TreeNodeModel))
      .map(node =>
        createPropsRow(node as TreeNodeModel, isFavoriteNode(node as TreeNodeModel))
      )
    sortRowsByFavorite(newRows)
    updateRowsVisibility(newRows, {
      searchTerm: debouncedSearchTerm.value,
      searchByName: searchSettings.value.byName,
      searchByRootElement: searchSettings.value.byRootElement,
      searchByKey: searchSettings.value.byKey,
      searchByValue: searchSettings.value.byValue
    })
    rows.value = newRows
    visibilityVersion.value++
  },
  { deep: true }
)

// Watch for settings changes in storage (extension / devtools cross-tab sync)
const storage = safeStorage()
let storageListener: ((changes: any) => void) | null = null

if (storage?.onChanged) {
  storageListener = (changes) => {
    const settingsKey = 'vue-inspector-settings'
    if (changes[settingsKey]) {
      useInspectorSettings().then(newSettings => {
        settings.value = newSettings
      }).catch(() => {})
    }
  }
  storage.onChanged.addListener(storageListener)
}

// ============================================================================
// Data loading
// ============================================================================

const { treeData, isLoading: treeLoading, error: treeError, refresh } = useTreeData()

// Transform incoming data to PropsRow format (only on new data)
watch(treeData, (data) => {
  if (data) {
    const newRows = data
      .filter(node => !isBlockedNode(node as TreeNodeModel))
      .map(node => 
        createPropsRow(node as TreeNodeModel, false)
      )
    
    rows.value = newRows

    // Batch favorite matching with nodeId disambiguation
    updateFavoriteFlags()
    
    // Apply current visibility filters
    updateRowsVisibility(rows.value, {
      searchTerm: debouncedSearchTerm.value,
      searchByName: searchSettings.value.byName,
      searchByRootElement: searchSettings.value.byRootElement,
      searchByKey: searchSettings.value.byKey,
      searchByValue: searchSettings.value.byValue
    })
    
    lastUpdated.value = formatDateTime(new Date())
  }
}, { immediate: true })

watch(treeLoading, (loading) => {
  isLoading.value = loading
})

watch(treeError, (err) => {
  error.value = err
})

// Auto-refresh logic
let autoRefreshTimer: number | null = null

function startAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
  }
  
  if (settings.value?.updates?.autoRefresh && settings.value?.updates?.autoRefreshInterval) {
    autoRefreshTimer = window.setInterval(async () => {
      if (!isLoading.value) {
        await refresh()
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

watch(() => settings.value?.updates?.autoRefresh, (autoRefresh) => {
  if (autoRefresh) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

watch(() => settings.value?.updates?.autoRefreshInterval, () => {
  if (settings.value?.updates?.autoRefresh) {
    startAutoRefresh()
  }
})

watch(settings, (newSettings) => {
  if (newSettings?.updates?.autoRefresh) {
    startAutoRefresh()
  }
})

// ============================================================================
// Filtering - OPTIMIZED (mutates row.visible, zero array creation)
// ============================================================================

const updateDebouncedSearch = useDebounceFn((term: string) => {
  debouncedSearchTerm.value = term
}, searchSettings.value.debounce)

watch(searchTerm, (term) => {
  if (term.length >= searchSettings.value.minLength || term.length === 0) {
    updateDebouncedSearch(term)
  }
})

// Watch filter changes
watch([debouncedSearchTerm], applyFilters)
watch(searchSettings, applyFilters, { deep: true })

/**
 * Visible rows for RecycleScroller
 * Virtualization REQUIRES filtered array (scroller calculates scroll height from items.length)
 */
const visibleRows = computed(() => {
  // Touch visibilityVersion to create dependency
  void visibilityVersion.value
  return rows.value.filter(r => r.visible)
})

// Active search types for badges
const activeSearchTypes = computed(() => {
  const types: string[] = []
  if (searchSettings.value.byName) types.push('Name')
  if (searchSettings.value.byLabel) types.push('Label')
  if (searchSettings.value.byRootElement) types.push('Root')
  if (searchSettings.value.byKey) types.push('Key')
  if (searchSettings.value.byValue) types.push('Value')
  return types
})

// ============================================================================
// Computed
// ============================================================================

// Counts based on visibleRows (already computed and cached)
const entriesCount = computed(() => visibleRows.value.length)
const totalCount = computed(() => rows.value.length)
const favoritesCount = computed(() => visibleRows.value.filter(r => r.isFavoriteFlag).length)

// ============================================================================
// Actions
// ============================================================================

function selectEntry(node: PropsRow) {
  selectedNode.value = node
}

function deselectEntry() {
  selectedNode.value = null
}

async function handleRefresh() {
  if (isLoading.value) return
  await refresh()
  lastUpdated.value = formatDateTime(new Date())
}

/** Refresh tree and re-select current node to update details panel */
async function handleRefreshSelected() {
  if (isLoading.value) return
  const currentId = selectedNode.value?.id ?? selectedNode.value?.componentUid
  await refresh()
  lastUpdated.value = formatDateTime(new Date())
  if (currentId) {
    const updated = rows.value.find(r => r.id === currentId || r.componentUid === currentId)
    if (updated) selectedNode.value = updated
  }
}

async function ignoreByName(node: PropsRow) {
  if (!settings.value?.blacklist) return
  const name = node.name?.trim()
  if (!name) return

  const { active, inactive } = settings.value.blacklist
  if (active.includes(name) || inactive.includes(name)) return

  active.push(name)

  try {
    const settingsToSave = JSON.parse(JSON.stringify(settings.value))
    await runtime.storage.set('vue-inspector-settings', settingsToSave)
  } catch {
    // Ignore save errors
  }
}

// Toggle favorite for a node (NO sorting - element stays in place)
async function toggleFavorite(node: PropsRow) {
  if (!settings.value) return

  const elementId = getNodeId(node)

  if (node.isFavoriteFlag) {
    // Remove: prefer nodeId match, then fall back to stable id
    const stableMatches = settings.value.favorites.filter(f => matchFavoriteIds(elementId, f.id))
    const toRemove = stableMatches.find(f => f.nodeId === node.id) || stableMatches[0]
    if (toRemove) {
      settings.value.favorites = settings.value.favorites.filter(
        (fav: FavoriteItem) => fav !== toRemove
      )
    }
    node.isFavoriteFlag = false
  } else {
    // Add to favorites with session-specific nodeId
    const favoriteItem: FavoriteItem = {
      id: elementId,
      nodeId: node.id,
      tagName: node.element?.tagName || node.rootElement?.tagName || 'div',
      className: node.element?.className || node.rootElement?.className,
      name: node.name,
      timestamp: new Date().toISOString()
    }
    settings.value.favorites.push(favoriteItem)
    node.isFavoriteFlag = true
  }

  // Save settings (NO sorting - element stays in place)
  try {
    const settingsToSave = JSON.parse(JSON.stringify(settings.value))
    await runtime.storage.set('vue-inspector-settings', settingsToSave)
  } catch {
    // Ignore save errors
  }
}

// ============================================================================
// Highlight
// ============================================================================

async function unhighlightElements() {
  try {
    const runtime = safeRuntime()
    const tabsApi = safeTabs()
    if (!runtime || !tabsApi) return

    const tabs = await tabsApi.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) return

    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT',
      tabId: tabs[0].id
    })
  } catch { /* ignore */ }
}

watch(searchTerm, val => {
  if (val.trim()) {
    unhighlightElements()
  }
})

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  lastUpdated.value = formatDateTime(new Date())
})

onUnmounted(() => {
  stopAutoRefresh()
  if (storage?.onChanged && storageListener) {
    storage.onChanged.removeListener(storageListener)
  }
})
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Toolbar -->
      <div class="shrink-0 flex flex-wrap items-center gap-2 p-2 border-b toolbar-container" :class="{ 'toolbar-hide-on-details': selectedNode }">
        <!-- Left block: Title + Search + Filter -->
        <div class="flex items-center gap-2 toolbar-left-block">
          <h3 class="text-lg font-semibold shrink-0 toolbar-title">
            Props
          </h3>
          
          <!-- Search bar (stays left) -->
          <div class="flex-1 min-w-[155px] max-w-xs relative">
            <Input
              v-model="searchTerm"
              placeholder="Search components..."
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
              :options="propsSearchTypeOptions"
            />
          </div>
        </div>
        
        <!-- Right block: Status badges and controls -->
        <div class="flex items-center gap-2 shrink-0 ml-auto toolbar-right-block">
          <Badge variant="secondary" class="font-mono">
            {{ entriesCount }}<span v-if="searchTerm && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
          </Badge>
          <Badge v-if="favoritesCount > 0" variant="outline" class="text-yellow-500 border-yellow-500/30">
            <Star class="h-3 w-3 mr-1 fill-yellow-500" />
            {{ favoritesCount }}
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
            {{ lastUpdated }}
          </span>
        </div>
      </div>
      
      <!-- Content -->
      <div class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden responsive-panels">
        <!-- Left: Table -->
        <div class="h-full min-h-0 overflow-hidden">
          <PropsTable
            :rows="visibleRows"
            :selected-id="selectedNode?.id || null"
            @select="selectEntry"
            @toggle-favorite="toggleFavorite"
            @ignore-by-name="ignoreByName"
          />
        </div>
        
        <!-- Right: Details -->
        <div class="h-full min-h-0 overflow-hidden border rounded-lg details-panel" :class="{ 'details-active': selectedNode }">
          <ComponentDetails
            v-if="selectedNode"
            :key="selectedNode.id || selectedNode.componentUid"
            :node="selectedNode"
            :refreshing="isLoading"
            @back="deselectEntry"
            @refresh="handleRefreshSelected"
          />
          
          <div
            v-else
            class="h-full flex items-center justify-center text-muted-foreground"
          >
            Select a component to see details
          </div>
        </div>
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
