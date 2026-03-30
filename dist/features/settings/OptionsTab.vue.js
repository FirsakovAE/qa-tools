import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useInspectorSettings, resetInspectorSettings, exportSettings, importSettings } from '@/settings/useInspectorSettings';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/Sheet';
import { Settings, Globe, Box, Database, Info, MenuIcon, } from 'lucide-vue-next';
import GeneralSection from './sections/GeneralSection.vue';
import NetworkSection from './sections/NetworkSection.vue';
import PropsSection from './sections/PropsSection.vue';
import PiniaSection from './sections/PiniaSection.vue';
import AboutSection from './sections/AboutSection.vue';
import SettingsDetails from './SettingsDetails.vue';
import BreakpointForm from '@/features/network/BreakpointForm.vue';
import MockForm from '@/features/network/MockForm.vue';
import { compareVersions } from '@/services/githubReleaseService';
import { ignoreVersion } from '@/composables/useUpdateChecker';
import { useRuntime } from '@/runtime';
import { postToContentScript } from '@/utils/postToContentScript';
const props = defineProps();
const emit = defineEmits();
// -------------------- RUNTIME --------------------
const runtime = useRuntime();
// -------------------- STATE --------------------
const settings = ref(null);
const isLoading = ref(true);
const activeSection = ref('general');
const sheetOpen = ref(false);
function selectSection(id) {
    activeSection.value = id;
    sheetOpen.value = false;
}
const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'network', label: 'Network', icon: Globe },
    { id: 'props', label: 'Props', icon: Box },
    { id: 'pinia', label: 'Pinia Store', icon: Database },
    { id: 'about', label: 'About', icon: Info },
];
const selectedItem = ref(null);
watch(activeSection, () => {
    selectedItem.value = null;
    piniaFavoriteEditMode.value = false;
    siteListEditMode.value = false;
    if (activeSection.value !== 'about') {
        releaseInfo.value = null;
    }
});
function onSelectItem(item) {
    selectedItem.value = item;
    piniaFavoriteEditMode.value = false;
    siteListEditMode.value = false;
}
// -------------------- EDIT MODE --------------------
const editMode = ref(null);
const editEntry = ref(null);
const editExistingBreakpoint = ref(null);
const editExistingMock = ref(null);
function buildEntryFromBreakpoint(bp) {
    const url = `${bp.scheme}://${bp.host}${bp.port ? ':' + bp.port : ''}${bp.path}${bp.query ? '?' + bp.query : ''}`;
    return {
        id: bp.id, version: 1, timestamp: bp.timestamp,
        method: bp.method || 'GET', url, path: bp.path,
        name: bp.path.split('/').pop() || bp.path,
        status: 0, statusText: '', duration: 0, size: 0,
        requestHeaders: [], responseHeaders: [], params: [],
        authorization: { type: 'None' },
        requestBody: null, responseBody: null,
        pending: false, initiator: 'fetch'
    };
}
function buildEntryFromMock(mock) {
    const url = `${mock.scheme || 'https'}://${mock.host || 'example.com'}${mock.port ? ':' + mock.port : ''}${mock.path || '/'}${mock.query ? '?' + mock.query : ''}`;
    return {
        id: mock.id, version: 1, timestamp: mock.timestamp,
        method: mock.method || 'GET', url, path: mock.path || '/',
        name: (mock.path || '/').split('/').pop() || '/',
        status: mock.status, statusText: mock.statusText || '', duration: 0, size: 0,
        requestHeaders: [],
        responseHeaders: mock.headers.map(h => ({ name: h.name, value: h.value })),
        params: [], authorization: { type: 'None' },
        requestBody: null,
        responseBody: mock.body !== undefined ? { text: mock.body || '', contentType: 'application/json', originalSize: (mock.body || '').length, truncated: false, isBinary: false } : null,
        pending: false, initiator: 'fetch'
    };
}
function findBreakpointById(id) {
    if (!settings.value?.breakpoints)
        return null;
    return settings.value.breakpoints.active.find(bp => bp.id === id)
        || settings.value.breakpoints.inactive.find(bp => bp.id === id)
        || null;
}
function findMockById(id) {
    if (!settings.value?.mocks)
        return null;
    return settings.value.mocks.active.find(m => m.id === id)
        || settings.value.mocks.inactive.find(m => m.id === id)
        || null;
}
function handleEditBreakpoint(id) {
    const bp = findBreakpointById(id);
    if (!bp)
        return;
    editExistingBreakpoint.value = bp;
    editEntry.value = buildEntryFromBreakpoint(bp);
    editMode.value = 'breakpoint';
}
function handleEditMock(id) {
    const mock = findMockById(id);
    if (!mock)
        return;
    editExistingMock.value = mock;
    editEntry.value = buildEntryFromMock(mock);
    editMode.value = 'mock';
}
function handleEditFromDetails() {
    if (!selectedItem.value)
        return;
    if (selectedItem.value.type === 'breakpoint') {
        piniaFavoriteEditMode.value = false;
        siteListEditMode.value = false;
        handleEditBreakpoint(selectedItem.value.id);
    }
    else if (selectedItem.value.type === 'mock') {
        piniaFavoriteEditMode.value = false;
        siteListEditMode.value = false;
        handleEditMock(selectedItem.value.id);
    }
    else if (selectedItem.value.type === 'pinia-favorite') {
        siteListEditMode.value = false;
        piniaFavoriteEditMode.value = true;
    }
    else if (selectedItem.value.type === 'site-blacklist' || selectedItem.value.type === 'site-whitelist') {
        piniaFavoriteEditMode.value = false;
        siteListEditMode.value = true;
    }
}
function handleEditFormBack() {
    editMode.value = null;
    editEntry.value = null;
    editExistingBreakpoint.value = null;
    editExistingMock.value = null;
    piniaFavoriteEditMode.value = false;
    siteListEditMode.value = false;
}
const piniaFavoriteEditMode = ref(false);
const siteListEditMode = ref(false);
function handleEditPiniaFavorite(item) {
    selectedItem.value = item;
    siteListEditMode.value = false;
    piniaFavoriteEditMode.value = true;
}
function handleEditSiteList(item) {
    selectedItem.value = item;
    piniaFavoriteEditMode.value = false;
    siteListEditMode.value = true;
}
function handlePiniaFavoriteEditDone(newId) {
    piniaFavoriteEditMode.value = false;
    if (newId && selectedItem.value?.type === 'pinia-favorite') {
        selectedItem.value = { type: 'pinia-favorite', id: newId };
    }
}
function handleSiteListEditDone() {
    siteListEditMode.value = false;
}
function handleBreakpointEditConfirm(breakpoint) {
    if (!settings.value?.breakpoints)
        return;
    const bps = settings.value.breakpoints;
    // Update in active list
    const activeIdx = bps.active.findIndex(bp => bp.id === breakpoint.id);
    if (activeIdx !== -1) {
        bps.active[activeIdx] = breakpoint;
    }
    else {
        // Update in inactive list
        const inactiveIdx = bps.inactive.findIndex(bp => bp.id === breakpoint.id);
        if (inactiveIdx !== -1) {
            bps.inactive[inactiveIdx] = breakpoint;
        }
    }
    syncBreakpoints();
    handleEditFormBack();
}
function handleMockEditConfirm(mock) {
    if (!settings.value?.mocks)
        return;
    const mocks = settings.value.mocks;
    // Update in active list
    const activeIdx = mocks.active.findIndex(m => m.id === mock.id);
    if (activeIdx !== -1) {
        mocks.active[activeIdx] = mock;
    }
    else {
        // Update in inactive list
        const inactiveIdx = mocks.inactive.findIndex(m => m.id === mock.id);
        if (inactiveIdx !== -1) {
            mocks.inactive[inactiveIdx] = mock;
        }
    }
    syncMocks();
    handleEditFormBack();
}
// -------------------- RELEASE INFO --------------------
const releaseInfo = ref(null);
function handleShowRelease(info) {
    selectedItem.value = null;
    releaseInfo.value = info;
}
function handleCloseRelease() {
    releaseInfo.value = null;
}
async function handleIgnoreVersion(version) {
    try {
        await ignoreVersion(version);
        releaseInfo.value = null;
    }
    catch (error) {
        console.error('[settings/OptionsTab] handleIgnoreVersion failed:', error);
    }
}
function handleDownloadUpdate(url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
const optionsDetailsActive = computed(() => !!selectedItem.value || !!editMode.value || !!(releaseInfo.value && activeSection.value === 'about'));
// Handle navigation from toast "Preview" button
watch(() => props.pendingAboutRelease, (release) => {
    if (!release)
        return;
    activeSection.value = 'about';
    const localVersion = runtime.getManifest()?.version || '0.0.0';
    const remoteVersion = release.tag_name.replace(/^v/, '');
    const hasUpdate = compareVersions(remoteVersion, localVersion) > 0;
    releaseInfo.value = {
        type: hasUpdate ? 'update-available' : 'release-notes',
        body: release.body || 'No release notes available.',
        version: remoteVersion,
        downloadUrl: release.assets?.[0]?.browser_download_url ?? null,
    };
    emit('clearPendingAboutRelease');
}, { immediate: true });
// -------------------- NETWORK SYNC --------------------
function sendNetworkCommand(type, data = {}) {
    postToContentScript({
        type,
        __VUE_INSPECTOR__: true,
        __NETWORK_CMD__: true,
        ...data
    });
}
function syncBreakpoints() {
    if (!settings.value?.breakpoints)
        return;
    const breakpointsToSync = settings.value.breakpoints.active.map(bp => ({
        id: bp.id,
        scheme: bp.scheme,
        host: bp.host,
        port: bp.port,
        path: bp.path,
        query: bp.query,
        trigger: bp.trigger,
        enabled: true
    }));
    sendNetworkCommand('NETWORK_BREAKPOINTS_SYNC', {
        breakpoints: JSON.parse(JSON.stringify(breakpointsToSync))
    });
}
function syncMocks() {
    if (!settings.value?.mocks)
        return;
    const mocksToSync = settings.value.mocks.active.map(m => ({
        id: m.id,
        enabled: true,
        scheme: m.scheme,
        host: m.host,
        port: m.port,
        path: m.path,
        query: m.query,
        method: m.method,
        status: m.status || 200,
        statusText: m.statusText || 'OK',
        headers: m.headers || [],
        body: m.body === undefined ? undefined : (m.body || ''),
        delay: m.delay
    }));
    sendNetworkCommand('NETWORK_MOCKS_SYNC', {
        mocks: JSON.parse(JSON.stringify(mocksToSync))
    });
}
// Auto-sync when breakpoints/mocks change
watch(() => settings.value?.breakpoints, () => syncBreakpoints(), { deep: true });
watch(() => settings.value?.mocks, () => syncMocks(), { deep: true });
// -------------------- ALERT DIALOG --------------------
const alertDialog = ref({
    open: false,
    title: '',
    description: '',
    type: 'info'
});
function showAlert(title, description, type = 'info') {
    alertDialog.value = { open: true, title, description, type };
}
// -------------------- IMPORT / EXPORT --------------------
const importError = ref(null);
async function handleExport() {
    if (!settings.value)
        return;
    try {
        const settingsJson = await exportSettings();
        const blob = new Blob([settingsJson], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vue-inspector-settings-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('Export Complete', 'Settings have been exported to a file.', 'success');
    }
    catch (error) {
        console.error('[settings/OptionsTab] handleExport failed:', error);
        showAlert('Export Failed', 'Failed to export settings. Please try again.', 'error');
    }
}
async function handleImport() {
    if (!settings.value)
        return;
    importError.value = null;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            const text = await file.text();
            await importSettings(text);
            const newSettings = await useInspectorSettings();
            settings.value = newSettings;
            syncBreakpoints();
            syncMocks();
            showAlert('Import Complete', 'Settings have been imported successfully.', 'success');
        }
        catch (error) {
            console.error('[settings/OptionsTab] handleImport failed:', error);
            importError.value = error instanceof Error ? error.message : 'Invalid settings file';
            showAlert('Import Failed', error instanceof Error ? error.message : 'Invalid settings file', 'error');
        }
    };
    input.click();
}
async function handleReset() {
    try {
        await resetInspectorSettings();
        const newSettings = await useInspectorSettings();
        settings.value = newSettings;
        syncBreakpoints();
        syncMocks();
        selectedItem.value = null;
        showAlert('Reset Complete', 'All settings have been reset to defaults.', 'success');
    }
    catch (error) {
        console.error('[settings/OptionsTab] handleReset failed:', error);
        showAlert('Reset Failed', 'Failed to reset settings. Please try again.', 'error');
    }
}
// -------------------- SCROLL TO ANCHOR --------------------
watch(() => props.scrollToAnchor, (anchor) => {
    if (!anchor)
        return;
    // Switch section based on anchor
    if (anchor === 'saved-files-section') {
        activeSection.value = 'general';
    }
    else if (anchor === 'favorites-section') {
        activeSection.value = 'props';
    }
    else if (anchor === 'pinia-favorites-section') {
        activeSection.value = 'pinia';
    }
    else {
        activeSection.value = 'network';
    }
    nextTick(() => {
        // Small delay to ensure DOM is rendered after section switch
        setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            emit('clearScrollAnchor');
        }, 50);
    });
}, { immediate: true });
// -------------------- MOUNT --------------------
onMounted(async () => {
    try {
        const loadedSettings = await useInspectorSettings();
        settings.value = loadedSettings;
        // Initialize breakpoints/mocks if missing
        if (loadedSettings && !loadedSettings.breakpoints) {
            loadedSettings.breakpoints = { active: [], inactive: [] };
        }
        if (loadedSettings && !loadedSettings.mocks) {
            loadedSettings.mocks = { active: [], inactive: [] };
        }
    }
    catch (error) {
        console.error('[settings/OptionsTab] useInspectorSettings failed:', error);
    }
    finally {
        nextTick(() => {
            isLoading.value = false;
        });
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
/** @type {__VLS_StyleScopedClasses['options-hamburger']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full flex flex-col overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex items-center gap-2 p-2 border-b" },
    ...{ class: ({ 'toolbar-hide-on-details': __VLS_ctx.optionsDetailsActive }) },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-hide-on-details']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Sheet} */
Sheet;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    open: (__VLS_ctx.sheetOpen),
}));
const __VLS_2 = __VLS_1({
    open: (__VLS_ctx.sheetOpen),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
let __VLS_6;
/** @ts-ignore @type {typeof ___VLS_components.SheetTrigger} */
SheetTrigger;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    asChild: true,
}));
const __VLS_8 = __VLS_7({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
let __VLS_12;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    variant: "outline",
    size: "icon",
    ...{ class: "h-8 w-8 shrink-0 options-hamburger" },
}));
const __VLS_14 = __VLS_13({
    variant: "outline",
    size: "icon",
    ...{ class: "h-8 w-8 shrink-0 options-hamburger" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['options-hamburger']} */ ;
const { default: __VLS_17 } = __VLS_15.slots;
let __VLS_18;
/** @ts-ignore @type {typeof ___VLS_components.MenuIcon} */
MenuIcon;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
    ...{ class: "h-4 w-4" },
}));
const __VLS_20 = __VLS_19({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[optionsDetailsActive, sheetOpen,];
var __VLS_15;
// @ts-ignore
[];
var __VLS_9;
let __VLS_23;
/** @ts-ignore @type {typeof ___VLS_components.SheetContent} */
SheetContent;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
    side: "left",
    ...{ class: "w-[240px] p-4 text-foreground bg-background" },
}));
const __VLS_25 = __VLS_24({
    side: "left",
    ...{ class: "w-[240px] p-4 text-foreground bg-background" },
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
/** @type {__VLS_StyleScopedClasses['w-[240px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
const { default: __VLS_28 } = __VLS_26.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "flex flex-col gap-1 mt-4" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
for (const [section] of __VLS_getVForSourceType((__VLS_ctx.sections))) {
    let __VLS_29;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        ...{ 'onClick': {} },
        key: (section.id),
        variant: "ghost",
        size: "sm",
        ...{ class: ([
                'w-full justify-start h-10 text-sm',
                __VLS_ctx.activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
            ]) },
    }));
    const __VLS_31 = __VLS_30({
        ...{ 'onClick': {} },
        key: (section.id),
        variant: "ghost",
        size: "sm",
        ...{ class: ([
                'w-full justify-start h-10 text-sm',
                __VLS_ctx.activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
            ]) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    let __VLS_34;
    const __VLS_35 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.selectSection(section.id);
                // @ts-ignore
                [sections, activeSection, selectSection,];
            } });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const { default: __VLS_36 } = __VLS_32.slots;
    const __VLS_37 = (section.icon);
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
        ...{ class: "w-5 h-5 mr-2 shrink-0" },
    }));
    const __VLS_39 = __VLS_38({
        ...{ class: "w-5 h-5 mr-2 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    (section.label);
    // @ts-ignore
    [];
    var __VLS_32;
    var __VLS_33;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_26;
// @ts-ignore
[];
var __VLS_3;
let __VLS_42;
/** @ts-ignore @type {typeof ___VLS_components.Settings} */
Settings;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
    ...{ class: "h-5 w-5 text-muted-foreground" },
}));
const __VLS_44 = __VLS_43({
    ...{ class: "h-5 w-5 text-muted-foreground" },
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1 flex items-center justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-center" },
    });
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div)({
        ...{ class: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
}
else if (!__VLS_ctx.settings) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1 flex items-center justify-center text-destructive_text" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
}
else {
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
        ...{ class: "h-full min-h-0 min-w-0 flex overflow-hidden gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "options-sidebar shrink-0 w-[240px] p-1 flex flex-col gap-1 bg-muted/50 rounded-lg" },
    });
    /** @type {__VLS_StyleScopedClasses['options-sidebar']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-[240px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    for (const [section] of __VLS_getVForSourceType((__VLS_ctx.sections))) {
        let __VLS_47;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
            ...{ 'onClick': {} },
            key: (section.id),
            variant: "ghost",
            size: "sm",
            ...{ class: ([
                    'w-full justify-start h-10 text-sm',
                    __VLS_ctx.activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
                ]) },
        }));
        const __VLS_49 = __VLS_48({
            ...{ 'onClick': {} },
            key: (section.id),
            variant: "ghost",
            size: "sm",
            ...{ class: ([
                    'w-full justify-start h-10 text-sm',
                    __VLS_ctx.activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
                ]) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
        let __VLS_52;
        const __VLS_53 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isLoading))
                        return;
                    if (!!(!__VLS_ctx.settings))
                        return;
                    __VLS_ctx.activeSection = section.id;
                    // @ts-ignore
                    [sections, activeSection, activeSection, isLoading, settings,];
                } });
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        const { default: __VLS_54 } = __VLS_50.slots;
        const __VLS_55 = (section.icon);
        // @ts-ignore
        const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
            ...{ class: "w-5 h-5 mr-2 shrink-0" },
        }));
        const __VLS_57 = __VLS_56({
            ...{ class: "w-5 h-5 mr-2 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_56));
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        (section.label);
        // @ts-ignore
        [];
        var __VLS_50;
        var __VLS_51;
        // @ts-ignore
        [];
    }
    let __VLS_60;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ class: "options-section-scroll flex-1 min-h-0 min-w-0 border rounded-lg" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "options-section-scroll flex-1 min-h-0 min-w-0 border rounded-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    /** @type {__VLS_StyleScopedClasses['options-section-scroll']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    const { default: __VLS_65 } = __VLS_63.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-4 min-w-0 overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    if (__VLS_ctx.activeSection === 'general') {
        const __VLS_66 = GeneralSection;
        // @ts-ignore
        const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
            ...{ 'onImport': {} },
            ...{ 'onExport': {} },
            ...{ 'onReset': {} },
            ...{ 'onSelect': {} },
            ...{ 'onEdit': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'saved-file' ? __VLS_ctx.selectedItem.id : null),
            selectedSiteList: (__VLS_ctx.selectedItem?.type === 'site-blacklist'
                ? { kind: 'blacklist', id: __VLS_ctx.selectedItem.id }
                : __VLS_ctx.selectedItem?.type === 'site-whitelist'
                    ? { kind: 'whitelist', id: __VLS_ctx.selectedItem.id }
                    : null),
        }));
        const __VLS_68 = __VLS_67({
            ...{ 'onImport': {} },
            ...{ 'onExport': {} },
            ...{ 'onReset': {} },
            ...{ 'onSelect': {} },
            ...{ 'onEdit': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'saved-file' ? __VLS_ctx.selectedItem.id : null),
            selectedSiteList: (__VLS_ctx.selectedItem?.type === 'site-blacklist'
                ? { kind: 'blacklist', id: __VLS_ctx.selectedItem.id }
                : __VLS_ctx.selectedItem?.type === 'site-whitelist'
                    ? { kind: 'whitelist', id: __VLS_ctx.selectedItem.id }
                    : null),
        }, ...__VLS_functionalComponentArgsRest(__VLS_67));
        let __VLS_71;
        const __VLS_72 = ({ import: {} },
            { onImport: (__VLS_ctx.handleImport) });
        const __VLS_73 = ({ export: {} },
            { onExport: (__VLS_ctx.handleExport) });
        const __VLS_74 = ({ reset: {} },
            { onReset: (__VLS_ctx.handleReset) });
        const __VLS_75 = ({ select: {} },
            { onSelect: (__VLS_ctx.onSelectItem) });
        const __VLS_76 = ({ edit: {} },
            { onEdit: (__VLS_ctx.handleEditSiteList) });
        var __VLS_69;
        var __VLS_70;
    }
    else if (__VLS_ctx.activeSection === 'network') {
        const __VLS_77 = NetworkSection;
        // @ts-ignore
        const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
            ...{ 'onSelect': {} },
            ...{ 'onEditBreakpoint': {} },
            ...{ 'onEditMock': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'breakpoint' || __VLS_ctx.selectedItem?.type === 'mock' ? __VLS_ctx.selectedItem.id : null),
        }));
        const __VLS_79 = __VLS_78({
            ...{ 'onSelect': {} },
            ...{ 'onEditBreakpoint': {} },
            ...{ 'onEditMock': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'breakpoint' || __VLS_ctx.selectedItem?.type === 'mock' ? __VLS_ctx.selectedItem.id : null),
        }, ...__VLS_functionalComponentArgsRest(__VLS_78));
        let __VLS_82;
        const __VLS_83 = ({ select: {} },
            { onSelect: (__VLS_ctx.onSelectItem) });
        const __VLS_84 = ({ editBreakpoint: {} },
            { onEditBreakpoint: (__VLS_ctx.handleEditBreakpoint) });
        const __VLS_85 = ({ editMock: {} },
            { onEditMock: (__VLS_ctx.handleEditMock) });
        var __VLS_80;
        var __VLS_81;
    }
    else if (__VLS_ctx.activeSection === 'props') {
        const __VLS_86 = PropsSection;
        // @ts-ignore
        const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
            ...{ 'onSelect': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'blacklist' || __VLS_ctx.selectedItem?.type === 'favorite' ? __VLS_ctx.selectedItem.id : null),
        }));
        const __VLS_88 = __VLS_87({
            ...{ 'onSelect': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'blacklist' || __VLS_ctx.selectedItem?.type === 'favorite' ? __VLS_ctx.selectedItem.id : null),
        }, ...__VLS_functionalComponentArgsRest(__VLS_87));
        let __VLS_91;
        const __VLS_92 = ({ select: {} },
            { onSelect: (__VLS_ctx.onSelectItem) });
        var __VLS_89;
        var __VLS_90;
    }
    else if (__VLS_ctx.activeSection === 'pinia') {
        const __VLS_93 = PiniaSection;
        // @ts-ignore
        const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
            ...{ 'onSelect': {} },
            ...{ 'onEdit': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'pinia-favorite' ? __VLS_ctx.selectedItem.id : null),
        }));
        const __VLS_95 = __VLS_94({
            ...{ 'onSelect': {} },
            ...{ 'onEdit': {} },
            settings: (__VLS_ctx.settings),
            selectedItemId: (__VLS_ctx.selectedItem?.type === 'pinia-favorite' ? __VLS_ctx.selectedItem.id : null),
        }, ...__VLS_functionalComponentArgsRest(__VLS_94));
        let __VLS_98;
        const __VLS_99 = ({ select: {} },
            { onSelect: (__VLS_ctx.onSelectItem) });
        const __VLS_100 = ({ edit: {} },
            { onEdit: (__VLS_ctx.handleEditPiniaFavorite) });
        var __VLS_96;
        var __VLS_97;
    }
    else if (__VLS_ctx.activeSection === 'about') {
        const __VLS_101 = AboutSection;
        // @ts-ignore
        const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
            ...{ 'onShowRelease': {} },
            settings: (__VLS_ctx.settings),
        }));
        const __VLS_103 = __VLS_102({
            ...{ 'onShowRelease': {} },
            settings: (__VLS_ctx.settings),
        }, ...__VLS_functionalComponentArgsRest(__VLS_102));
        let __VLS_106;
        const __VLS_107 = ({ showRelease: {} },
            { onShowRelease: (__VLS_ctx.handleShowRelease) });
        var __VLS_104;
        var __VLS_105;
    }
    // @ts-ignore
    [activeSection, activeSection, activeSection, activeSection, activeSection, settings, settings, settings, settings, settings, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, handleImport, handleExport, handleReset, onSelectItem, onSelectItem, onSelectItem, onSelectItem, handleEditSiteList, handleEditBreakpoint, handleEditMock, handleEditPiniaFavorite, handleShowRelease,];
    var __VLS_63;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full min-h-0 overflow-hidden border rounded-lg details-panel" },
        ...{ class: ({
                'ring-2 ring-amber-500': __VLS_ctx.editMode === 'breakpoint',
                'ring-2 ring-purple-500': __VLS_ctx.editMode === 'mock',
                'details-active': __VLS_ctx.optionsDetailsActive
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
    if (__VLS_ctx.editMode === 'breakpoint' && __VLS_ctx.editEntry) {
        const __VLS_108 = BreakpointForm;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            ...{ 'onBack': {} },
            ...{ 'onConfirm': {} },
            entry: (__VLS_ctx.editEntry),
            existingBreakpoint: (__VLS_ctx.editExistingBreakpoint ?? undefined),
        }));
        const __VLS_110 = __VLS_109({
            ...{ 'onBack': {} },
            ...{ 'onConfirm': {} },
            entry: (__VLS_ctx.editEntry),
            existingBreakpoint: (__VLS_ctx.editExistingBreakpoint ?? undefined),
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        let __VLS_113;
        const __VLS_114 = ({ back: {} },
            { onBack: (__VLS_ctx.handleEditFormBack) });
        const __VLS_115 = ({ confirm: {} },
            { onConfirm: (__VLS_ctx.handleBreakpointEditConfirm) });
        var __VLS_111;
        var __VLS_112;
    }
    else if (__VLS_ctx.editMode === 'mock' && __VLS_ctx.editEntry) {
        const __VLS_116 = MockForm;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            ...{ 'onBack': {} },
            ...{ 'onConfirm': {} },
            entry: (__VLS_ctx.editEntry),
            existingMock: (__VLS_ctx.editExistingMock ?? undefined),
        }));
        const __VLS_118 = __VLS_117({
            ...{ 'onBack': {} },
            ...{ 'onConfirm': {} },
            entry: (__VLS_ctx.editEntry),
            existingMock: (__VLS_ctx.editExistingMock ?? undefined),
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        let __VLS_121;
        const __VLS_122 = ({ back: {} },
            { onBack: (__VLS_ctx.handleEditFormBack) });
        const __VLS_123 = ({ confirm: {} },
            { onConfirm: (__VLS_ctx.handleMockEditConfirm) });
        var __VLS_119;
        var __VLS_120;
    }
    else {
        const __VLS_124 = SettingsDetails;
        // @ts-ignore
        const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
            ...{ 'onClose': {} },
            ...{ 'onCloseRelease': {} },
            ...{ 'onIgnoreVersion': {} },
            ...{ 'onDownloadUpdate': {} },
            ...{ 'onEdit': {} },
            ...{ 'onPiniaFavoriteEditDone': {} },
            ...{ 'onSiteListEditDone': {} },
            settings: (__VLS_ctx.settings),
            selectedItem: (__VLS_ctx.selectedItem),
            releaseInfo: (__VLS_ctx.activeSection === 'about' ? __VLS_ctx.releaseInfo : null),
            piniaFavoriteEditMode: (__VLS_ctx.piniaFavoriteEditMode),
            siteListEditMode: (__VLS_ctx.siteListEditMode),
        }));
        const __VLS_126 = __VLS_125({
            ...{ 'onClose': {} },
            ...{ 'onCloseRelease': {} },
            ...{ 'onIgnoreVersion': {} },
            ...{ 'onDownloadUpdate': {} },
            ...{ 'onEdit': {} },
            ...{ 'onPiniaFavoriteEditDone': {} },
            ...{ 'onSiteListEditDone': {} },
            settings: (__VLS_ctx.settings),
            selectedItem: (__VLS_ctx.selectedItem),
            releaseInfo: (__VLS_ctx.activeSection === 'about' ? __VLS_ctx.releaseInfo : null),
            piniaFavoriteEditMode: (__VLS_ctx.piniaFavoriteEditMode),
            siteListEditMode: (__VLS_ctx.siteListEditMode),
        }, ...__VLS_functionalComponentArgsRest(__VLS_125));
        let __VLS_129;
        const __VLS_130 = ({ close: {} },
            { onClose: (...[$event]) => {
                    if (!!(__VLS_ctx.isLoading))
                        return;
                    if (!!(!__VLS_ctx.settings))
                        return;
                    if (!!(__VLS_ctx.editMode === 'breakpoint' && __VLS_ctx.editEntry))
                        return;
                    if (!!(__VLS_ctx.editMode === 'mock' && __VLS_ctx.editEntry))
                        return;
                    __VLS_ctx.selectedItem = null;
                    __VLS_ctx.piniaFavoriteEditMode = false;
                    __VLS_ctx.siteListEditMode = false;
                    // @ts-ignore
                    [optionsDetailsActive, activeSection, settings, selectedItem, selectedItem, editMode, editMode, editMode, editMode, editEntry, editEntry, editEntry, editEntry, editExistingBreakpoint, handleEditFormBack, handleEditFormBack, handleBreakpointEditConfirm, editExistingMock, handleMockEditConfirm, releaseInfo, piniaFavoriteEditMode, piniaFavoriteEditMode, siteListEditMode, siteListEditMode,];
                } });
        const __VLS_131 = ({ closeRelease: {} },
            { onCloseRelease: (__VLS_ctx.handleCloseRelease) });
        const __VLS_132 = ({ ignoreVersion: {} },
            { onIgnoreVersion: (__VLS_ctx.handleIgnoreVersion) });
        const __VLS_133 = ({ downloadUpdate: {} },
            { onDownloadUpdate: (__VLS_ctx.handleDownloadUpdate) });
        const __VLS_134 = ({ edit: {} },
            { onEdit: (__VLS_ctx.handleEditFromDetails) });
        const __VLS_135 = ({ piniaFavoriteEditDone: {} },
            { onPiniaFavoriteEditDone: (__VLS_ctx.handlePiniaFavoriteEditDone) });
        const __VLS_136 = ({ siteListEditDone: {} },
            { onSiteListEditDone: (__VLS_ctx.handleSiteListEditDone) });
        var __VLS_127;
        var __VLS_128;
    }
}
let __VLS_137;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialog} */
AlertDialog;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
    ...{ 'onUpdate:open': {} },
    open: (__VLS_ctx.alertDialog.open),
}));
const __VLS_139 = __VLS_138({
    ...{ 'onUpdate:open': {} },
    open: (__VLS_ctx.alertDialog.open),
}, ...__VLS_functionalComponentArgsRest(__VLS_138));
let __VLS_142;
const __VLS_143 = ({ 'update:open': {} },
    { 'onUpdate:open': ((open) => __VLS_ctx.alertDialog.open = open) });
