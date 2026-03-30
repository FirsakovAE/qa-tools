import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { SearchIcon, RefreshCw, Star } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FacetedFilter } from '@/components/ui/FacetedFilter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PiniaTable from './PiniaTable.vue';
import PiniaDetails from './PiniaDetails.vue';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { useSearchSettings } from '@/composables/useSearchSettings';
import { useRuntime } from '@/runtime';
import { parseSearchTerm } from '@/utils/searchUtils';
import { isStoreInFavorites, matchFavoritePattern } from '@/utils/piniaFavoritesMatcher';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
const runtime = useRuntime();
const emit = defineEmits();
// ============================================================================
// State
// ============================================================================
const entries = ref([]);
const selectedStoreId = ref(null);
const isLoading = ref(false);
const error = ref(null);
const lastUpdated = ref('');
// Search state
const searchTerm = ref('');
const settings = useInspectorSettingsSync();
const { searchSettings, selectedSearchTypes, searchTypeOptions: piniaSearchTypeOptions } = useSearchSettings({
    settings,
    searchKey: 'piniaSearch',
    typeMap: {
        'Name': 'byName',
        'Key': 'byKey',
        'Value': 'byValue',
    }
});
// Matched store IDs from PINIA_SEARCH (for key/value filter)
const matchedStoreIds = ref(new Set());
// ============================================================================
// Data loading
// ============================================================================
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
// Pull-only model: load stores summary via request-response
async function loadStoresSummary() {
    isLoading.value = true;
    error.value = null;
    try {
        // Check content script availability
        let contentScriptReady = false;
        try {
            const pingResponse = await runtime.sendMessage({ type: 'PING' });
            if (pingResponse?.pong) {
                contentScriptReady = true;
            }
        }
        catch (error) {
            if (!isExpectedExtensionError(error)) {
                console.error('[stores/StoresTab] PING failed:', error);
            }
            contentScriptReady = false;
        }
        if (!contentScriptReady) {
            isLoading.value = false;
            return;
        }
        // Request store summary
        const response = await runtime.sendMessage({
            type: 'PINIA_GET_STORES_SUMMARY'
        });
        if (response?.summary) {
            entries.value = Object.values(response.summary);
            lastUpdated.value = formatDateTime(new Date());
            isLoading.value = false;
            applyFilters();
        }
        else if (response?.error) {
            error.value = response.error;
            isLoading.value = false;
        }
        else {
            // Fallback timeout
            setTimeout(() => {
                if (isLoading.value) {
                    isLoading.value = false;
                    if (entries.value.length === 0) {
                        error.value = 'Timeout: Pinia stores not found or not initialized';
                    }
                }
            }, 3000);
        }
    }
    catch (err) {
        if (!isExpectedExtensionError(err)) {
            console.error('[stores/StoresTab] loadStoresSummary failed:', err);
        }
        if (isExpectedExtensionError(err)) {
            error.value = null;
        }
        else {
            error.value = 'Failed to load Pinia stores. Make sure Pinia is installed and initialized.';
        }
        isLoading.value = false;
    }
}
// Auto-refresh logic
let autoRefreshTimer = null;
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    if (settings.value?.updates?.autoRefresh && settings.value?.updates?.autoRefreshInterval) {
        autoRefreshTimer = setInterval(() => {
            if (!isLoading.value) {
                loadStoresSummary();
            }
        }, settings.value.updates.autoRefreshInterval);
    }
}
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}
watch(() => settings.value?.updates?.autoRefresh, (newValue, oldValue) => {
    if (newValue !== oldValue) {
        if (newValue) {
            startAutoRefresh();
        }
        else {
            stopAutoRefresh();
        }
    }
});
watch(() => settings.value?.updates?.autoRefreshInterval, (newValue, oldValue) => {
    if (newValue !== oldValue && settings.value?.updates?.autoRefresh) {
        startAutoRefresh();
    }
});
// Visibility and reconnect handler
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
        loadStoresSummary();
    }
};
// ============================================================================
// Filtering (like PropsTab - PINIA_SEARCH for key/value, local for name)
// ============================================================================
const debouncedSearchTerm = ref('');
const updateDebouncedSearch = useDebounceFn((term) => {
    debouncedSearchTerm.value = term;
}, searchSettings.value.debounce);
watch(searchTerm, (term) => {
    if (term.length >= searchSettings.value.minLength || term.length === 0) {
        updateDebouncedSearch(term);
    }
});
async function applyFilters() {
    const term = debouncedSearchTerm.value;
    const { query, exactMatch } = parseSearchTerm(term);
    const byKey = !!searchSettings.value.byKey;
    const byValue = !!searchSettings.value.byValue;
    const needsKeyValueSearch = (byKey || byValue) && query.length >= (searchSettings.value.minLength ?? 2);
    let matched;
    if (needsKeyValueSearch) {
        try {
            const res = await runtime.sendMessage({
                type: 'PINIA_SEARCH',
                query,
                searchByKey: byKey,
                searchByValue: byValue,
                exactMatch
            });
            matched = new Set((res?.results ?? []).map(r => r.storeId));
        }
        catch (e) {
            if (!isExpectedExtensionError(e)) {
                console.error('[stores/StoresTab] PINIA_SEARCH failed:', e);
            }
            matched = new Set();
        }
    }
    matchedStoreIds.value = matched ?? new Set();
}
watch(debouncedSearchTerm, applyFilters);
watch(searchSettings, applyFilters, { deep: true });
function isFavoriteStore(store) {
    if (!settings.value?.piniaFavorites?.length)
        return false;
    const name = store.baseId || '';
    return isStoreInFavorites(name, settings.value.piniaFavorites);
}
// Filter stores (name: local, key/value: via matchedStoreIds from PINIA_SEARCH)
const filteredEntries = computed(() => {
    const term = debouncedSearchTerm.value;
    const { query, exactMatch } = parseSearchTerm(term);
    const q = query.toLowerCase().trim();
    if (!q)
        return entries.value;
    const matchStr = exactMatch
        ? (s) => s === q
        : (s) => s.includes(q);
    return entries.value.filter(store => {
        if (searchSettings.value.byName && store.baseId && matchStr(store.baseId.toLowerCase())) {
            return true;
        }
        if ((searchSettings.value.byKey || searchSettings.value.byValue) && matchedStoreIds.value.has(store.id)) {
            return true;
        }
        return false;
    });
});
// Sort: favorites first
const sortedEntries = computed(() => {
    const list = [...filteredEntries.value];
    return list.sort((a, b) => {
        const aFav = isFavoriteStore(a);
        const bFav = isFavoriteStore(b);
        if (aFav && !bFav)
            return -1;
        if (!aFav && bFav)
            return 1;
        return 0;
    });
});
// ============================================================================
// Computed
// ============================================================================
const selectedStore = computed(() => {
    if (!selectedStoreId.value)
        return null;
    return entries.value.find(s => s.id === selectedStoreId.value) || null;
});
const entriesCount = computed(() => sortedEntries.value.length);
const totalCount = computed(() => entries.value.length);
const favoritesFound = computed(() => sortedEntries.value.filter(s => isFavoriteStore(s)).length);
const favoritesTotal = computed(() => settings.value?.piniaFavorites?.length ?? 0);
const favoritesLabel = computed(() => {
    const total = favoritesTotal.value;
    if (total === 0)
        return '0';
    return `${favoritesFound.value}/${total}`;
});
// ============================================================================
// Actions
// ============================================================================
function selectStore(store) {
    selectedStoreId.value = store.id;
}
function deselectStore() {
    selectedStoreId.value = null;
}
async function handleRefresh() {
    if (isLoading.value)
        return;
    await loadStoresSummary();
}
async function toggleFavorite(store) {
    if (!settings.value)
        return;
    const name = store.baseId || 'Unknown Store';
    const isFav = isFavoriteStore(store);
    if (isFav) {
        settings.value.piniaFavorites = settings.value.piniaFavorites.filter(f => {
            if (f.id === name || f.name === name)
                return false;
            if (matchFavoritePattern(name, f.id) || matchFavoritePattern(name, f.name))
                return false;
            return true;
        });
    }
    else {
        settings.value.piniaFavorites.push({
            id: name,
            storeId: store.id,
            name,
            timestamp: new Date().toISOString()
        });
    }
    try {
        const settingsToSave = JSON.parse(JSON.stringify(settings.value));
        await runtime.storage.set('vue-inspector-settings', settingsToSave);
    }
    catch (error) {
        console.error('[stores/StoresTab] toggleFavorite save failed:', error);
    }
}
// ============================================================================
// Lifecycle
// ============================================================================
onMounted(() => {
    window.addEventListener('message', broadcastHandler);
    loadStoresSummary();
    // Start auto-refresh if enabled
    if (settings.value?.updates?.autoRefresh) {
        startAutoRefresh();
    }
});
onUnmounted(() => {
    window.removeEventListener('message', broadcastHandler);
    stopAutoRefresh();
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full flex flex-col overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex flex-wrap items-center gap-2 p-2 border-b toolbar-container" },
    ...{ class: ({ 'toolbar-hide-on-details': __VLS_ctx.selectedStore }) },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-container']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-hide-on-details']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 toolbar-left-block" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-left-block']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold shrink-0 toolbar-title" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-title']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1 min-w-[155px] max-w-xs relative" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[155px]']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.Input} */
