import { ref, watch, computed, onMounted } from 'vue';
import { addMedia, removeMedia, putWallpaperBlob, removeWallpaperBlob, initWallpapersStore } from '@/settings/mediaStore';
import { getStorageClient } from '@/storage/storage-client';
import { MEDIA_LIMIT_BYTES } from '@/storage/storage-protocol';
import { Progress } from '@/components/ui/Progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import RadioGroup from '@/components/ui/RadioGroup/RadioGroup.vue';
import RadioGroupItem from '@/components/ui/RadioGroup/RadioGroupItem.vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { ContextMenu, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { OptionsItemActionsMenuContent } from '@/components/OptionsItemActionsMenu';
import { Info, Download, Upload, RotateCcw, Plus, MoreHorizontal, Pencil, Trash, Moon, Sun, AlertTriangle } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { getRuntimeAdapter } from '@/runtime';
import ImagePickerDrawer from '@/features/settings/components/ImagePickerDrawer.vue';
import { wallpapers, defaultWallpaperName } from '@/assets/wallpapers';
const props = defineProps();
const emit = defineEmits();
const runtime = getRuntimeAdapter();
const isRunningInDevtools = runtime?.id === 'devtools';
const isStandalone = runtime?.capabilities.mode === 'standalone';
// -------------------- STORAGE USAGE (standalone) --------------------
const mediaUsedBytes = ref(0);
const storageClient = isStandalone ? getStorageClient() : null;
async function refreshMediaUsage() {
    if (!storageClient)
        return;
    try {
        mediaUsedBytes.value = await storageClient.getTotalMediaSize();
    }
    catch (error) {
        console.error('[settings/GeneralSection] refreshMediaUsage failed:', error);
    }
}
const mediaUsagePercent = computed(() => Math.min(100, Math.round((mediaUsedBytes.value / MEDIA_LIMIT_BYTES) * 100)));
const mediaUsageLabel = computed(() => {
    const used = (mediaUsedBytes.value / 1024 / 1024).toFixed(1);
    const limit = (MEDIA_LIMIT_BYTES / 1024 / 1024).toFixed(0);
    return `${used} MB / ${limit} MB`;
});
if (isStandalone)
    onMounted(refreshMediaUsage);
/** Standalone: media files for background picker (from wallpapers store). Extension: from savedFiles. */
const mediaFilesForPicker = computed(() => {
    if (isStandalone) {
        const wallpapers = props.settings.customize?.image?.wallpapers ?? [];
        return wallpapers
            .filter(w => w.mimeType.startsWith('image/') || w.mimeType.startsWith('video/'))
            .map(w => ({ id: w.id, name: w.name, size: w.size ?? 0, mimeType: w.mimeType }));
    }
    return (props.settings.savedFiles ?? []).filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'));
});
/** Saved Files table: standalone = wallpapers + savedFiles, extension = savedFiles only */
const savedFilesForTable = computed(() => {
    if (isStandalone) {
        const wallpapers = (props.settings.customize?.image?.wallpapers ?? []).map(w => ({
            id: w.id,
            name: w.name,
            size: w.size ?? 0,
            mimeType: w.mimeType,
            _isWallpaper: true,
        }));
        const breakpointFiles = (props.settings.savedFiles ?? []).map(f => ({
            ...f,
            _isWallpaper: false,
        }));
        return [...wallpapers, ...breakpointFiles];
    }
    return (props.settings.savedFiles ?? []).map(f => ({ ...f, _isWallpaper: false }));
});
const displayMode = computed({
    get: () => props.settings.displayMode ?? 'overlay',
    set: (val) => { props.settings.displayMode = val; }
});
const theme = computed({
    get: () => props.settings.theme ?? 'dark',
    set: (val) => { props.settings.theme = val; }
});
const showDevtoolsHint = computed(() => displayMode.value === 'devtools' && !isRunningInDevtools);
const showOverlayHint = computed(() => displayMode.value === 'overlay' && isRunningInDevtools);
const debounceValue = ref(props.settings.searchParams.debounce ?? 300);
const minLengthValue = ref(props.settings.searchParams.minLength ?? 2);
watch(debounceValue, (val) => { props.settings.searchParams.debounce = val; });
watch(minLengthValue, (val) => { props.settings.searchParams.minLength = val; });
// jsonMode — закомментировано вместе с JSON Editor Mode
// const jsonMode = computed({
//   get: () => props.settings.json?.mode ?? 'text',
//   set: (val: 'text' | 'tree') => { props.settings.json.mode = val }
// })
const refreshIntervals = [
    { value: 1000, label: '1 second' },
    { value: 2000, label: '2 seconds' },
    { value: 5000, label: '5 seconds' },
    { value: 10000, label: '10 seconds' },
    { value: 30000, label: '30 seconds' },
];
// -------------------- CUSTOMIZE --------------------
const customize = computed(() => props.settings.customize);
const imagePickerOpen = ref(false);
const currentImageLabel = computed(() => {
    if (customize.value.image.url)
        return customize.value.image.url;
    const savedFileId = customize.value.image.savedFileId;
    const fileName = customize.value.image.fileName;
    if (savedFileId && fileName) {
        const exists = (savedFileId.startsWith('wallpaper:') && wallpapers.some(w => w.id === savedFileId)) ||
            (props.settings.customize?.image?.wallpapers ?? []).some(w => w.id === savedFileId) ||
            (props.settings.savedFiles ?? []).some(f => f.id === savedFileId);
        if (exists)
            return fileName;
    }
    return defaultWallpaperName;
});
function handlePickerSelectFile(id, name) {
    customize.value.image.sourceType = 'file';
    customize.value.image.savedFileId = id;
    customize.value.image.fileName = name;
    customize.value.image.url = '';
    if (isStandalone)
        customize.value.image.wallpaperId = id;
}
function handlePickerAddUrl(url) {
    const urls = customize.value.image.urls ?? [];
    if (urls.includes(url))
        return;
    customize.value.image.urls = [...urls, url];
    customize.value.image.sourceType = 'link';
    customize.value.image.url = url;
    customize.value.image.savedFileId = '';
    customize.value.image.fileName = '';
    if (isStandalone)
        customize.value.image.wallpaperId = '';
}
function handlePickerSelectUrl(url) {
    customize.value.image.sourceType = 'link';
    customize.value.image.url = url;
    customize.value.image.savedFileId = '';
    customize.value.image.fileName = '';
    if (isStandalone)
        customize.value.image.wallpaperId = '';
}
function handlePickerRemoveUrl(url) {
    const urls = customize.value.image.urls ?? [];
    customize.value.image.urls = urls.filter(u => u !== url);
    if (customize.value.image.url === url) {
        customize.value.image.url = '';
        customize.value.image.sourceType = 'file';
        customize.value.image.savedFileId = '';
        customize.value.image.fileName = '';
        if (isStandalone)
            customize.value.image.wallpaperId = '';
    }
}
async function handlePickerAddFile(file) {
    if (isStandalone) {
        const wallpapers = customize.value.image.wallpapers ?? [];
        const nums = wallpapers.map(w => {
            const m = w.id.match(/^wallpaper_(\d+)$/);
            return m ? parseInt(m[1], 10) : 0;
        });
        const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        const fileId = `wallpaper_${nextNum}`;
        await putWallpaperBlob(fileId, file);
        customize.value.image.wallpapers = [...wallpapers, {
                id: fileId,
                name: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
            }];
        customize.value.image.sourceType = 'file';
        customize.value.image.savedFileId = fileId;
        customize.value.image.fileName = file.name;
        customize.value.image.wallpaperId = fileId;
        customize.value.image.url = '';
        await initWallpapersStore([fileId]);
        refreshMediaUsage();
        return;
    }
    const existing = props.settings.savedFiles.find(sf => sf.name === file.name && sf.size === file.size);
    let fileId;
    if (existing) {
        fileId = existing.id;
    }
    else {
        fileId = generateId();
        await addMedia(fileId, file);
        props.settings.savedFiles.push({
            id: fileId,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
        });
    }
    customize.value.image.sourceType = 'file';
    customize.value.image.savedFileId = fileId;
    customize.value.image.fileName = file.name;
    customize.value.image.url = '';
}
async function handlePickerRemoveFile(id) {
    if (isStandalone) {
        const wallpapers = customize.value.image.wallpapers ?? [];
        customize.value.image.wallpapers = wallpapers.filter(w => w.id !== id);
        await removeWallpaperBlob(id);
        if (customize.value.image.savedFileId === id || customize.value.image.wallpaperId === id) {
            customize.value.image.savedFileId = '';
            customize.value.image.fileName = '';
            customize.value.image.wallpaperId = '';
        }
        refreshMediaUsage();
        return;
    }
    if (!props.settings.savedFiles)
        return;
    props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== id);
    await removeMedia(id);
    if (customize.value.image.savedFileId === id) {
        customize.value.image.savedFileId = '';
        customize.value.image.fileName = '';
    }
}
function setSlider(setter, val) {
    if (val && val.length > 0)
        setter(val[0]);
}
// -------------------- SAVED FILES --------------------
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024)
        return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}
