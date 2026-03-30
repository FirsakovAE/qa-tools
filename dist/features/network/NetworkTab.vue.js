import { ref, computed, watch } from 'vue';
import { Trash2, Pause, Play, SearchIcon, Upload } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FacetedFilter } from '@/components/ui/FacetedFilter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NetworkTable from './NetworkTable.vue';
import NetworkDetails from './NetworkDetails.vue';
import MockForm from './MockForm.vue';
import BreakpointForm from './BreakpointForm.vue';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { useSearchSettings } from '@/composables/useSearchSettings';
import { useCurlCopy } from '@/composables/useCurlCopy';
import { downloadPostmanCollection } from '@/utils/networkUtils';
import { useNetworkEntries, useNetworkSearch, useBreakpointState, useMockState, useNetworkUIState, useNetworkHandlers, } from './composables';
import { deepClone } from './utils';
const props = defineProps();
const emit = defineEmits();
// ============================================================================
// Settings
// ============================================================================
const settings = useInspectorSettingsSync();
const { searchSettings, selectedSearchTypes, searchTypeOptions } = useSearchSettings({
    settings,
    searchKey: 'networkSearch',
    typeMap: {
        'Status code': 'byStatus',
        'Method': 'byMethod',
        'Path': 'byPath',
        'Name': 'byName',
        'Key': 'byKey',
        'Value': 'byValue',
    }
});
const activeBreakpoints = computed(() => settings.value?.breakpoints?.active ?? []);
const activeMocks = computed(() => settings.value?.mocks?.active ?? []);
const allBreakpointsWithStatus = computed(() => [
    ...(settings.value?.breakpoints?.active ?? []).map(bp => ({ ...bp, isActive: true })),
    ...(settings.value?.breakpoints?.inactive ?? []).map(bp => ({ ...bp, isActive: false })),
]);
const allMocksWithStatus = computed(() => [
    ...(settings.value?.mocks?.active ?? []).map(m => ({ ...m, isActive: true })),
    ...(settings.value?.mocks?.inactive ?? []).map(m => ({ ...m, isActive: false })),
]);
// ============================================================================
// Composables
// ============================================================================
const { entries, entriesVersion, paused, isReady, totalCount, pendingCount, sendCommand, togglePause, clearEntries: clearEntriesBase, addEntry, getEntry, normalizeEntry } = useNetworkEntries({
    onBreakpointHit: (requestId, trigger, entry) => {
        if (entry) {
            addEntry(normalizeEntry(entry));
        }
        breakpointState.handleBreakpointHit(requestId, trigger);
    }
});
const { searchTerm, filteredEntries, activeSearchTypes, addToIndex, removeFromIndex, clearIndex, rebuildIndex } = useNetworkSearch(() => entries.value, () => searchSettings.value, entriesVersion);
const breakpointState = useBreakpointState(() => activeBreakpoints.value, () => entries.value, { sendCommand, getEntry });
const mockState = useMockState(() => activeMocks.value, { sendCommand }, () => entries.value);
const { copyCurl } = useCurlCopy();
const { selectedEntryId } = useNetworkUIState();
// Pending breakpoint from Navigation
const pendingBreakpointToProcess = ref(null);
// ============================================================================
// Computed
// ============================================================================
const pendingBreakpointIds = computed(() => {
    const pending = Array.from(breakpointState.pendingBreakpoints.value.entries());
    pending.sort((a, b) => a[1].timestamp - b[1].timestamp);
    return pending.map(([id]) => id);
});
const activeEntryId = computed(() => {
    if (selectedEntryId.value)
        return selectedEntryId.value;
    if (pendingBreakpointIds.value.length > 0)
        return pendingBreakpointIds.value[0];
    return null;
});
const selectedEntry = computed(() => {
    void entriesVersion.value;
    if (!activeEntryId.value)
        return null;
    const entry = getEntry(activeEntryId.value);
    if (entry) {
        return deepClone({ ...entry, version: entry.version ?? 1 });
    }
    const draft = breakpointState.getBreakpointDraft(activeEntryId.value);
    if (draft) {
        const fullUrl = `${draft.scheme}://${draft.host}${draft.path}`;
        const constructedEntry = {
            id: draft.entryId,
            version: 1,
            timestamp: new Date().toISOString(),
            method: draft.method,
            url: fullUrl,
            path: draft.path,
            name: draft.path.split('/').pop() || draft.path,
            status: 0,
            statusText: 'Breakpoint',
            duration: 0,
            size: 0,
            requestHeaders: draft.requestHeaders.map(h => ({ name: h.name, value: h.value })),
            responseHeaders: draft.responseHeaders.map(h => ({ name: h.name, value: h.value })),
            params: draft.params,
            authorization: { type: 'None' },
            requestBody: draft.requestBody ? { text: draft.requestBody, contentType: 'application/json', originalSize: draft.requestBody.length, truncated: false, isBinary: false } : null,
            responseBody: draft.responseBody ? { text: draft.responseBody, contentType: 'application/json', originalSize: draft.responseBody.length, truncated: false, isBinary: false } : null,
            pending: true,
            initiator: 'fetch'
        };
        return constructedEntry;
    }
    return null;
});
const entriesCount = computed(() => filteredEntries.value.length);
const currentBreakpointDraft = computed(() => {
    if (!activeEntryId.value)
        return null;
    return breakpointState.getBreakpointDraft(activeEntryId.value);
});
const isShowingPendingBreakpoint = computed(() => {
    return !!(activeEntryId.value && breakpointState.pendingBreakpoints.value.has(activeEntryId.value));
});
// ============================================================================
// Handlers (composable)
// ============================================================================
const handlers = useNetworkHandlers({
    settings,
    selectedEntryId,
    pendingBreakpointIds,
    activeBreakpoints,
    activeMocks,
    breakpointState,
    mockState,
    clearEntriesBase,
    clearIndex,
    copyCurl,
    activeEntryId,
});
const { mockFormMode, mockFormEntry, mockFormExisting, breakpointFormMode, breakpointFormEntry, breakpointFormExisting, clearEntries, selectEntry, deselectEntry, selectFirstPendingBreakpoint, handleSetBreakpoint, handleBreakpointFormBack, handleBreakpointConfirm, handleMockResponse, handleMockFormBack, handleMockConfirm, handleCopyCurl, handleToggleBreakpoint, handleDeleteBreakpoint, handleToggleMock, handleDeleteMock, handleApplyBreakpoint, handleCancelBreakpoint, handleDraftUpdate, } = handlers;
// ============================================================================
// Watchers
// ============================================================================
watch(entriesVersion, () => { rebuildIndex(); });
watch(() => props.pendingBreakpoint, (pending) => {
    if (pending) {
        pendingBreakpointToProcess.value = pending;
        emit('clearPendingBreakpoint');
    }
}, { immediate: true });
watch([isReady, pendingBreakpointToProcess], ([ready, pending]) => {
    if (ready && pending) {
        if (pending.entry) {
            const existingIndex = entries.value.findIndex(e => e.id === pending.requestId);
            if (existingIndex === -1) {
                addEntry(normalizeEntry(pending.entry));
                addToIndex(normalizeEntry(pending.entry));
            }
        }
        breakpointState.handleBreakpointHit(pending.requestId, pending.trigger);
        selectedEntryId.value = pending.requestId;
        pendingBreakpointToProcess.value = null;
    }
}, { immediate: true });
watch(activeBreakpoints, () => { breakpointState.syncBreakpoints(); }, { deep: true });
watch(activeMocks, () => { mockState.syncMocks(); }, { deep: true });
watch(pendingBreakpointIds, (newIds, oldIds) => {
    if (newIds.length > (oldIds?.length ?? 0)) {
        const newBreakpointId = newIds.find(id => !oldIds?.includes(id));
        if (newBreakpointId) {
            if (!selectedEntryId.value || !newIds.includes(selectedEntryId.value)) {
                selectedEntryId.value = newBreakpointId;
            }
        }
    }
}, { immediate: true });
// ============================================================================
// Lifecycle
// ============================================================================
watch(settings, (s) => {
    if (!s)
        return;
    if (!s.mocks) {
        s.mocks = { active: [], inactive: [] };
    }
    setTimeout(() => {
        breakpointState.syncBreakpoints();
        mockState.syncMocks();
    }, 100);
}, { immediate: true });
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full flex flex-col overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex flex-wrap items-center gap-2 p-2 border-b toolbar-container" },
    ...{ class: ({ 'toolbar-hide-on-details': __VLS_ctx.selectedEntry || __VLS_ctx.mockFormMode || __VLS_ctx.breakpointFormMode }) },
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
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Input} */
Input;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.searchTerm),
    placeholder: "Search requests...",
    ...{ class: "pl-8 h-8" },
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.searchTerm),
    placeholder: "Search requests...",
    ...{ class: "pl-8 h-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['pl-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof ___VLS_components.SearchIcon} */
SearchIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
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
let __VLS_10;
/** @ts-ignore @type {typeof ___VLS_components.FacetedFilter} */
FacetedFilter;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.selectedSearchTypes),
    title: "Search by",
    options: (__VLS_ctx.searchTypeOptions),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.selectedSearchTypes),
    title: "Search by",
    options: (__VLS_ctx.searchTypeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "export-inline" },
});
/** @type {__VLS_StyleScopedClasses['export-inline']} */ ;
let __VLS_15;
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const { default: __VLS_20 } = __VLS_18.slots;
let __VLS_21;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({}));
const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
const { default: __VLS_26 } = __VLS_24.slots;
let __VLS_27;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
    asChild: true,
}));
const __VLS_29 = __VLS_28({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
const { default: __VLS_32 } = __VLS_30.slots;
let __VLS_33;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300" },
    disabled: (__VLS_ctx.filteredEntries.length === 0),
}));
const __VLS_35 = __VLS_34({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300" },
    disabled: (__VLS_ctx.filteredEntries.length === 0),
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
let __VLS_38;
const __VLS_39 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.downloadPostmanCollection(__VLS_ctx.filteredEntries);
            // @ts-ignore
            [selectedEntry, mockFormMode, breakpointFormMode, searchTerm, selectedSearchTypes, searchTypeOptions, filteredEntries, filteredEntries, downloadPostmanCollection,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-orange-500/40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-orange-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-orange-400']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:text-orange-300']} */ ;
const { default: __VLS_40 } = __VLS_36.slots;
let __VLS_41;
/** @ts-ignore @type {typeof ___VLS_components.Upload} */
Upload;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    ...{ class: "h-3.5 w-3.5" },
}));
const __VLS_43 = __VLS_42({
    ...{ class: "h-3.5 w-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs font-medium" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
// @ts-ignore
[];
var __VLS_36;
var __VLS_37;
// @ts-ignore
[];
var __VLS_30;
let __VLS_46;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
    side: "bottom",
}));
const __VLS_48 = __VLS_47({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
const { default: __VLS_51 } = __VLS_49.slots;
// @ts-ignore
[];
var __VLS_49;
// @ts-ignore
[];
var __VLS_24;
// @ts-ignore
[];
var __VLS_18;
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
    ...{ class: "hidden export-wrapped" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['export-wrapped']} */ ;
let __VLS_52;
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const { default: __VLS_57 } = __VLS_55.slots;
let __VLS_58;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_59 = __VLS_asFunctionalComponent(__VLS_58, new __VLS_58({}));
const __VLS_60 = __VLS_59({}, ...__VLS_functionalComponentArgsRest(__VLS_59));
const { default: __VLS_63 } = __VLS_61.slots;
let __VLS_64;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    asChild: true,
}));
const __VLS_66 = __VLS_65({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
const { default: __VLS_69 } = __VLS_67.slots;
let __VLS_70;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300" },
    disabled: (__VLS_ctx.filteredEntries.length === 0),
}));
const __VLS_72 = __VLS_71({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300" },
    disabled: (__VLS_ctx.filteredEntries.length === 0),
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
let __VLS_75;
const __VLS_76 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.downloadPostmanCollection(__VLS_ctx.filteredEntries);
            // @ts-ignore
            [filteredEntries, filteredEntries, downloadPostmanCollection,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-orange-500/40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-orange-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-orange-400']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:text-orange-300']} */ ;
const { default: __VLS_77 } = __VLS_73.slots;
let __VLS_78;
/** @ts-ignore @type {typeof ___VLS_components.Upload} */
Upload;
// @ts-ignore
const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
    ...{ class: "h-3.5 w-3.5" },
}));
const __VLS_80 = __VLS_79({
    ...{ class: "h-3.5 w-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_79));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs font-medium" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
// @ts-ignore
[];
var __VLS_73;
var __VLS_74;
// @ts-ignore
[];
var __VLS_67;
let __VLS_83;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
    side: "bottom",
}));
const __VLS_85 = __VLS_84({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_84));
const { default: __VLS_88 } = __VLS_86.slots;
// @ts-ignore
[];
var __VLS_86;
// @ts-ignore
[];
var __VLS_61;
// @ts-ignore
[];
var __VLS_55;
__VLS_asFunctionalElement(__VLS_intrinsics.div)({
    ...{ class: "hidden flex-1 export-spacer" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['export-spacer']} */ ;
let __VLS_89;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_90 = __VLS_asFunctionalComponent(__VLS_89, new __VLS_89({
    variant: "secondary",
    ...{ class: "font-mono" },
}));
const __VLS_91 = __VLS_90({
    variant: "secondary",
    ...{ class: "font-mono" },
}, ...__VLS_functionalComponentArgsRest(__VLS_90));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
const { default: __VLS_94 } = __VLS_92.slots;
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
var __VLS_92;
if (__VLS_ctx.pendingCount > 0) {
    let __VLS_95;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_96 = __VLS_asFunctionalComponent(__VLS_95, new __VLS_95({
        variant: "outline",
        ...{ class: "whitespace-nowrap text-yellow-500 border-yellow-500/30" },
    }));
    const __VLS_97 = __VLS_96({
        variant: "outline",
        ...{ class: "whitespace-nowrap text-yellow-500 border-yellow-500/30" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_96));
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-yellow-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-yellow-500/30']} */ ;
    const { default: __VLS_100 } = __VLS_98.slots;
    (__VLS_ctx.pendingCount);
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge-label" },
    });
    /** @type {__VLS_StyleScopedClasses['badge-label']} */ ;
    // @ts-ignore
    [pendingCount, pendingCount,];
    var __VLS_98;
}
if (__VLS_ctx.pendingBreakpointIds.length > 0) {
    let __VLS_101;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "whitespace-nowrap text-amber-500 border-amber-500/30 animate-pulse cursor-pointer hover:bg-amber-500/10 transition-colors" },
    }));
    const __VLS_103 = __VLS_102({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "whitespace-nowrap text-amber-500 border-amber-500/30 animate-pulse cursor-pointer hover:bg-amber-500/10 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_102));
    let __VLS_106;
    const __VLS_107 = ({ click: {} },
        { onClick: (__VLS_ctx.selectFirstPendingBreakpoint) });
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    const { default: __VLS_108 } = __VLS_104.slots;
    (__VLS_ctx.pendingBreakpointIds.length);
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge-label" },
    });
    /** @type {__VLS_StyleScopedClasses['badge-label']} */ ;
    // @ts-ignore
    [pendingBreakpointIds, pendingBreakpointIds, selectFirstPendingBreakpoint,];
    var __VLS_104;
    var __VLS_105;
}
if (__VLS_ctx.activeBreakpoints.length > 0) {
    let __VLS_109;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "whitespace-nowrap text-amber-500 border-amber-500/30 cursor-pointer hover:bg-amber-500/10 transition-colors" },
    }));
    const __VLS_111 = __VLS_110({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "whitespace-nowrap text-amber-500 border-amber-500/30 cursor-pointer hover:bg-amber-500/10 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_110));
    let __VLS_114;
    const __VLS_115 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeBreakpoints.length > 0))
                    return;
                __VLS_ctx.emit('navigateToOptions', 'breakpoints-section');
                // @ts-ignore
                [activeBreakpoints, emit,];
            } });
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    const { default: __VLS_116 } = __VLS_112.slots;
    (__VLS_ctx.activeBreakpoints.length);
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge-label" },
    });
    /** @type {__VLS_StyleScopedClasses['badge-label']} */ ;
    // @ts-ignore
    [activeBreakpoints,];
    var __VLS_112;
    var __VLS_113;
}
if (__VLS_ctx.activeMocks.length > 0) {
    let __VLS_117;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "whitespace-nowrap text-purple-500 border-purple-500/30 cursor-pointer hover:bg-purple-500/10 transition-colors" },
    }));
    const __VLS_119 = __VLS_118({
        ...{ 'onClick': {} },
        variant: "outline",
        ...{ class: "whitespace-nowrap text-purple-500 border-purple-500/30 cursor-pointer hover:bg-purple-500/10 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
    let __VLS_122;
    const __VLS_123 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeMocks.length > 0))
                    return;
                __VLS_ctx.emit('navigateToOptions', 'mocks-section');
                // @ts-ignore
                [emit, activeMocks,];
            } });
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-purple-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-purple-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-purple-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    const { default: __VLS_124 } = __VLS_120.slots;
    (__VLS_ctx.activeMocks.length);
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge-label" },
    });
    /** @type {__VLS_StyleScopedClasses['badge-label']} */ ;
    // @ts-ignore
    [activeMocks,];
    var __VLS_120;
    var __VLS_121;
}
if (__VLS_ctx.paused) {
    let __VLS_125;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({
        variant: "outline",
        ...{ class: "whitespace-nowrap text-orange-500 border-orange-500/30" },
    }));
    const __VLS_127 = __VLS_126({
        variant: "outline",
        ...{ class: "whitespace-nowrap text-orange-500 border-orange-500/30" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_126));
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-orange-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-orange-500/30']} */ ;
    const { default: __VLS_130 } = __VLS_128.slots;
    // @ts-ignore
    [paused,];
    var __VLS_128;
}
let __VLS_131;
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({}));
const __VLS_133 = __VLS_132({}, ...__VLS_functionalComponentArgsRest(__VLS_132));
const { default: __VLS_136 } = __VLS_134.slots;
let __VLS_137;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({}));
const __VLS_139 = __VLS_138({}, ...__VLS_functionalComponentArgsRest(__VLS_138));
const { default: __VLS_142 } = __VLS_140.slots;
let __VLS_143;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({
    asChild: true,
}));
const __VLS_145 = __VLS_144({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_144));
const { default: __VLS_148 } = __VLS_146.slots;
let __VLS_149;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_150 = __VLS_asFunctionalComponent(__VLS_149, new __VLS_149({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    ...{ class: ({ 'text-orange-500': __VLS_ctx.paused }) },
}));
const __VLS_151 = __VLS_150({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    ...{ class: ({ 'text-orange-500': __VLS_ctx.paused }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_150));
let __VLS_154;
const __VLS_155 = ({ click: {} },
    { onClick: (__VLS_ctx.togglePause) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-500']} */ ;
const { default: __VLS_156 } = __VLS_152.slots;
if (!__VLS_ctx.paused) {
    let __VLS_157;
    /** @ts-ignore @type {typeof ___VLS_components.Pause} */
    Pause;
    // @ts-ignore
    const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_159 = __VLS_158({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_158));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
else {
    let __VLS_162;
    /** @ts-ignore @type {typeof ___VLS_components.Play} */
    Play;
    // @ts-ignore
    const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_164 = __VLS_163({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_163));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
// @ts-ignore
[paused, paused, togglePause,];
var __VLS_152;
var __VLS_153;
// @ts-ignore
[];
var __VLS_146;
let __VLS_167;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_168 = __VLS_asFunctionalComponent(__VLS_167, new __VLS_167({
    side: "bottom",
}));
const __VLS_169 = __VLS_168({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_168));
const { default: __VLS_172 } = __VLS_170.slots;
(__VLS_ctx.paused ? 'Resume recording' : 'Pause recording');
// @ts-ignore
[paused,];
var __VLS_170;
// @ts-ignore
[];
var __VLS_140;
// @ts-ignore
[];
var __VLS_134;
let __VLS_173;
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({}));
const __VLS_175 = __VLS_174({}, ...__VLS_functionalComponentArgsRest(__VLS_174));
const { default: __VLS_178 } = __VLS_176.slots;
let __VLS_179;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_180 = __VLS_asFunctionalComponent(__VLS_179, new __VLS_179({}));
const __VLS_181 = __VLS_180({}, ...__VLS_functionalComponentArgsRest(__VLS_180));
const { default: __VLS_184 } = __VLS_182.slots;
let __VLS_185;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
    asChild: true,
}));
const __VLS_187 = __VLS_186({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_186));
const { default: __VLS_190 } = __VLS_188.slots;
let __VLS_191;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_192 = __VLS_asFunctionalComponent(__VLS_191, new __VLS_191({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    disabled: (__VLS_ctx.totalCount === 0),
}));
const __VLS_193 = __VLS_192({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
    disabled: (__VLS_ctx.totalCount === 0),
}, ...__VLS_functionalComponentArgsRest(__VLS_192));
let __VLS_196;
const __VLS_197 = ({ click: {} },
    { onClick: (__VLS_ctx.clearEntries) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_198 } = __VLS_194.slots;
let __VLS_199;
/** @ts-ignore @type {typeof ___VLS_components.Trash2} */
Trash2;
// @ts-ignore
const __VLS_200 = __VLS_asFunctionalComponent(__VLS_199, new __VLS_199({
    ...{ class: "h-4 w-4" },
}));
const __VLS_201 = __VLS_200({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_200));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[totalCount, clearEntries,];
var __VLS_194;
var __VLS_195;
// @ts-ignore
[];
var __VLS_188;
let __VLS_204;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    side: "bottom",
}));
const __VLS_206 = __VLS_205({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
const { default: __VLS_209 } = __VLS_207.slots;
// @ts-ignore
[];
var __VLS_207;
// @ts-ignore
[];
var __VLS_182;
// @ts-ignore
[];
var __VLS_176;
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
const __VLS_210 = NetworkTable;
// @ts-ignore
const __VLS_211 = __VLS_asFunctionalComponent(__VLS_210, new __VLS_210({
    ...{ 'onSelect': {} },
    ...{ 'onSetBreakpoint': {} },
    ...{ 'onCopyCurl': {} },
    ...{ 'onMockResponse': {} },
    ...{ 'onToggleBreakpoint': {} },
    ...{ 'onDeleteBreakpoint': {} },
    ...{ 'onToggleMock': {} },
    ...{ 'onDeleteMock': {} },
    entries: (__VLS_ctx.filteredEntries),
    selectedId: (__VLS_ctx.selectedEntryId),
    breakpointEntryIds: (__VLS_ctx.breakpointState.breakpointEntryIds.value),
    breakpointMatchingIds: (__VLS_ctx.breakpointState.entriesMatchingBreakpoints.value),
    mockMatchingIds: (__VLS_ctx.mockState.entriesMatchingMocks.value),
    allBreakpoints: (__VLS_ctx.allBreakpointsWithStatus),
    allMocks: (__VLS_ctx.allMocksWithStatus),
}));
const __VLS_212 = __VLS_211({
    ...{ 'onSelect': {} },
    ...{ 'onSetBreakpoint': {} },
    ...{ 'onCopyCurl': {} },
    ...{ 'onMockResponse': {} },
    ...{ 'onToggleBreakpoint': {} },
    ...{ 'onDeleteBreakpoint': {} },
    ...{ 'onToggleMock': {} },
    ...{ 'onDeleteMock': {} },
    entries: (__VLS_ctx.filteredEntries),
    selectedId: (__VLS_ctx.selectedEntryId),
    breakpointEntryIds: (__VLS_ctx.breakpointState.breakpointEntryIds.value),
    breakpointMatchingIds: (__VLS_ctx.breakpointState.entriesMatchingBreakpoints.value),
    mockMatchingIds: (__VLS_ctx.mockState.entriesMatchingMocks.value),
    allBreakpoints: (__VLS_ctx.allBreakpointsWithStatus),
    allMocks: (__VLS_ctx.allMocksWithStatus),
}, ...__VLS_functionalComponentArgsRest(__VLS_211));
let __VLS_215;
const __VLS_216 = ({ select: {} },
    { onSelect: (__VLS_ctx.selectEntry) });
const __VLS_217 = ({ setBreakpoint: {} },
    { onSetBreakpoint: (__VLS_ctx.handleSetBreakpoint) });
const __VLS_218 = ({ copyCurl: {} },
    { onCopyCurl: (__VLS_ctx.handleCopyCurl) });
const __VLS_219 = ({ mockResponse: {} },
    { onMockResponse: (__VLS_ctx.handleMockResponse) });
const __VLS_220 = ({ toggleBreakpoint: {} },
    { onToggleBreakpoint: (__VLS_ctx.handleToggleBreakpoint) });
const __VLS_221 = ({ deleteBreakpoint: {} },
    { onDeleteBreakpoint: (__VLS_ctx.handleDeleteBreakpoint) });
const __VLS_222 = ({ toggleMock: {} },
    { onToggleMock: (__VLS_ctx.handleToggleMock) });
const __VLS_223 = ({ deleteMock: {} },
    { onDeleteMock: (__VLS_ctx.handleDeleteMock) });
var __VLS_213;
var __VLS_214;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full min-h-0 overflow-hidden border rounded-lg details-panel" },
    ...{ class: ({
            'ring-2 ring-amber-500': __VLS_ctx.isShowingPendingBreakpoint || __VLS_ctx.breakpointFormMode,
            'ring-2 ring-purple-500': __VLS_ctx.mockFormMode,
            'details-active': __VLS_ctx.selectedEntry || __VLS_ctx.mockFormMode || __VLS_ctx.breakpointFormMode
        }) },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['details-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-amber-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['details-active']} */ ;
if (__VLS_ctx.mockFormMode && __VLS_ctx.mockFormEntry) {
    const __VLS_224 = MockForm;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
        ...{ 'onBack': {} },
        ...{ 'onConfirm': {} },
        entry: (__VLS_ctx.mockFormEntry),
        existingMock: (__VLS_ctx.mockFormExisting ?? undefined),
    }));
    const __VLS_226 = __VLS_225({
        ...{ 'onBack': {} },
        ...{ 'onConfirm': {} },
        entry: (__VLS_ctx.mockFormEntry),
        existingMock: (__VLS_ctx.mockFormExisting ?? undefined),
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    let __VLS_229;
    const __VLS_230 = ({ back: {} },
        { onBack: (__VLS_ctx.handleMockFormBack) });
    const __VLS_231 = ({ confirm: {} },
        { onConfirm: (__VLS_ctx.handleMockConfirm) });
    var __VLS_227;
    var __VLS_228;
}
else if (__VLS_ctx.breakpointFormMode && __VLS_ctx.breakpointFormEntry) {
    const __VLS_232 = BreakpointForm;
    // @ts-ignore
    const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
        ...{ 'onBack': {} },
        ...{ 'onConfirm': {} },
        entry: (__VLS_ctx.breakpointFormEntry),
        existingBreakpoint: (__VLS_ctx.breakpointFormExisting ?? undefined),
    }));
    const __VLS_234 = __VLS_233({
        ...{ 'onBack': {} },
        ...{ 'onConfirm': {} },
        entry: (__VLS_ctx.breakpointFormEntry),
        existingBreakpoint: (__VLS_ctx.breakpointFormExisting ?? undefined),
    }, ...__VLS_functionalComponentArgsRest(__VLS_233));
    let __VLS_237;
    const __VLS_238 = ({ back: {} },
        { onBack: (__VLS_ctx.handleBreakpointFormBack) });
    const __VLS_239 = ({ confirm: {} },
        { onConfirm: (__VLS_ctx.handleBreakpointConfirm) });
    var __VLS_235;
    var __VLS_236;
}
else if (__VLS_ctx.selectedEntry) {
    const __VLS_240 = NetworkDetails;
    // @ts-ignore
    const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
        ...{ 'onBack': {} },
        ...{ 'onCancelBreakpoint': {} },
        ...{ 'onApplyBreakpoint': {} },
        ...{ 'onUpdateDraft': {} },
        ...{ 'onCopyCurl': {} },
        ...{ 'onSetBreakpoint': {} },
        ...{ 'onMockResponse': {} },
        ...{ 'onToggleBreakpoint': {} },
        ...{ 'onDeleteBreakpoint': {} },
        ...{ 'onToggleMock': {} },
        ...{ 'onDeleteMock': {} },
        entry: (__VLS_ctx.selectedEntry),
        breakpointMode: (__VLS_ctx.isShowingPendingBreakpoint),
        breakpointTrigger: (__VLS_ctx.breakpointState.breakpointTrigger.value),
        breakpointDraft: (__VLS_ctx.currentBreakpointDraft),
        breakpointMatchingIds: (__VLS_ctx.breakpointState.entriesMatchingBreakpoints.value),
        mockMatchingIds: (__VLS_ctx.mockState.entriesMatchingMocks.value),
        allBreakpoints: (__VLS_ctx.allBreakpointsWithStatus),
        allMocks: (__VLS_ctx.allMocksWithStatus),
    }));
    const __VLS_242 = __VLS_241({
        ...{ 'onBack': {} },
        ...{ 'onCancelBreakpoint': {} },
        ...{ 'onApplyBreakpoint': {} },
        ...{ 'onUpdateDraft': {} },
        ...{ 'onCopyCurl': {} },
        ...{ 'onSetBreakpoint': {} },
        ...{ 'onMockResponse': {} },
        ...{ 'onToggleBreakpoint': {} },
        ...{ 'onDeleteBreakpoint': {} },
        ...{ 'onToggleMock': {} },
        ...{ 'onDeleteMock': {} },
        entry: (__VLS_ctx.selectedEntry),
        breakpointMode: (__VLS_ctx.isShowingPendingBreakpoint),
        breakpointTrigger: (__VLS_ctx.breakpointState.breakpointTrigger.value),
        breakpointDraft: (__VLS_ctx.currentBreakpointDraft),
        breakpointMatchingIds: (__VLS_ctx.breakpointState.entriesMatchingBreakpoints.value),
        mockMatchingIds: (__VLS_ctx.mockState.entriesMatchingMocks.value),
        allBreakpoints: (__VLS_ctx.allBreakpointsWithStatus),
        allMocks: (__VLS_ctx.allMocksWithStatus),
    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
    let __VLS_245;
    const __VLS_246 = ({ back: {} },
        { onBack: (__VLS_ctx.deselectEntry) });
    const __VLS_247 = ({ cancelBreakpoint: {} },
        { onCancelBreakpoint: (__VLS_ctx.handleCancelBreakpoint) });
    const __VLS_248 = ({ applyBreakpoint: {} },
        { onApplyBreakpoint: (__VLS_ctx.handleApplyBreakpoint) });
    const __VLS_249 = ({ updateDraft: {} },
        { onUpdateDraft: (__VLS_ctx.handleDraftUpdate) });
    const __VLS_250 = ({ copyCurl: {} },
        { onCopyCurl: (__VLS_ctx.handleCopyCurl) });
    const __VLS_251 = ({ setBreakpoint: {} },
        { onSetBreakpoint: (__VLS_ctx.handleSetBreakpoint) });
    const __VLS_252 = ({ mockResponse: {} },
        { onMockResponse: (__VLS_ctx.handleMockResponse) });
    const __VLS_253 = ({ toggleBreakpoint: {} },
        { onToggleBreakpoint: (__VLS_ctx.handleToggleBreakpoint) });
    const __VLS_254 = ({ deleteBreakpoint: {} },
        { onDeleteBreakpoint: (__VLS_ctx.handleDeleteBreakpoint) });
    const __VLS_255 = ({ toggleMock: {} },
        { onToggleMock: (__VLS_ctx.handleToggleMock) });
    const __VLS_256 = ({ deleteMock: {} },
        { onDeleteMock: (__VLS_ctx.handleDeleteMock) });
    var __VLS_243;
    var __VLS_244;
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
[selectedEntry, selectedEntry, selectedEntry, mockFormMode, mockFormMode, mockFormMode, breakpointFormMode, breakpointFormMode, breakpointFormMode, filteredEntries, selectedEntryId, breakpointState, breakpointState, breakpointState, breakpointState, mockState, mockState, allBreakpointsWithStatus, allBreakpointsWithStatus, allMocksWithStatus, allMocksWithStatus, selectEntry, handleSetBreakpoint, handleSetBreakpoint, handleCopyCurl, handleCopyCurl, handleMockResponse, handleMockResponse, handleToggleBreakpoint, handleToggleBreakpoint, handleDeleteBreakpoint, handleDeleteBreakpoint, handleToggleMock, handleToggleMock, handleDeleteMock, handleDeleteMock, isShowingPendingBreakpoint, isShowingPendingBreakpoint, mockFormEntry, mockFormEntry, mockFormExisting, handleMockFormBack, handleMockConfirm, breakpointFormEntry, breakpointFormEntry, breakpointFormExisting, handleBreakpointFormBack, handleBreakpointConfirm, currentBreakpointDraft, deselectEntry, handleCancelBreakpoint, handleApplyBreakpoint, handleDraftUpdate,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=NetworkTab.vue.js.map