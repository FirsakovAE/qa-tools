import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { SearchIcon, RefreshCw, Star, MousePointer2, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FacetedFilter } from '@/components/ui/FacetedFilter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PropsTable from './PropsTable.vue';
import ComponentDetails from './prop-details/ComponentDetails.vue';
import { useInspectorSettings, useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { useSearchSettings } from '@/composables/useSearchSettings';
import { useTreeData } from '@/hooks/useTreeData';
import { useRuntime } from '@/runtime';
import { safeRuntime, safeTabs, safeStorage } from '@/utils/extensionBridge';
import { isInFavorites, matchFavoriteIds } from '@/utils/favoritesMatcher';
import { parseSearchTerm } from '@/utils/searchUtils';
import { createPropsRow, updateRowsVisibility, sortRowsByFavorite } from './types';
import { getPropsFavoriteNodeId } from './propsFavorites';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
const runtime = useRuntime();
const emit = defineEmits();
// ============================================================================
// State - OPTIMIZED MODEL
// ============================================================================
// STABLE rows array - reference NEVER changes, only row.visible mutates
const rows = shallowRef([]);
// Trigger for forcing re-render after visibility mutation
const visibilityVersion = ref(0);
const selectedNode = ref(null);
const isLoading = ref(false);
const error = ref(null);
const lastUpdated = ref('');
// Inspector mode (element picker like Chrome DevTools Elements)
const isInspectorMode = ref(false);
const inspectRootUid = ref(null);
// Search state
const searchTerm = ref('');
const debouncedSearchTerm = ref('');
const settings = useInspectorSettingsSync();
const { searchSettings, selectedSearchTypes, searchTypeOptions: propsSearchTypeOptions } = useSearchSettings({
    settings,
    searchKey: 'propsSearch',
    typeMap: {
        'Name': 'byName',
        'Label': 'byLabel',
        'Root': 'byRootElement',
        'Key': 'byKey',
        'Value': 'byValue',
    }
});
// Favorites (pass full objects for proper matching)
const favorites = computed(() => {
    if (!settings.value?.favorites)
        return [];
    return settings.value.favorites;
});
// ============================================================================
// Helper functions - MUST BE DEFINED BEFORE watches that use them
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
function getNodeId(node) {
    return getPropsFavoriteNodeId(node);
}
function isFavoriteNode(node) {
    if (!settings.value?.favorites?.length)
        return false;
    const id = getNodeId(node);
    return isInFavorites(id, settings.value.favorites);
}
async function applyFilters() {
    const term = debouncedSearchTerm.value;
    const { query, exactMatch } = parseSearchTerm(term);
    const byKey = !!searchSettings.value.byKey;
    const byValue = !!searchSettings.value.byValue;
    const needsKeyValueSearch = (byKey || byValue) && query.length >= (searchSettings.value.minLength ?? 2);
    let matchedUids;
    if (needsKeyValueSearch) {
        try {
            const res = await runtime.sendMessage({
                type: 'PROPS_SEARCH',
                query,
                searchByKey: byKey,
                searchByValue: byValue,
                exactMatch
            });
            matchedUids = new Set((res?.results ?? []).map(r => r.uid));
        }
        catch (e) {
            if (!isExpectedExtensionError(e)) {
                console.error('[props/PropsTab] PROPS_SEARCH failed:', e);
            }
            matchedUids = new Set();
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
    });
    visibilityVersion.value++;
}
let updatingFavorites = false;
function updateFavoriteFlags() {
    if (updatingFavorites)
        return;
    updatingFavorites = true;
    try {
        if (!settings.value?.favorites?.length) {
            for (const row of rows.value)
                row.isFavoriteFlag = false;
            visibilityVersion.value++;
            return;
        }
        for (const row of rows.value)
            row.isFavoriteFlag = false;
        const nodeIdUpdates = [];
        for (const fav of settings.value.favorites) {
            const candidates = rows.value.filter(r => {
                const sid = getNodeId(r);
                return matchFavoriteIds(sid, fav.id);
            });
            if (candidates.length === 0)
                continue;
            if (candidates.length === 1) {
                candidates[0].isFavoriteFlag = true;
                if (fav.nodeId && fav.nodeId !== candidates[0].id) {
                    nodeIdUpdates.push({ fav, newNodeId: candidates[0].id });
                }
                continue;
            }
            // Multiple candidates — use nodeId to pick the right one
            if (fav.nodeId) {
                const exact = candidates.find(r => r.id === fav.nodeId);
                if (exact) {
                    exact.isFavoriteFlag = true;
                    continue;
                }
            }
            // nodeId stale or missing — mark first candidate
            candidates[0].isFavoriteFlag = true;
            nodeIdUpdates.push({ fav, newNodeId: candidates[0].id });
        }
        sortRowsByFavorite(rows.value);
        visibilityVersion.value++;
        // Apply nodeId updates outside the reactive pass to avoid triggering watchers
        if (nodeIdUpdates.length > 0) {
            for (const { fav, newNodeId } of nodeIdUpdates) {
                fav.nodeId = newNodeId;
            }
            try {
                const settingsToSave = JSON.parse(JSON.stringify(settings.value));
                runtime.storage.set('vue-inspector-settings', settingsToSave).catch((error) => {
                    console.error('[props/PropsTab] Failed to save favorites nodeId:', error);
                });
            }
            catch (error) {
                console.error('[props/PropsTab] updateFavoriteFlags JSON/save failed:', error);
            }
        }
    }
    finally {
        updatingFavorites = false;
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
        updateFavoriteFlags();
    }
}, { deep: true });
// When blacklist changes, refresh (blacklist applied at traversal stage)
watch(() => settings.value?.blacklist, () => {
    if (rows.value.length && treeData.value?.length)
        refresh();
}, { deep: true });
// Watch for settings changes in storage (extension / devtools cross-tab sync)
const storage = safeStorage();
let storageListener = null;
if (storage?.onChanged) {
    storageListener = (changes) => {
        const settingsKey = 'vue-inspector-settings';
        if (changes[settingsKey]) {
            useInspectorSettings().then(newSettings => {
                settings.value = newSettings;
            }).catch((error) => {
                console.error('[props/PropsTab] storageListener useInspectorSettings failed:', error);
            });
        }
    };
    storage.onChanged.addListener(storageListener);
}
// ============================================================================
// Data loading
// ============================================================================
const { treeData, isLoading: treeLoading, error: treeError, refresh } = useTreeData();
// Transform incoming data to PropsRow format (blacklist applied at traversal)
watch(treeData, (data) => {
    if (data) {
        const newRows = data.map(node => createPropsRow(node, false));
        rows.value = newRows;
        // Batch favorite matching with nodeId disambiguation
        updateFavoriteFlags();
        // Apply current visibility filters
        updateRowsVisibility(rows.value, {
            searchTerm: debouncedSearchTerm.value,
            searchByName: !!searchSettings.value.byName,
            searchByRootElement: !!searchSettings.value.byRootElement,
            searchByKey: !!searchSettings.value.byKey,
            searchByValue: !!searchSettings.value.byValue
        });
        lastUpdated.value = formatDateTime(new Date());
    }
}, { immediate: true });
watch(treeLoading, (loading) => {
    isLoading.value = loading;
});
watch(treeError, (err) => {
    error.value = err;
});
// Auto-refresh logic
let autoRefreshTimer = null;
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    if (settings.value?.updates?.autoRefresh && settings.value?.updates?.autoRefreshInterval) {
        autoRefreshTimer = window.setInterval(async () => {
            if (!isLoading.value) {
                await refresh();
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
watch(() => settings.value?.updates?.autoRefresh, (autoRefresh) => {
    if (autoRefresh) {
        startAutoRefresh();
    }
    else {
        stopAutoRefresh();
    }
});
watch(() => settings.value?.updates?.autoRefreshInterval, () => {
    if (settings.value?.updates?.autoRefresh) {
        startAutoRefresh();
    }
});
watch(settings, (newSettings) => {
    if (newSettings?.updates?.autoRefresh) {
        startAutoRefresh();
    }
});
// ============================================================================
// Filtering - OPTIMIZED (mutates row.visible, zero array creation)
// ============================================================================
const updateDebouncedSearch = useDebounceFn((term) => {
    debouncedSearchTerm.value = term;
}, searchSettings.value.debounce);
watch(searchTerm, (term) => {
    if (term.length >= searchSettings.value.minLength || term.length === 0) {
        updateDebouncedSearch(term);
    }
});
// Watch filter changes
watch([debouncedSearchTerm], applyFilters);
watch(searchSettings, applyFilters, { deep: true });
/**
 * Visible rows for RecycleScroller
 * Virtualization REQUIRES filtered array (scroller calculates scroll height from items.length)
 */
const visibleRows = computed(() => {
    // Touch visibilityVersion to create dependency
    void visibilityVersion.value;
    return rows.value.filter(r => r.visible);
});
// ============================================================================
// Computed
// ============================================================================
// Counts based on visibleRows (already computed and cached)
const entriesCount = computed(() => visibleRows.value.length);
const totalCount = computed(() => rows.value.length);
const favoritesFound = computed(() => visibleRows.value.filter(r => r.isFavoriteFlag).length);
const favoritesTotal = computed(() => settings.value?.favorites?.length ?? 0);
const favoritesLabel = computed(() => {
    const total = favoritesTotal.value;
    if (total === 0)
        return '0';
    return `${favoritesFound.value}/${total}`;
});
// ============================================================================
// Actions
// ============================================================================
async function selectEntry(node) {
    selectedNode.value = node;
    const needsProps = node.hasPropsFlag && (!node.props || Object.keys(node.props).length === 0);
    if (needsProps)
        await handleRefreshSelected();
}
function deselectEntry() {
    selectedNode.value = null;
}
async function handleRefresh() {
    if (isLoading.value)
        return;
    await refresh(inspectRootUid.value != null ? { rootElementUid: inspectRootUid.value } : undefined);
    lastUpdated.value = formatDateTime(new Date());
}
/** Refresh only the selected component's props (no full tree reload) */
async function handleRefreshSelected() {
    const node = selectedNode.value;
    if (!node || isLoading.value)
        return;
    const componentPath = node.id;
    if (!componentPath || !componentPath.startsWith('uid:'))
        return;
    isLoading.value = true;
    try {
        const response = await runtime.sendMessage({
            type: 'GET_COMPONENT_PROPS',
            componentUid: componentPath,
            componentPathFallback: node.componentUid || undefined
        });
        const freshProps = response?.props ?? {};
        const rawProps = response?.rawProps ?? {};
        const newUid = response?.newUid;
        selectedNode.value = {
            ...node,
            id: newUid != null ? `uid:${newUid}` : node.id,
            componentUid: node.componentUid,
            props: freshProps,
            rawProps,
            jsonProps: JSON.stringify(freshProps, null, 2)
        };
        lastUpdated.value = formatDateTime(new Date());
    }
    catch (error) {
        if (!isExpectedExtensionError(error)) {
            console.error('[props/PropsTab] handleRefreshSelected GET_COMPONENT_PROPS failed:', error);
        }
        // Fallback: full refresh if single-component refresh fails
        await refresh();
        await nextTick();
        const updated = rows.value.find(r => r.id === node.id || r.componentUid === node.componentUid);
        if (updated)
            selectedNode.value = updated;
        lastUpdated.value = formatDateTime(new Date());
    }
    finally {
        isLoading.value = false;
    }
}
async function ignoreByName(node) {
    if (!settings.value?.blacklist)
        return;
    const name = node.name?.trim();
    if (!name)
        return;
    const { active, inactive } = settings.value.blacklist;
    if (active.includes(name) || inactive.includes(name))
        return;
    active.push(name);
    try {
        const settingsToSave = JSON.parse(JSON.stringify(settings.value));
        await runtime.storage.set('vue-inspector-settings', settingsToSave);
    }
    catch (error) {
        console.error('[props/PropsTab] ignoreByName save failed:', error);
    }
}
// Toggle favorite for a node (NO sorting - element stays in place)
async function toggleFavorite(node) {
    if (!settings.value)
        return;
    const elementId = getNodeId(node);
    if (node.isFavoriteFlag) {
        // Remove: prefer nodeId match, then fall back to stable id
        const stableMatches = settings.value.favorites.filter(f => matchFavoriteIds(elementId, f.id));
        const toRemove = stableMatches.find(f => f.nodeId === node.id) || stableMatches[0];
        if (toRemove) {
            settings.value.favorites = settings.value.favorites.filter((fav) => fav !== toRemove);
        }
        node.isFavoriteFlag = false;
    }
    else {
        // Add to favorites with session-specific nodeId
        const favoriteItem = {
            id: elementId,
            nodeId: node.id,
            tagName: node.element?.tagName || node.rootElement?.tagName || 'div',
            className: node.element?.className || node.rootElement?.className,
            name: node.name,
            timestamp: new Date().toISOString()
        };
        settings.value.favorites.push(favoriteItem);
        node.isFavoriteFlag = true;
    }
    // Save settings (NO sorting - element stays in place)
    try {
        const settingsToSave = JSON.parse(JSON.stringify(settings.value));
        await runtime.storage.set('vue-inspector-settings', settingsToSave);
    }
    catch (error) {
        console.error('[props/PropsTab] toggleFavorite save failed:', error);
    }
}
// ============================================================================
// Inspector mode (element picker)
// ============================================================================
async function toggleInspectorMode() {
    if (isInspectorMode.value) {
        // Exit inspector mode only (filter stays)
        isInspectorMode.value = false;
        await runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' });
    }
    else {
        // Enter: refresh first (lazy load), then start inspector
        await refresh(inspectRootUid.value != null ? { rootElementUid: inspectRootUid.value } : undefined);
        isInspectorMode.value = true;
        await runtime.sendMessage({
            type: 'PROPS_INSPECTOR_START',
            theme: settings.value?.theme ?? 'dark',
            collapseOverlayOnPropsInspect: settings.value?.collapseOverlayOnPropsInspect !== false
        });
    }
}
async function handleInspectorElementSelected(uid) {
    inspectRootUid.value = uid;
    isInspectorMode.value = false;
    await runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' });
    refresh({ rootElementUid: uid });
}
async function clearInspectFilter() {
    inspectRootUid.value = null;
    await refresh();
}
/** Esc while focus is in DevTools / UI iframe — content script on the page never sees this key. */
function onInspectorEscapeKeydown(e) {
    if (!isInspectorMode.value || e.key !== 'Escape')
        return;
    e.preventDefault();
    e.stopPropagation();
    isInspectorMode.value = false;
    runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' }).catch(() => { });
}
watch(isInspectorMode, active => {
    if (active) {
        window.addEventListener('keydown', onInspectorEscapeKeydown, true);
    }
    else {
        window.removeEventListener('keydown', onInspectorEscapeKeydown, true);
    }
});
// Listen for inspector events from content script (via devtools port broadcast)
let inspectorUnsubscribe = null;
onMounted(() => {
    inspectorUnsubscribe = runtime.onMessage((msg) => {
        if (msg.type === 'PROPS_INSPECTOR_ELEMENT_SELECTED' && typeof msg.uid === 'number') {
            handleInspectorElementSelected(msg.uid);
        }
        else if (msg.type === 'PROPS_INSPECTOR_CANCELLED') {
            isInspectorMode.value = false;
        }
    });
});
// Exit inspector on tab switch, DevTools close
onUnmounted(() => {
    window.removeEventListener('keydown', onInspectorEscapeKeydown, true);
    if (inspectorUnsubscribe) {
        inspectorUnsubscribe();
        inspectorUnsubscribe = null;
    }
    if (isInspectorMode.value) {
        runtime.sendMessage({ type: 'PROPS_INSPECTOR_STOP' }).catch(() => { });
    }
});
// ============================================================================
// Highlight
// ============================================================================
async function unhighlightElements() {
    try {
        const runtime = safeRuntime();
        const tabsApi = safeTabs();
        if (!runtime || !tabsApi)
            return;
        const tabs = await tabsApi.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id)
            return;
        await runtime.sendMessage({
            type: 'UNHIGHLIGHT_ELEMENT',
            tabId: tabs[0].id
        });
    }
    catch (error) {
        if (!isExpectedExtensionError(error)) {
            console.error('[props/PropsTab] unhighlightElements failed:', error);
        }
    }
}
watch(searchTerm, val => {
    if (val.trim()) {
        unhighlightElements();
    }
});
// ============================================================================
// Lifecycle
// ============================================================================
onMounted(() => {
    lastUpdated.value = formatDateTime(new Date());
});
onUnmounted(() => {
    stopAutoRefresh();
    if (storage?.onChanged && storageListener) {
        storage.onChanged.removeListener(storageListener);
    }
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
    ...{ class: ({ 'toolbar-hide-on-details': __VLS_ctx.selectedNode }) },
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
    placeholder: "Search components...",
    ...{ class: "pl-8 h-8" },
}));
const __VLS_9 = __VLS_8({
    modelValue: (__VLS_ctx.searchTerm),
    placeholder: "Search components...",
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
    options: (__VLS_ctx.propsSearchTypeOptions),
}));
const __VLS_19 = __VLS_18({
    modelValue: (__VLS_ctx.selectedSearchTypes),
    title: "Search by",
    options: (__VLS_ctx.propsSearchTypeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "inspect-inline" },
});
/** @type {__VLS_StyleScopedClasses['inspect-inline']} */ ;
let __VLS_22;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({}));
const __VLS_24 = __VLS_23({}, ...__VLS_functionalComponentArgsRest(__VLS_23));
const { default: __VLS_27 } = __VLS_25.slots;
let __VLS_28;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    asChild: true,
}));
const __VLS_30 = __VLS_29({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
const { default: __VLS_33 } = __VLS_31.slots;
let __VLS_34;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "inspect-btn h-8 gap-1.5" },
    ...{ class: (__VLS_ctx.isInspectorMode ? 'border-primary bg-primary/10 text-primary' : '') },
    disabled: (__VLS_ctx.isLoading),
}));
const __VLS_36 = __VLS_35({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "inspect-btn h-8 gap-1.5" },
    ...{ class: (__VLS_ctx.isInspectorMode ? 'border-primary bg-primary/10 text-primary' : '') },
    disabled: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
let __VLS_39;
const __VLS_40 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleInspectorMode) });
/** @type {__VLS_StyleScopedClasses['inspect-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
const { default: __VLS_41 } = __VLS_37.slots;
let __VLS_42;
/** @ts-ignore @type {typeof ___VLS_components.MousePointer2} */
MousePointer2;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
    ...{ class: "h-3.5 w-3.5 shrink-0" },
    'aria-hidden': true,
}));
const __VLS_44 = __VLS_43({
    ...{ class: "h-3.5 w-3.5 shrink-0" },
    'aria-hidden': true,
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inspect-btn-label text-xs font-medium" },
});
/** @type {__VLS_StyleScopedClasses['inspect-btn-label']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
// @ts-ignore
[selectedNode, searchTerm, selectedSearchTypes, propsSearchTypeOptions, isInspectorMode, isLoading, toggleInspectorMode,];
var __VLS_37;
var __VLS_38;
// @ts-ignore
[];
var __VLS_31;
let __VLS_47;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
    side: "bottom",
}));
const __VLS_49 = __VLS_48({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
const { default: __VLS_52 } = __VLS_50.slots;
// @ts-ignore
[];
var __VLS_50;
// @ts-ignore
[];
var __VLS_25;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 shrink-0 ml-auto toolbar-right-block" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-right-block']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hidden inspect-wrapped" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['inspect-wrapped']} */ ;
let __VLS_53;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({}));
const __VLS_55 = __VLS_54({}, ...__VLS_functionalComponentArgsRest(__VLS_54));
const { default: __VLS_58 } = __VLS_56.slots;
let __VLS_59;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({
    asChild: true,
}));
const __VLS_61 = __VLS_60({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_60));
const { default: __VLS_64 } = __VLS_62.slots;
let __VLS_65;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "inspect-btn h-8 gap-1.5" },
    ...{ class: (__VLS_ctx.isInspectorMode ? 'border-primary bg-primary/10 text-primary' : '') },
    disabled: (__VLS_ctx.isLoading),
}));
const __VLS_67 = __VLS_66({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "inspect-btn h-8 gap-1.5" },
    ...{ class: (__VLS_ctx.isInspectorMode ? 'border-primary bg-primary/10 text-primary' : '') },
    disabled: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
let __VLS_70;
const __VLS_71 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleInspectorMode) });
/** @type {__VLS_StyleScopedClasses['inspect-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
const { default: __VLS_72 } = __VLS_68.slots;
let __VLS_73;
/** @ts-ignore @type {typeof ___VLS_components.MousePointer2} */
MousePointer2;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
    ...{ class: "h-3.5 w-3.5 shrink-0" },
    'aria-hidden': true,
}));
const __VLS_75 = __VLS_74({
    ...{ class: "h-3.5 w-3.5 shrink-0" },
    'aria-hidden': true,
}, ...__VLS_functionalComponentArgsRest(__VLS_74));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inspect-btn-label text-xs font-medium" },
});
/** @type {__VLS_StyleScopedClasses['inspect-btn-label']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
// @ts-ignore
[isInspectorMode, isLoading, toggleInspectorMode,];
var __VLS_68;
var __VLS_69;
// @ts-ignore
[];
var __VLS_62;
let __VLS_78;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
    side: "bottom",
}));
const __VLS_80 = __VLS_79({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_79));
const { default: __VLS_83 } = __VLS_81.slots;
// @ts-ignore
[];
var __VLS_81;
// @ts-ignore
[];
var __VLS_56;
__VLS_asFunctionalElement(__VLS_intrinsics.div)({
    ...{ class: "hidden flex-1 inspect-spacer" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['inspect-spacer']} */ ;