async function removeSavedFile(fileId, isWallpaper = false) {
    if (isWallpaper) {
        const wallpapers = customize.value.image.wallpapers ?? [];
        customize.value.image.wallpapers = wallpapers.filter(w => w.id !== fileId);
        await removeWallpaperBlob(fileId);
        if (customize.value.image.savedFileId === fileId || customize.value.image.wallpaperId === fileId) {
            customize.value.image.savedFileId = '';
            customize.value.image.fileName = '';
            customize.value.image.wallpaperId = '';
        }
        refreshMediaUsage();
        return;
    }
    if (!props.settings.savedFiles)
        return;
    props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== fileId);
    await removeMedia(fileId);
    if (customize.value.image.savedFileId === fileId) {
        customize.value.image.savedFileId = '';
        customize.value.image.fileName = '';
    }
    refreshMediaUsage();
}
async function handleAddNewFile(event) {
    const input = event.target;
    const files = input?.files;
    if (!files)
        return;
    if (isStandalone) {
        for (const file of Array.from(files)) {
            const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
            if (isMedia) {
                const wallpapers = customize.value.image.wallpapers ?? [];
                const alreadySaved = wallpapers.some(w => w.name === file.name && w.size === file.size);
                if (!alreadySaved) {
                    const nums = wallpapers.map(w => {
                        const m = w.id.match(/^wallpaper_(\d+)$/);
                        return m ? parseInt(m[1], 10) : 0;
                    });
                    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
                    const fileId = `wallpaper_${nextNum}`;
                    await putWallpaperBlob(fileId, file);
                    customize.value.image.wallpapers = [...wallpapers, {
                            id: fileId,
                            name: file.name,
                            size: file.size,
                            mimeType: file.type || 'application/octet-stream',
                        }];
                    await initWallpapersStore([fileId]);
                }
            }
            else {
                if (!props.settings.savedFiles)
                    props.settings.savedFiles = [];
                const alreadySaved = props.settings.savedFiles.some(sf => sf.name === file.name && sf.size === file.size);
                if (!alreadySaved) {
                    const id = generateId();
                    await addMedia(id, file);
                    props.settings.savedFiles.push({
                        id,
                        name: file.name,
                        size: file.size,
                        mimeType: file.type || 'application/octet-stream',
                    });
                }
            }
        }
        input.value = '';
        refreshMediaUsage();
        return;
    }
    if (!props.settings.savedFiles)
        return;
    for (const file of Array.from(files)) {
        const alreadySaved = props.settings.savedFiles.some(sf => sf.name === file.name && sf.size === file.size);
        if (!alreadySaved) {
            const id = generateId();
            await addMedia(id, file);
            props.settings.savedFiles.push({
                id,
                name: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
            });
        }
    }
    input.value = '';
    refreshMediaUsage();
}
async function handleEditFileChange(event, fileId, isWallpaper = false) {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file)
        return;
    if (isWallpaper) {
        await putWallpaperBlob(fileId, file);
        const wp = customize.value.image.wallpapers?.find(w => w.id === fileId);
        if (wp) {
            wp.name = file.name;
            wp.size = file.size;
            wp.mimeType = file.type || 'application/octet-stream';
        }
        await initWallpapersStore([fileId]);
        input.value = '';
        refreshMediaUsage();
        return;
    }
    await addMedia(fileId, file);
    const sf = props.settings.savedFiles?.find(f => f.id === fileId);
    if (sf) {
        sf.name = file.name;
        sf.size = file.size;
        sf.mimeType = file.type || 'application/octet-stream';
    }
    input.value = '';
    refreshMediaUsage();
}
const savedFilesTableHeight = computed(() => {
    const rowCount = savedFilesForTable.value.length + 1;
    return Math.min(rowCount * 41, 205);
});
const savedFilesNeedsScroll = computed(() => savedFilesForTable.value.length > 4);
function getSavedFileActions(file) {
    return [
        { label: 'Edit', icon: Pencil, slot: 'edit' },
        { label: 'Delete', icon: Trash, onClick: () => removeSavedFile(file.id, file._isWallpaper), destructiveText: true },
    ];
}
// -------------------- AUTO RUN --------------------
function ensureAutoRun() {
    if (!props.settings.autoRun) {
        props.settings.autoRun = { advancedMode: false, siteBlacklist: [], siteWhitelist: [] };
    }
    return props.settings.autoRun;
}
const autoRun = computed(() => ensureAutoRun());
const blacklistUrl = ref('');
const whitelistUrl = ref('');
function addToBlacklist() {
    const pattern = blacklistUrl.value.trim();
    if (!pattern)
        return;
    const ar = ensureAutoRun();
    if (ar.siteBlacklist.some(e => e.pattern === pattern))
        return;
    ar.siteBlacklist.push({ id: generateId(), pattern, addedAt: new Date().toISOString() });
    blacklistUrl.value = '';
}
function removeFromBlacklist(id) {
    const ar = ensureAutoRun();
    ar.siteBlacklist = ar.siteBlacklist.filter(e => e.id !== id);
}
function addToWhitelist() {
    const pattern = whitelistUrl.value.trim();
    if (!pattern)
        return;
    const ar = ensureAutoRun();
    if (ar.siteWhitelist.some(e => e.pattern === pattern))
        return;
    ar.siteWhitelist.push({ id: generateId(), pattern, addedAt: new Date().toISOString() });
    whitelistUrl.value = '';
}
function removeFromWhitelist(id) {
    const ar = ensureAutoRun();
    ar.siteWhitelist = ar.siteWhitelist.filter(e => e.id !== id);
}
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        });
    }
    catch {
        return iso;
    }
}
function isBlacklistRowSelected(entry) {
    return props.selectedSiteList?.kind === 'blacklist' && props.selectedSiteList.id === entry.id;
}
function isWhitelistRowSelected(entry) {
    return props.selectedSiteList?.kind === 'whitelist' && props.selectedSiteList.id === entry.id;
}
function getSiteBlacklistActions(entry) {
    return [
        { label: 'Edit', icon: Pencil, onClick: () => emit('edit', { type: 'site-blacklist', id: entry.id }) },
        { label: 'Delete', icon: Trash, onClick: () => removeFromBlacklist(entry.id), destructiveText: true },
    ];
}
function getSiteWhitelistActions(entry) {
    return [
        { label: 'Edit', icon: Pencil, onClick: () => emit('edit', { type: 'site-whitelist', id: entry.id }) },
        { label: 'Delete', icon: Trash, onClick: () => removeFromWhitelist(entry.id), destructiveText: true },
    ];
}
const siteBlacklistNeedsScroll = computed(() => autoRun.value.siteBlacklist.length > 4);
const siteBlacklistTableHeight = computed(() => Math.min(Math.max(autoRun.value.siteBlacklist.length, 1) * 41, 205));
const siteWhitelistNeedsScroll = computed(() => autoRun.value.siteWhitelist.length > 4);
const siteWhitelistTableHeight = computed(() => Math.min(Math.max(autoRun.value.siteWhitelist.length, 1) * 41, 205));
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
    ...{ class: "space-y-6 min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
const __VLS_0 = RadioGroup || RadioGroup;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.displayMode),
    disabled: (__VLS_ctx.isStandalone),
    ...{ class: "gap-3" },
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.displayMode),
    disabled: (__VLS_ctx.isStandalone),
    ...{ class: "gap-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center space-x-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
const __VLS_6 = RadioGroupItem;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    value: "overlay",
    id: "mode-overlay",
}));
const __VLS_8 = __VLS_7({
    value: "overlay",
    id: "mode-overlay",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
let __VLS_11;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    for: "mode-overlay",
    ...{ class: "text-sm font-normal" },
    ...{ class: (__VLS_ctx.isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer') },
}));
const __VLS_13 = __VLS_12({
    for: "mode-overlay",
    ...{ class: "text-sm font-normal" },
    ...{ class: (__VLS_ctx.isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer') },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
const { default: __VLS_16 } = __VLS_14.slots;
// @ts-ignore
[displayMode, isStandalone, isStandalone,];
var __VLS_14;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center space-x-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
const __VLS_17 = RadioGroupItem;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    value: "devtools",
    id: "mode-devtools",
}));
const __VLS_19 = __VLS_18({
    value: "devtools",
    id: "mode-devtools",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
let __VLS_22;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
    for: "mode-devtools",
    ...{ class: "text-sm font-normal" },
    ...{ class: (__VLS_ctx.isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer') },
}));
const __VLS_24 = __VLS_23({
    for: "mode-devtools",
    ...{ class: "text-sm font-normal" },
    ...{ class: (__VLS_ctx.isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer') },
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
const { default: __VLS_27 } = __VLS_25.slots;
// @ts-ignore
[isStandalone,];
var __VLS_25;
// @ts-ignore
[];
var __VLS_3;
if (__VLS_ctx.isStandalone) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-yellow-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-yellow-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-yellow-400']} */ ;
    let __VLS_28;
    /** @ts-ignore @type {typeof ___VLS_components.Info} */
    Info;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
    }));
    const __VLS_30 = __VLS_29({
        ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
if (__VLS_ctx.showDevtoolsHint) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-400" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-blue-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-blue-400']} */ ;
    let __VLS_33;
    /** @ts-ignore @type {typeof ___VLS_components.Info} */
    Info;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
    }));
    const __VLS_35 = __VLS_34({
        ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
}
if (__VLS_ctx.showOverlayHint) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-400" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-blue-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-blue-400']} */ ;
    let __VLS_38;
    /** @ts-ignore @type {typeof ___VLS_components.Info} */
    Info;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
        ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
    }));
    const __VLS_40 = __VLS_39({
        ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4 border-t pt-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2 min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
let __VLS_43;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({
    ...{ class: "text-xs font-medium text-muted-foreground" },
}));
const __VLS_45 = __VLS_44({
    ...{ class: "text-xs font-medium text-muted-foreground" },
}, ...__VLS_functionalComponentArgsRest(__VLS_44));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
const { default: __VLS_48 } = __VLS_46.slots;
// @ts-ignore
[isStandalone, showDevtoolsHint, showOverlayHint,];
var __VLS_46;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-[minmax(0,_1fr)_auto_auto] items-center gap-2 min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-[minmax(0,_1fr)_auto_auto]']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground truncate block min-w-0" },
    title: (__VLS_ctx.currentImageLabel),
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
(__VLS_ctx.currentImageLabel);
let __VLS_49;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 w-8 p-0 shrink-0" },
    title: (__VLS_ctx.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'),
}));
const __VLS_51 = __VLS_50({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 w-8 p-0 shrink-0" },
    title: (__VLS_ctx.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'),
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
let __VLS_54;
const __VLS_55 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.theme = __VLS_ctx.theme === 'dark' ? 'light' : 'dark';
            // @ts-ignore
            [currentImageLabel, currentImageLabel, theme, theme, theme,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const { default: __VLS_56 } = __VLS_52.slots;
if (__VLS_ctx.theme === 'dark') {
    let __VLS_57;
    /** @ts-ignore @type {typeof ___VLS_components.Sun} */
    Sun;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_59 = __VLS_58({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
else {
    let __VLS_62;
    /** @ts-ignore @type {typeof ___VLS_components.Moon} */
    Moon;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_64 = __VLS_63({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
// @ts-ignore
[theme,];
var __VLS_52;
var __VLS_53;
let __VLS_67;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 px-3 text-xs shrink-0" },
}));
const __VLS_69 = __VLS_68({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 px-3 text-xs shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_68));
let __VLS_72;
const __VLS_73 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.imagePickerOpen = true;
            // @ts-ignore
            [imagePickerOpen,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const { default: __VLS_74 } = __VLS_70.slots;
// @ts-ignore
[];
var __VLS_70;
var __VLS_71;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
let __VLS_75;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
    ...{ class: "text-xs" },
}));
const __VLS_77 = __VLS_76({
    ...{ class: "text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_76));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_80 } = __VLS_78.slots;
// @ts-ignore
[];
var __VLS_78;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground tabular-nums" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.customize.positionX);
let __VLS_81;
/** @ts-ignore @type {typeof ___VLS_components.Slider} */
Slider;
// @ts-ignore
const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.positionX]),
    min: (0),
    max: (100),
    step: (1),
}));
const __VLS_83 = __VLS_82({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.positionX]),
    min: (0),
    max: (100),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_82));
let __VLS_86;
const __VLS_87 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.setSlider(v => __VLS_ctx.customize.positionX = v, $event);
            // @ts-ignore
            [customize, customize, customize, setSlider,];
        } });
var __VLS_84;
var __VLS_85;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
let __VLS_88;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ class: "text-xs" },
}));
const __VLS_90 = __VLS_89({
    ...{ class: "text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_93 } = __VLS_91.slots;
// @ts-ignore
[];
var __VLS_91;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground tabular-nums" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.customize.positionY);
let __VLS_94;
/** @ts-ignore @type {typeof ___VLS_components.Slider} */
Slider;
// @ts-ignore
const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.positionY]),
    min: (0),
    max: (100),
    step: (1),
}));
const __VLS_96 = __VLS_95({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.positionY]),
    min: (0),
    max: (100),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_95));
let __VLS_99;
const __VLS_100 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.setSlider(v => __VLS_ctx.customize.positionY = v, $event);
            // @ts-ignore
            [customize, customize, customize, setSlider,];
        } });
var __VLS_97;
var __VLS_98;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
let __VLS_101;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
    ...{ class: "text-xs" },
}));
const __VLS_103 = __VLS_102({
    ...{ class: "text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_102));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_106 } = __VLS_104.slots;
// @ts-ignore
[];
var __VLS_104;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground tabular-nums" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.customize.scale);
let __VLS_107;
/** @ts-ignore @type {typeof ___VLS_components.Slider} */
Slider;
// @ts-ignore
const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.scale]),
    min: (100),
    max: (200),
    step: (1),
}));
const __VLS_109 = __VLS_108({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.scale]),
    min: (100),
    max: (200),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_108));
let __VLS_112;
const __VLS_113 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.setSlider(v => __VLS_ctx.customize.scale = v, $event);
            // @ts-ignore
            [customize, customize, customize, setSlider,];
        } });
var __VLS_110;
var __VLS_111;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
let __VLS_114;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
    ...{ class: "text-xs" },
}));
const __VLS_116 = __VLS_115({
    ...{ class: "text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_119 } = __VLS_117.slots;
// @ts-ignore
[];
var __VLS_117;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground tabular-nums" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.customize.imageOpacity.toFixed(2));
let __VLS_120;
/** @ts-ignore @type {typeof ___VLS_components.Slider} */
Slider;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.imageOpacity]),
    min: (0),
    max: (0.5),
    step: (0.01),
}));
const __VLS_122 = __VLS_121({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.imageOpacity]),
    min: (0),
    max: (0.5),
    step: (0.01),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
let __VLS_125;
const __VLS_126 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.setSlider(v => __VLS_ctx.customize.imageOpacity = v, $event);
            // @ts-ignore
            [customize, customize, customize, setSlider,];
        } });
var __VLS_123;
var __VLS_124;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
let __VLS_127;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
    ...{ class: "text-xs" },
}));
const __VLS_129 = __VLS_128({
    ...{ class: "text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_128));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_132 } = __VLS_130.slots;
// @ts-ignore
[];
var __VLS_130;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground tabular-nums" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.customize.blur);
let __VLS_133;
/** @ts-ignore @type {typeof ___VLS_components.Slider} */
Slider;
// @ts-ignore
const __VLS_134 = __VLS_asFunctionalComponent(__VLS_133, new __VLS_133({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.blur]),
    min: (0),
    max: (200),
    step: (1),
}));
const __VLS_135 = __VLS_134({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: ([__VLS_ctx.customize.blur]),
    min: (0),
    max: (200),
    step: (1),
}, ...__VLS_functionalComponentArgsRest(__VLS_134));
let __VLS_138;
const __VLS_139 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.setSlider(v => __VLS_ctx.customize.blur = v, $event);
            // @ts-ignore
            [customize, customize, customize, setSlider,];
        } });
