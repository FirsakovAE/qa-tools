import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { ArrowLeft, Edit, X, Save, RefreshCw, Star } from 'lucide-vue-next';
import { useEscapeClose } from '@/composables/useEscapeClose';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import JsonEditor from '@/components/JsonEditor.vue';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { useRuntime } from '@/runtime';
import { isStoreInFavorites, matchFavoritePattern } from '@/utils/piniaFavoritesMatcher';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
const runtime = useRuntime();
const props = defineProps();
const emit = defineEmits();
const activeSection = ref(props.store.stateKeys > 0 ? 'state' : 'getters');
// Data from API (snapshot - not reactive to external changes)
const stateData = ref(null);
const gettersData = ref(null);
const isLoading = ref(true);
const lastFetched = ref('');
// Editing state
const isEditingState = ref(false);
const editedStateJson = ref('{}');
const isStateJsonValid = computed(() => {
    try {
        JSON.parse(editedStateJson.value);
        return true;
    }
    catch {
        return false;
    }
});
// Editing getters
const isEditingGetters = ref(false);
const editedGettersJson = ref('{}');
const isGettersJsonValid = computed(() => {
    try {
        JSON.parse(editedGettersJson.value);
        return true;
    }
    catch {
        return false;
    }
});
// JSON Mode
const jsonMode = ref('text');
// --- Favorites (by store name) ---
const settings = useInspectorSettingsSync();
const storeName = computed(() => props.store.baseId || 'Unknown Store');
const isFavorite = computed(() => {
    if (!settings.value?.piniaFavorites)
        return false;
    const name = storeName.value;
    return isStoreInFavorites(name, settings.value.piniaFavorites);
});
async function toggleFavorite() {
    if (!settings.value)
        return;
    const name = storeName.value;
    if (isFavorite.value) {
        settings.value.piniaFavorites = settings.value.piniaFavorites.filter(f => {
            if (f.id === name || f.name === name)
                return false;
            if (matchFavoritePattern(name, f.id) || matchFavoritePattern(name, f.name))
                return false;
            return true;
        });
    }
    else {
        const favoriteItem = {
            id: name,
            storeId: storeId,
            name,
            timestamp: new Date().toISOString()
        };
        settings.value.piniaFavorites.push(favoriteItem);
    }
    try {
        const settingsToSave = JSON.parse(JSON.stringify(settings.value));
        await runtime.storage.set('vue-inspector-settings', settingsToSave);
    }
    catch (error) {
        console.error('[stores/PiniaDetails] toggleFavorite save failed:', error);
    }
}
// Sections definition
const sections = computed(() => {
    const list = [];
    if (props.store.stateKeys > 0) {
        list.push({ id: 'state', label: 'State' });
    }
    if (props.store.getterKeys > 0) {
        list.push({ id: 'getters', label: 'Getters' });
    }
    return list;
});
// Computed
const storeId = props.store.id; // NOT reactive - this component is disposable
const displayName = computed(() => props.store.baseId || 'Unknown Store');
const hasState = computed(() => props.store.stateKeys > 0);
const hasGetters = computed(() => props.store.getterKeys > 0);
// Current editing mode
const isEditing = computed(() => {
    if (activeSection.value === 'state')
        return isEditingState.value;
    if (activeSection.value === 'getters')
        return isEditingGetters.value;
    return false;
});
const isCurrentJsonValid = computed(() => {
    if (activeSection.value === 'state')
        return isStateJsonValid.value;
    if (activeSection.value === 'getters')
        return isGettersJsonValid.value;
    return true;
});
const stateJson = computed(() => {
    if (!stateData.value)
        return '{}';
    return JSON.stringify(stateData.value, null, 2);
});
const gettersJson = computed(() => {
    if (!gettersData.value)
        return '{}';
    return JSON.stringify(gettersData.value, null, 2);
});
// Check if data is ready for display
const isStateDataReady = computed(() => stateData.value !== null);
const isGettersDataReady = computed(() => gettersData.value !== null);
// Load store data (called once on mount)
async function loadStoreData() {
    isLoading.value = true;
    try {
        const response = await runtime.sendMessage({
            type: 'PINIA_GET_STORE_STATE',
            storeId: storeId
        });
        if (response) {
            // Only set data if present in response (don't overwrite with undefined)
            if ('state' in response) {
                stateData.value = response.state ?? {};
            }
            if ('getters' in response) {
                gettersData.value = response.getters ?? {};
            }
            // Update edited JSON after data is loaded
            await nextTick();
            editedStateJson.value = stateJson.value;
            editedGettersJson.value = gettersJson.value;
        }
        const now = new Date();
        lastFetched.value = now.toISOString().replace('T', ' ').slice(0, 19);
    }
    catch (err) {
        if (!isExpectedExtensionError(err)) {
            console.error('[stores/PiniaDetails] loadStoreData failed:', err);
        }
        // Set empty objects to show "empty" state instead of loading
        stateData.value = {};
        gettersData.value = {};
    }
    finally {
        isLoading.value = false;
    }
}
// Handle save result messages (snapshot-only: no live updates)
function handlePiniaMessage(message) {
    // Only handle messages for THIS store
    if (message?.storeId && message.storeId !== storeId)
        return;
    // Reload data after successful save
    if (message?.type === 'PINIA_REPLACE_STATE_RESULT') {
        if (message.success) {
            loadStoreData();
        }
        else {
            console.error('[stores/PiniaDetails] Failed to replace state:', message.error);
        }
    }
    if (message?.type === 'PINIA_PATCH_GETTERS_RESULT') {
        if (message.success) {
            loadStoreData();
        }
        else {
            console.error('[stores/PiniaDetails] Failed to patch getters:', message.error);
        }
    }
}
// Start editing current section
function startEditing() {
    if (activeSection.value === 'state') {
        editedStateJson.value = stateJson.value;
        isEditingState.value = true;
    }
    else if (activeSection.value === 'getters') {
        editedGettersJson.value = gettersJson.value;
        isEditingGetters.value = true;
    }
}
function cancelEditing() {
    if (activeSection.value === 'state') {
        editedStateJson.value = stateJson.value;
        isEditingState.value = false;
    }
    else if (activeSection.value === 'getters') {
        editedGettersJson.value = gettersJson.value;
        isEditingGetters.value = false;
    }
}
useEscapeClose(computed(() => true), () => {
    if (isEditing.value)
        cancelEditing();
    else
        emit('back');
});
async function saveChanges() {
    if (activeSection.value === 'state') {
        await saveStateChanges();
    }
    else if (activeSection.value === 'getters') {
        await saveGettersChanges();
    }
}
// Save state changes
async function saveStateChanges() {
    if (!isStateJsonValid.value)
        return;
    try {
        const newState = JSON.parse(editedStateJson.value);
        const response = await runtime.sendMessage({
            type: 'PINIA_REPLACE_STATE',
            storeId: storeId,
            newState
        });
        if (response?.success) {
            // Update local state immediately for responsive UI
            stateData.value = newState;
            isEditingState.value = false;
        }
        else {
            console.error('[stores/PiniaDetails] Failed to save state:', response?.error);
        }
    }
    catch (err) {
        if (!isExpectedExtensionError(err)) {
            console.error('[stores/PiniaDetails] saveStateChanges failed:', err);
        }
    }
}
// Save getters changes
async function saveGettersChanges() {
    if (!isGettersJsonValid.value)
        return;
    try {
        const newGetters = JSON.parse(editedGettersJson.value);
        const response = await runtime.sendMessage({
            type: 'PINIA_PATCH_GETTERS',
            storeId: storeId,
            newGetters
        });
        if (response?.success) {
            // Update local state immediately for responsive UI
            gettersData.value = newGetters;
            isEditingGetters.value = false;
        }
        else {
            const detail = typeof response?.error === 'string' && response.error.length > 0
                ? response.error
                : 'Save failed (no detail — check the page console and injected [injected/pinia/state-writer] logs)';
            console.error('[stores/PiniaDetails] Failed to save getters:', detail);
        }
    }
    catch (err) {
        if (!isExpectedExtensionError(err)) {
            console.error('[stores/PiniaDetails] saveGettersChanges failed:', err);
        }
    }
}
let unsubscribeMessage = null;
watch(settings, (s) => {
    if (s)
        jsonMode.value = s.json?.mode ?? 'text';
}, { immediate: true });
// Mount - load data once
onMounted(() => {
    unsubscribeMessage = runtime.onMessage(handlePiniaMessage);
    loadStoreData();
});
// Cleanup
onUnmounted(() => {
    unsubscribeMessage?.();
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
    ...{ class: "h-full flex flex-col" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex items-center gap-3 p-3 border-b" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}));
const __VLS_9 = __VLS_8({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('back');
            // @ts-ignore
            [emit,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_14 } = __VLS_10.slots;
let __VLS_15;
/** @ts-ignore @type {typeof ___VLS_components.ArrowLeft} */
ArrowLeft;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-4 w-4" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[];
var __VLS_10;
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1 min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 mb-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-semibold truncate" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
(__VLS_ctx.displayName);
if (__VLS_ctx.hasState) {
    let __VLS_20;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        variant: "secondary",
        ...{ class: "text-xs" },
    }));
    const __VLS_22 = __VLS_21({
        variant: "secondary",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_25 } = __VLS_23.slots;
    (__VLS_ctx.store.stateKeys);
    // @ts-ignore
    [displayName, hasState, store,];
    var __VLS_23;
}
if (__VLS_ctx.hasGetters) {
    let __VLS_26;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
        variant: "outline",
        ...{ class: "text-xs" },
    }));
    const __VLS_28 = __VLS_27({
        variant: "outline",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_31 } = __VLS_29.slots;
    (__VLS_ctx.store.getterKeys);
    // @ts-ignore
    [store, hasGetters,];
    var __VLS_29;
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
(__VLS_ctx.lastFetched || 'Loading...');
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1 shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
let __VLS_32;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const { default: __VLS_37 } = __VLS_35.slots;
let __VLS_38;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
    asChild: true,
}));
const __VLS_40 = __VLS_39({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
const { default: __VLS_43 } = __VLS_41.slots;
let __VLS_44;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}));
const __VLS_46 = __VLS_45({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_49;
const __VLS_50 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleFavorite) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_51 } = __VLS_47.slots;
let __VLS_52;
/** @ts-ignore @type {typeof ___VLS_components.Star} */
Star;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.isFavorite ? 'text-yellow-500 fill-yellow-500' : '') },
}));
const __VLS_54 = __VLS_53({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.isFavorite ? 'text-yellow-500 fill-yellow-500' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[lastFetched, toggleFavorite, isFavorite,];
var __VLS_47;
var __VLS_48;
// @ts-ignore
[];
var __VLS_41;
let __VLS_57;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
    side: "bottom",
}));
const __VLS_59 = __VLS_58({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
const { default: __VLS_62 } = __VLS_60.slots;
(__VLS_ctx.isFavorite ? 'Remove from favorites' : 'Add to favorites');
// @ts-ignore
[isFavorite,];
var __VLS_60;
// @ts-ignore
[];
var __VLS_35;
if (!__VLS_ctx.isEditing) {
    let __VLS_63;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({}));
    const __VLS_65 = __VLS_64({}, ...__VLS_functionalComponentArgsRest(__VLS_64));
    const { default: __VLS_68 } = __VLS_66.slots;
    let __VLS_69;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
        asChild: true,
    }));
    const __VLS_71 = __VLS_70({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    const { default: __VLS_74 } = __VLS_72.slots;
    let __VLS_75;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (__VLS_ctx.isLoading),
    }));
    const __VLS_77 = __VLS_76({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (__VLS_ctx.isLoading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    let __VLS_80;
    const __VLS_81 = ({ click: {} },
        { onClick: (__VLS_ctx.loadStoreData) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_82 } = __VLS_78.slots;
    let __VLS_83;
    /** @ts-ignore @type {typeof ___VLS_components.RefreshCw} */
    RefreshCw;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
        ...{ class: "h-4 w-4" },
        ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
    }));
    const __VLS_85 = __VLS_84({
        ...{ class: "h-4 w-4" },
        ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    // @ts-ignore
    [isEditing, isLoading, isLoading, loadStoreData,];
    var __VLS_78;
    var __VLS_79;
    // @ts-ignore
    [];
    var __VLS_72;
    let __VLS_88;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        side: "bottom",
    }));
    const __VLS_90 = __VLS_89({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    const { default: __VLS_93 } = __VLS_91.slots;
    // @ts-ignore
    [];
    var __VLS_91;
    // @ts-ignore
    [];
    var __VLS_66;
}
if (!__VLS_ctx.isEditing) {
    let __VLS_94;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({}));
    const __VLS_96 = __VLS_95({}, ...__VLS_functionalComponentArgsRest(__VLS_95));
    const { default: __VLS_99 } = __VLS_97.slots;
    let __VLS_100;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        asChild: true,
    }));
    const __VLS_102 = __VLS_101({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    const { default: __VLS_105 } = __VLS_103.slots;
    let __VLS_106;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }));
    const __VLS_108 = __VLS_107({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
    let __VLS_111;
    const __VLS_112 = ({ click: {} },
        { onClick: (__VLS_ctx.startEditing) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_113 } = __VLS_109.slots;
    let __VLS_114;
    /** @ts-ignore @type {typeof ___VLS_components.Edit} */
    Edit;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_116 = __VLS_115({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [isEditing, startEditing,];
    var __VLS_109;
    var __VLS_110;
    // @ts-ignore
    [];
    var __VLS_103;
    let __VLS_119;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
        side: "bottom",
    }));
    const __VLS_121 = __VLS_120({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_120));
    const { default: __VLS_124 } = __VLS_122.slots;
    (__VLS_ctx.activeSection);
    // @ts-ignore
    [activeSection,];
    var __VLS_122;
    // @ts-ignore
    [];
    var __VLS_97;
}
if (__VLS_ctx.isEditing) {
    let __VLS_125;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({}));
    const __VLS_127 = __VLS_126({}, ...__VLS_functionalComponentArgsRest(__VLS_126));
    const { default: __VLS_130 } = __VLS_128.slots;
    let __VLS_131;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({
        asChild: true,
    }));
    const __VLS_133 = __VLS_132({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_132));
    const { default: __VLS_136 } = __VLS_134.slots;
    let __VLS_137;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }));
    const __VLS_139 = __VLS_138({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_138));
    let __VLS_142;
    const __VLS_143 = ({ click: {} },
        { onClick: (__VLS_ctx.cancelEditing) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_144 } = __VLS_140.slots;
    let __VLS_145;
    /** @ts-ignore @type {typeof ___VLS_components.X} */
    X;
    // @ts-ignore
    const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_147 = __VLS_146({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_146));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [isEditing, cancelEditing,];
    var __VLS_140;
    var __VLS_141;
    // @ts-ignore
    [];
    var __VLS_134;
    let __VLS_150;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
        side: "bottom",
    }));
    const __VLS_152 = __VLS_151({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_151));
    const { default: __VLS_155 } = __VLS_153.slots;
    // @ts-ignore
    [];
    var __VLS_153;
    // @ts-ignore
    [];
    var __VLS_128;
    let __VLS_156;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({}));
    const __VLS_158 = __VLS_157({}, ...__VLS_functionalComponentArgsRest(__VLS_157));
    const { default: __VLS_161 } = __VLS_159.slots;
    let __VLS_162;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
        asChild: true,
    }));
    const __VLS_164 = __VLS_163({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_163));
    const { default: __VLS_167 } = __VLS_165.slots;
    let __VLS_168;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (!__VLS_ctx.isCurrentJsonValid),
    }));
    const __VLS_170 = __VLS_169({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (!__VLS_ctx.isCurrentJsonValid),
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    let __VLS_173;
    const __VLS_174 = ({ click: {} },
        { onClick: (__VLS_ctx.saveChanges) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_175 } = __VLS_171.slots;
    let __VLS_176;
    /** @ts-ignore @type {typeof ___VLS_components.Save} */
    Save;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_178 = __VLS_177({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [isCurrentJsonValid, saveChanges,];
    var __VLS_171;
    var __VLS_172;
    // @ts-ignore
    [];
    var __VLS_165;
    let __VLS_181;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_182 = __VLS_asFunctionalComponent(__VLS_181, new __VLS_181({
        side: "bottom",
    }));
    const __VLS_183 = __VLS_182({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_182));
    const { default: __VLS_186 } = __VLS_184.slots;
    // @ts-ignore
    [];
    var __VLS_184;
    // @ts-ignore
    [];
    var __VLS_159;
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex items-center gap-1 p-1 border-b bg-muted/30" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
for (const [section] of __VLS_getVForSourceType((__VLS_ctx.sections))) {
    __VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.activeSection = section.id;
                // @ts-ignore
                [activeSection, sections,];
            } },
        key: (section.id),
        ...{ class: "px-3 py-1.5 text-sm font-medium rounded-sm transition-colors" },
        ...{ class: ({
                'bg-secondary text-secondary-foreground': __VLS_ctx.activeSection === section.id,
                'hover:bg-secondary/50 text-muted-foreground': __VLS_ctx.activeSection !== section.id
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-secondary-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-secondary/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (section.label);
    // @ts-ignore
    [activeSection, activeSection,];
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1 min-h-0 overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex items-center justify-center text-sm text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
}
else if (__VLS_ctx.activeSection === 'state') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    if (!__VLS_ctx.hasState) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex-1 flex items-center justify-center text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    else if (__VLS_ctx.isStateDataReady) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex-1 min-h-0" },
        });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
        const __VLS_187 = JsonEditor;
        // @ts-ignore
        const __VLS_188 = __VLS_asFunctionalComponent(__VLS_187, new __VLS_187({
            modelValue: (__VLS_ctx.editedStateJson),
            editable: (__VLS_ctx.isEditingState),
            showCopy: (true),
            mode: (__VLS_ctx.jsonMode),
            fullHeight: (true),
            ...{ class: "h-full" },
        }));
        const __VLS_189 = __VLS_188({
            modelValue: (__VLS_ctx.editedStateJson),
            editable: (__VLS_ctx.isEditingState),
            showCopy: (true),
            mode: (__VLS_ctx.jsonMode),
            fullHeight: (true),
            ...{ class: "h-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_188));
        /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    }
}
else if (__VLS_ctx.activeSection === 'getters') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    if (!__VLS_ctx.hasGetters) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex-1 flex items-center justify-center text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    else if (__VLS_ctx.isGettersDataReady) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex-1 min-h-0" },
        });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
        const __VLS_192 = JsonEditor;
        // @ts-ignore
        const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
            modelValue: (__VLS_ctx.editedGettersJson),
            editable: (__VLS_ctx.isEditingGetters),
            showCopy: (true),
            mode: (__VLS_ctx.jsonMode),
            fullHeight: (true),
            ...{ class: "h-full" },
        }));
        const __VLS_194 = __VLS_193({
            modelValue: (__VLS_ctx.editedGettersJson),
            editable: (__VLS_ctx.isEditingGetters),
            showCopy: (true),
            mode: (__VLS_ctx.jsonMode),
            fullHeight: (true),
            ...{ class: "h-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_193));
        /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    }
}
// @ts-ignore
[hasState, hasGetters, isLoading, activeSection, activeSection, isStateDataReady, editedStateJson, isEditingState, jsonMode, jsonMode, isGettersDataReady, editedGettersJson, isEditingGetters,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=PiniaDetails.vue.js.map