Input;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    modelValue: (__VLS_ctx.searchTerm),
    placeholder: "Search stores...",
    ...{ class: "pl-8 h-8" },
}));
const __VLS_9 = __VLS_8({
    modelValue: (__VLS_ctx.searchTerm),
    placeholder: "Search stores...",
    ...{ class: "pl-8 h-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['pl-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
let __VLS_12;
/** @ts-ignore @type {typeof ___VLS_components.SearchIcon} */
SearchIcon;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ class: "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" },
}));
const __VLS_14 = __VLS_13({
    ...{ class: "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 toolbar-row1-right" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-row1-right']} */ ;
let __VLS_17;
/** @ts-ignore @type {typeof ___VLS_components.FacetedFilter} */
FacetedFilter;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    modelValue: (__VLS_ctx.selectedSearchTypes),
    title: "Search by",
    options: (__VLS_ctx.piniaSearchTypeOptions),
}));
const __VLS_19 = __VLS_18({
    modelValue: (__VLS_ctx.selectedSearchTypes),
    title: "Search by",
    options: (__VLS_ctx.piniaSearchTypeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 shrink-0 ml-auto toolbar-right-block" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-right-block']} */ ;
let __VLS_22;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
    variant: "secondary",
    ...{ class: "font-mono" },
}));
const __VLS_24 = __VLS_23({
    variant: "secondary",
    ...{ class: "font-mono" },
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
const { default: __VLS_27 } = __VLS_25.slots;
(__VLS_ctx.entriesCount);
if (__VLS_ctx.searchTerm && __VLS_ctx.entriesCount !== __VLS_ctx.totalCount) {
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (__VLS_ctx.totalCount);
}
// @ts-ignore
[selectedStore, searchTerm, searchTerm, selectedSearchTypes, piniaSearchTypeOptions, entriesCount, entriesCount, totalCount, totalCount,];
var __VLS_25;
let __VLS_28;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ 'onClick': {} },
    variant: "outline",
    ...{ class: "cursor-pointer transition-colors" },
    ...{ class: (__VLS_ctx.favoritesFound > 0
            ? 'text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10'
            : 'text-muted-foreground border-muted hover:bg-muted/50') },
}));
const __VLS_30 = __VLS_29({
    ...{ 'onClick': {} },
    variant: "outline",
    ...{ class: "cursor-pointer transition-colors" },
    ...{ class: (__VLS_ctx.favoritesFound > 0
            ? 'text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10'
            : 'text-muted-foreground border-muted hover:bg-muted/50') },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_33;
const __VLS_34 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('navigateToOptions', 'pinia-favorites-section');
            // @ts-ignore
            [favoritesFound, emit,];
        } });
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
const { default: __VLS_35 } = __VLS_31.slots;
let __VLS_36;
/** @ts-ignore @type {typeof ___VLS_components.Star} */
Star;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ class: "h-3 w-3 mr-1" },
    ...{ class: (__VLS_ctx.favoritesFound > 0 ? 'fill-yellow-500' : 'fill-muted-foreground') },
}));
const __VLS_38 = __VLS_37({
    ...{ class: "h-3 w-3 mr-1" },
    ...{ class: (__VLS_ctx.favoritesFound > 0 ? 'fill-yellow-500' : 'fill-muted-foreground') },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
(__VLS_ctx.favoritesLabel);
// @ts-ignore
[favoritesFound, favoritesLabel,];
var __VLS_31;
var __VLS_32;
let __VLS_41;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({}));
const __VLS_43 = __VLS_42({}, ...__VLS_functionalComponentArgsRest(__VLS_42));
const { default: __VLS_46 } = __VLS_44.slots;
let __VLS_47;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
    asChild: true,
}));
const __VLS_49 = __VLS_48({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
const { default: __VLS_52 } = __VLS_50.slots;
let __VLS_53;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    disabled: (__VLS_ctx.isLoading),
}));
const __VLS_55 = __VLS_54({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    disabled: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
let __VLS_58;
const __VLS_59 = ({ click: {} },
    { onClick: (__VLS_ctx.handleRefresh) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_60 } = __VLS_56.slots;
let __VLS_61;
/** @ts-ignore @type {typeof ___VLS_components.RefreshCw} */
RefreshCw;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
    ...{ class: "h-4 w-4" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
}));
const __VLS_63 = __VLS_62({
    ...{ class: "h-4 w-4" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_62));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
// @ts-ignore
[isLoading, isLoading, handleRefresh,];
var __VLS_56;
var __VLS_57;
// @ts-ignore
[];
var __VLS_50;
let __VLS_66;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
    side: "bottom",
}));
const __VLS_68 = __VLS_67({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_67));
const { default: __VLS_71 } = __VLS_69.slots;
// @ts-ignore
[];
var __VLS_69;
// @ts-ignore
[];
var __VLS_44;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground whitespace-nowrap" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
(__VLS_ctx.isLoading ? 'Loading...' : __VLS_ctx.lastUpdated);
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden responsive-panels" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['responsive-panels']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full min-h-0 overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
const __VLS_72 = PiniaTable;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    ...{ 'onSelect': {} },
    ...{ 'onToggleFavorite': {} },
    entries: (__VLS_ctx.sortedEntries),
    selectedId: (__VLS_ctx.selectedStoreId),
    piniaFavorites: (__VLS_ctx.settings?.piniaFavorites ?? []),
    isLoading: (__VLS_ctx.isLoading),
}));
const __VLS_74 = __VLS_73({
    ...{ 'onSelect': {} },
    ...{ 'onToggleFavorite': {} },
    entries: (__VLS_ctx.sortedEntries),
    selectedId: (__VLS_ctx.selectedStoreId),
    piniaFavorites: (__VLS_ctx.settings?.piniaFavorites ?? []),
    isLoading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
let __VLS_77;
const __VLS_78 = ({ select: {} },
    { onSelect: (__VLS_ctx.selectStore) });
const __VLS_79 = ({ toggleFavorite: {} },
    { onToggleFavorite: (__VLS_ctx.toggleFavorite) });
var __VLS_75;
var __VLS_76;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full min-h-0 overflow-hidden border rounded-lg details-panel" },
    ...{ class: ({ 'details-active': __VLS_ctx.selectedStore }) },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['details-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['details-active']} */ ;
if (__VLS_ctx.selectedStore) {
    const __VLS_80 = PiniaDetails;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        ...{ 'onBack': {} },
        key: (__VLS_ctx.selectedStore.id),
        store: (__VLS_ctx.selectedStore),
    }));
    const __VLS_82 = __VLS_81({
        ...{ 'onBack': {} },
        key: (__VLS_ctx.selectedStore.id),
        store: (__VLS_ctx.selectedStore),
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    let __VLS_85;
    const __VLS_86 = ({ back: {} },
        { onBack: (__VLS_ctx.deselectStore) });
    var __VLS_83;
    var __VLS_84;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex items-center justify-center text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "absolute inset-0 z-10 bg-background/80 flex items-center justify-center text-destructive_text text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-background/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.error);
}
// @ts-ignore
[selectedStore, selectedStore, selectedStore, selectedStore, isLoading, isLoading, lastUpdated, sortedEntries, selectedStoreId, settings, selectStore, toggleFavorite, deselectStore, error, error,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
//# sourceMappingURL=StoresTab.vue.js.map