import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Box, DatabaseIcon, GlobeIcon, SettingsIcon, } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from '@/components/ui/tooltip';
import { PropsTab } from '@/features/props';
import { StoresTab, usePiniaStores } from '@/features/stores';
import { OptionsTab } from '@/features/settings';
import { NetworkTab } from '@/features/network';
import { postToContentScript } from '@/utils/postToContentScript';
/* ============================================================================
 * Pinia
 * ============================================================================
 */
const { storesData, loading: storesLoading, error: storesError, load: loadStoresSummary, } = usePiniaStores();
/* ============================================================================
 * Remote flags (content script)
 * ============================================================================
 */
const DEFAULT_REMOTE_FLAGS = {
    hasVue: false,
    hasPinia: false,
    vueVersion: null,
};
const remoteFeatureFlags = ref({
    ...DEFAULT_REMOTE_FLAGS,
});
function normalizeRemoteFlags(flags) {
    return {
        ...DEFAULT_REMOTE_FLAGS,
        ...flags,
    };
}
/* ============================================================================
 * UI feature flags (ручные)
 * ============================================================================
 */
const UI_FEATURE_FLAGS = {
    hasNetwork: true, // 👈 Network tab enabled
};
/**
 * Локальные QA / debug overrides
 */
const localFeatureOverrides = ref({
// hasNetwork: false,
});
/* ============================================================================
 * Финальные флаги UI
 * ============================================================================
 */
const featureFlags = computed(() => ({
    ...remoteFeatureFlags.value, // runtime
    ...UI_FEATURE_FLAGS, // ручные
    ...localFeatureOverrides.value // QA
}));
/* ============================================================================
 * Flags lifecycle - REACTIVE DETECTION
 * ============================================================================
 */
let storesLoaded = false;
/**
 * Handle detection messages from injected script
 * Supports both initial flags and reactive updates
 */
function handleDetectionMessage(event) {
    if (!event.data)
        return;
    let incomingFlags = null;
    // New format (broadcast)
    if (event.data?.__VUE_INSPECTOR__ &&
        event.data.broadcast &&
        event.data.message?.type === 'VUE_INSPECTOR_FEATURE_FLAGS') {
        incomingFlags = event.data.message.flags;
    }
    // Legacy format
    else if (event.data?.type === 'VUE_INSPECTOR_FEATURE_FLAGS' &&
        event.data.flags) {
        incomingFlags = event.data.flags;
    }
    // Response format (from handleGetFlags via ui-bridge)
    else if (event.data?.__VUE_INSPECTOR__ &&
        event.data?.response?.type === 'VUE_INSPECTOR_FEATURE_FLAGS' &&
        event.data?.response?.flags) {
        incomingFlags = event.data.response.flags;
    }
    // Detection result format (from injected/main.ts)
    else if (event.data?.type === 'VUE_INSPECTOR_DETECTION_RESULT' &&
        event.data?.__FROM_VUE_INSPECTOR__) {
        incomingFlags = {
            hasVue: event.data.hasVue ?? false,
            hasPinia: event.data.hasPinia ?? false,
            vueVersion: event.data.vueVersion ?? null
        };
    }
    // Props module ready - Vue was detected
    else if (event.data?.type === 'VUE_INSPECTOR_PROPS_READY' &&
        event.data?.__FROM_VUE_INSPECTOR__) {
        // Update only Vue flag, keep Pinia flag as-is
        remoteFeatureFlags.value = {
            ...remoteFeatureFlags.value,
            hasVue: true
        };
        return;
    }
    // Pinia module ready - Pinia was detected
    else if (event.data?.type === 'VUE_INSPECTOR_PINIA_READY' &&
        event.data?.__FROM_VUE_INSPECTOR__) {
        // Update Pinia flag
        remoteFeatureFlags.value = {
            ...remoteFeatureFlags.value,
            hasPinia: true
        };
        // Load stores if not yet loaded
        if (!storesLoaded) {
            storesLoaded = true;
            loadStoresSummary();
        }
        return;
    }
    // Vue detected format (legacy)
    else if (event.data?.type === 'VUE_INSPECTOR_VUE_DETECTED' &&
        event.data?.__FROM_VUE_INSPECTOR__) {
        if (event.data.detected) {
            remoteFeatureFlags.value = {
                ...remoteFeatureFlags.value,
                hasVue: true,
                vueVersion: event.data.hasVue2 ? 2 : 3
            };
        }
        return;
    }
    if (!incomingFlags)
        return;
    // Merge incoming flags with existing (don't lose already-detected flags)
    const newFlags = normalizeRemoteFlags(incomingFlags);
    // Only update if something changed
    const current = remoteFeatureFlags.value;
    if (current.hasVue !== newFlags.hasVue ||
        current.hasPinia !== newFlags.hasPinia ||
        current.vueVersion !== newFlags.vueVersion) {
        // Preserve already-true flags (detection is one-way: false -> true)
        remoteFeatureFlags.value = {
            hasVue: current.hasVue || newFlags.hasVue,
            hasPinia: current.hasPinia || newFlags.hasPinia,
            vueVersion: newFlags.vueVersion ?? current.vueVersion
        };
    }
    // Load Pinia stores when detected
    if (remoteFeatureFlags.value.hasPinia && !storesLoaded) {
        storesLoaded = true;
        loadStoresSummary();
    }
}
/**
 * Handle breakpoint hit - switch to Network tab and store pending info
 */
