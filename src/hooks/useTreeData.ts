import { ref, onMounted, onUnmounted, watch, shallowRef, readonly } from 'vue'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import type { TreeNodeModel } from '@/types/tree'
import { StableUpdateManager } from '@/utils/stableUpdate'
import { DataServiceFactory } from '@/services/dataServiceFactory'
import type { DataService } from '@/services/dataServiceFactory'
import type { TreeSearchOptions } from '@/types/search'

export function useTreeData() {
    const updateManager = new StableUpdateManager()
    const rawTreeData = shallowRef<TreeNodeModel[]>([])
    const stableTreeData = shallowRef<TreeNodeModel[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const hasLoadedData = ref(false) // Флаг, что данные уже были загружены
    const settings = ref<any>(null)
    const dataService = shallowRef<DataService | null>(null)

    useInspectorSettings().then(s => {
        settings.value = s
        dataService.value = DataServiceFactory.createService()
        // Загружаем данные после инициализации настроек
        loadData()
    })

    function updateStableData(newData: TreeNodeModel[]) {
        if (updateManager.shouldUpdate(newData)) {
            stableTreeData.value = updateManager.updateTree(stableTreeData.value, newData)
            // console.log('🔄 Tree updated:', newData.length)
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
    const stopAutoRefresh = () => {
        if (refreshIntervalId !== null) clearInterval(refreshIntervalId)
        refreshIntervalId = null
    }

    const startAutoRefresh = () => {
        stopAutoRefresh()
        const interval = settings.value?.updates?.autoRefreshInterval ?? 5000
        if (!settings.value?.updates?.autoRefresh) return
        refreshIntervalId = window.setInterval(() => {
            if (!isLoading.value) loadData()
        }, interval)
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