if (__VLS_ctx.inspectRootUid != null) {
    let __VLS_84;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
    const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
    const { default: __VLS_89 } = __VLS_87.slots;
    let __VLS_90;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
        asChild: true,
    }));
    const __VLS_92 = __VLS_91({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    const { default: __VLS_95 } = __VLS_93.slots;
    let __VLS_96;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "filtered-badge cursor-pointer gap-1.5 pl-2 pr-1.5 py-1 text-amber-600 border-amber-500/40 hover:bg-amber-500/10 dark:text-amber-400 dark:border-amber-400/40 dark:hover:bg-amber-400/10 transition-colors" },
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "filtered-badge cursor-pointer gap-1.5 pl-2 pr-1.5 py-1 text-amber-600 border-amber-500/40 hover:bg-amber-500/10 dark:text-amber-400 dark:border-amber-400/40 dark:hover:bg-amber-400/10 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_101;
    const __VLS_102 = ({ click: {} },
        { onClick: (__VLS_ctx.clearInspectFilter) });
    /** @type {__VLS_StyleScopedClasses['filtered-badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['pr-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-amber-400']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-amber-400/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:hover:bg-amber-400/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    const { default: __VLS_103 } = __VLS_99.slots;
    let __VLS_104;
    /** @ts-ignore @type {typeof ___VLS_components.MousePointer2} */
    MousePointer2;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        ...{ class: "h-3 w-3 shrink-0" },
        'aria-hidden': true,
    }));
    const __VLS_106 = __VLS_105({
        ...{ class: "h-3 w-3 shrink-0" },
        'aria-hidden': true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "filtered-badge-label text-xs font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['filtered-badge-label']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    let __VLS_109;
    /** @ts-ignore @type {typeof ___VLS_components.X} */
    X;
    // @ts-ignore
    const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({
        ...{ class: "h-3 w-3 shrink-0 ml-0.5 opacity-70" },
        'aria-hidden': true,
    }));
    const __VLS_111 = __VLS_110({
        ...{ class: "h-3 w-3 shrink-0 ml-0.5 opacity-70" },
        'aria-hidden': true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_110));
    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    // @ts-ignore
    [inspectRootUid, clearInspectFilter,];
    var __VLS_99;
    var __VLS_100;
    // @ts-ignore
    [];
    var __VLS_93;
    let __VLS_114;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
        side: "bottom",
    }));
    const __VLS_116 = __VLS_115({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    const { default: __VLS_119 } = __VLS_117.slots;
    // @ts-ignore
    [];
    var __VLS_117;
    // @ts-ignore
    [];
    var __VLS_87;
}
let __VLS_120;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    variant: "secondary",
    ...{ class: "font-mono" },
}));
const __VLS_122 = __VLS_121({
    variant: "secondary",
    ...{ class: "font-mono" },
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
const { default: __VLS_125 } = __VLS_123.slots;
(__VLS_ctx.entriesCount);
if (__VLS_ctx.searchTerm && __VLS_ctx.entriesCount !== __VLS_ctx.totalCount) {
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (__VLS_ctx.totalCount);
}
// @ts-ignore
[searchTerm, entriesCount, entriesCount, totalCount, totalCount,];
var __VLS_123;
let __VLS_126;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({
    ...{ 'onClick': {} },
    variant: "outline",
    ...{ class: "cursor-pointer transition-colors" },
    ...{ class: (__VLS_ctx.favoritesFound > 0
            ? 'text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10'
            : 'text-muted-foreground border-muted hover:bg-muted/50') },
}));
const __VLS_128 = __VLS_127({
    ...{ 'onClick': {} },
    variant: "outline",
    ...{ class: "cursor-pointer transition-colors" },
    ...{ class: (__VLS_ctx.favoritesFound > 0
            ? 'text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10'
            : 'text-muted-foreground border-muted hover:bg-muted/50') },
}, ...__VLS_functionalComponentArgsRest(__VLS_127));
let __VLS_131;
const __VLS_132 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('navigateToOptions', 'favorites-section');
            // @ts-ignore
            [favoritesFound, emit,];
        } });
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
const { default: __VLS_133 } = __VLS_129.slots;
let __VLS_134;
/** @ts-ignore @type {typeof ___VLS_components.Star} */
Star;
// @ts-ignore
const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
    ...{ class: "h-3 w-3 mr-1" },
    ...{ class: (__VLS_ctx.favoritesFound > 0 ? 'fill-yellow-500' : 'fill-muted-foreground') },
}));
const __VLS_136 = __VLS_135({
    ...{ class: "h-3 w-3 mr-1" },
    ...{ class: (__VLS_ctx.favoritesFound > 0 ? 'fill-yellow-500' : 'fill-muted-foreground') },
}, ...__VLS_functionalComponentArgsRest(__VLS_135));
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
(__VLS_ctx.favoritesLabel);
// @ts-ignore
[favoritesFound, favoritesLabel,];
var __VLS_129;
var __VLS_130;
let __VLS_139;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({}));
const __VLS_141 = __VLS_140({}, ...__VLS_functionalComponentArgsRest(__VLS_140));
const { default: __VLS_144 } = __VLS_142.slots;
let __VLS_145;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
    asChild: true,
}));
const __VLS_147 = __VLS_146({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_146));
const { default: __VLS_150 } = __VLS_148.slots;
let __VLS_151;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    disabled: (__VLS_ctx.isLoading),
}));
const __VLS_153 = __VLS_152({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    disabled: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_152));
let __VLS_156;
const __VLS_157 = ({ click: {} },
    { onClick: (__VLS_ctx.handleRefresh) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_158 } = __VLS_154.slots;
let __VLS_159;
/** @ts-ignore @type {typeof ___VLS_components.RefreshCw} */
RefreshCw;
// @ts-ignore
const __VLS_160 = __VLS_asFunctionalComponent(__VLS_159, new __VLS_159({
    ...{ class: "h-4 w-4" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
}));
const __VLS_161 = __VLS_160({
    ...{ class: "h-4 w-4" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_160));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
// @ts-ignore
[isLoading, isLoading, handleRefresh,];
var __VLS_154;
var __VLS_155;
// @ts-ignore
[];
var __VLS_148;
let __VLS_164;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
    side: "bottom",
}));
const __VLS_166 = __VLS_165({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_165));
const { default: __VLS_169 } = __VLS_167.slots;
// @ts-ignore
[];
var __VLS_167;
// @ts-ignore
[];
var __VLS_142;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground whitespace-nowrap" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
(__VLS_ctx.lastUpdated);
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
const __VLS_170 = PropsTable;
// @ts-ignore
const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
    ...{ 'onSelect': {} },
    ...{ 'onToggleFavorite': {} },
    ...{ 'onIgnoreByName': {} },
    rows: (__VLS_ctx.visibleRows),
    selectedId: (__VLS_ctx.selectedNode?.id || null),
    isLoading: (__VLS_ctx.isLoading),
}));
const __VLS_172 = __VLS_171({
    ...{ 'onSelect': {} },
    ...{ 'onToggleFavorite': {} },
    ...{ 'onIgnoreByName': {} },
    rows: (__VLS_ctx.visibleRows),
    selectedId: (__VLS_ctx.selectedNode?.id || null),
    isLoading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_171));