function handleBreakpointMessage(event) {
    if (!event.data)
        return;
    // Check for breakpoint hit message (from content script broadcast)
    if (event.data?.__VUE_INSPECTOR__ &&
        event.data.broadcast &&
        event.data.message?.type === 'NETWORK_BREAKPOINT_HIT') {
        const msg = event.data.message;
        // Store pending breakpoint info so NetworkTab can show details on mount
        if (msg.requestId && msg.trigger) {
            pendingBreakpoint.value = {
                requestId: msg.requestId,
                trigger: msg.trigger,
                entry: msg.entry || null // Include entry data if available
            };
        }
        activeTab.value = 'network';
    }
}
/**
 * Clear pending breakpoint (called by NetworkTab after handling)
 */
function clearPendingBreakpoint() {
    pendingBreakpoint.value = null;
}
onMounted(() => {
    // Listen for detection messages (keep listening for reactive updates)
    window.addEventListener('message', handleDetectionMessage);
    // Listen for breakpoint hits to switch to Network tab
    window.addEventListener('message', handleBreakpointMessage);
    // Listen for toast "Preview" → navigate to Options > About
    window.addEventListener('vue-inspector:navigate-about', handleNavigateToAbout);
    // Request initial flags
    postToContentScript({ type: 'VUE_INSPECTOR_GET_FLAGS' });
    // DevTools reconnect handler — re-request flags after page reload
    const handleReconnect = (event) => {
        if (event.data?.__VUE_INSPECTOR__ && event.data.broadcast &&
            event.data.message?.type === 'DEVTOOLS_RECONNECTED') {
            storesLoaded = false;
            postToContentScript({ type: 'VUE_INSPECTOR_GET_FLAGS' });
        }
    };
    window.addEventListener('message', handleReconnect);
    onUnmounted(() => {
        window.removeEventListener('message', handleReconnect);
    });
});
onUnmounted(() => {
    window.removeEventListener('message', handleDetectionMessage);
    window.removeEventListener('message', handleBreakpointMessage);
    window.removeEventListener('vue-inspector:navigate-about', handleNavigateToAbout);
});
/* ============================================================================
 * Tabs
 * ============================================================================
 */
const allTabs = [
    {
        id: 'network',
        title: 'Network',
        icon: GlobeIcon,
        requiresFlag: 'hasNetwork', // 👈 ТОЛЬКО UI-флаг
    },
    {
        id: 'props',
        title: 'Props',
        icon: Box,
        requiresFlag: 'hasVue',
    },
    {
        id: 'stores',
        title: 'Pinia Stores',
        icon: DatabaseIcon,
        requiresFlag: 'hasPinia',
    },
];
const tabs = computed(() => allTabs.filter(tab => featureFlags.value[tab.requiresFlag]));
/* ============================================================================
 * Navigation state
 * ============================================================================
 */
const optionsTab = {
    id: 'options',
    title: 'Options',
    icon: SettingsIcon,
};
const activeTab = ref('props');
const pendingBreakpoint = ref(null);
// Scroll anchor for Options tab (from Network badge clicks)
const optionsScrollAnchor = ref(null);
function handleNavigateToOptions(anchor) {
    optionsScrollAnchor.value = anchor;
    activeTab.value = 'options';
}
function clearScrollAnchor() {
    optionsScrollAnchor.value = null;
}
// Pending About release data (from toast "Preview" button)
const pendingAboutRelease = ref(null);
function handleNavigateToAbout(event) {
    const release = event.detail?.release;
    if (release) {
        pendingAboutRelease.value = release;
        activeTab.value = 'options';
    }
}
function clearPendingAboutRelease() {
    pendingAboutRelease.value = null;
}
/* ============================================================================
 * Tabs watcher
 * ============================================================================
 */