const { default: __VLS_144 } = __VLS_140.slots;
let __VLS_145;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogContent} */
AlertDialogContent;
// @ts-ignore
const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({}));
const __VLS_147 = __VLS_146({}, ...__VLS_functionalComponentArgsRest(__VLS_146));
const { default: __VLS_150 } = __VLS_148.slots;
let __VLS_151;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogHeader} */
AlertDialogHeader;
// @ts-ignore
const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({}));
const __VLS_153 = __VLS_152({}, ...__VLS_functionalComponentArgsRest(__VLS_152));
const { default: __VLS_156 } = __VLS_154.slots;
let __VLS_157;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogTitle} */
AlertDialogTitle;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({}));
const __VLS_159 = __VLS_158({}, ...__VLS_functionalComponentArgsRest(__VLS_158));
const { default: __VLS_162 } = __VLS_160.slots;
(__VLS_ctx.alertDialog.title);
// @ts-ignore
[handleCloseRelease, handleIgnoreVersion, handleDownloadUpdate, handleEditFromDetails, handlePiniaFavoriteEditDone, handleSiteListEditDone, alertDialog, alertDialog, alertDialog,];
var __VLS_160;
let __VLS_163;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogDescription} */
AlertDialogDescription;
// @ts-ignore
const __VLS_164 = __VLS_asFunctionalComponent(__VLS_163, new __VLS_163({}));
const __VLS_165 = __VLS_164({}, ...__VLS_functionalComponentArgsRest(__VLS_164));
const { default: __VLS_168 } = __VLS_166.slots;
(__VLS_ctx.alertDialog.description);
// @ts-ignore
[alertDialog,];
var __VLS_166;
// @ts-ignore
[];
var __VLS_154;
let __VLS_169;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogFooter} */
AlertDialogFooter;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
    ...{ class: "justify-center" },
}));
const __VLS_171 = __VLS_170({
    ...{ class: "justify-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
const { default: __VLS_174 } = __VLS_172.slots;
let __VLS_175;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogAction} */
AlertDialogAction;
// @ts-ignore
const __VLS_176 = __VLS_asFunctionalComponent(__VLS_175, new __VLS_175({
    ...{ 'onClick': {} },
}));
const __VLS_177 = __VLS_176({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_176));
let __VLS_180;
const __VLS_181 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.alertDialog.open = false;
            // @ts-ignore
            [alertDialog,];
        } });
const { default: __VLS_182 } = __VLS_178.slots;
// @ts-ignore
[];
var __VLS_178;
var __VLS_179;
// @ts-ignore
[];
var __VLS_172;
// @ts-ignore
[];
var __VLS_148;
// @ts-ignore
[];
var __VLS_140;
var __VLS_141;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=OptionsTab.vue.js.map