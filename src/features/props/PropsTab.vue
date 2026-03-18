<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { SearchIcon, RefreshCw, Star, MousePointer2, X } from 'lucide-vue-next'
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
import { useInspectorSettings, useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { useSearchSettings } from '@/composables/useSearchSettings'
import { useTreeData } from '@/hooks/useTreeData'
import { useRuntime } from '@/runtime'
import { safeRuntime, safeTabs, safeStorage } from '@/utils/extensionBridge'
import { isInFavorites, findMatchingFavorite, matchFavoriteIds } from '@/utils/favoritesMatcher'
import { parseSearchTerm } from '@/utils/searchUtils'
import { 
  type PropsRow, 
  createPropsRow, 
  updateRowsVisibility,
  sortRowsByFavorite,
  getElementInfo
} from './types'

const runtime = useRuntime()

const emit = defineEmits<{
  (e: 'navigateToOptions', anchor: string): void
}>()

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

// Inspector mode (element picker like Chrome DevTools Elements)
const isInspectorMode = ref(false)
const inspectRootUid = ref<number | null>(null)

// Search state
const searchTerm = ref('')
const debouncedSearchTerm = ref('')
const settings = useInspectorSettingsSync()

const {
  searchSettings,
  selectedSearchTypes,
  searchTypeOptions: propsSearchTypeOptions
} = useSearchSettings({
  settings,
  searchKey: 'propsSearch',
  typeMap: {
    'Name': 'byName',
    'Label': 'byLabel',
    'Root': 'byRootElement',
    'Key': 'byKey',
    'Value': 'byValue',
  }
})

// Favorites (pass full objects for proper matching)
const favorites = computed(() => {
  if (!settings.value?.favorites) return []
  return settings.value.favorites
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

async function applyFilters() {
  const term = debouncedSearchTerm.value
  const { query, exactMatch } = parseSearchTerm(term)
  const byKey = !!searchSettings.value.byKey
  const byValue = !!searchSettings.value.byValue
  const needsKeyValueSearch = (byKey || byValue) && query.length >= (searchSettings.value.minLength ?? 2)

  let matchedUids: Set<number> | undefined
  if (needsKeyValueSearch) {
    try {
      const res = await runtime.sendMessage<{ results?: Array<{ uid: number }> }>({
        type: 'PROPS_SEARCH',
        query,
        searchByKey: byKey,
        searchByValue: byValue,
        exactMatch
      })
      matchedUids = new Set((res?.results ?? []).map(r => r.uid))
    } catch (e) {
      console.error('[props/PropsTab] PROPS_SEARCH failed:', e)
      matchedUids = new Set()
    }
  }

  updateRowsVisibility(rows.value, {
    searchTerm: query,
    searchByName: !!searchSettings.value.byName,
    searchByRootElement: !!searchSettings.value.byRootElement,
    searchByKey: byKey,
    searchByValue: byValue,
    exactMatch,
    matchedUids
  })

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
        runtime.storage.set('vue-inspector-settings', settingsToSave).catch((error) => {
          console.error('[props/PropsTab] Failed to save favorites nodeId:', error)
        })
      } catch (error) {
        console.error('[props/PropsTab] updateFavoriteFlags JSON/save failed:', error)
      }
    }
  } finally {
    updatingFavorites = false
  }
}

// ============================================================================
// Settings
// ============================================================================


// Sync favorite flags on any favorites mutation (add/remove from table,
// details panel, settings load, or external storage change).
// Works identically in all modes (extension, devtools, standalone).
watch(favorites, () => {
  if (rows.value.length) {
    updateFavoriteFlags()
  }
}, { deep: true })

// When blacklist changes, refresh (blacklist applied at traversal stage)
watch(
  () => settings.value?.blacklist,
  () => {
    if (rows.value.length && treeData.value?.length) refresh()
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
      }).catch((error) => {
        console.error('[props/PropsTab] storageListener useInspectorSettings failed:', error)
      })
    }
  }
  storage.onChanged.addListener(storageListener)
}