watch(tabs, newTabs => {
    const currentAvailable = newTabs.some(t => t.id === activeTab.value) ||
        activeTab.value === 'options';
    // Only switch if current tab is not available
    if (!currentAvailable && newTabs.length > 0) {
        activeTab.value = newTabs[0].id;
    }
}, { immediate: true });
const __VLS_ctx = {
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid h-full w-full pl-[56px] overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-[56px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "inset-y fixed left-0 z-20 flex h-full flex-col border-r" },
});
/** @type {__VLS_StyleScopedClasses['inset-y']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "grid gap-1 p-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
for (const [tab] of __VLS_getVForSourceType((__VLS_ctx.tabs))) {
    let __VLS_0;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
    TooltipProvider;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        key: (tab.id),
    }));
    const __VLS_2 = __VLS_1({
        key: (tab.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const { default: __VLS_5 } = __VLS_3.slots;
    let __VLS_6;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({}));
    const __VLS_8 = __VLS_7({}, ...__VLS_functionalComponentArgsRest(__VLS_7));
    const { default: __VLS_11 } = __VLS_9.slots;
    let __VLS_12;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        asChild: true,
    }));
    const __VLS_14 = __VLS_13({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    const { default: __VLS_17 } = __VLS_15.slots;
    let __VLS_18;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "rounded-lg" },
        ...{ class: ({ 'bg-muted': __VLS_ctx.activeTab === tab.id }) },
        'aria-label': (tab.title),
    }));
    const __VLS_20 = __VLS_19({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "rounded-lg" },
        ...{ class: ({ 'bg-muted': __VLS_ctx.activeTab === tab.id }) },
        'aria-label': (tab.title),
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    let __VLS_23;
    const __VLS_24 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.activeTab = tab.id;
                // @ts-ignore
                [tabs, activeTab, activeTab,];
            } });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
    const { default: __VLS_25 } = __VLS_21.slots;
    const __VLS_26 = (tab.icon);
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
        ...{ class: "size-5" },
    }));
    const __VLS_28 = __VLS_27({
        ...{ class: "size-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    /** @type {__VLS_StyleScopedClasses['size-5']} */ ;
    // @ts-ignore
    [];
    var __VLS_21;
    var __VLS_22;
    // @ts-ignore
    [];
    var __VLS_15;
    let __VLS_31;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
        side: "right",
        sideOffset: (5),
    }));
    const __VLS_33 = __VLS_32({
        side: "right",
        sideOffset: (5),
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    const { default: __VLS_36 } = __VLS_34.slots;
    (tab.title);
    // @ts-ignore
    [];
    var __VLS_34;
    // @ts-ignore
    [];
    var __VLS_9;
    // @ts-ignore
    [];
    var __VLS_3;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "mt-auto grid gap-1 p-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
let __VLS_37;
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({}));
const __VLS_39 = __VLS_38({}, ...__VLS_functionalComponentArgsRest(__VLS_38));
const { default: __VLS_42 } = __VLS_40.slots;
let __VLS_43;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({}));
const __VLS_45 = __VLS_44({}, ...__VLS_functionalComponentArgsRest(__VLS_44));
const { default: __VLS_48 } = __VLS_46.slots;
let __VLS_49;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    asChild: true,
}));
const __VLS_51 = __VLS_50({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const { default: __VLS_54 } = __VLS_52.slots;
let __VLS_55;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "rounded-lg" },
    ...{ class: ({ 'bg-muted': __VLS_ctx.activeTab === __VLS_ctx.optionsTab.id }) },
    'aria-label': "Options",
}));
const __VLS_57 = __VLS_56({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "rounded-lg" },
    ...{ class: ({ 'bg-muted': __VLS_ctx.activeTab === __VLS_ctx.optionsTab.id }) },
    'aria-label': "Options",
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
const __VLS_61 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.activeTab = __VLS_ctx.optionsTab.id;
            // @ts-ignore
            [activeTab, activeTab, optionsTab, optionsTab,];
        } });
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
const { default: __VLS_62 } = __VLS_58.slots;
let __VLS_63;
/** @ts-ignore @type {typeof ___VLS_components.SettingsIcon} */
SettingsIcon;
// @ts-ignore
const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({
    ...{ class: "size-5" },
}));
const __VLS_65 = __VLS_64({
    ...{ class: "size-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_64));
/** @type {__VLS_StyleScopedClasses['size-5']} */ ;
// @ts-ignore
[];
var __VLS_58;
var __VLS_59;
// @ts-ignore
[];
var __VLS_52;
let __VLS_68;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    side: "right",
    sideOffset: (5),
}));
const __VLS_70 = __VLS_69({
    side: "right",
    sideOffset: (5),
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const { default: __VLS_73 } = __VLS_71.slots;
(__VLS_ctx.optionsTab.title);
// @ts-ignore
[optionsTab,];
var __VLS_71;
// @ts-ignore
[];
var __VLS_46;
// @ts-ignore
[];
var __VLS_40;
__VLS_asFunctionalElement(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "h-full min-h-0 overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
if (__VLS_ctx.activeTab === 'props') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    let __VLS_74;
    /** @ts-ignore @type {typeof ___VLS_components.PropsTab} */
    PropsTab;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
        ...{ 'onNavigateToOptions': {} },
    }));
    const __VLS_76 = __VLS_75({
        ...{ 'onNavigateToOptions': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    let __VLS_79;
    const __VLS_80 = ({ navigateToOptions: {} },
        { onNavigateToOptions: (__VLS_ctx.handleNavigateToOptions) });
    var __VLS_77;
    var __VLS_78;
}
else if (__VLS_ctx.activeTab === 'stores') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    let __VLS_81;
    /** @ts-ignore @type {typeof ___VLS_components.StoresTab} */
    StoresTab;
    // @ts-ignore
    const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
        ...{ 'onNavigateToOptions': {} },
    }));
    const __VLS_83 = __VLS_82({
        ...{ 'onNavigateToOptions': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_82));
    let __VLS_86;
    const __VLS_87 = ({ navigateToOptions: {} },
        { onNavigateToOptions: (__VLS_ctx.handleNavigateToOptions) });
    var __VLS_84;
    var __VLS_85;
}
else if (__VLS_ctx.activeTab === 'network') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    let __VLS_88;
    /** @ts-ignore @type {typeof ___VLS_components.NetworkTab} */
    NetworkTab;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ 'onClearPendingBreakpoint': {} },
        ...{ 'onNavigateToOptions': {} },
        pendingBreakpoint: (__VLS_ctx.pendingBreakpoint),
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onClearPendingBreakpoint': {} },
        ...{ 'onNavigateToOptions': {} },
        pendingBreakpoint: (__VLS_ctx.pendingBreakpoint),
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_93;
    const __VLS_94 = ({ clearPendingBreakpoint: {} },
        { onClearPendingBreakpoint: (__VLS_ctx.clearPendingBreakpoint) });
    const __VLS_95 = ({ navigateToOptions: {} },
        { onNavigateToOptions: (__VLS_ctx.handleNavigateToOptions) });
    var __VLS_91;
    var __VLS_92;
}
else if (__VLS_ctx.activeTab === 'options') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    let __VLS_96;
    /** @ts-ignore @type {typeof ___VLS_components.OptionsTab} */
    OptionsTab;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClearScrollAnchor': {} },
        ...{ 'onClearPendingAboutRelease': {} },
        scrollToAnchor: (__VLS_ctx.optionsScrollAnchor),
        pendingAboutRelease: (__VLS_ctx.pendingAboutRelease),
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClearScrollAnchor': {} },
        ...{ 'onClearPendingAboutRelease': {} },
        scrollToAnchor: (__VLS_ctx.optionsScrollAnchor),
        pendingAboutRelease: (__VLS_ctx.pendingAboutRelease),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_101;
    const __VLS_102 = ({ clearScrollAnchor: {} },
        { onClearScrollAnchor: (__VLS_ctx.clearScrollAnchor) });
    const __VLS_103 = ({ clearPendingAboutRelease: {} },
        { onClearPendingAboutRelease: (__VLS_ctx.clearPendingAboutRelease) });
    var __VLS_99;
    var __VLS_100;
}
// @ts-ignore
[activeTab, activeTab, activeTab, activeTab, handleNavigateToOptions, handleNavigateToOptions, handleNavigateToOptions, pendingBreakpoint, clearPendingBreakpoint, optionsScrollAnchor, pendingAboutRelease, clearScrollAnchor, clearPendingAboutRelease,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
//# sourceMappingURL=Navigation.vue.js.map