var __VLS_136;
var __VLS_137;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4 border-t pt-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-2 gap-x-6 gap-y-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-6']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-2']} */ ;
let __VLS_140;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
    for: "search-debounce",
}));
const __VLS_142 = __VLS_141({
    for: "search-debounce",
}, ...__VLS_functionalComponentArgsRest(__VLS_141));
const { default: __VLS_145 } = __VLS_143.slots;
// @ts-ignore
[];
var __VLS_143;
let __VLS_146;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
    for: "search-min-length",
}));
const __VLS_148 = __VLS_147({
    for: "search-min-length",
}, ...__VLS_functionalComponentArgsRest(__VLS_147));
const { default: __VLS_151 } = __VLS_149.slots;
// @ts-ignore
[];
var __VLS_149;
let __VLS_152;
/** @ts-ignore @type {typeof ___VLS_components.Input} */
Input;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    id: "search-debounce",
    modelValue: (__VLS_ctx.debounceValue),
    type: "number",
    ...{ class: "w-24 h-8" },
    min: (100),
    max: (1000),
}));
const __VLS_154 = __VLS_153({
    id: "search-debounce",
    modelValue: (__VLS_ctx.debounceValue),
    type: "number",
    ...{ class: "w-24 h-8" },
    min: (100),
    max: (1000),
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
let __VLS_157;
/** @ts-ignore @type {typeof ___VLS_components.Input} */
Input;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    id: "search-min-length",
    modelValue: (__VLS_ctx.minLengthValue),
    type: "number",
    ...{ class: "w-24 h-8" },
    min: (1),
    max: (10),
}));
const __VLS_159 = __VLS_158({
    id: "search-min-length",
    modelValue: (__VLS_ctx.minLengthValue),
    type: "number",
    ...{ class: "w-24 h-8" },
    min: (1),
    max: (10),
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4 border-t pt-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center space-x-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
let __VLS_162;
/** @ts-ignore @type {typeof ___VLS_components.Checkbox} */
Checkbox;
// @ts-ignore
const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
    id: "auto-refresh",
    modelValue: (__VLS_ctx.settings.updates.autoRefresh),
}));
const __VLS_164 = __VLS_163({
    id: "auto-refresh",
    modelValue: (__VLS_ctx.settings.updates.autoRefresh),
}, ...__VLS_functionalComponentArgsRest(__VLS_163));
let __VLS_167;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_168 = __VLS_asFunctionalComponent(__VLS_167, new __VLS_167({
    for: "auto-refresh",
    ...{ class: "text-sm" },
}));
const __VLS_169 = __VLS_168({
    for: "auto-refresh",
    ...{ class: "text-sm" },
}, ...__VLS_functionalComponentArgsRest(__VLS_168));
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const { default: __VLS_172 } = __VLS_170.slots;
// @ts-ignore
[debounceValue, minLengthValue, settings,];
var __VLS_170;
if (__VLS_ctx.settings.updates?.autoRefresh) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
    let __VLS_173;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({
        for: "refresh-interval",
        ...{ class: "block mb-2" },
    }));
    const __VLS_175 = __VLS_174({
        for: "refresh-interval",
        ...{ class: "block mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_174));
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    const { default: __VLS_178 } = __VLS_176.slots;
    // @ts-ignore
    [settings,];
    var __VLS_176;
    let __VLS_179;
    /** @ts-ignore @type {typeof ___VLS_components.Select} */
    Select;
    // @ts-ignore
    const __VLS_180 = __VLS_asFunctionalComponent(__VLS_179, new __VLS_179({
        modelValue: (__VLS_ctx.settings.updates.autoRefreshInterval),
    }));
    const __VLS_181 = __VLS_180({
        modelValue: (__VLS_ctx.settings.updates.autoRefreshInterval),
    }, ...__VLS_functionalComponentArgsRest(__VLS_180));
    const { default: __VLS_184 } = __VLS_182.slots;
    let __VLS_185;
    /** @ts-ignore @type {typeof ___VLS_components.SelectTrigger} */
    SelectTrigger;
    // @ts-ignore
    const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
        ...{ class: "w-full h-8" },
    }));
    const __VLS_187 = __VLS_186({
        ...{ class: "w-full h-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_186));
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    const { default: __VLS_190 } = __VLS_188.slots;
    let __VLS_191;
    /** @ts-ignore @type {typeof ___VLS_components.SelectValue} */
    SelectValue;
    // @ts-ignore
    const __VLS_192 = __VLS_asFunctionalComponent(__VLS_191, new __VLS_191({
        placeholder: (`${(__VLS_ctx.settings.updates?.autoRefreshInterval ?? 5000) / 1000} seconds`),
    }));
    const __VLS_193 = __VLS_192({
        placeholder: (`${(__VLS_ctx.settings.updates?.autoRefreshInterval ?? 5000) / 1000} seconds`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_192));
    // @ts-ignore
    [settings, settings,];
    var __VLS_188;
    let __VLS_196;
    /** @ts-ignore @type {typeof ___VLS_components.SelectContent} */
    SelectContent;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({}));
    const __VLS_198 = __VLS_197({}, ...__VLS_functionalComponentArgsRest(__VLS_197));
    const { default: __VLS_201 } = __VLS_199.slots;
    for (const [interval] of __VLS_getVForSourceType((__VLS_ctx.refreshIntervals))) {
        let __VLS_202;
        /** @ts-ignore @type {typeof ___VLS_components.SelectItem} */
        SelectItem;
        // @ts-ignore
        const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
            key: (interval.value),
            value: (interval.value),
        }));
        const __VLS_204 = __VLS_203({
            key: (interval.value),
            value: (interval.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_203));
        const { default: __VLS_207 } = __VLS_205.slots;
        (interval.label);
        // @ts-ignore
        [refreshIntervals,];
        var __VLS_205;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_199;
    // @ts-ignore
    [];
    var __VLS_182;
}
if (!__VLS_ctx.isStandalone) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-4 border-t pt-4" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center space-x-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
    let __VLS_208;
    /** @ts-ignore @type {typeof ___VLS_components.Checkbox} */
    Checkbox;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        ...{ 'onUpdate:modelValue': {} },
        id: "auto-run-advanced",
        modelValue: (__VLS_ctx.autoRun.advancedMode),
    }));
    const __VLS_210 = __VLS_209({
        ...{ 'onUpdate:modelValue': {} },
        id: "auto-run-advanced",
        modelValue: (__VLS_ctx.autoRun.advancedMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    let __VLS_213;
    const __VLS_214 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!(!__VLS_ctx.isStandalone))
                    return;
                __VLS_ctx.autoRun.advancedMode = $event;
                // @ts-ignore
                [isStandalone, autoRun, autoRun,];
            } });
    var __VLS_211;
    var __VLS_212;
    let __VLS_215;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_216 = __VLS_asFunctionalComponent(__VLS_215, new __VLS_215({
        for: "auto-run-advanced",
        ...{ class: "text-sm" },
    }));
    const __VLS_217 = __VLS_216({
        for: "auto-run-advanced",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_216));
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const { default: __VLS_220 } = __VLS_218.slots;
    // @ts-ignore
    [];
    var __VLS_218;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_221;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_222 = __VLS_asFunctionalComponent(__VLS_221, new __VLS_221({
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.blacklistUrl),
        placeholder: "e.g. https://app.example/ or *localhost*",
        ...{ class: "flex-1 h-8" },
    }));
    const __VLS_223 = __VLS_222({
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.blacklistUrl),
        placeholder: "e.g. https://app.example/ or *localhost*",
        ...{ class: "flex-1 h-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_222));
    let __VLS_226;
    const __VLS_227 = ({ keydown: {} },
        { onKeydown: (__VLS_ctx.addToBlacklist) });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    var __VLS_224;
    var __VLS_225;
    let __VLS_228;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
        ...{ 'onClick': {} },
        size: "sm",
        ...{ class: "h-8" },
    }));
    const __VLS_230 = __VLS_229({
        ...{ 'onClick': {} },
        size: "sm",
        ...{ class: "h-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_229));
    let __VLS_233;
    const __VLS_234 = ({ click: {} },
        { onClick: (__VLS_ctx.addToBlacklist) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    const { default: __VLS_235 } = __VLS_231.slots;
    // @ts-ignore
    [blacklistUrl, addToBlacklist, addToBlacklist,];
    var __VLS_231;
    var __VLS_232;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col border rounded-lg overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 border-b bg-muted/30" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
    let __VLS_236;
    /** @ts-ignore @type {typeof ___VLS_components.Table} */
    Table;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
        ...{ class: "table-fixed" },
    }));
    const __VLS_238 = __VLS_237({
        ...{ class: "table-fixed" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
    const { default: __VLS_241 } = __VLS_239.slots;
    let __VLS_242;
    /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
    TableHeader;
    // @ts-ignore
    const __VLS_243 = __VLS_asFunctionalComponent(__VLS_242, new __VLS_242({
        ...{ class: "[&_th]:h-10" },
    }));
    const __VLS_244 = __VLS_243({
        ...{ class: "[&_th]:h-10" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_243));
    /** @type {__VLS_StyleScopedClasses['[&_th]:h-10']} */ ;
    const { default: __VLS_247 } = __VLS_245.slots;
    let __VLS_248;
    /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
    TableRow;
    // @ts-ignore
    const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
        ...{ class: "hover:bg-transparent" },
    }));
    const __VLS_250 = __VLS_249({
        ...{ class: "hover:bg-transparent" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_249));
    /** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
    const { default: __VLS_253 } = __VLS_251.slots;
    let __VLS_254;
    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
    TableHead;
    // @ts-ignore
    const __VLS_255 = __VLS_asFunctionalComponent(__VLS_254, new __VLS_254({
        ...{ class: "text-xs font-semibold" },
    }));
    const __VLS_256 = __VLS_255({
        ...{ class: "text-xs font-semibold" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_255));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    const { default: __VLS_259 } = __VLS_257.slots;
    // @ts-ignore
    [];
    var __VLS_257;
    let __VLS_260;
    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
    TableHead;
    // @ts-ignore
    const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
        ...{ class: "text-xs font-semibold w-[100px] text-center" },
    }));
    const __VLS_262 = __VLS_261({
        ...{ class: "text-xs font-semibold w-[100px] text-center" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_261));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    const { default: __VLS_265 } = __VLS_263.slots;
    // @ts-ignore
    [];
    var __VLS_263;
    let __VLS_266;
    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
    TableHead;
    // @ts-ignore
    const __VLS_267 = __VLS_asFunctionalComponent(__VLS_266, new __VLS_266({
        ...{ class: "w-[48px] text-center p-0" },
    }));
    const __VLS_268 = __VLS_267({
        ...{ class: "w-[48px] text-center p-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_267));
    /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
    // @ts-ignore
    [];
    var __VLS_251;
    // @ts-ignore
    [];
    var __VLS_245;
    // @ts-ignore
    [];
    var __VLS_239;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-h-0 max-h-[205px] overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-h-[205px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    if (__VLS_ctx.siteBlacklistNeedsScroll) {
        let __VLS_271;
        /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
        ScrollArea;
        // @ts-ignore
        const __VLS_272 = __VLS_asFunctionalComponent(__VLS_271, new __VLS_271({
            ...{ style: ({ height: `${__VLS_ctx.siteBlacklistTableHeight}px` }) },
        }));
        const __VLS_273 = __VLS_272({
            ...{ style: ({ height: `${__VLS_ctx.siteBlacklistTableHeight}px` }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_272));
        const { default: __VLS_276 } = __VLS_274.slots;
        let __VLS_277;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_278 = __VLS_asFunctionalComponent(__VLS_277, new __VLS_277({
            ...{ class: "table-fixed" },
        }));
        const __VLS_279 = __VLS_278({
            ...{ class: "table-fixed" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_278));
        /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
        const { default: __VLS_282 } = __VLS_280.slots;
        let __VLS_283;
        /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
        TableBody;
        // @ts-ignore
        const __VLS_284 = __VLS_asFunctionalComponent(__VLS_283, new __VLS_283({}));
        const __VLS_285 = __VLS_284({}, ...__VLS_functionalComponentArgsRest(__VLS_284));
        const { default: __VLS_288 } = __VLS_286.slots;
        for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.autoRun.siteBlacklist))) {
            let __VLS_289;
            /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
            ContextMenu;
            // @ts-ignore
            const __VLS_290 = __VLS_asFunctionalComponent(__VLS_289, new __VLS_289({
                key: (entry.id),
            }));
            const __VLS_291 = __VLS_290({
                key: (entry.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_290));
            const { default: __VLS_294 } = __VLS_292.slots;
            let __VLS_295;
            /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
            ContextMenuTrigger;
            // @ts-ignore
            const __VLS_296 = __VLS_asFunctionalComponent(__VLS_295, new __VLS_295({
                asChild: true,
            }));
            const __VLS_297 = __VLS_296({
                asChild: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_296));
            const { default: __VLS_300 } = __VLS_298.slots;
            let __VLS_301;
            /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
            TableRow;
            // @ts-ignore
            const __VLS_302 = __VLS_asFunctionalComponent(__VLS_301, new __VLS_301({
                ...{ 'onClick': {} },
                ...{ class: "h-[41px] cursor-pointer transition-colors" },
                ...{ class: (__VLS_ctx.isBlacklistRowSelected(entry) ? 'bg-accent' : '') },
            }));
            const __VLS_303 = __VLS_302({
                ...{ 'onClick': {} },
                ...{ class: "h-[41px] cursor-pointer transition-colors" },
                ...{ class: (__VLS_ctx.isBlacklistRowSelected(entry) ? 'bg-accent' : '') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_302));
            let __VLS_306;
            const __VLS_307 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.isStandalone))
                            return;
                        if (!(__VLS_ctx.siteBlacklistNeedsScroll))
                            return;
                        __VLS_ctx.emit('select', { type: 'site-blacklist', id: entry.id });
                        // @ts-ignore
                        [autoRun, siteBlacklistNeedsScroll, siteBlacklistTableHeight, isBlacklistRowSelected, emit,];
                    } });
            /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            const { default: __VLS_308 } = __VLS_304.slots;
            let __VLS_309;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_310 = __VLS_asFunctionalComponent(__VLS_309, new __VLS_309({
                ...{ class: "overflow-hidden !py-2" },
            }));
            const __VLS_311 = __VLS_310({
                ...{ class: "overflow-hidden !py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_310));
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
            const { default: __VLS_314 } = __VLS_312.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-sm truncate" },
                title: (entry.pattern),
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (entry.pattern);
            // @ts-ignore
            [];
            var __VLS_312;
            let __VLS_315;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_316 = __VLS_asFunctionalComponent(__VLS_315, new __VLS_315({
                ...{ class: "w-[100px] text-center !py-2" },
            }));
            const __VLS_317 = __VLS_316({
                ...{ class: "w-[100px] text-center !py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_316));
            /** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
            const { default: __VLS_320 } = __VLS_318.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.formatDate(entry.addedAt));
            // @ts-ignore
            [formatDate,];
            var __VLS_318;
            let __VLS_321;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_322 = __VLS_asFunctionalComponent(__VLS_321, new __VLS_321({
                ...{ class: "w-[48px] text-center p-0" },
            }));
            const __VLS_323 = __VLS_322({
                ...{ class: "w-[48px] text-center p-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_322));
            /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
            const { default: __VLS_326 } = __VLS_324.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex justify-center items-center" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            let __VLS_327;
            /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
            DropdownMenu;
            // @ts-ignore
            const __VLS_328 = __VLS_asFunctionalComponent(__VLS_327, new __VLS_327({}));
            const __VLS_329 = __VLS_328({}, ...__VLS_functionalComponentArgsRest(__VLS_328));
            const { default: __VLS_332 } = __VLS_330.slots;
            let __VLS_333;
            /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
            DropdownMenuTrigger;
            // @ts-ignore
            const __VLS_334 = __VLS_asFunctionalComponent(__VLS_333, new __VLS_333({
                asChild: true,
            }));
            const __VLS_335 = __VLS_334({
                asChild: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_334));
            const { default: __VLS_338 } = __VLS_336.slots;
            let __VLS_339;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_340 = __VLS_asFunctionalComponent(__VLS_339, new __VLS_339({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-6 w-6 p-0" },
            }));
            const __VLS_341 = __VLS_340({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-6 w-6 p-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_340));
            let __VLS_344;
            const __VLS_345 = ({ click: {} },
                { onClick: () => { } });
            /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
            const { default: __VLS_346 } = __VLS_342.slots;
            let __VLS_347;
            /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
            MoreHorizontal;
            // @ts-ignore
            const __VLS_348 = __VLS_asFunctionalComponent(__VLS_347, new __VLS_347({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_349 = __VLS_348({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_348));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [];
            var __VLS_342;
            var __VLS_343;
            // @ts-ignore
            [];
            var __VLS_336;
            let __VLS_352;
            /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
            OptionsItemActionsMenuContent;
            // @ts-ignore
            const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
                variant: "dropdown",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }));
            const __VLS_354 = __VLS_353({
                variant: "dropdown",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_353));
            // @ts-ignore
            [getSiteBlacklistActions,];
            var __VLS_330;
            // @ts-ignore
            [];
            var __VLS_324;
            // @ts-ignore
            [];
            var __VLS_304;
            var __VLS_305;
            // @ts-ignore
            [];
            var __VLS_298;
            let __VLS_357;
            /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
            OptionsItemActionsMenuContent;
            // @ts-ignore
            const __VLS_358 = __VLS_asFunctionalComponent(__VLS_357, new __VLS_357({
                variant: "context",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }));
            const __VLS_359 = __VLS_358({
                variant: "context",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_358));
            // @ts-ignore
            [getSiteBlacklistActions,];
            var __VLS_292;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_286;
        // @ts-ignore
        [];
        var __VLS_280;
        // @ts-ignore
        [];
        var __VLS_274;
    }
    else {
        let __VLS_362;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_363 = __VLS_asFunctionalComponent(__VLS_362, new __VLS_362({
            ...{ class: "table-fixed" },
        }));
        const __VLS_364 = __VLS_363({
            ...{ class: "table-fixed" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_363));
        /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
        const { default: __VLS_367 } = __VLS_365.slots;
        let __VLS_368;
        /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
        TableBody;
        // @ts-ignore
        const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({}));
        const __VLS_370 = __VLS_369({}, ...__VLS_functionalComponentArgsRest(__VLS_369));
        const { default: __VLS_373 } = __VLS_371.slots;
        for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.autoRun.siteBlacklist))) {
            let __VLS_374;
            /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
            ContextMenu;
            // @ts-ignore
            const __VLS_375 = __VLS_asFunctionalComponent(__VLS_374, new __VLS_374({
                key: (entry.id),
            }));
            const __VLS_376 = __VLS_375({
                key: (entry.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_375));
            const { default: __VLS_379 } = __VLS_377.slots;
            let __VLS_380;
            /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
            ContextMenuTrigger;
            // @ts-ignore
            const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
                asChild: true,
            }));
            const __VLS_382 = __VLS_381({
                asChild: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_381));
            const { default: __VLS_385 } = __VLS_383.slots;
            let __VLS_386;
            /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
            TableRow;
            // @ts-ignore
            const __VLS_387 = __VLS_asFunctionalComponent(__VLS_386, new __VLS_386({
                ...{ 'onClick': {} },
                ...{ class: "h-[41px] cursor-pointer transition-colors" },
                ...{ class: (__VLS_ctx.isBlacklistRowSelected(entry) ? 'bg-accent' : '') },
            }));
            const __VLS_388 = __VLS_387({
                ...{ 'onClick': {} },
                ...{ class: "h-[41px] cursor-pointer transition-colors" },
                ...{ class: (__VLS_ctx.isBlacklistRowSelected(entry) ? 'bg-accent' : '') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_387));
            let __VLS_391;
            const __VLS_392 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.isStandalone))
                            return;
                        if (!!(__VLS_ctx.siteBlacklistNeedsScroll))
                            return;
                        __VLS_ctx.emit('select', { type: 'site-blacklist', id: entry.id });
                        // @ts-ignore
                        [autoRun, isBlacklistRowSelected, emit,];
                    } });
            /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            const { default: __VLS_393 } = __VLS_389.slots;
            let __VLS_394;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_395 = __VLS_asFunctionalComponent(__VLS_394, new __VLS_394({
                ...{ class: "overflow-hidden !py-2" },
            }));
            const __VLS_396 = __VLS_395({
                ...{ class: "overflow-hidden !py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_395));
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
            const { default: __VLS_399 } = __VLS_397.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-sm truncate" },
                title: (entry.pattern),
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (entry.pattern);
            // @ts-ignore
            [];
            var __VLS_397;
            let __VLS_400;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
                ...{ class: "w-[100px] text-center !py-2" },
            }));
            const __VLS_402 = __VLS_401({
                ...{ class: "w-[100px] text-center !py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_401));
            /** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
            const { default: __VLS_405 } = __VLS_403.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.formatDate(entry.addedAt));
            // @ts-ignore
            [formatDate,];
            var __VLS_403;
            let __VLS_406;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_407 = __VLS_asFunctionalComponent(__VLS_406, new __VLS_406({
                ...{ class: "w-[48px] text-center p-0" },
            }));
            const __VLS_408 = __VLS_407({
                ...{ class: "w-[48px] text-center p-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_407));
            /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
            const { default: __VLS_411 } = __VLS_409.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex justify-center items-center" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            let __VLS_412;
            /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
            DropdownMenu;
            // @ts-ignore
            const __VLS_413 = __VLS_asFunctionalComponent(__VLS_412, new __VLS_412({}));
            const __VLS_414 = __VLS_413({}, ...__VLS_functionalComponentArgsRest(__VLS_413));
            const { default: __VLS_417 } = __VLS_415.slots;
            let __VLS_418;
            /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
            DropdownMenuTrigger;
            // @ts-ignore
            const __VLS_419 = __VLS_asFunctionalComponent(__VLS_418, new __VLS_418({
                asChild: true,
            }));
            const __VLS_420 = __VLS_419({
                asChild: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_419));
            const { default: __VLS_423 } = __VLS_421.slots;
            let __VLS_424;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-6 w-6 p-0" },
            }));
            const __VLS_426 = __VLS_425({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-6 w-6 p-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_425));
            let __VLS_429;
            const __VLS_430 = ({ click: {} },
                { onClick: () => { } });
            /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
            const { default: __VLS_431 } = __VLS_427.slots;
            let __VLS_432;
            /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
            MoreHorizontal;
            // @ts-ignore
            const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_434 = __VLS_433({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_433));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [];
            var __VLS_427;
            var __VLS_428;
            // @ts-ignore
            [];
            var __VLS_421;
            let __VLS_437;
            /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
            OptionsItemActionsMenuContent;
            // @ts-ignore
            const __VLS_438 = __VLS_asFunctionalComponent(__VLS_437, new __VLS_437({
                variant: "dropdown",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }));
            const __VLS_439 = __VLS_438({
                variant: "dropdown",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_438));
            // @ts-ignore
            [getSiteBlacklistActions,];
            var __VLS_415;
            // @ts-ignore
            [];
            var __VLS_409;
            // @ts-ignore
            [];
            var __VLS_389;
            var __VLS_390;
            // @ts-ignore
            [];
            var __VLS_383;
            let __VLS_442;
            /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
            OptionsItemActionsMenuContent;
            // @ts-ignore
            const __VLS_443 = __VLS_asFunctionalComponent(__VLS_442, new __VLS_442({
                variant: "context",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }));
            const __VLS_444 = __VLS_443({
                variant: "context",
                actions: (__VLS_ctx.getSiteBlacklistActions(entry)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_443));
            // @ts-ignore
            [getSiteBlacklistActions,];
            var __VLS_377;
            // @ts-ignore
            [];
        }
        if (!__VLS_ctx.autoRun.siteBlacklist.length) {
            let __VLS_447;
            /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
            TableRow;
            // @ts-ignore
            const __VLS_448 = __VLS_asFunctionalComponent(__VLS_447, new __VLS_447({}));
            const __VLS_449 = __VLS_448({}, ...__VLS_functionalComponentArgsRest(__VLS_448));
            const { default: __VLS_452 } = __VLS_450.slots;
            let __VLS_453;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_454 = __VLS_asFunctionalComponent(__VLS_453, new __VLS_453({
                colspan: "3",
                ...{ class: "text-center text-muted-foreground py-8" },
            }));
            const __VLS_455 = __VLS_454({
                colspan: "3",
                ...{ class: "text-center text-muted-foreground py-8" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_454));
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
            const { default: __VLS_458 } = __VLS_456.slots;
            // @ts-ignore
            [autoRun,];
            var __VLS_456;
            // @ts-ignore
            [];
            var __VLS_450;
        }
        // @ts-ignore
        [];
        var __VLS_371;
        // @ts-ignore
        [];
        var __VLS_365;
    }
    if (__VLS_ctx.autoRun.advancedMode) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-2" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-yellow-500/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-yellow-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-yellow-400']} */ ;
        let __VLS_459;
        /** @ts-ignore @type {typeof ___VLS_components.AlertTriangle} */
        AlertTriangle;
        // @ts-ignore
        const __VLS_460 = __VLS_asFunctionalComponent(__VLS_459, new __VLS_459({
            ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
        }));
        const __VLS_461 = __VLS_460({
            ...{ class: "h-4 w-4 shrink-0 mt-0.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_460));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        let __VLS_464;
        /** @ts-ignore @type {typeof ___VLS_components.Input} */
        Input;
        // @ts-ignore
        const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
            ...{ 'onKeydown': {} },
            modelValue: (__VLS_ctx.whitelistUrl),
            placeholder: "e.g. https://app.example/ or *localhost*",
            ...{ class: "flex-1 h-8" },
        }));
        const __VLS_466 = __VLS_465({
            ...{ 'onKeydown': {} },
            modelValue: (__VLS_ctx.whitelistUrl),
            placeholder: "e.g. https://app.example/ or *localhost*",
            ...{ class: "flex-1 h-8" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_465));
        let __VLS_469;
        const __VLS_470 = ({ keydown: {} },
            { onKeydown: (__VLS_ctx.addToWhitelist) });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
        var __VLS_467;
        var __VLS_468;
        let __VLS_471;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_472 = __VLS_asFunctionalComponent(__VLS_471, new __VLS_471({
            ...{ 'onClick': {} },
            size: "sm",
            ...{ class: "h-8" },
        }));
        const __VLS_473 = __VLS_472({
            ...{ 'onClick': {} },
            size: "sm",
            ...{ class: "h-8" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_472));
        let __VLS_476;
        const __VLS_477 = ({ click: {} },
            { onClick: (__VLS_ctx.addToWhitelist) });
        /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
        const { default: __VLS_478 } = __VLS_474.slots;
        // @ts-ignore
        [autoRun, whitelistUrl, addToWhitelist, addToWhitelist,];
        var __VLS_474;
        var __VLS_475;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col border rounded-lg overflow-hidden" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "shrink-0 border-b bg-muted/30" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
        let __VLS_479;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_480 = __VLS_asFunctionalComponent(__VLS_479, new __VLS_479({
            ...{ class: "table-fixed" },
        }));
        const __VLS_481 = __VLS_480({
            ...{ class: "table-fixed" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_480));
        /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
        const { default: __VLS_484 } = __VLS_482.slots;
        let __VLS_485;
        /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
        TableHeader;
        // @ts-ignore
        const __VLS_486 = __VLS_asFunctionalComponent(__VLS_485, new __VLS_485({
            ...{ class: "[&_th]:h-10" },
        }));
        const __VLS_487 = __VLS_486({
            ...{ class: "[&_th]:h-10" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_486));
        /** @type {__VLS_StyleScopedClasses['[&_th]:h-10']} */ ;
        const { default: __VLS_490 } = __VLS_488.slots;
        let __VLS_491;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_492 = __VLS_asFunctionalComponent(__VLS_491, new __VLS_491({
            ...{ class: "hover:bg-transparent" },
        }));
        const __VLS_493 = __VLS_492({
            ...{ class: "hover:bg-transparent" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_492));
        /** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
        const { default: __VLS_496 } = __VLS_494.slots;
        let __VLS_497;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_498 = __VLS_asFunctionalComponent(__VLS_497, new __VLS_497({
            ...{ class: "text-xs font-semibold" },
        }));
        const __VLS_499 = __VLS_498({
            ...{ class: "text-xs font-semibold" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_498));
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        const { default: __VLS_502 } = __VLS_500.slots;
        // @ts-ignore
        [];
        var __VLS_500;
        let __VLS_503;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_504 = __VLS_asFunctionalComponent(__VLS_503, new __VLS_503({
            ...{ class: "text-xs font-semibold w-[100px] text-center" },
        }));
        const __VLS_505 = __VLS_504({
            ...{ class: "text-xs font-semibold w-[100px] text-center" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_504));
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        const { default: __VLS_508 } = __VLS_506.slots;
        // @ts-ignore
        [];
        var __VLS_506;
        let __VLS_509;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_510 = __VLS_asFunctionalComponent(__VLS_509, new __VLS_509({
            ...{ class: "w-[48px] text-center p-0" },
        }));
        const __VLS_511 = __VLS_510({
            ...{ class: "w-[48px] text-center p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_510));
        /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        // @ts-ignore
        [];
        var __VLS_494;
        // @ts-ignore
        [];
        var __VLS_488;
        // @ts-ignore
        [];
        var __VLS_482;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-h-0 max-h-[205px] overflow-hidden" },
        });
        /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-h-[205px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        if (__VLS_ctx.siteWhitelistNeedsScroll) {
            let __VLS_514;
            /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
            ScrollArea;
            // @ts-ignore
            const __VLS_515 = __VLS_asFunctionalComponent(__VLS_514, new __VLS_514({
                ...{ style: ({ height: `${__VLS_ctx.siteWhitelistTableHeight}px` }) },
            }));
            const __VLS_516 = __VLS_515({
                ...{ style: ({ height: `${__VLS_ctx.siteWhitelistTableHeight}px` }) },
            }, ...__VLS_functionalComponentArgsRest(__VLS_515));
            const { default: __VLS_519 } = __VLS_517.slots;
            let __VLS_520;
            /** @ts-ignore @type {typeof ___VLS_components.Table} */
            Table;
            // @ts-ignore
            const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
                ...{ class: "table-fixed" },
            }));
            const __VLS_522 = __VLS_521({
                ...{ class: "table-fixed" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_521));
            /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
            const { default: __VLS_525 } = __VLS_523.slots;
            let __VLS_526;
            /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
            TableBody;
            // @ts-ignore
            const __VLS_527 = __VLS_asFunctionalComponent(__VLS_526, new __VLS_526({}));
            const __VLS_528 = __VLS_527({}, ...__VLS_functionalComponentArgsRest(__VLS_527));
            const { default: __VLS_531 } = __VLS_529.slots;
            for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.autoRun.siteWhitelist))) {
                let __VLS_532;
                /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
                ContextMenu;
                // @ts-ignore
                const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
                    key: (entry.id),
                }));
                const __VLS_534 = __VLS_533({
                    key: (entry.id),
                }, ...__VLS_functionalComponentArgsRest(__VLS_533));
                const { default: __VLS_537 } = __VLS_535.slots;
                let __VLS_538;
                /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
                ContextMenuTrigger;
                // @ts-ignore
                const __VLS_539 = __VLS_asFunctionalComponent(__VLS_538, new __VLS_538({
                    asChild: true,
                }));
                const __VLS_540 = __VLS_539({
                    asChild: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_539));
                const { default: __VLS_543 } = __VLS_541.slots;
                let __VLS_544;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
                    ...{ 'onClick': {} },
                    ...{ class: "h-[41px] cursor-pointer transition-colors" },
                    ...{ class: (__VLS_ctx.isWhitelistRowSelected(entry) ? 'bg-accent' : '') },
                }));
                const __VLS_546 = __VLS_545({
                    ...{ 'onClick': {} },
                    ...{ class: "h-[41px] cursor-pointer transition-colors" },
                    ...{ class: (__VLS_ctx.isWhitelistRowSelected(entry) ? 'bg-accent' : '') },
                }, ...__VLS_functionalComponentArgsRest(__VLS_545));
                let __VLS_549;
                const __VLS_550 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!(!__VLS_ctx.isStandalone))
                                return;
                            if (!(__VLS_ctx.autoRun.advancedMode))
                                return;
                            if (!(__VLS_ctx.siteWhitelistNeedsScroll))
                                return;
                            __VLS_ctx.emit('select', { type: 'site-whitelist', id: entry.id });
                            // @ts-ignore
                            [autoRun, emit, siteWhitelistNeedsScroll, siteWhitelistTableHeight, isWhitelistRowSelected,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                const { default: __VLS_551 } = __VLS_547.slots;
                let __VLS_552;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
                    ...{ class: "overflow-hidden !py-2" },
                }));
                const __VLS_554 = __VLS_553({
                    ...{ class: "overflow-hidden !py-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_553));
                /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
                /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
                const { default: __VLS_557 } = __VLS_555.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-sm truncate" },
                    title: (entry.pattern),
                });
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (entry.pattern);
                // @ts-ignore
                [];
                var __VLS_555;
                let __VLS_558;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_559 = __VLS_asFunctionalComponent(__VLS_558, new __VLS_558({
                    ...{ class: "w-[100px] text-center !py-2" },
                }));
                const __VLS_560 = __VLS_559({
                    ...{ class: "w-[100px] text-center !py-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_559));
                /** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
                const { default: __VLS_563 } = __VLS_561.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-xs text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                (__VLS_ctx.formatDate(entry.addedAt));
                // @ts-ignore
                [formatDate,];
                var __VLS_561;
                let __VLS_564;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
                    ...{ class: "w-[48px] text-center p-0" },
                }));
                const __VLS_566 = __VLS_565({
                    ...{ class: "w-[48px] text-center p-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_565));
                /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                const { default: __VLS_569 } = __VLS_567.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex justify-center items-center" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                let __VLS_570;
                /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
                DropdownMenu;
                // @ts-ignore
                const __VLS_571 = __VLS_asFunctionalComponent(__VLS_570, new __VLS_570({}));
                const __VLS_572 = __VLS_571({}, ...__VLS_functionalComponentArgsRest(__VLS_571));
                const { default: __VLS_575 } = __VLS_573.slots;
                let __VLS_576;
                /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
                DropdownMenuTrigger;
                // @ts-ignore
                const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
                    asChild: true,
                }));
                const __VLS_578 = __VLS_577({
                    asChild: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_577));
                const { default: __VLS_581 } = __VLS_579.slots;
                let __VLS_582;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_583 = __VLS_asFunctionalComponent(__VLS_582, new __VLS_582({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "icon",
                    ...{ class: "h-6 w-6 p-0" },
                }));
                const __VLS_584 = __VLS_583({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "icon",
                    ...{ class: "h-6 w-6 p-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_583));
                let __VLS_587;
                const __VLS_588 = ({ click: {} },
                    { onClick: () => { } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                const { default: __VLS_589 } = __VLS_585.slots;
                let __VLS_590;
                /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
                MoreHorizontal;
                // @ts-ignore
                const __VLS_591 = __VLS_asFunctionalComponent(__VLS_590, new __VLS_590({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_592 = __VLS_591({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_591));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                // @ts-ignore
                [];
                var __VLS_585;
                var __VLS_586;
                // @ts-ignore
                [];
                var __VLS_579;
                let __VLS_595;
                /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
                OptionsItemActionsMenuContent;
                // @ts-ignore
                const __VLS_596 = __VLS_asFunctionalComponent(__VLS_595, new __VLS_595({
                    variant: "dropdown",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }));
                const __VLS_597 = __VLS_596({
                    variant: "dropdown",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }, ...__VLS_functionalComponentArgsRest(__VLS_596));
                // @ts-ignore
                [getSiteWhitelistActions,];
                var __VLS_573;
                // @ts-ignore
                [];
                var __VLS_567;
                // @ts-ignore
                [];
                var __VLS_547;
                var __VLS_548;
                // @ts-ignore
                [];
                var __VLS_541;
                let __VLS_600;
                /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
                OptionsItemActionsMenuContent;
                // @ts-ignore
                const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
                    variant: "context",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }));
                const __VLS_602 = __VLS_601({
                    variant: "context",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }, ...__VLS_functionalComponentArgsRest(__VLS_601));
                // @ts-ignore
                [getSiteWhitelistActions,];
                var __VLS_535;
                // @ts-ignore
                [];
            }
            // @ts-ignore
            [];
            var __VLS_529;
            // @ts-ignore
            [];
            var __VLS_523;
            // @ts-ignore
            [];
            var __VLS_517;
        }
        else {
            let __VLS_605;
            /** @ts-ignore @type {typeof ___VLS_components.Table} */
            Table;
            // @ts-ignore
            const __VLS_606 = __VLS_asFunctionalComponent(__VLS_605, new __VLS_605({
                ...{ class: "table-fixed" },
            }));
            const __VLS_607 = __VLS_606({
                ...{ class: "table-fixed" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_606));
            /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
            const { default: __VLS_610 } = __VLS_608.slots;
            let __VLS_611;
            /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
            TableBody;
            // @ts-ignore
            const __VLS_612 = __VLS_asFunctionalComponent(__VLS_611, new __VLS_611({}));
            const __VLS_613 = __VLS_612({}, ...__VLS_functionalComponentArgsRest(__VLS_612));
            const { default: __VLS_616 } = __VLS_614.slots;
            for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.autoRun.siteWhitelist))) {
                let __VLS_617;
                /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
                ContextMenu;
                // @ts-ignore
                const __VLS_618 = __VLS_asFunctionalComponent(__VLS_617, new __VLS_617({
                    key: (entry.id),
                }));
                const __VLS_619 = __VLS_618({
                    key: (entry.id),
                }, ...__VLS_functionalComponentArgsRest(__VLS_618));
                const { default: __VLS_622 } = __VLS_620.slots;
                let __VLS_623;
                /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
                ContextMenuTrigger;
                // @ts-ignore
                const __VLS_624 = __VLS_asFunctionalComponent(__VLS_623, new __VLS_623({
                    asChild: true,
                }));
                const __VLS_625 = __VLS_624({
                    asChild: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_624));
                const { default: __VLS_628 } = __VLS_626.slots;
                let __VLS_629;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_630 = __VLS_asFunctionalComponent(__VLS_629, new __VLS_629({
                    ...{ 'onClick': {} },
                    ...{ class: "h-[41px] cursor-pointer transition-colors" },
                    ...{ class: (__VLS_ctx.isWhitelistRowSelected(entry) ? 'bg-accent' : '') },
                }));
                const __VLS_631 = __VLS_630({
                    ...{ 'onClick': {} },
                    ...{ class: "h-[41px] cursor-pointer transition-colors" },
                    ...{ class: (__VLS_ctx.isWhitelistRowSelected(entry) ? 'bg-accent' : '') },
                }, ...__VLS_functionalComponentArgsRest(__VLS_630));
                let __VLS_634;
                const __VLS_635 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!(!__VLS_ctx.isStandalone))
                                return;
                            if (!(__VLS_ctx.autoRun.advancedMode))
                                return;
                            if (!!(__VLS_ctx.siteWhitelistNeedsScroll))
                                return;
                            __VLS_ctx.emit('select', { type: 'site-whitelist', id: entry.id });
                            // @ts-ignore
                            [autoRun, emit, isWhitelistRowSelected,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                const { default: __VLS_636 } = __VLS_632.slots;
                let __VLS_637;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_638 = __VLS_asFunctionalComponent(__VLS_637, new __VLS_637({
                    ...{ class: "overflow-hidden !py-2" },
                }));
                const __VLS_639 = __VLS_638({
                    ...{ class: "overflow-hidden !py-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_638));
                /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
                /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
                const { default: __VLS_642 } = __VLS_640.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-sm truncate" },
                    title: (entry.pattern),
                });
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (entry.pattern);
                // @ts-ignore
                [];
                var __VLS_640;
                let __VLS_643;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_644 = __VLS_asFunctionalComponent(__VLS_643, new __VLS_643({
                    ...{ class: "w-[100px] text-center !py-2" },
                }));
                const __VLS_645 = __VLS_644({
                    ...{ class: "w-[100px] text-center !py-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_644));
                /** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
                const { default: __VLS_648 } = __VLS_646.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-xs text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                (__VLS_ctx.formatDate(entry.addedAt));
                // @ts-ignore
                [formatDate,];
                var __VLS_646;
                let __VLS_649;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_650 = __VLS_asFunctionalComponent(__VLS_649, new __VLS_649({
                    ...{ class: "w-[48px] text-center p-0" },
                }));
                const __VLS_651 = __VLS_650({
                    ...{ class: "w-[48px] text-center p-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_650));
                /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                const { default: __VLS_654 } = __VLS_652.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex justify-center items-center" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                let __VLS_655;
                /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
                DropdownMenu;
                // @ts-ignore
                const __VLS_656 = __VLS_asFunctionalComponent(__VLS_655, new __VLS_655({}));
                const __VLS_657 = __VLS_656({}, ...__VLS_functionalComponentArgsRest(__VLS_656));
                const { default: __VLS_660 } = __VLS_658.slots;
                let __VLS_661;
                /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
                DropdownMenuTrigger;
                // @ts-ignore
                const __VLS_662 = __VLS_asFunctionalComponent(__VLS_661, new __VLS_661({
                    asChild: true,
                }));
                const __VLS_663 = __VLS_662({
                    asChild: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_662));
                const { default: __VLS_666 } = __VLS_664.slots;
                let __VLS_667;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_668 = __VLS_asFunctionalComponent(__VLS_667, new __VLS_667({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "icon",
                    ...{ class: "h-6 w-6 p-0" },
                }));
                const __VLS_669 = __VLS_668({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "icon",
                    ...{ class: "h-6 w-6 p-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_668));
                let __VLS_672;
                const __VLS_673 = ({ click: {} },
                    { onClick: () => { } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                const { default: __VLS_674 } = __VLS_670.slots;
                let __VLS_675;
                /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
                MoreHorizontal;
                // @ts-ignore
                const __VLS_676 = __VLS_asFunctionalComponent(__VLS_675, new __VLS_675({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_677 = __VLS_676({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_676));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                // @ts-ignore
                [];
                var __VLS_670;
                var __VLS_671;
                // @ts-ignore
                [];
                var __VLS_664;
                let __VLS_680;
                /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
                OptionsItemActionsMenuContent;
                // @ts-ignore
                const __VLS_681 = __VLS_asFunctionalComponent(__VLS_680, new __VLS_680({
                    variant: "dropdown",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }));
                const __VLS_682 = __VLS_681({
                    variant: "dropdown",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }, ...__VLS_functionalComponentArgsRest(__VLS_681));
                // @ts-ignore
                [getSiteWhitelistActions,];
                var __VLS_658;
                // @ts-ignore
                [];
                var __VLS_652;
                // @ts-ignore
                [];
                var __VLS_632;
                var __VLS_633;
                // @ts-ignore
                [];
                var __VLS_626;
                let __VLS_685;
                /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
                OptionsItemActionsMenuContent;
                // @ts-ignore
                const __VLS_686 = __VLS_asFunctionalComponent(__VLS_685, new __VLS_685({
                    variant: "context",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }));
                const __VLS_687 = __VLS_686({
                    variant: "context",
                    actions: (__VLS_ctx.getSiteWhitelistActions(entry)),
                }, ...__VLS_functionalComponentArgsRest(__VLS_686));
                // @ts-ignore
                [getSiteWhitelistActions,];
                var __VLS_620;
                // @ts-ignore
                [];
            }
            if (!__VLS_ctx.autoRun.siteWhitelist.length) {
                let __VLS_690;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_691 = __VLS_asFunctionalComponent(__VLS_690, new __VLS_690({}));
                const __VLS_692 = __VLS_691({}, ...__VLS_functionalComponentArgsRest(__VLS_691));
                const { default: __VLS_695 } = __VLS_693.slots;
                let __VLS_696;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_697 = __VLS_asFunctionalComponent(__VLS_696, new __VLS_696({
                    colspan: "3",
                    ...{ class: "text-center text-muted-foreground py-8" },
                }));
                const __VLS_698 = __VLS_697({
                    colspan: "3",
                    ...{ class: "text-center text-muted-foreground py-8" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_697));
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
                const { default: __VLS_701 } = __VLS_699.slots;
                // @ts-ignore
                [autoRun,];
                var __VLS_699;
                // @ts-ignore
                [];
                var __VLS_693;
            }
            // @ts-ignore
            [];
            var __VLS_614;
            // @ts-ignore
            [];
            var __VLS_608;
        }
    }
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "saved-files-section",
    ...{ class: "space-y-2 border-t pt-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
if (__VLS_ctx.isStandalone) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    let __VLS_702;
    /** @ts-ignore @type {typeof ___VLS_components.Progress} */
    Progress;
    // @ts-ignore
    const __VLS_703 = __VLS_asFunctionalComponent(__VLS_702, new __VLS_702({
        modelValue: (__VLS_ctx.mediaUsagePercent),
        ...{ class: "h-2 flex-1" },
        ...{ class: (__VLS_ctx.mediaUsagePercent >= 90 ? '[&>*]:bg-destructive' : __VLS_ctx.mediaUsagePercent >= 70 ? '[&>*]:bg-yellow-500' : '') },
    }));
    const __VLS_704 = __VLS_703({
        modelValue: (__VLS_ctx.mediaUsagePercent),
        ...{ class: "h-2 flex-1" },
        ...{ class: (__VLS_ctx.mediaUsagePercent >= 90 ? '[&>*]:bg-destructive' : __VLS_ctx.mediaUsagePercent >= 70 ? '[&>*]:bg-yellow-500' : '') },
    }, ...__VLS_functionalComponentArgsRest(__VLS_703));
    /** @type {__VLS_StyleScopedClasses['h-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs text-muted-foreground tabular-nums whitespace-nowrap" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    (__VLS_ctx.mediaUsageLabel);
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center space-x-3 mb-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
let __VLS_707;
/** @ts-ignore @type {typeof ___VLS_components.Checkbox} */
Checkbox;
// @ts-ignore
const __VLS_708 = __VLS_asFunctionalComponent(__VLS_707, new __VLS_707({
    ...{ 'onUpdate:modelValue': {} },
    id: "auto-save-files",
    modelValue: (__VLS_ctx.settings.autoSaveFiles),
}));
const __VLS_709 = __VLS_708({
    ...{ 'onUpdate:modelValue': {} },
    id: "auto-save-files",
    modelValue: (__VLS_ctx.settings.autoSaveFiles),
}, ...__VLS_functionalComponentArgsRest(__VLS_708));
let __VLS_712;
const __VLS_713 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.settings.autoSaveFiles = $event;
            // @ts-ignore
            [isStandalone, settings, settings, mediaUsagePercent, mediaUsagePercent, mediaUsagePercent, mediaUsageLabel,];
        } });
var __VLS_710;
var __VLS_711;
let __VLS_714;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_715 = __VLS_asFunctionalComponent(__VLS_714, new __VLS_714({
    for: "auto-save-files",
    ...{ class: "text-sm" },
}));
const __VLS_716 = __VLS_715({
    for: "auto-save-files",
    ...{ class: "text-sm" },
}, ...__VLS_functionalComponentArgsRest(__VLS_715));
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const { default: __VLS_719 } = __VLS_717.slots;
// @ts-ignore
[];
var __VLS_717;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col border rounded-lg" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 border-b bg-muted/30" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
let __VLS_720;
/** @ts-ignore @type {typeof ___VLS_components.Table} */
Table;
// @ts-ignore
const __VLS_721 = __VLS_asFunctionalComponent(__VLS_720, new __VLS_720({
    ...{ class: "table-fixed" },
}));
const __VLS_722 = __VLS_721({
    ...{ class: "table-fixed" },
}, ...__VLS_functionalComponentArgsRest(__VLS_721));
/** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
const { default: __VLS_725 } = __VLS_723.slots;
let __VLS_726;
/** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
TableHeader;
// @ts-ignore
const __VLS_727 = __VLS_asFunctionalComponent(__VLS_726, new __VLS_726({
    ...{ class: "[&_th]:h-10" },
}));
const __VLS_728 = __VLS_727({
    ...{ class: "[&_th]:h-10" },
}, ...__VLS_functionalComponentArgsRest(__VLS_727));
/** @type {__VLS_StyleScopedClasses['[&_th]:h-10']} */ ;
const { default: __VLS_731 } = __VLS_729.slots;
let __VLS_732;
/** @ts-ignore @type {typeof ___VLS_components.TableRow} */
TableRow;
// @ts-ignore
const __VLS_733 = __VLS_asFunctionalComponent(__VLS_732, new __VLS_732({
    ...{ class: "hover:bg-transparent" },
}));
const __VLS_734 = __VLS_733({
    ...{ class: "hover:bg-transparent" },
}, ...__VLS_functionalComponentArgsRest(__VLS_733));
/** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
const { default: __VLS_737 } = __VLS_735.slots;
let __VLS_738;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_739 = __VLS_asFunctionalComponent(__VLS_738, new __VLS_738({
    ...{ class: "text-xs font-semibold" },
}));
const __VLS_740 = __VLS_739({
    ...{ class: "text-xs font-semibold" },
}, ...__VLS_functionalComponentArgsRest(__VLS_739));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
const { default: __VLS_743 } = __VLS_741.slots;
// @ts-ignore
[];
var __VLS_741;
let __VLS_744;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_745 = __VLS_asFunctionalComponent(__VLS_744, new __VLS_744({
    ...{ class: "text-xs font-semibold w-[80px] text-center" },
}));
const __VLS_746 = __VLS_745({
    ...{ class: "text-xs font-semibold w-[80px] text-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_745));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[80px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
const { default: __VLS_749 } = __VLS_747.slots;
// @ts-ignore
[];
var __VLS_747;
let __VLS_750;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_751 = __VLS_asFunctionalComponent(__VLS_750, new __VLS_750({
    ...{ class: "w-[48px] text-center p-0" },
}));
const __VLS_752 = __VLS_751({
    ...{ class: "w-[48px] text-center p-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_751));
/** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
// @ts-ignore
[];
var __VLS_735;
// @ts-ignore
[];
var __VLS_729;
// @ts-ignore
[];
var __VLS_723;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-h-0 max-h-[205px] overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[205px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
if (__VLS_ctx.savedFilesNeedsScroll) {
    let __VLS_755;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_756 = __VLS_asFunctionalComponent(__VLS_755, new __VLS_755({
        ...{ style: ({ height: `${__VLS_ctx.savedFilesTableHeight}px` }) },
    }));
    const __VLS_757 = __VLS_756({
        ...{ style: ({ height: `${__VLS_ctx.savedFilesTableHeight}px` }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_756));
    const { default: __VLS_760 } = __VLS_758.slots;
    let __VLS_761;
    /** @ts-ignore @type {typeof ___VLS_components.Table} */
    Table;
    // @ts-ignore
    const __VLS_762 = __VLS_asFunctionalComponent(__VLS_761, new __VLS_761({
        ...{ class: "table-fixed" },
    }));
    const __VLS_763 = __VLS_762({
        ...{ class: "table-fixed" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_762));
    /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
    const { default: __VLS_766 } = __VLS_764.slots;
    let __VLS_767;
    /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
    TableBody;
    // @ts-ignore
    const __VLS_768 = __VLS_asFunctionalComponent(__VLS_767, new __VLS_767({}));
    const __VLS_769 = __VLS_768({}, ...__VLS_functionalComponentArgsRest(__VLS_768));
    const { default: __VLS_772 } = __VLS_770.slots;
    for (const [file] of __VLS_getVForSourceType((__VLS_ctx.savedFilesForTable))) {
        let __VLS_773;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
        ContextMenu;
        // @ts-ignore
        const __VLS_774 = __VLS_asFunctionalComponent(__VLS_773, new __VLS_773({
            key: (file.id),
        }));
        const __VLS_775 = __VLS_774({
            key: (file.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_774));
        const { default: __VLS_778 } = __VLS_776.slots;
        let __VLS_779;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
        ContextMenuTrigger;
        // @ts-ignore
        const __VLS_780 = __VLS_asFunctionalComponent(__VLS_779, new __VLS_779({
            asChild: true,
        }));
        const __VLS_781 = __VLS_780({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_780));
        const { default: __VLS_784 } = __VLS_782.slots;
        let __VLS_785;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_786 = __VLS_asFunctionalComponent(__VLS_785, new __VLS_785({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === file.id }) },
        }));
        const __VLS_787 = __VLS_786({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === file.id }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_786));
        let __VLS_790;
        const __VLS_791 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.savedFilesNeedsScroll))
                        return;
                    __VLS_ctx.emit('select', { type: 'saved-file', id: file.id });
                    // @ts-ignore
                    [emit, savedFilesNeedsScroll, savedFilesTableHeight, savedFilesForTable, selectedItemId,];
                } });
        /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
        const { default: __VLS_792 } = __VLS_788.slots;
        let __VLS_793;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_794 = __VLS_asFunctionalComponent(__VLS_793, new __VLS_793({
            ...{ class: "overflow-hidden !py-2" },
        }));
        const __VLS_795 = __VLS_794({
            ...{ class: "overflow-hidden !py-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_794));
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
        const { default: __VLS_798 } = __VLS_796.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm truncate" },
            title: (file.name),
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (file.name);
        // @ts-ignore
        [];
        var __VLS_796;
        let __VLS_799;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_800 = __VLS_asFunctionalComponent(__VLS_799, new __VLS_799({
            ...{ class: "w-[80px] text-center !py-2" },
        }));
        const __VLS_801 = __VLS_800({
            ...{ class: "w-[80px] text-center !py-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_800));
        /** @type {__VLS_StyleScopedClasses['w-[80px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
        const { default: __VLS_804 } = __VLS_802.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        (__VLS_ctx.formatFileSize(file.size));
        // @ts-ignore
        [formatFileSize,];
        var __VLS_802;
        let __VLS_805;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_806 = __VLS_asFunctionalComponent(__VLS_805, new __VLS_805({
            ...{ class: "w-[48px] text-center p-0" },
        }));
        const __VLS_807 = __VLS_806({
            ...{ class: "w-[48px] text-center p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_806));
        /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_810 } = __VLS_808.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-center items-center" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        let __VLS_811;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
        DropdownMenu;
        // @ts-ignore
        const __VLS_812 = __VLS_asFunctionalComponent(__VLS_811, new __VLS_811({}));
        const __VLS_813 = __VLS_812({}, ...__VLS_functionalComponentArgsRest(__VLS_812));
        const { default: __VLS_816 } = __VLS_814.slots;
        let __VLS_817;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
        DropdownMenuTrigger;
        // @ts-ignore
        const __VLS_818 = __VLS_asFunctionalComponent(__VLS_817, new __VLS_817({
            asChild: true,
        }));
        const __VLS_819 = __VLS_818({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_818));
        const { default: __VLS_822 } = __VLS_820.slots;
        let __VLS_823;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_824 = __VLS_asFunctionalComponent(__VLS_823, new __VLS_823({
            ...{ 'onClick': {} },
            variant: "ghost",
            ...{ class: "h-6 w-6 p-0" },
        }));
        const __VLS_825 = __VLS_824({
            ...{ 'onClick': {} },
            variant: "ghost",
            ...{ class: "h-6 w-6 p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_824));
        let __VLS_828;
        const __VLS_829 = ({ click: {} },
            { onClick: () => { } });
        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_830 } = __VLS_826.slots;
        let __VLS_831;
        /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
        MoreHorizontal;
        // @ts-ignore
        const __VLS_832 = __VLS_asFunctionalComponent(__VLS_831, new __VLS_831({
            ...{ class: "h-3.5 w-3.5" },
        }));
        const __VLS_833 = __VLS_832({
            ...{ class: "h-3.5 w-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_832));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        // @ts-ignore
        [];
        var __VLS_826;
        var __VLS_827;
        // @ts-ignore
        [];
        var __VLS_820;
        let __VLS_836;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_837 = __VLS_asFunctionalComponent(__VLS_836, new __VLS_836({
            variant: "dropdown",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }));
        const __VLS_838 = __VLS_837({
            variant: "dropdown",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }, ...__VLS_functionalComponentArgsRest(__VLS_837));
        const { default: __VLS_841 } = __VLS_839.slots;
        {
            const { edit: __VLS_842 } = __VLS_839.slots;
            const [{ item: f, variant }] = __VLS_getSlotParameters(__VLS_842);
            __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full" },
                ...{ class: (variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground') },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            let __VLS_843;
            /** @ts-ignore @type {typeof ___VLS_components.Pencil} */
            Pencil;
            // @ts-ignore
            const __VLS_844 = __VLS_asFunctionalComponent(__VLS_843, new __VLS_843({
                ...{ class: "h-4 w-4 mr-2" },
            }));
            const __VLS_845 = __VLS_844({
                ...{ class: "h-4 w-4 mr-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_844));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.input)({
                ...{ onChange: (...[$event]) => {
                        if (!(__VLS_ctx.savedFilesNeedsScroll))
                            return;
                        __VLS_ctx.handleEditFileChange($event, f.id, f._isWallpaper);
                        // @ts-ignore
                        [getSavedFileActions, handleEditFileChange,];
                    } },
                type: "file",
                ...{ class: "sr-only" },
            });
            /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_839;
        // @ts-ignore
        [];
        var __VLS_814;
        // @ts-ignore
        [];
        var __VLS_808;
        // @ts-ignore
        [];
        var __VLS_788;
        var __VLS_789;
        // @ts-ignore
        [];
        var __VLS_782;
        let __VLS_848;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_849 = __VLS_asFunctionalComponent(__VLS_848, new __VLS_848({
            variant: "context",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }));
        const __VLS_850 = __VLS_849({
            variant: "context",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }, ...__VLS_functionalComponentArgsRest(__VLS_849));
        const { default: __VLS_853 } = __VLS_851.slots;
        {
            const { edit: __VLS_854 } = __VLS_851.slots;
            const [{ item: f, variant }] = __VLS_getSlotParameters(__VLS_854);
            __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full" },
                ...{ class: (variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground') },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            let __VLS_855;
            /** @ts-ignore @type {typeof ___VLS_components.Pencil} */
            Pencil;
            // @ts-ignore
            const __VLS_856 = __VLS_asFunctionalComponent(__VLS_855, new __VLS_855({
                ...{ class: "h-4 w-4 mr-2" },
            }));
            const __VLS_857 = __VLS_856({
                ...{ class: "h-4 w-4 mr-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_856));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.input)({
                ...{ onChange: (...[$event]) => {
                        if (!(__VLS_ctx.savedFilesNeedsScroll))
                            return;
                        __VLS_ctx.handleEditFileChange($event, f.id, f._isWallpaper);
                        // @ts-ignore
                        [getSavedFileActions, handleEditFileChange,];
                    } },
                type: "file",
                ...{ class: "sr-only" },
            });
            /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_851;
        // @ts-ignore
        [];
        var __VLS_776;
        // @ts-ignore
        [];
    }
    let __VLS_860;
    /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
    TableRow;
    // @ts-ignore
    const __VLS_861 = __VLS_asFunctionalComponent(__VLS_860, new __VLS_860({
        ...{ class: "h-[41px] hover:bg-muted/50 transition-colors" },
    }));
    const __VLS_862 = __VLS_861({
        ...{ class: "h-[41px] hover:bg-muted/50 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_861));
    /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    const { default: __VLS_865 } = __VLS_863.slots;
    let __VLS_866;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_867 = __VLS_asFunctionalComponent(__VLS_866, new __VLS_866({
        colspan: "3",
        ...{ class: "!p-0" },
    }));
    const __VLS_868 = __VLS_867({
        colspan: "3",
        ...{ class: "!p-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_867));
    /** @type {__VLS_StyleScopedClasses['!p-0']} */ ;
    const { default: __VLS_871 } = __VLS_869.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center justify-center gap-1.5 cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors w-full h-[41px]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:text-primary/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
    let __VLS_872;
    /** @ts-ignore @type {typeof ___VLS_components.Plus} */
    Plus;
    // @ts-ignore
    const __VLS_873 = __VLS_asFunctionalComponent(__VLS_872, new __VLS_872({
        ...{ class: "h-3.5 w-3.5" },
    }));
    const __VLS_874 = __VLS_873({
        ...{ class: "h-3.5 w-3.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_873));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.input)({
        ...{ onChange: (__VLS_ctx.handleAddNewFile) },
        type: "file",
        multiple: true,
        ...{ class: "sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
    // @ts-ignore
    [handleAddNewFile,];
    var __VLS_869;
    // @ts-ignore
    [];
    var __VLS_863;
    // @ts-ignore
    [];
    var __VLS_770;
    // @ts-ignore
    [];
    var __VLS_764;
    // @ts-ignore
    [];
    var __VLS_758;
}
else {
    let __VLS_877;
    /** @ts-ignore @type {typeof ___VLS_components.Table} */
    Table;
    // @ts-ignore
    const __VLS_878 = __VLS_asFunctionalComponent(__VLS_877, new __VLS_877({
        ...{ class: "table-fixed" },
    }));
    const __VLS_879 = __VLS_878({
        ...{ class: "table-fixed" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_878));
    /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
    const { default: __VLS_882 } = __VLS_880.slots;
    let __VLS_883;
    /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
    TableBody;
    // @ts-ignore
    const __VLS_884 = __VLS_asFunctionalComponent(__VLS_883, new __VLS_883({}));
    const __VLS_885 = __VLS_884({}, ...__VLS_functionalComponentArgsRest(__VLS_884));
    const { default: __VLS_888 } = __VLS_886.slots;
    for (const [file] of __VLS_getVForSourceType((__VLS_ctx.savedFilesForTable))) {
        let __VLS_889;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
        ContextMenu;
        // @ts-ignore
        const __VLS_890 = __VLS_asFunctionalComponent(__VLS_889, new __VLS_889({
            key: (file.id),
        }));
        const __VLS_891 = __VLS_890({
            key: (file.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_890));
        const { default: __VLS_894 } = __VLS_892.slots;
        let __VLS_895;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
        ContextMenuTrigger;
        // @ts-ignore
        const __VLS_896 = __VLS_asFunctionalComponent(__VLS_895, new __VLS_895({
            asChild: true,
        }));
        const __VLS_897 = __VLS_896({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_896));
        const { default: __VLS_900 } = __VLS_898.slots;
        let __VLS_901;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_902 = __VLS_asFunctionalComponent(__VLS_901, new __VLS_901({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === file.id }) },
        }));
        const __VLS_903 = __VLS_902({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === file.id }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_902));
        let __VLS_906;
        const __VLS_907 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.savedFilesNeedsScroll))
                        return;
                    __VLS_ctx.emit('select', { type: 'saved-file', id: file.id });
                    // @ts-ignore
                    [emit, savedFilesForTable, selectedItemId,];
                } });
        /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
        const { default: __VLS_908 } = __VLS_904.slots;
        let __VLS_909;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_910 = __VLS_asFunctionalComponent(__VLS_909, new __VLS_909({
            ...{ class: "overflow-hidden !py-2" },
        }));
        const __VLS_911 = __VLS_910({
            ...{ class: "overflow-hidden !py-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_910));
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
        const { default: __VLS_914 } = __VLS_912.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm truncate" },
            title: (file.name),
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (file.name);
        // @ts-ignore
        [];
        var __VLS_912;
        let __VLS_915;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_916 = __VLS_asFunctionalComponent(__VLS_915, new __VLS_915({
            ...{ class: "w-[80px] text-center !py-2" },
        }));
        const __VLS_917 = __VLS_916({
            ...{ class: "w-[80px] text-center !py-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_916));
        /** @type {__VLS_StyleScopedClasses['w-[80px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
        const { default: __VLS_920 } = __VLS_918.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        (__VLS_ctx.formatFileSize(file.size));
        // @ts-ignore
        [formatFileSize,];
        var __VLS_918;
        let __VLS_921;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_922 = __VLS_asFunctionalComponent(__VLS_921, new __VLS_921({
            ...{ class: "w-[48px] text-center p-0" },
        }));
        const __VLS_923 = __VLS_922({
            ...{ class: "w-[48px] text-center p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_922));
        /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_926 } = __VLS_924.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-center items-center" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        let __VLS_927;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
        DropdownMenu;
        // @ts-ignore
        const __VLS_928 = __VLS_asFunctionalComponent(__VLS_927, new __VLS_927({}));
        const __VLS_929 = __VLS_928({}, ...__VLS_functionalComponentArgsRest(__VLS_928));
        const { default: __VLS_932 } = __VLS_930.slots;
        let __VLS_933;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
        DropdownMenuTrigger;
        // @ts-ignore
        const __VLS_934 = __VLS_asFunctionalComponent(__VLS_933, new __VLS_933({
            asChild: true,
        }));
        const __VLS_935 = __VLS_934({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_934));
        const { default: __VLS_938 } = __VLS_936.slots;
        let __VLS_939;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_940 = __VLS_asFunctionalComponent(__VLS_939, new __VLS_939({
            ...{ 'onClick': {} },
            variant: "ghost",
            ...{ class: "h-6 w-6 p-0" },
        }));
        const __VLS_941 = __VLS_940({
            ...{ 'onClick': {} },
            variant: "ghost",
            ...{ class: "h-6 w-6 p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_940));
        let __VLS_944;
        const __VLS_945 = ({ click: {} },
            { onClick: () => { } });
        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_946 } = __VLS_942.slots;
        let __VLS_947;
        /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
        MoreHorizontal;
        // @ts-ignore
        const __VLS_948 = __VLS_asFunctionalComponent(__VLS_947, new __VLS_947({
            ...{ class: "h-3.5 w-3.5" },
        }));
        const __VLS_949 = __VLS_948({
            ...{ class: "h-3.5 w-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_948));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        // @ts-ignore
        [];
        var __VLS_942;
        var __VLS_943;
        // @ts-ignore
        [];
        var __VLS_936;
        let __VLS_952;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_953 = __VLS_asFunctionalComponent(__VLS_952, new __VLS_952({
            variant: "dropdown",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }));
        const __VLS_954 = __VLS_953({
            variant: "dropdown",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }, ...__VLS_functionalComponentArgsRest(__VLS_953));
        const { default: __VLS_957 } = __VLS_955.slots;
        {
            const { edit: __VLS_958 } = __VLS_955.slots;
            const [{ item: f, variant }] = __VLS_getSlotParameters(__VLS_958);
            __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full" },
                ...{ class: (variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground') },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            let __VLS_959;
            /** @ts-ignore @type {typeof ___VLS_components.Pencil} */
            Pencil;
            // @ts-ignore
            const __VLS_960 = __VLS_asFunctionalComponent(__VLS_959, new __VLS_959({
                ...{ class: "h-4 w-4 mr-2" },
            }));
            const __VLS_961 = __VLS_960({
                ...{ class: "h-4 w-4 mr-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_960));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.input)({
                ...{ onChange: (...[$event]) => {
                        if (!!(__VLS_ctx.savedFilesNeedsScroll))
                            return;
                        __VLS_ctx.handleEditFileChange($event, f.id, f._isWallpaper);
                        // @ts-ignore
                        [getSavedFileActions, handleEditFileChange,];
                    } },
                type: "file",
                ...{ class: "sr-only" },
            });
            /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_955;
        // @ts-ignore
        [];
        var __VLS_930;
        // @ts-ignore
        [];
        var __VLS_924;
        // @ts-ignore
        [];
        var __VLS_904;
        var __VLS_905;
        // @ts-ignore
        [];
        var __VLS_898;
        let __VLS_964;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_965 = __VLS_asFunctionalComponent(__VLS_964, new __VLS_964({
            variant: "context",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }));
        const __VLS_966 = __VLS_965({
            variant: "context",
            actions: (__VLS_ctx.getSavedFileActions(file)),
            item: (file),
        }, ...__VLS_functionalComponentArgsRest(__VLS_965));
        const { default: __VLS_969 } = __VLS_967.slots;
        {
            const { edit: __VLS_970 } = __VLS_967.slots;
            const [{ item: f, variant }] = __VLS_getSlotParameters(__VLS_970);
            __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full" },
                ...{ class: (variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground') },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            let __VLS_971;
            /** @ts-ignore @type {typeof ___VLS_components.Pencil} */
            Pencil;
            // @ts-ignore
            const __VLS_972 = __VLS_asFunctionalComponent(__VLS_971, new __VLS_971({
                ...{ class: "h-4 w-4 mr-2" },
            }));
            const __VLS_973 = __VLS_972({
                ...{ class: "h-4 w-4 mr-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_972));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.input)({
                ...{ onChange: (...[$event]) => {
                        if (!!(__VLS_ctx.savedFilesNeedsScroll))
                            return;
                        __VLS_ctx.handleEditFileChange($event, f.id, f._isWallpaper);
                        // @ts-ignore
                        [getSavedFileActions, handleEditFileChange,];
                    } },
                type: "file",
                ...{ class: "sr-only" },
            });
            /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_967;
        // @ts-ignore
        [];
        var __VLS_892;
        // @ts-ignore
        [];
    }
    let __VLS_976;
    /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
    TableRow;
    // @ts-ignore
    const __VLS_977 = __VLS_asFunctionalComponent(__VLS_976, new __VLS_976({
        ...{ class: "h-[41px] hover:bg-muted/50 transition-colors" },
    }));
    const __VLS_978 = __VLS_977({
        ...{ class: "h-[41px] hover:bg-muted/50 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_977));
    /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    const { default: __VLS_981 } = __VLS_979.slots;
    let __VLS_982;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_983 = __VLS_asFunctionalComponent(__VLS_982, new __VLS_982({
        colspan: "3",
        ...{ class: "!p-0" },
    }));
    const __VLS_984 = __VLS_983({
        colspan: "3",
        ...{ class: "!p-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_983));
    /** @type {__VLS_StyleScopedClasses['!p-0']} */ ;
    const { default: __VLS_987 } = __VLS_985.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center justify-center gap-1.5 cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors w-full h-[41px]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:text-primary/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
    let __VLS_988;
    /** @ts-ignore @type {typeof ___VLS_components.Plus} */
    Plus;
    // @ts-ignore
    const __VLS_989 = __VLS_asFunctionalComponent(__VLS_988, new __VLS_988({
        ...{ class: "h-3.5 w-3.5" },
    }));
    const __VLS_990 = __VLS_989({
        ...{ class: "h-3.5 w-3.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_989));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.input)({
        ...{ onChange: (__VLS_ctx.handleAddNewFile) },
        type: "file",
        multiple: true,
        ...{ class: "sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
    // @ts-ignore
    [handleAddNewFile,];
    var __VLS_985;
    // @ts-ignore
    [];
    var __VLS_979;
    // @ts-ignore
    [];
    var __VLS_886;
    // @ts-ignore
    [];
    var __VLS_880;
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4 border-t pt-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_993;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_994 = __VLS_asFunctionalComponent(__VLS_993, new __VLS_993({
    ...{ 'onClick': {} },
    size: "sm",
    variant: "outline",
    ...{ class: "h-8 gap-1.5" },
}));
const __VLS_995 = __VLS_994({
    ...{ 'onClick': {} },
    size: "sm",
    variant: "outline",
    ...{ class: "h-8 gap-1.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_994));
let __VLS_998;
const __VLS_999 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('import');
            // @ts-ignore
            [emit,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
const { default: __VLS_1000 } = __VLS_996.slots;
let __VLS_1001;
/** @ts-ignore @type {typeof ___VLS_components.Download} */
Download;
// @ts-ignore
const __VLS_1002 = __VLS_asFunctionalComponent(__VLS_1001, new __VLS_1001({
    ...{ class: "w-3.5 h-3.5" },
}));
const __VLS_1003 = __VLS_1002({
    ...{ class: "w-3.5 h-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1002));
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
// @ts-ignore
[];
var __VLS_996;
var __VLS_997;
let __VLS_1006;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_1007 = __VLS_asFunctionalComponent(__VLS_1006, new __VLS_1006({
    ...{ 'onClick': {} },
    size: "sm",
    variant: "outline",
    ...{ class: "h-8 gap-1.5" },
}));
const __VLS_1008 = __VLS_1007({
    ...{ 'onClick': {} },
    size: "sm",
    variant: "outline",
    ...{ class: "h-8 gap-1.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1007));
let __VLS_1011;
const __VLS_1012 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('export');
            // @ts-ignore
            [emit,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
const { default: __VLS_1013 } = __VLS_1009.slots;
let __VLS_1014;
/** @ts-ignore @type {typeof ___VLS_components.Upload} */
Upload;
// @ts-ignore
const __VLS_1015 = __VLS_asFunctionalComponent(__VLS_1014, new __VLS_1014({
    ...{ class: "w-3.5 h-3.5" },
}));
const __VLS_1016 = __VLS_1015({
    ...{ class: "w-3.5 h-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1015));
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
// @ts-ignore
[];
var __VLS_1009;
var __VLS_1010;
let __VLS_1019;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_1020 = __VLS_asFunctionalComponent(__VLS_1019, new __VLS_1019({
    ...{ 'onClick': {} },
    size: "sm",
    variant: "destructive",
    ...{ class: "h-8 gap-1.5" },
}));
const __VLS_1021 = __VLS_1020({
    ...{ 'onClick': {} },
    size: "sm",
    variant: "destructive",
    ...{ class: "h-8 gap-1.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1020));
let __VLS_1024;
const __VLS_1025 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('reset');
            // @ts-ignore
            [emit,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
const { default: __VLS_1026 } = __VLS_1022.slots;
let __VLS_1027;
/** @ts-ignore @type {typeof ___VLS_components.RotateCcw} */
RotateCcw;
// @ts-ignore
const __VLS_1028 = __VLS_asFunctionalComponent(__VLS_1027, new __VLS_1027({
    ...{ class: "w-3.5 h-3.5" },
}));
const __VLS_1029 = __VLS_1028({
    ...{ class: "w-3.5 h-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1028));
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
// @ts-ignore
[];
var __VLS_1022;
var __VLS_1023;
const __VLS_1032 = ImagePickerDrawer;
// @ts-ignore
const __VLS_1033 = __VLS_asFunctionalComponent(__VLS_1032, new __VLS_1032({
    ...{ 'onSelectFile': {} },
    ...{ 'onSelectUrl': {} },
    ...{ 'onAddUrl': {} },
    ...{ 'onRemoveUrl': {} },
    ...{ 'onAddFile': {} },
    ...{ 'onRemoveFile': {} },
    open: (__VLS_ctx.imagePickerOpen),
    savedFiles: (__VLS_ctx.mediaFilesForPicker),
    urlImages: (__VLS_ctx.customize.image.urls),
    selectedSavedFileId: (__VLS_ctx.customize.image.savedFileId),
    selectedUrl: (__VLS_ctx.customize.image.url),
}));
const __VLS_1034 = __VLS_1033({
    ...{ 'onSelectFile': {} },
    ...{ 'onSelectUrl': {} },
    ...{ 'onAddUrl': {} },
    ...{ 'onRemoveUrl': {} },
    ...{ 'onAddFile': {} },
    ...{ 'onRemoveFile': {} },
    open: (__VLS_ctx.imagePickerOpen),
    savedFiles: (__VLS_ctx.mediaFilesForPicker),
    urlImages: (__VLS_ctx.customize.image.urls),
    selectedSavedFileId: (__VLS_ctx.customize.image.savedFileId),
    selectedUrl: (__VLS_ctx.customize.image.url),
}, ...__VLS_functionalComponentArgsRest(__VLS_1033));
let __VLS_1037;
const __VLS_1038 = ({ selectFile: {} },
    { onSelectFile: (__VLS_ctx.handlePickerSelectFile) });
const __VLS_1039 = ({ selectUrl: {} },
    { onSelectUrl: (__VLS_ctx.handlePickerSelectUrl) });
const __VLS_1040 = ({ addUrl: {} },
    { onAddUrl: (__VLS_ctx.handlePickerAddUrl) });
const __VLS_1041 = ({ removeUrl: {} },
    { onRemoveUrl: (__VLS_ctx.handlePickerRemoveUrl) });
const __VLS_1042 = ({ addFile: {} },
    { onAddFile: (__VLS_ctx.handlePickerAddFile) });
const __VLS_1043 = ({ removeFile: {} },
    { onRemoveFile: (__VLS_ctx.handlePickerRemoveFile) });
var __VLS_1035;
var __VLS_1036;
// @ts-ignore
[imagePickerOpen, customize, customize, customize, mediaFilesForPicker, handlePickerSelectFile, handlePickerSelectUrl, handlePickerAddUrl, handlePickerRemoveUrl, handlePickerAddFile, handlePickerRemoveFile,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=GeneralSection.vue.js.map