import { ref, onMounted, onUnmounted, watch, shallowRef, readonly } from 'vue';
import { useInspectorSettings } from '@/settings/useInspectorSettings';
import { StableUpdateManager } from '@/utils/stableUpdate';
import { DataServiceFactory } from '@/services/dataServiceFactory';
// Flood protection constants
const FLOOD_WINDOW_MS = 5000; // 5 seconds window
const MAX_UPDATES_IN_WINDOW = 10; // Max updates allowed in window
const COOLDOWN_MS = 10000; // Cooldown period after flood detected
export function useTreeData() {
    const updateManager = new StableUpdateManager();
    const rawTreeData = shallowRef([]);
    const stableTreeData = shallowRef([]);
    const isLoading = ref(false);
    const error = ref(null);
    const hasLoadedData = ref(false); // Флаг, что данные уже были загружены
    const settings = ref(null);
    const dataService = shallowRef(null);
    // Flood protection state
    const updateTimestamps = [];
    let floodCooldownUntil = 0;
    useInspectorSettings().then(s => {
        settings.value = s;
        dataService.value = DataServiceFactory.createService();
        // Загружаем данные после инициализации настроек
        loadData();
    }).catch((error) => {
        console.error('[hooks/useTreeData] useInspectorSettings failed:', error);
    });
    /**
     * Check if we're in a flood state (too many updates in short time)
     */
    function isFlooding() {
        const now = Date.now();
        // Check if we're still in cooldown
        if (now < floodCooldownUntil) {
            return true;
        }
        // Remove old timestamps outside the window
        while (updateTimestamps.length > 0 && updateTimestamps[0] < now - FLOOD_WINDOW_MS) {
            updateTimestamps.shift();
        }
        // Check if too many updates in window
        if (updateTimestamps.length >= MAX_UPDATES_IN_WINDOW) {
            console.warn('[VueInspector] Props update flood detected, entering cooldown');
            floodCooldownUntil = now + COOLDOWN_MS;
            updateTimestamps.length = 0; // Clear timestamps
            return true;
        }
        return false;
    }
    function updateStableData(newData, forceUpdate = false) {
        // Check for flood protection
        if (isFlooding()) {
            return;
        }
        if (forceUpdate || updateManager.shouldUpdate(newData)) {
            // Track update timestamp
            updateTimestamps.push(Date.now());
            stableTreeData.value = forceUpdate
                ? newData
                : updateManager.updateTree(stableTreeData.value, newData);
        }
    }
    async function loadData(search, forceReload = false, rootFilter) {
        if (!settings.value || !dataService.value || isLoading.value)
            return;
        // Если данные уже загружены и не требуется принудительная перезагрузка, пропускаем
        if (hasLoadedData.value && !forceReload && !search && !rootFilter)
            return;
        isLoading.value = true;
        error.value = null;
        try {
            const options = { blacklist: settings.value?.blacklist, rootFilter };
            let data;
            if (search && dataService.value.refreshComponents) {
                data = await dataService.value.getTreeData(search, forceReload, options);
            }
            else {
                data = await dataService.value.getTreeData(undefined, forceReload, options);
            }
            rawTreeData.value = data;
            updateStableData(data, forceReload);
            hasLoadedData.value = true;
        }
        catch (e) {
            console.error('[hooks/useTreeData] loadData failed:', e);
            error.value = String(e);
        }
        finally {
            isLoading.value = false;
        }
    }
    onMounted(() => {
        // Если настройки уже загружены, загружаем данные сразу
        if (settings.value && dataService.value) {
            loadData();
        }
    });
    let refreshIntervalId = null;
    let cleanupIntervalId = null;
    let refreshInProgress = false; // 🔥 Prevent overlapping refresh calls
    const stopAutoRefresh = () => {
        if (refreshIntervalId !== null)
            clearInterval(refreshIntervalId);
        refreshIntervalId = null;
        if (cleanupIntervalId !== null)
            clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
    };
    const startAutoRefresh = () => {
        stopAutoRefresh();
        const interval = settings.value?.updates?.autoRefreshInterval ?? 5000;
        if (!settings.value?.updates?.autoRefresh)
            return;
        // 🔥 Use async handler with refreshInProgress guard
        refreshIntervalId = window.setInterval(async () => {
            // Skip if previous refresh is still running or loading
            if (refreshInProgress || isLoading.value)
                return;
            refreshInProgress = true;
            try {
                await loadData();
            }
            finally {
                refreshInProgress = false;
            }
        }, interval);
        // Периодическая очистка кэша StableUpdateManager каждые 50 обновлений
        // или каждые 5 минут (что наступит раньше)
        cleanupIntervalId = window.setInterval(() => {
            updateManager.clearCache();
        }, Math.min(5 * 60 * 1000, interval * 50)); // 5 минут или 50 циклов автообновления
    };
    watch(() => settings.value?.updates, () => startAutoRefresh(), { deep: true });
    // Слушаем изменение видимости панели и reconnect
    let isVisible = true;
    const broadcastHandler = (event) => {
        if (!event.data?.__VUE_INSPECTOR__ || !event.data.broadcast)
            return;
        const msgType = event.data.message?.type;
        if (msgType === 'VUE_INSPECTOR_VISIBILITY_CHANGED') {
            isVisible = event.data.message.visible;
            if (isVisible && settings.value?.updates?.autoRefresh) {
                startAutoRefresh();
            }
            else {
                stopAutoRefresh();
            }
        }
        if (msgType === 'DEVTOOLS_RECONNECTED') {
            loadData(undefined, true);
        }
    };
    window.addEventListener('message', broadcastHandler);
    onUnmounted(() => {
        stopAutoRefresh();
        window.removeEventListener('message', broadcastHandler);
    });
    const refresh = (rootFilter) => loadData(undefined, true, rootFilter);
    return {
        treeData: readonly(stableTreeData),
        rawTreeData,
        isLoading,
        error,
        refresh,
        startAutoRefresh,
        stopAutoRefresh,
    };
}
//# sourceMappingURL=useTreeData.js.map