// ============================================================================
// Data loading
// ============================================================================

const { treeData, isLoading: treeLoading, error: treeError, refresh } = useTreeData()

// Transform incoming data to PropsRow format (blacklist applied at traversal)
watch(treeData, (data) => {
  if (data) {
    const newRows = data.map(node => 
      createPropsRow(node as TreeNodeModel, false)
    )
    
    rows.value = newRows

    // Batch favorite matching with nodeId disambiguation
    updateFavoriteFlags()
    
    // Apply current visibility filters
    updateRowsVisibility(rows.value, {
      searchTerm: debouncedSearchTerm.value,
      searchByName: !!searchSettings.value.byName,
      searchByRootElement: !!searchSettings.value.byRootElement,
      searchByKey: !!searchSettings.value.byKey,
      searchByValue: !!searchSettings.value.byValue
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

// ============================================================================
// Computed
// ============================================================================

// Counts based on visibleRows (already computed and cached)
const entriesCount = computed(() => visibleRows.value.length)
const totalCount = computed(() => rows.value.length)
const favoritesFound = computed(() => visibleRows.value.filter(r => r.isFavoriteFlag).length)
const favoritesTotal = computed(() => settings.value?.favorites?.length ?? 0)
const favoritesLabel = computed(() => {
  const total = favoritesTotal.value
  if (total === 0) return '0'
  return `${favoritesFound.value}/${total}`
})

// ============================================================================
// Actions
// ============================================================================

async function selectEntry(node: PropsRow) {
  selectedNode.value = node
  const needsProps = node.hasPropsFlag && (!node.props || Object.keys(node.props).length === 0)
  if (needsProps) await handleRefreshSelected()
}

function deselectEntry() {
  selectedNode.value = null
}

async function handleRefresh() {
  if (isLoading.value) return
  await refresh(inspectRootUid.value != null ? { rootElementUid: inspectRootUid.value } : undefined)
  lastUpdated.value = formatDateTime(new Date())
}

/** Refresh only the selected component's props (no full tree reload) */
async function handleRefreshSelected() {
  const node = selectedNode.value
  if (!node || isLoading.value) return

  const componentPath = node.id
  if (!componentPath || !componentPath.startsWith('uid:')) return

  isLoading.value = true
  try {
    const response = await runtime.sendMessage<{ props?: Record<string, any>; rawProps?: Record<string, any>; newUid?: number }>({
      type: 'GET_COMPONENT_PROPS',
      componentUid: componentPath,
      componentPathFallback: node.componentUid || undefined
    })
    const freshProps = response?.props ?? {}
    const rawProps = response?.rawProps ?? {}
    const newUid = response?.newUid
    selectedNode.value = {
      ...node,
      id: newUid != null ? `uid:${newUid}` : node.id,
      componentUid: node.componentUid,
      props: freshProps,
      rawProps,
      jsonProps: JSON.stringify(freshProps, null, 2)
    }
    lastUpdated.value = formatDateTime(new Date())
  } catch (error) {
    console.error('[props/PropsTab] handleRefreshSelected GET_COMPONENT_PROPS failed:', error)
    // Fallback: full refresh if single-component refresh fails
    await refresh()
    await nextTick()
    const updated = rows.value.find(r => r.id === node.id || r.componentUid === node.componentUid)
    if (updated) selectedNode.value = updated
    lastUpdated.value = formatDateTime(new Date())
  } finally {
    isLoading.value = false
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
  } catch (error) {
    console.error('[props/PropsTab] ignoreByName save failed:', error)
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
  } catch (error) {
    console.error('[props/PropsTab] toggleFavorite save failed:', error)
  }
}

// ============================================================================
// Inspector mode (element picker)
// ============================================================================

async function toggleInspectorMode() {
  if (isInspectorMode.value) {
    // Exit inspector mode only (filter stays)
    isInspectorMode.value = false
    await runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' })
  } else {
    // Enter: refresh first (lazy load), then start inspector
    await refresh(inspectRootUid.value != null ? { rootElementUid: inspectRootUid.value } : undefined)
    isInspectorMode.value = true
    await runtime.sendMessage({
      type: 'PROPS_INSPECTOR_START',
      theme: settings.value?.theme ?? 'dark'
    })
  }
}

async function handleInspectorElementSelected(uid: number) {
  inspectRootUid.value = uid
  isInspectorMode.value = false
  await runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' })
  refresh({ rootElementUid: uid })
}

async function clearInspectFilter() {
  inspectRootUid.value = null
  await refresh()
}

// Listen for inspector events from content script (via devtools port broadcast)
let inspectorUnsubscribe: (() => void) | null = null
onMounted(() => {
  inspectorUnsubscribe = runtime.onMessage((msg: { type?: string; uid?: number }) => {
    if (msg.type === 'PROPS_INSPECTOR_ELEMENT_SELECTED' && typeof msg.uid === 'number') {
      handleInspectorElementSelected(msg.uid)
    }
  })
})

// Exit inspector on tab switch, DevTools close
onUnmounted(() => {
  if (inspectorUnsubscribe) {
    inspectorUnsubscribe()
    inspectorUnsubscribe = null
  }
  if (isInspectorMode.value) {
    runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' }).catch(() => {})
  }
})

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
  } catch (error) {
    console.error('[props/PropsTab] unhighlightElements failed:', error)
  }
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

            <!-- Inspect (inline — hidden when toolbar is narrow) -->
            <div class="inspect-inline">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="outline"
                    size="sm"
                    class="inspect-btn h-8 gap-1.5"
                    :class="isInspectorMode ? 'border-primary bg-primary/10 text-primary' : ''"
                    :disabled="isLoading"
                    @click="toggleInspectorMode"
                  >
                    <MousePointer2 class="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span class="inspect-btn-label text-xs font-medium">Inspect</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Select element on page to filter Props
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        
        <!-- Right block: Status badges and controls -->
        <div class="flex items-center gap-2 shrink-0 ml-auto toolbar-right-block">
          <!-- Inspect (wrapped — shown when toolbar is narrow) -->
          <div class="hidden inspect-wrapped">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="inspect-btn h-8 gap-1.5"
                  :class="isInspectorMode ? 'border-primary bg-primary/10 text-primary' : ''"
                  :disabled="isLoading"
                  @click="toggleInspectorMode"
                >
                  <MousePointer2 class="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span class="inspect-btn-label text-xs font-medium">Inspect</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Select element on page to filter Props
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="hidden flex-1 inspect-spacer" />

          <!-- Inspect filter reset (when filtered by element) -->
          <Tooltip v-if="inspectRootUid != null">
            <TooltipTrigger as-child>
              <Badge
                variant="outline"
                class="filtered-badge cursor-pointer gap-1.5 pl-2 pr-1.5 py-1 text-amber-600 border-amber-500/40 hover:bg-amber-500/10 dark:text-amber-400 dark:border-amber-400/40 dark:hover:bg-amber-400/10 transition-colors"
                @click="clearInspectFilter"
              >
                <MousePointer2 class="h-3 w-3 shrink-0" aria-hidden />
                <span class="filtered-badge-label text-xs font-medium">Filtered</span>
                <X class="h-3 w-3 shrink-0 ml-0.5 opacity-70" aria-hidden />
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Clear element filter, show full list
            </TooltipContent>
          </Tooltip>
          <Badge variant="secondary" class="font-mono">
            {{ entriesCount }}<span v-if="searchTerm && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
          </Badge>
          <Badge
            variant="outline"
            class="cursor-pointer transition-colors"
            :class="favoritesFound > 0
              ? 'text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10'
              : 'text-muted-foreground border-muted hover:bg-muted/50'"
            @click="emit('navigateToOptions', 'favorites-section')"
          >
            <Star class="h-3 w-3 mr-1" :class="favoritesFound > 0 ? 'fill-yellow-500' : 'fill-muted-foreground'" />
            {{ favoritesLabel }}
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
            :is-loading="isLoading"
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
