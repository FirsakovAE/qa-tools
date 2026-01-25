<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { SearchIcon, RefreshCw, Star } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { isInFavorites, findMatchingFavorite } from '@/utils/favoritesMatcher'

const runtime = useRuntime()

// ============================================================================
// State
// ============================================================================

const entries = ref<TreeNodeModel[]>([])
const selectedNode = ref<TreeNodeModel | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref<string>('')

// Search state
const searchTerm = ref('')
const propsOnly = ref(false)
const settings = ref<BaseInspectorSettings | null>(null)

// Favorites (pass full objects for proper matching)
const favorites = computed(() => {
  if (!settings.value?.favorites) return []
  return settings.value.favorites
})

// ============================================================================
// Settings
// ============================================================================

onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
  } catch { /* use defaults */ }
})

// Watch for settings changes in storage
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

// Search settings from inspector settings
const searchSettings = computed(() => ({
  byName: settings.value?.search?.byName ?? true,
  byLabel: settings.value?.search?.byLabel ?? false,
  byRootElement: settings.value?.search?.byRootElement ?? false,
  byKey: settings.value?.search?.byKey ?? false,
  byValue: settings.value?.search?.byValue ?? false,
  debounce: settings.value?.search?.debounce ?? 300,
  minLength: settings.value?.search?.minLength ?? 2
}))

// ============================================================================
// Data loading
// ============================================================================

const { treeData, isLoading: treeLoading, error: treeError, refresh } = useTreeData()

watch(treeData, (data) => {
  if (data) {
    entries.value = [...data] as TreeNodeModel[]
    lastUpdated.value = formatDateTime(new Date())
  }
}, { immediate: true })

watch(treeLoading, (loading) => {
  isLoading.value = loading
})

watch(treeError, (err) => {
  error.value = err
})

function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

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

// Filter tree data
const filteredEntries = computed(() => {
  let result = entries.value
  
  // Filter by props only
  if (propsOnly.value) {
    result = result.filter(node => node.props && Object.keys(node.props).length > 0)
  }
  
  // Filter by search term
  const q = debouncedSearchTerm.value.toLowerCase().trim()
  if (q) {
    result = result.filter(node => {
      // Search by name
      if (searchSettings.value.byName && node.name?.toLowerCase().includes(q)) {
        return true
      }
      
      // Search by root element
      if (searchSettings.value.byRootElement) {
        const elementInfo = getElementInfo(node)
        if (elementInfo.toLowerCase().includes(q)) {
          return true
        }
      }
      
      // Search by key
      if (searchSettings.value.byKey && node.props) {
        if (Object.keys(node.props).some(k => k.toLowerCase().includes(q))) {
          return true
        }
      }
      
      // Search by value
      if (searchSettings.value.byValue && node.props) {
        if (Object.values(node.props).some(v => String(v).toLowerCase().includes(q))) {
          return true
        }
      }
      
      return false
    })
  }
  
  // Sort: favorites first
  return result.sort((a, b) => {
    const aFav = isFavoriteNode(a)
    const bFav = isFavoriteNode(b)
    if (aFav && !bFav) return -1
    if (!aFav && bFav) return 1
    return 0
  })
})

function getElementInfo(node: TreeNodeModel): string {
  if (node.element) {
    if (node.element instanceof HTMLElement) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className
        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    } else if (node.element.tagName) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className
        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    }
  }
  
  if (node.rootElement?.tagName) {
    const tag = node.rootElement.tagName.toLowerCase()
    const cls = node.rootElement.className
      ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.')
      : ''
    return tag + cls
  }
  
  return 'Logic only'
}

function getNodeId(node: TreeNodeModel): string {
  // Use componentUid if available
  if (node.componentUid) {
    return node.componentUid
  }
  // Fallback to id if it looks like a path (contains ::)
  if (node.id && node.id.includes('::')) {
    return node.id
  }
  // Final fallback
  return `${node.name}::${getElementInfo(node)}`
}

function isFavoriteNode(node: TreeNodeModel): boolean {
  if (!settings.value?.favorites?.length) return false
  const id = getNodeId(node)
  return isInFavorites(id, settings.value.favorites)
}

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

const entriesCount = computed(() => filteredEntries.value.length)
const totalCount = computed(() => entries.value.length)
const favoritesCount = computed(() => filteredEntries.value.filter(isFavoriteNode).length)

// ============================================================================
// Actions
// ============================================================================

function selectEntry(node: TreeNodeModel) {
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

// Toggle favorite for a node
async function toggleFavorite(node: TreeNodeModel) {
  if (!settings.value) return

  const elementId = getNodeId(node)

  if (isFavoriteNode(node)) {
    // Remove from favorites
    const matchingFav = findMatchingFavorite(elementId, settings.value.favorites)
    if (matchingFav) {
      settings.value.favorites = settings.value.favorites.filter(
        (fav: FavoriteItem) => fav.id !== matchingFav.id
      )
    }
  } else {
    // Add to favorites
    const favoriteItem: FavoriteItem = {
      id: elementId,
      tagName: node.element?.tagName || node.rootElement?.tagName || 'div',
      className: node.element?.className || node.rootElement?.className,
      name: node.name,
      timestamp: new Date().toISOString()
    }
    settings.value.favorites.push(favoriteItem)
  }

  // Save settings
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
      <div class="shrink-0 flex items-center gap-2 p-2 border-b">
        <!-- Left: Title -->
        <h3 class="text-lg font-semibold shrink-0">
          Props
        </h3>
        
        <!-- Search bar -->
        <div class="flex-1 max-w-xs relative">
          <Input
            v-model="searchTerm"
            placeholder="Search components..."
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
            {{ entriesCount }}<span v-if="(searchTerm || propsOnly) && entriesCount !== totalCount" class="text-muted-foreground">/{{ totalCount }}</span>
          </Badge>
          <Badge v-if="favoritesCount > 0" variant="outline" class="text-yellow-500 border-yellow-500/30">
            <Star class="h-3 w-3 mr-1 fill-yellow-500" />
            {{ favoritesCount }}
          </Badge>
          
          <!-- Props only toggle -->
          <div class="flex items-center gap-1.5">
            <Checkbox 
              id="props-only" 
              :checked="propsOnly"
              @update:checked="(val: boolean) => propsOnly = val"
            />
            <Label 
              for="props-only" 
              class="text-xs text-muted-foreground cursor-pointer"
              @click="propsOnly = !propsOnly"
            >
              Props only
            </Label>
          </div>
          
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
      <div class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden">
        <!-- Left: Table -->
        <div class="h-full min-h-0 overflow-hidden">
          <PropsTable
            :entries="filteredEntries"
            :selected-id="selectedNode?.id || null"
            :favorites="favorites"
            @select="selectEntry"
            @toggle-favorite="toggleFavorite"
          />
        </div>
        
        <!-- Right: Details -->
        <div class="h-full min-h-0 overflow-hidden border rounded-lg">
          <ComponentDetails
            v-if="selectedNode"
            :key="selectedNode.id || selectedNode.componentUid"
            :node="selectedNode"
            @back="deselectEntry"
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
