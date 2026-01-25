import { ref, onMounted, onUnmounted, watch, shallowRef, readonly } from 'vue'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import type { TreeNodeModel } from '@/types/tree'
import { StableUpdateManager } from '@/utils/stableUpdate'
import { DataServiceFactory } from '@/services/dataServiceFactory'
import type { DataService } from '@/services/dataServiceFactory'
import type { TreeSearchOptions } from '@/types/search'

// Flood protection constants
const FLOOD_WINDOW_MS = 5000 // 5 seconds window
const MAX_UPDATES_IN_WINDOW = 10 // Max updates allowed in window
const COOLDOWN_MS = 10000 // Cooldown period after flood detected

export function useTreeData() {
    const updateManager = new StableUpdateManager()
    const rawTreeData = shallowRef<TreeNodeModel[]>([])
    const stableTreeData = shallowRef<TreeNodeModel[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const hasLoadedData = ref(false) // Флаг, что данные уже были загружены
    const settings = ref<any>(null)
    const dataService = shallowRef<DataService | null>(null)
    
    // Flood protection state
    const updateTimestamps: number[] = []
    let floodCooldownUntil = 0

    useInspectorSettings().then(s => {
        settings.value = s
        dataService.value = DataServiceFactory.createService()
        // Загружаем данные после инициализации настроек
        loadData()
    })

    /**
     * Check if we're in a flood state (too many updates in short time)
     */
    function isFlooding(): boolean {
        const now = Date.now()
        
        // Check if we're still in cooldown
        if (now < floodCooldownUntil) {
            return true
        }
        
        // Remove old timestamps outside the window
        while (updateTimestamps.length > 0 && updateTimestamps[0] < now - FLOOD_WINDOW_MS) {
            updateTimestamps.shift()
        }
        
        // Check if too many updates in window
        if (updateTimestamps.length >= MAX_UPDATES_IN_WINDOW) {
            console.warn('[VueInspector] Props update flood detected, entering cooldown')
            floodCooldownUntil = now + COOLDOWN_MS
            updateTimestamps.length = 0 // Clear timestamps
            return true
        }
        
        return false
    }
    
    function updateStableData(newData: TreeNodeModel[]) {
        // Check for flood protection
        if (isFlooding()) {
            return
        }
        
        if (updateManager.shouldUpdate(newData)) {
            // Track update timestamp
            updateTimestamps.push(Date.now())
            stableTreeData.value = updateManager.updateTree(stableTreeData.value, newData)
        }
    }

    async function loadData(search?: TreeSearchOptions, forceReload = false) {
        if (!settings.value || !dataService.value || isLoading.value) return

        // Если данные уже загружены и не требуется принудительная перезагрузка, пропускаем
        if (hasLoadedData.value && !forceReload && !search) return

        isLoading.value = true
        error.value = null

        try {
            let data: TreeNodeModel[]
            if (search && dataService.value.refreshComponents) {
                data = await dataService.value.getTreeData(search)
            } else {
                data = await dataService.value.getTreeData()
            }

            rawTreeData.value = data
            updateStableData(data)
            hasLoadedData.value = true
        } catch (e) {
            error.value = String(e)
        } finally {
            isLoading.value = false
        }
    }

    onMounted(() => {
        // Если настройки уже загружены, загружаем данные сразу
        if (settings.value && dataService.value) {
            loadData()
        }
    })

    let refreshIntervalId: number | null = null
    let cleanupIntervalId: number | null = null
    let refreshInProgress = false // 🔥 Prevent overlapping refresh calls

    const stopAutoRefresh = () => {
        if (refreshIntervalId !== null) clearInterval(refreshIntervalId)
        refreshIntervalId = null
        if (cleanupIntervalId !== null) clearInterval(cleanupIntervalId)
        cleanupIntervalId = null
    }

    const startAutoRefresh = () => {
        stopAutoRefresh()
        const interval = settings.value?.updates?.autoRefreshInterval ?? 5000
        if (!settings.value?.updates?.autoRefresh) return

        // 🔥 Use async handler with refreshInProgress guard
        refreshIntervalId = window.setInterval(async () => {
            // Skip if previous refresh is still running or loading
            if (refreshInProgress || isLoading.value) return
            
            refreshInProgress = true
            try {
                await loadData()
            } finally {
                refreshInProgress = false
            }
        }, interval)

        // Периодическая очистка кэша StableUpdateManager каждые 50 обновлений
        // или каждые 5 минут (что наступит раньше)
        cleanupIntervalId = window.setInterval(() => {
            updateManager.clearCache()
        }, Math.min(5 * 60 * 1000, interval * 50)) // 5 минут или 50 циклов автообновления
    }

    watch(() => settings.value?.updates, () => startAutoRefresh(), { deep: true })

    // Слушаем изменение видимости панели
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

    onUnmounted(() => {
        stopAutoRefresh()
        window.removeEventListener('message', visibilityHandler)
    })

    const refresh = () => loadData(undefined, true)

    return {
        treeData: readonly(stableTreeData),
        rawTreeData,
        isLoading,
        error,
        refresh,
        startAutoRefresh,
        stopAutoRefresh,
    }
}
