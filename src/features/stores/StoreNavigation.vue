
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
  import { useDebounceFn } from '@vueuse/core'
  import { Input } from '@/components/ui/input'
  import { Badge } from '@/components/ui/badge'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import { SearchIcon, RefreshCw } from 'lucide-vue-next'
  import { Button } from '@/components/ui/button'
  import { useInspectorSettings } from '@/settings/useInspectorSettings'
  import type { InspectorSettings } from '@/settings/inspectorSettings'
  import type { SearchIndexEntry } from '@/types/inspector'
  import StoreListItem from './store-details/StoreListItem.vue'
  import { useRuntime } from '@/runtime'
  
  const runtime = useRuntime()
  
  const STORAGE_KEY_POPUP_STATE = 'vue-inspector-popup-state'
  
  
  const props = defineProps<{
    storesData?: Record<string, any>
    isLoading?: boolean
    error?: string | null
  }>()
  
  const emit = defineEmits<{
    (e: 'refresh'): void
    (e: 'select', store: any): void
  }>()
  
  // Function to load saved state synchronously if possible
  function getSavedPopupState(): any {
    try {
      // Try to get from localStorage as fallback
      const localStorageState = localStorage.getItem(STORAGE_KEY_POPUP_STATE)
      if (localStorageState) {
        const parsed = JSON.parse(localStorageState)
        return parsed
      }
    } catch (e) {
      console.warn('[StoreNavigation] localStorage not available or invalid:', e)
    }
  
    // Default state
    return {
      storesSearchTerm: ''
    }
  }
  
  const popupState = ref<any>(getSavedPopupState())
  
  // Track last update time
  const lastUpdated = ref<string>('')
  
  // Settings and auto refresh
  const settings = ref<InspectorSettings | null>(null)
  const autoRefreshTimer = ref<NodeJS.Timeout | null>(null)
  
  // Search index for stores
  const searchIndex = ref<SearchIndexEntry[]>([])
  
  // Search settings from OptionsTab
  const searchSettings = ref({
    byKey: false, // Search by keys
    byValue: false // Search by values
  })
  
  // Search debounce and min length from settings
  const debounceMs = computed(() => settings.value?.search?.debounce ?? 300)
  const minSearchLength = computed(() => settings.value?.search?.minLength ?? 2)
  
  // Format date and time
  function formatDateTime(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  
  // Handle messages from content script
  function handlePiniaMessage(message: any, respond: (r: unknown) => void) {
    if (message?.type === 'PINIA_SEARCH_INDEX_READY') {
      searchIndex.value = message.index || []
    }
  }
  
  let unsubscribeMessage: (() => void) | null = null
  
  // Load saved popup state and settings on mount
  onMounted(async () => {
    lastUpdated.value = formatDateTime(new Date())
  
    // Listen for messages from content script
    unsubscribeMessage = runtime.onMessage(handlePiniaMessage)
  
    // Build initial search index
    buildSearchIndex()
  
    // Load settings
    try {
      settings.value = await useInspectorSettings()
  
      // Load search settings
      updateSearchSettings()
  
      startAutoRefresh()
    } catch (error) {
      console.error('[StoreNavigation] Failed to load settings:', error)
    }
  
    // Load saved popup state
    const savedState = await runtime.storage.get<any>(STORAGE_KEY_POPUP_STATE)
    if (savedState && typeof savedState === 'object') {
      popupState.value = {
        ...popupState.value,
        ...savedState
      }
      // Инициализируем searchTerm из сохраненного состояния
      searchTerm.value = popupState.value.storesSearchTerm || ''
    }
  })
  
  // Save popup state when it changes
  watch(popupState, (newState) => {
    // Save to runtime storage
    runtime.storage.set(STORAGE_KEY_POPUP_STATE, newState)
  }, { deep: true })
  
  // Watch for settings changes to restart auto refresh
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
  
  // Слушаем изменение видимости панели (для экономии ресурсов)
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
  window.addEventListener('message', visibilityHandler)

  // Cleanup
  onUnmounted(() => {
    stopAutoRefresh()
    unsubscribeMessage?.()
    window.removeEventListener('message', visibilityHandler)
  })
  
  // Преобразуем storesData в массив для отображения
  const storesList = computed(() => {
    if (!props.storesData) return []
    return Object.values(props.storesData)
  })
  
  // Реактивное значение для поиска (с debounce)
  const searchTerm = ref(popupState.value.storesSearchTerm || '')
  
  // Ref для текущей debounced функции
  const debouncedSearchUpdate = ref<any>(null)
  
  // Функция для создания новой debounced функции с текущими настройками
  const updateDebouncedSearch = () => {
    debouncedSearchUpdate.value = useDebounceFn((query: string) => {
      searchTerm.value = query
    }, debounceMs.value)
  }
  
  // Инициализируем debounced функцию
  updateDebouncedSearch()
  
  // Пересоздаем debounced функцию при изменении debounce настроек
  watch(debounceMs, updateDebouncedSearch)
  
  // Watch для popupState.storesSearchTerm с проверкой минимальной длины
  watch(() => popupState.value.storesSearchTerm, (newTerm) => {
    const term = newTerm || ''
    // Проверяем минимальную длину поиска
    if (term.length >= minSearchLength.value || term.length === 0) {
      debouncedSearchUpdate.value?.(term)
    }
  })
  
  // Фильтруем stores по поисковому запросу
  const filteredStores = computed(() => {
    const q = searchTerm.value?.toLowerCase()
    if (!q) return storesList.value
  
    let matchedStoreIds = new Set<string>()
  
    // Проверяем поиск по имени store (если включен)
    if (settings.value?.search?.byName) {
      storesList.value.forEach((store: any) => {
        const baseId = store.baseId || ''
        if (baseId.toLowerCase().includes(q)) {
          matchedStoreIds.add(store.id)
        }
      })
    }
  
    // Дополнительно проверяем поиск по ключам/значениям (если включен)
    if (searchSettings.value.byKey || searchSettings.value.byValue) {
      searchIndex.value.forEach(e => {
        const matchesKey = searchSettings.value.byKey && e.key.toLowerCase().includes(q)
        const matchesValue = searchSettings.value.byValue && e.valueStr.includes(q)
  
        if (matchesKey || matchesValue) {
          matchedStoreIds.add(e.storeId)
        }
      })
    }
  
    return storesList.value.filter(store =>
      matchedStoreIds.has(store.id)
    )
  })
  
  const storesCount = computed(() => filteredStores.value.length)
  
  // Формируем массив активных типов поиска для отображения
  const activeSearchTypes = computed(() => {
    const types: string[] = []
    const searchSettings = settings.value?.search
  
    if (searchSettings?.byName) types.push('Name')
    if (searchSettings?.byKey) types.push('Key')
    if (searchSettings?.byValue) types.push('Value')
  
    return types
  })
  
  const handleRefresh = () => {
    emit('refresh')
    buildSearchIndex()
    lastUpdated.value = formatDateTime(new Date())
  }
  
  // Auto refresh functions
  function startAutoRefresh() {
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value)
    }
  
    if (settings.value?.updates?.autoRefresh && settings.value?.updates?.autoRefreshInterval) {
      autoRefreshTimer.value = setInterval(() => {
        handleRefresh()
      }, settings.value.updates.autoRefreshInterval)
    }
  }
  
  function stopAutoRefresh() {
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value)
      autoRefreshTimer.value = null
    }
  }
  
  // Build search index for stores (only if advanced search is enabled)
  async function buildSearchIndex() {
    if (searchSettings.value.byKey || searchSettings.value.byValue) {
      try {
        const response = await runtime.sendMessage<{
          type: string
          index?: any[]
          error?: string
        }>({
          type: 'PINIA_BUILD_SEARCH_INDEX'
        })
        
        if (response?.index) {
          searchIndex.value = response.index
        }
      } catch (error) {
        console.error('[StoreNavigation] Error sending build search index message:', error)
        searchIndex.value = []
      }
    } else {
      searchIndex.value = []
    }
  }
  
  // Update search settings from inspector settings
  function updateSearchSettings() {
    if (settings.value?.search) {
      const oldByKey = searchSettings.value.byKey
      const oldByValue = searchSettings.value.byValue
  
      searchSettings.value = {
        byKey: settings.value.search.byKey ?? false,
        byValue: settings.value.search.byValue ?? false
      }
  
      // Rebuild search index if advanced search settings changed
      if (oldByKey !== searchSettings.value.byKey || oldByValue !== searchSettings.value.byValue) {
        buildSearchIndex()
      }
    }
  }
  
  const handleSelect = (store: any) => {
    emit('select', store)
  }</script>
  
  <template>
    <div class="h-full flex flex-col">
      <div class="flex justify-between items-start p-1">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-semibold mb-2">
            Available Stores ({{ storesCount }})
          </h3>
          <Button size="sm" variant="ghost" :disabled="isLoading" @click="handleRefresh">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          </Button>
        </div>
        <span class="text-sm text-muted-foreground">
          Updated: {{ isLoading ? 'Loading...' : lastUpdated || 'Just now' }}
        </span>
      </div>
    </div>
  
    <div class="mb-2">
      <div class="relative">
        <Input v-model="popupState.storesSearchTerm" placeholder="Search stores..." class="pl-10" />
        <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
      </div>
  
      <div v-if="activeSearchTypes.length" class="flex items-center gap-1 flex-wrap mt-2">
        <Badge v-for="item in activeSearchTypes" :key="item" variant="secondary">{{ item }}</Badge>
      </div>
    </div>
  
  
    <div class="relative flex-1 min-h-0 border rounded overflow-hidden">
      <ScrollArea class="h-full min-h-0">
        <div class="flex h-full flex-col">
          <div
            v-if="!isLoading && filteredStores.length === 0"
            class="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground"
          >
            <div class="space-y-2">
              <div class="space-y-2 flex flex-col items-center">
                <SearchIcon class="w-6 h-6 text-muted-foreground/60" />
                <div class="text-sm text-muted-foreground">
                  No stores found
                </div>
              </div>
            </div>
          </div>
  
          <div v-else class="flex flex-col gap-1 p-1">
            <StoreListItem
              v-for="(store, index) in filteredStores"
              :key="store.id || index"
              :store="store"
              @select="handleSelect(store)"
            />
          </div>
        </div>
      </ScrollArea>
  
      <div
        v-if="error"
        class="absolute inset-0 z-10 bg-background/80 flex items-center justify-center text-destructive text-sm"
      >
        {{ error }}
      </div>
    </div>
    </div>
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