let __VLS_175;
const __VLS_176 = ({ select: {} },
    { onSelect: (__VLS_ctx.selectEntry) });
const __VLS_177 = ({ toggleFavorite: {} },
    { onToggleFavorite: (__VLS_ctx.toggleFavorite) });
const __VLS_178 = ({ ignoreByName: {} },
    { onIgnoreByName: (__VLS_ctx.ignoreByName) });
var __VLS_173;
var __VLS_174;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full min-h-0 overflow-hidden border rounded-lg details-panel" },
    ...{ class: ({ 'details-active': __VLS_ctx.selectedNode }) },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['details-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['details-active']} */ ;
if (__VLS_ctx.selectedNode) {
    const __VLS_179 = ComponentDetails;
    // @ts-ignore
    const __VLS_180 = __VLS_asFunctionalComponent(__VLS_179, new __VLS_179({
        ...{ 'onBack': {} },
        ...{ 'onRefresh': {} },
        key: (__VLS_ctx.selectedNode.id || __VLS_ctx.selectedNode.componentUid),
        node: (__VLS_ctx.selectedNode),
        allRows: (__VLS_ctx.rows),
        refreshing: (__VLS_ctx.isLoading),
    }));
    const __VLS_181 = __VLS_180({
        ...{ 'onBack': {} },
        ...{ 'onRefresh': {} },
        key: (__VLS_ctx.selectedNode.id || __VLS_ctx.selectedNode.componentUid),
        node: (__VLS_ctx.selectedNode),
        allRows: (__VLS_ctx.rows),
        refreshing: (__VLS_ctx.isLoading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_180));
    let __VLS_184;
    const __VLS_185 = ({ back: {} },
        { onBack: (__VLS_ctx.deselectEntry) });
    const __VLS_186 = ({ refresh: {} },
        { onRefresh: (__VLS_ctx.handleRefreshSelected) });
    var __VLS_182;
    var __VLS_183;
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
// @ts-ignore
[selectedNode, selectedNode, selectedNode, selectedNode, selectedNode, selectedNode, isLoading, isLoading, lastUpdated, visibleRows, selectEntry, toggleFavorite, ignoreByName, rows, deselectEntry, handleRefreshSelected,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
//# sourceMappingURL=PropsTab.vue.js.map