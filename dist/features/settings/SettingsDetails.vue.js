import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useEscapeClose } from '@/composables/useEscapeClose';
import { marked } from 'marked';
import '@/assets/markdown.css';
import { mediaUrls, getMediaBlob, getWallpaperBlob } from '@/settings/mediaStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, EyeOff, CheckCircle2, AlertTriangle, ArrowUpCircle, Pencil, FileSpreadsheet, FileText, Edit, X, Save, } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
marked.setOptions({ breaks: true, gfm: true });
const renderedBody = computed(() => {
    const body = props.releaseInfo?.body;
    if (!body)
        return '';
    try {
        return marked.parse(body);
    }
    catch (error) {
        console.error('[settings/SettingsDetails] marked.parse failed:', error);
        return body;
    }
});
const props = defineProps();
const emit = defineEmits();
const detailsTitle = computed(() => {
    const t = props.selectedItem?.type;
    if (!t)
        return 'Details';
    switch (t) {
        case 'saved-file':
            return 'File Preview';
        case 'pinia-favorite':
            return 'Favorite Store Details';
        case 'site-blacklist':
            return 'Site Blacklist Details';
        case 'site-whitelist':
            return 'Site Whitelist Details';
        default:
            return t.charAt(0).toUpperCase() + t.slice(1) + ' Details';
    }
});
useEscapeClose(computed(() => !!(props.selectedItem || props.releaseInfo)), () => {
    if (props.selectedItem)
        emit('close');
    else if (props.releaseInfo)
        emit('close-release');
});
// -------------------- LOOKUP DATA --------------------
const breakpointData = computed(() => {
    if (props.selectedItem?.type !== 'breakpoint')
        return null;
    const id = props.selectedItem.id;
    const active = props.settings.breakpoints.active.find(bp => bp.id === id);
    if (active)
        return { ...active, active: true };
    const inactive = props.settings.breakpoints.inactive.find(bp => bp.id === id);
    if (inactive)
        return { ...inactive, active: false };
    return null;
});
const mockData = computed(() => {
    if (props.selectedItem?.type !== 'mock')
        return null;
    const id = props.selectedItem.id;
    const active = props.settings.mocks.active.find(m => m.id === id);
    if (active)
        return { ...active, active: true };
    const inactive = props.settings.mocks.inactive.find(m => m.id === id);
    if (inactive)
        return { ...inactive, active: false };
    return null;
});
const blacklistData = computed(() => {
    if (props.selectedItem?.type !== 'blacklist')
        return null;
    const name = props.selectedItem.id;
    if (props.settings.blacklist.active.includes(name))
        return { name, active: true };
    if (props.settings.blacklist.inactive.includes(name))
        return { name, active: false };
    return null;
});
const favoriteData = computed(() => {
    if (props.selectedItem?.type !== 'favorite')
        return null;
    return props.settings.favorites.find(f => f.id === props.selectedItem.id) || null;
});
const piniaFavoriteData = computed(() => {
    if (props.selectedItem?.type !== 'pinia-favorite')
        return null;
    return props.settings.piniaFavorites?.find(f => f.id === props.selectedItem.id) || null;
});
// Pinia favorite edit state
const editedPiniaFavoriteName = ref('');
watch(() => [props.piniaFavoriteEditMode, piniaFavoriteData.value], ([editMode, data]) => {
    if (editMode && data) {
        editedPiniaFavoriteName.value = data.name;
    }
}, { immediate: true });
function savePiniaFavoriteEdit() {
    const fav = piniaFavoriteData.value;
    if (!fav || !props.settings.piniaFavorites)
        return;
    const newName = editedPiniaFavoriteName.value.trim();
    if (!newName)
        return;
    const idx = props.settings.piniaFavorites.findIndex(f => f.id === fav.id);
    if (idx === -1)
        return;
    const updated = { ...fav, id: newName, name: newName };
    props.settings.piniaFavorites[idx] = updated;
    emit('pinia-favorite-edit-done', newName);
}
function cancelPiniaFavoriteEdit() {
    emit('pinia-favorite-edit-done');
}
const siteListDetailData = computed(() => {
    const sel = props.selectedItem;
    if (!sel || (sel.type !== 'site-blacklist' && sel.type !== 'site-whitelist'))
        return null;
    const ar = props.settings.autoRun;
    if (!ar)
        return null;
    const id = sel.id;
    if (sel.type === 'site-blacklist') {
        return ar.siteBlacklist.find(e => e.id === id) ?? null;
    }
    return ar.siteWhitelist.find(e => e.id === id) ?? null;
});
const editedSiteListPattern = ref('');
watch(() => [props.siteListEditMode, siteListDetailData.value], ([editMode, data]) => {
    if (editMode && data) {
        editedSiteListPattern.value = data.pattern;
    }
}, { immediate: true });
function saveSiteListEdit() {
    const data = siteListDetailData.value;
    const sel = props.selectedItem;
    if (!data || !sel || (sel.type !== 'site-blacklist' && sel.type !== 'site-whitelist'))
        return;
    const next = editedSiteListPattern.value.trim();
    if (!next)
        return;
    const ar = props.settings.autoRun;
    if (!ar)
        return;
    const list = sel.type === 'site-blacklist' ? ar.siteBlacklist : ar.siteWhitelist;
    if (list.some(e => e.pattern === next && e.id !== data.id))
        return;
    const idx = list.findIndex(e => e.id === data.id);
    if (idx === -1)
        return;
    list[idx] = { ...data, pattern: next };
    emit('site-list-edit-done');
}
function cancelSiteListEdit() {
    emit('site-list-edit-done');
}
const savedFileData = computed(() => {
    if (props.selectedItem?.type !== 'saved-file')
        return null;
    const id = props.selectedItem.id;
    if (id.startsWith('wallpaper_')) {
        const wp = props.settings.customize?.image?.wallpapers?.find(w => w.id === id);
        return wp ? { id: wp.id, name: wp.name, size: wp.size, mimeType: wp.mimeType } : null;
    }
    return props.settings.savedFiles?.find(f => f.id === id) || null;
});
// -------------------- FILE PREVIEW HELPERS --------------------
async function getFileBlob(fileId) {
    if (fileId.startsWith('wallpaper_')) {
        return getWallpaperBlob(fileId);
    }
    return getMediaBlob(fileId);
}
function isImageFile(mime) {
    return mime.startsWith('image/');
}
function isAudioFile(mime) {
    return mime.startsWith('audio/');
}
function isVideoFile(mime) {
    return mime.startsWith('video/');
}
function isTextFile(mime) {
    const textPrefixes = [
        'text/', 'application/json', 'application/xml', 'application/javascript',
        'application/typescript', 'application/x-yaml', 'application/yaml',
        'application/csv', 'application/x-sh', 'application/sql',
    ];
    return textPrefixes.some(t => mime.startsWith(t));
}
const textPreviewContent = ref('(loading...)');
watch(savedFileData, async (file) => {
    textPreviewContent.value = '(loading...)';
    if (!file || !isTextFile(file.mimeType))
        return;
    try {
        const blob = await getFileBlob(file.id);
        if (blob) {
            textPreviewContent.value = await blob.text();
        }
        else {
            textPreviewContent.value = '(no data)';
        }
    }
    catch (error) {
        console.error('[settings/SettingsDetails] getFileBlob/text failed:', error);
        textPreviewContent.value = '(unable to decode)';
    }
}, { immediate: true });
function isOfficeFile(mime) {
    const officeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint',
    ];
    return officeTypes.includes(mime);
}
function getOfficeFileLabel(mime) {
    if (mime.includes('word') || mime.includes('document'))
        return 'Word Document';
    if (mime.includes('excel') || mime.includes('sheet'))
        return 'Excel Spreadsheet';
    if (mime.includes('powerpoint') || mime.includes('presentation'))
        return 'PowerPoint Presentation';
    return 'Office Document';
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024)
        return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}
async function downloadSavedFile(file) {
    try {
        const blob = await getFileBlob(file.id);
        if (!blob)
            return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    catch (error) {
        console.error('[settings/SettingsDetails] downloadSavedFile failed:', file.id, error);
    }
}
function getFileUrl(file) {
    return mediaUrls[file.id] || '';
}
const officeBlobUrl = ref(null);
watch(savedFileData, async (file) => {
    if (officeBlobUrl.value) {
        URL.revokeObjectURL(officeBlobUrl.value);
        officeBlobUrl.value = null;
    }
    if (file && isOfficeFile(file.mimeType)) {
        try {
            const blob = await getFileBlob(file.id);
            if (blob)
                officeBlobUrl.value = URL.createObjectURL(blob);
        }
        catch (error) {
            console.error('[settings/SettingsDetails] officeBlobUrl getFileBlob failed:', file.id, error);
        }
    }
}, { immediate: true });
onBeforeUnmount(() => {
    if (officeBlobUrl.value) {
        URL.revokeObjectURL(officeBlobUrl.value);
    }
});
// -------------------- FORMATTERS --------------------
function formatBreakpointUrl(bp) {
    let url = `${bp.scheme}://${bp.host}`;
    if (bp.port)
        url += `:${bp.port}`;
    url += bp.path;
    if (bp.query)
        url += `?${bp.query}`;
    return url;
}
function formatTrigger(trigger) {
    if (trigger === 'both')
        return 'Request & Response';
    return trigger.charAt(0).toUpperCase() + trigger.slice(1);
}
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
    ...{ class: "h-full flex flex-col" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
if (__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 flex items-center gap-2 p-2 border-b" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-7 w-7" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-7 w-7" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                    return;
                __VLS_ctx.emit('close-release');
                // @ts-ignore
                [releaseInfo, selectedItem, emit,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
    const { default: __VLS_7 } = __VLS_3.slots;
    let __VLS_8;
    /** @ts-ignore @type {typeof ___VLS_components.ArrowLeft} */
    ArrowLeft;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [];
    var __VLS_3;
    var __VLS_4;
    if (__VLS_ctx.releaseInfo.type === 'update-available') {
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    }
    else if (__VLS_ctx.releaseInfo.type === 'up-to-date') {
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    }
    let __VLS_13;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
        ...{ class: "flex-1 min-h-0" },
    }));
    const __VLS_15 = __VLS_14({
        ...{ class: "flex-1 min-h-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    const { default: __VLS_18 } = __VLS_16.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-4 space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    if (__VLS_ctx.releaseInfo.error) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start gap-2 p-3 rounded-lg bg-destructive_text/10 text-destructive_text" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-destructive_text/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
        let __VLS_19;
        /** @ts-ignore @type {typeof ___VLS_components.AlertTriangle} */
        AlertTriangle;
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
            ...{ class: "w-4 h-4 mt-0.5 shrink-0" },
        }));
        const __VLS_21 = __VLS_20({
            ...{ class: "w-4 h-4 mt-0.5 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        (__VLS_ctx.releaseInfo.error);
    }
    else if (__VLS_ctx.releaseInfo.type === 'update-available') {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-4" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-primary/20']} */ ;
        let __VLS_24;
        /** @ts-ignore @type {typeof ___VLS_components.ArrowUpCircle} */
        ArrowUpCircle;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            ...{ class: "w-5 h-5 text-primary mt-0.5 shrink-0" },
        }));
        const __VLS_26 = __VLS_25({
            ...{ class: "w-5 h-5 text-primary mt-0.5 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        (__VLS_ctx.releaseInfo.version);
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div)({
            ...{ class: "mt-2 text-sm break-words font-sans leading-relaxed markdown-body" },
        });
        __VLS_asFunctionalDirective(___VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderedBody) }, null, null);
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-sans']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
        /** @type {__VLS_StyleScopedClasses['markdown-body']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-2 pt-2 border-t" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
        let __VLS_29;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "gap-1.5" },
        }));
        const __VLS_31 = __VLS_30({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "gap-1.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_30));
        let __VLS_34;
        const __VLS_35 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                        return;
                    if (!!(__VLS_ctx.releaseInfo.error))
                        return;
                    if (!(__VLS_ctx.releaseInfo.type === 'update-available'))
                        return;
                    __VLS_ctx.emit('ignore-version', __VLS_ctx.releaseInfo.version);
                    // @ts-ignore
                    [releaseInfo, releaseInfo, releaseInfo, releaseInfo, releaseInfo, releaseInfo, releaseInfo, emit, renderedBody,];
                } });
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        const { default: __VLS_36 } = __VLS_32.slots;
        let __VLS_37;
        /** @ts-ignore @type {typeof ___VLS_components.EyeOff} */
        EyeOff;
        // @ts-ignore
        const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
            ...{ class: "w-3.5 h-3.5" },
        }));
        const __VLS_39 = __VLS_38({
            ...{ class: "w-3.5 h-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_38));
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        // @ts-ignore
        [];
        var __VLS_32;
        var __VLS_33;
        let __VLS_42;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
            ...{ 'onClick': {} },
            size: "sm",
            ...{ class: "gap-1.5" },
            disabled: (!__VLS_ctx.releaseInfo.downloadUrl),
        }));
        const __VLS_44 = __VLS_43({
            ...{ 'onClick': {} },
            size: "sm",
            ...{ class: "gap-1.5" },
            disabled: (!__VLS_ctx.releaseInfo.downloadUrl),
        }, ...__VLS_functionalComponentArgsRest(__VLS_43));
        let __VLS_47;
        const __VLS_48 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                        return;
                    if (!!(__VLS_ctx.releaseInfo.error))
                        return;
                    if (!(__VLS_ctx.releaseInfo.type === 'update-available'))
                        return;
                    __VLS_ctx.releaseInfo.downloadUrl && __VLS_ctx.emit('download-update', __VLS_ctx.releaseInfo.downloadUrl);
                    // @ts-ignore
                    [releaseInfo, releaseInfo, releaseInfo, emit,];
                } });
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        const { default: __VLS_49 } = __VLS_45.slots;
        let __VLS_50;
        /** @ts-ignore @type {typeof ___VLS_components.Download} */
        Download;
        // @ts-ignore
        const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
            ...{ class: "w-3.5 h-3.5" },
        }));
        const __VLS_52 = __VLS_51({
            ...{ class: "w-3.5 h-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_51));
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        // @ts-ignore
        [];
        var __VLS_45;
        var __VLS_46;
    }
    else if (__VLS_ctx.releaseInfo.type === 'up-to-date') {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-green-500/5']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-green-500/20']} */ ;
        let __VLS_55;
        /** @ts-ignore @type {typeof ___VLS_components.CheckCircle2} */
        CheckCircle2;
        // @ts-ignore
        const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
            ...{ class: "w-5 h-5 text-green-500 mt-0.5 shrink-0" },
        }));
        const __VLS_57 = __VLS_56({
            ...{ class: "w-5 h-5 text-green-500 mt-0.5 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_56));
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        (__VLS_ctx.releaseInfo.version);
        if (__VLS_ctx.releaseInfo.body) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div)({
                ...{ class: "mt-2 text-sm break-words font-sans leading-relaxed markdown-body" },
            });
            __VLS_asFunctionalDirective(___VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderedBody) }, null, null);
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-sans']} */ ;
            /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
            /** @type {__VLS_StyleScopedClasses['markdown-body']} */ ;
        }
    }
    else {
        if (__VLS_ctx.releaseInfo.version) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.releaseInfo.version);
        }
        __VLS_asFunctionalElement(__VLS_intrinsics.div)({
            ...{ class: "text-sm break-words font-sans leading-relaxed markdown-body" },
        });
        __VLS_asFunctionalDirective(___VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderedBody) }, null, null);
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-sans']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
        /** @type {__VLS_StyleScopedClasses['markdown-body']} */ ;
    }
    // @ts-ignore
    [releaseInfo, releaseInfo, releaseInfo, releaseInfo, releaseInfo, renderedBody, renderedBody,];
    var __VLS_16;
}
else if (__VLS_ctx.selectedItem) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 flex items-center gap-2 p-2 border-b" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    let __VLS_60;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-7 w-7" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-7 w-7" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    const __VLS_66 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                    return;
                if (!(__VLS_ctx.selectedItem))
                    return;
                __VLS_ctx.emit('close');
                // @ts-ignore
                [selectedItem, emit,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
    const { default: __VLS_67 } = __VLS_63.slots;
    let __VLS_68;
    /** @ts-ignore @type {typeof ___VLS_components.ArrowLeft} */
    ArrowLeft;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_70 = __VLS_69({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [];
    var __VLS_63;
    var __VLS_64;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.detailsTitle);
    __VLS_asFunctionalElement(__VLS_intrinsics.div)({
        ...{ class: "flex-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    if (__VLS_ctx.selectedItem.type === 'breakpoint' || __VLS_ctx.selectedItem.type === 'mock') {
        let __VLS_73;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs gap-1.5" },
        }));
        const __VLS_75 = __VLS_74({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs gap-1.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_74));
        let __VLS_78;
        const __VLS_79 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                        return;
                    if (!(__VLS_ctx.selectedItem))
                        return;
                    if (!(__VLS_ctx.selectedItem.type === 'breakpoint' || __VLS_ctx.selectedItem.type === 'mock'))
                        return;
                    __VLS_ctx.emit('edit');
                    // @ts-ignore
                    [selectedItem, selectedItem, emit, detailsTitle,];
                } });
        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        const { default: __VLS_80 } = __VLS_76.slots;
        let __VLS_81;
        /** @ts-ignore @type {typeof ___VLS_components.Pencil} */
        Pencil;
        // @ts-ignore
        const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
            ...{ class: "h-3.5 w-3.5" },
        }));
        const __VLS_83 = __VLS_82({
            ...{ class: "h-3.5 w-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_82));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        // @ts-ignore
        [];
        var __VLS_76;
        var __VLS_77;
    }
    else if (__VLS_ctx.selectedItem.type === 'pinia-favorite' && __VLS_ctx.piniaFavoriteData) {
        if (!__VLS_ctx.piniaFavoriteEditMode) {
            let __VLS_86;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Edit",
            }));
            const __VLS_88 = __VLS_87({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Edit",
            }, ...__VLS_functionalComponentArgsRest(__VLS_87));
            let __VLS_91;
            const __VLS_92 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                            return;
                        if (!(__VLS_ctx.selectedItem))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'breakpoint' || __VLS_ctx.selectedItem.type === 'mock'))
                            return;
                        if (!(__VLS_ctx.selectedItem.type === 'pinia-favorite' && __VLS_ctx.piniaFavoriteData))
                            return;
                        if (!(!__VLS_ctx.piniaFavoriteEditMode))
                            return;
                        __VLS_ctx.emit('edit');
                        // @ts-ignore
                        [selectedItem, emit, piniaFavoriteData, piniaFavoriteEditMode,];
                    } });
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
            const { default: __VLS_93 } = __VLS_89.slots;
            let __VLS_94;
            /** @ts-ignore @type {typeof ___VLS_components.Edit} */
            Edit;
            // @ts-ignore
            const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_96 = __VLS_95({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_95));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [];
            var __VLS_89;
            var __VLS_90;
        }
        else {
            let __VLS_99;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_100 = __VLS_asFunctionalComponent(__VLS_99, new __VLS_99({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Cancel",
            }));
            const __VLS_101 = __VLS_100({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Cancel",
            }, ...__VLS_functionalComponentArgsRest(__VLS_100));
            let __VLS_104;
            const __VLS_105 = ({ click: {} },
                { onClick: (__VLS_ctx.cancelPiniaFavoriteEdit) });
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
            const { default: __VLS_106 } = __VLS_102.slots;
            let __VLS_107;
            /** @ts-ignore @type {typeof ___VLS_components.X} */
            X;
            // @ts-ignore
            const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_109 = __VLS_108({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_108));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [cancelPiniaFavoriteEdit,];
            var __VLS_102;
            var __VLS_103;
            let __VLS_112;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Save",
                disabled: (!__VLS_ctx.editedPiniaFavoriteName.trim()),
            }));
            const __VLS_114 = __VLS_113({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Save",
                disabled: (!__VLS_ctx.editedPiniaFavoriteName.trim()),
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
            let __VLS_117;
            const __VLS_118 = ({ click: {} },
                { onClick: (__VLS_ctx.savePiniaFavoriteEdit) });
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
            const { default: __VLS_119 } = __VLS_115.slots;
            let __VLS_120;
            /** @ts-ignore @type {typeof ___VLS_components.Save} */
            Save;
            // @ts-ignore
            const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_122 = __VLS_121({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_121));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [editedPiniaFavoriteName, savePiniaFavoriteEdit,];
            var __VLS_115;
            var __VLS_116;
        }
    }
    else if ((__VLS_ctx.selectedItem.type === 'site-blacklist' || __VLS_ctx.selectedItem.type === 'site-whitelist') && __VLS_ctx.siteListDetailData) {
        if (!__VLS_ctx.siteListEditMode) {
            let __VLS_125;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Edit",
            }));
            const __VLS_127 = __VLS_126({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Edit",
            }, ...__VLS_functionalComponentArgsRest(__VLS_126));
            let __VLS_130;
            const __VLS_131 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                            return;
                        if (!(__VLS_ctx.selectedItem))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'breakpoint' || __VLS_ctx.selectedItem.type === 'mock'))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'pinia-favorite' && __VLS_ctx.piniaFavoriteData))
                            return;
                        if (!((__VLS_ctx.selectedItem.type === 'site-blacklist' || __VLS_ctx.selectedItem.type === 'site-whitelist') && __VLS_ctx.siteListDetailData))
                            return;
                        if (!(!__VLS_ctx.siteListEditMode))
                            return;
                        __VLS_ctx.emit('edit');
                        // @ts-ignore
                        [selectedItem, selectedItem, emit, siteListDetailData, siteListEditMode,];
                    } });
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
            const { default: __VLS_132 } = __VLS_128.slots;
            let __VLS_133;
            /** @ts-ignore @type {typeof ___VLS_components.Edit} */
            Edit;
            // @ts-ignore
            const __VLS_134 = __VLS_asFunctionalComponent(__VLS_133, new __VLS_133({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_135 = __VLS_134({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_134));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [];
            var __VLS_128;
            var __VLS_129;
        }
        else {
            let __VLS_138;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_139 = __VLS_asFunctionalComponent(__VLS_138, new __VLS_138({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Cancel",
            }));
            const __VLS_140 = __VLS_139({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Cancel",
            }, ...__VLS_functionalComponentArgsRest(__VLS_139));
            let __VLS_143;
            const __VLS_144 = ({ click: {} },
                { onClick: (__VLS_ctx.cancelSiteListEdit) });
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
            const { default: __VLS_145 } = __VLS_141.slots;
            let __VLS_146;
            /** @ts-ignore @type {typeof ___VLS_components.X} */
            X;
            // @ts-ignore
            const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_148 = __VLS_147({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_147));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [cancelSiteListEdit,];
            var __VLS_141;
            var __VLS_142;
            let __VLS_151;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Save",
                disabled: (!__VLS_ctx.editedSiteListPattern.trim()),
            }));
            const __VLS_153 = __VLS_152({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "icon",
                ...{ class: "h-7 w-7" },
                title: "Save",
                disabled: (!__VLS_ctx.editedSiteListPattern.trim()),
            }, ...__VLS_functionalComponentArgsRest(__VLS_152));
            let __VLS_156;
            const __VLS_157 = ({ click: {} },
                { onClick: (__VLS_ctx.saveSiteListEdit) });
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
            const { default: __VLS_158 } = __VLS_154.slots;
            let __VLS_159;
            /** @ts-ignore @type {typeof ___VLS_components.Save} */
            Save;
            // @ts-ignore
            const __VLS_160 = __VLS_asFunctionalComponent(__VLS_159, new __VLS_159({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_161 = __VLS_160({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_160));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [editedSiteListPattern, saveSiteListEdit,];
            var __VLS_154;
            var __VLS_155;
        }
    }
    let __VLS_164;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        ...{ class: "flex-1 min-h-0" },
    }));
    const __VLS_166 = __VLS_165({
        ...{ class: "flex-1 min-h-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    const { default: __VLS_169 } = __VLS_167.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-4 space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    if (__VLS_ctx.selectedItem.type === 'breakpoint' && __VLS_ctx.breakpointData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-mono text-sm break-all mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.formatBreakpointUrl(__VLS_ctx.breakpointData));
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-2 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.breakpointData.method || 'All');
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.breakpointData.active ? 'Active' : 'Disabled');
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-2 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.breakpointData.scheme);
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.breakpointData.host);
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-2 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        if (__VLS_ctx.breakpointData.port) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-sm font-mono mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.breakpointData.port);
        }
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.breakpointData.path);
        if (__VLS_ctx.breakpointData.query) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-sm font-mono mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.breakpointData.query);
        }
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (new Date(__VLS_ctx.breakpointData.timestamp).toLocaleString());
    }
    else if (__VLS_ctx.selectedItem.type === 'mock' && __VLS_ctx.mockData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-mono text-sm break-all mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.mockData.method ? __VLS_ctx.mockData.method + ' ' : '');
        (__VLS_ctx.mockData.scheme || '*');
        (__VLS_ctx.mockData.host || '*');
        (__VLS_ctx.mockData.port ? ':' + __VLS_ctx.mockData.port : '');
        (__VLS_ctx.mockData.path || '/*');
        (__VLS_ctx.mockData.query ? '?' + __VLS_ctx.mockData.query : '');
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-3 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1" },
            ...{ class: ({
                    'text-green-500': __VLS_ctx.mockData.status >= 200 && __VLS_ctx.mockData.status < 300,
                    'text-orange-500': __VLS_ctx.mockData.status >= 400 && __VLS_ctx.mockData.status < 500,
                    'text-red-500': __VLS_ctx.mockData.status >= 500
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-orange-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
        (__VLS_ctx.mockData.status);
        (__VLS_ctx.mockData.statusText || '');
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.mockData.delay ? __VLS_ctx.mockData.delay + 'ms' : 'None');
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.mockData.active ? 'Active' : 'Disabled');
        if (__VLS_ctx.mockData.headers?.length) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 space-y-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
            for (const [h, i] of __VLS_getVForSourceType((__VLS_ctx.mockData.headers))) {
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (i),
                    ...{ class: "font-mono text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                (h.name);
                (h.value);
                // @ts-ignore
                [selectedItem, selectedItem, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, breakpointData, formatBreakpointUrl, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData, mockData,];
            }
        }
        if (__VLS_ctx.mockData.body !== undefined) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            let __VLS_170;
            /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
            ScrollArea;
            // @ts-ignore
            const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
                ...{ class: "mt-1 rounded bg-muted/50 mock-body-scroll" },
            }));
            const __VLS_172 = __VLS_171({
                ...{ class: "mt-1 rounded bg-muted/50 mock-body-scroll" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_171));
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['mock-body-scroll']} */ ;
            const { default: __VLS_175 } = __VLS_173.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "text-xs font-mono p-2 whitespace-pre-wrap break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.mockData.body || '(empty)');
            // @ts-ignore
            [mockData, mockData,];
            var __VLS_173;
        }
        if (__VLS_ctx.mockData.description) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-sm mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.mockData.description);
        }
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (new Date(__VLS_ctx.mockData.timestamp).toLocaleString());
    }
    else if (__VLS_ctx.selectedItem.type === 'blacklist' && __VLS_ctx.blacklistData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-mono text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.blacklistData.name);
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.blacklistData.active ? 'Blocked' : 'Allowed');
    }
    else if (__VLS_ctx.selectedItem.type === 'favorite' && __VLS_ctx.favoriteData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-mono text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.favoriteData.name);
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-mono text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.favoriteData.tagName);
        (__VLS_ctx.favoriteData.className ? '.' + __VLS_ctx.favoriteData.className : '');
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (new Date(__VLS_ctx.favoriteData.timestamp).toLocaleString());
    }
    else if (__VLS_ctx.selectedItem.type === 'pinia-favorite' && __VLS_ctx.piniaFavoriteData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        if (__VLS_ctx.piniaFavoriteEditMode) {
            let __VLS_176;
            /** @ts-ignore @type {typeof ___VLS_components.Input} */
            Input;
            // @ts-ignore
            const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
                ...{ 'onKeydown': {} },
                modelValue: (__VLS_ctx.editedPiniaFavoriteName),
                ...{ class: "mt-1 font-mono" },
                placeholder: "Store name",
            }));
            const __VLS_178 = __VLS_177({
                ...{ 'onKeydown': {} },
                modelValue: (__VLS_ctx.editedPiniaFavoriteName),
                ...{ class: "mt-1 font-mono" },
                placeholder: "Store name",
            }, ...__VLS_functionalComponentArgsRest(__VLS_177));
            let __VLS_181;
            const __VLS_182 = ({ keydown: {} },
                { onKeydown: (__VLS_ctx.savePiniaFavoriteEdit) });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            var __VLS_179;
            var __VLS_180;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-mono text-sm mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.piniaFavoriteData.name);
        }
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (new Date(__VLS_ctx.piniaFavoriteData.timestamp).toLocaleString());
    }
    else if ((__VLS_ctx.selectedItem.type === 'site-blacklist' || __VLS_ctx.selectedItem.type === 'site-whitelist') && __VLS_ctx.siteListDetailData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        if (__VLS_ctx.siteListEditMode) {
            let __VLS_183;
            /** @ts-ignore @type {typeof ___VLS_components.Input} */
            Input;
            // @ts-ignore
            const __VLS_184 = __VLS_asFunctionalComponent(__VLS_183, new __VLS_183({
                ...{ 'onKeydown': {} },
                modelValue: (__VLS_ctx.editedSiteListPattern),
                ...{ class: "mt-1 font-mono" },
                placeholder: "Origin pattern",
            }));
            const __VLS_185 = __VLS_184({
                ...{ 'onKeydown': {} },
                modelValue: (__VLS_ctx.editedSiteListPattern),
                ...{ class: "mt-1 font-mono" },
                placeholder: "Origin pattern",
            }, ...__VLS_functionalComponentArgsRest(__VLS_184));
            let __VLS_188;
            const __VLS_189 = ({ keydown: {} },
                { onKeydown: (__VLS_ctx.saveSiteListEdit) });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            var __VLS_186;
            var __VLS_187;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-mono text-sm mt-1 break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.siteListDetailData.pattern);
        }
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (new Date(__VLS_ctx.siteListDetailData.addedAt).toLocaleString());
    }
    else if (__VLS_ctx.selectedItem.type === 'saved-file' && __VLS_ctx.savedFileData) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-2 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1 break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.savedFileData.name);
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.formatFileSize(__VLS_ctx.savedFileData.size));
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-mono mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.savedFileData.mimeType);
        if (__VLS_ctx.isImageFile(__VLS_ctx.savedFileData.mimeType)) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 rounded-lg border overflow-hidden bg-muted/20 flex items-center justify-center p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.img)({
                src: (__VLS_ctx.getFileUrl(__VLS_ctx.savedFileData)),
                alt: (__VLS_ctx.savedFileData.name),
                ...{ class: "max-w-full max-h-[300px] object-contain rounded" },
            });
            /** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-[300px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['object-contain']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
        }
        else if (__VLS_ctx.isAudioFile(__VLS_ctx.savedFileData.mimeType)) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.audio)({
                src: (__VLS_ctx.getFileUrl(__VLS_ctx.savedFileData)),
                controls: true,
                ...{ class: "w-full mt-2" },
            });
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        }
        else if (__VLS_ctx.isVideoFile(__VLS_ctx.savedFileData.mimeType)) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.video)({
                src: (__VLS_ctx.getFileUrl(__VLS_ctx.savedFileData)),
                controls: true,
                ...{ class: "w-full mt-2 rounded-lg max-h-[300px]" },
            });
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-[300px]']} */ ;
        }
        else if (__VLS_ctx.isTextFile(__VLS_ctx.savedFileData.mimeType)) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            let __VLS_190;
            /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
            ScrollArea;
            // @ts-ignore
            const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
                ...{ class: "mt-2 rounded bg-muted/50 saved-file-text-scroll" },
            }));
            const __VLS_192 = __VLS_191({
                ...{ class: "mt-2 rounded bg-muted/50 saved-file-text-scroll" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_191));
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['saved-file-text-scroll']} */ ;
            const { default: __VLS_195 } = __VLS_193.slots;
            __VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "text-xs font-mono p-3 whitespace-pre-wrap break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.textPreviewContent);
            // @ts-ignore
            [selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, selectedItem, piniaFavoriteData, piniaFavoriteData, piniaFavoriteData, piniaFavoriteEditMode, editedPiniaFavoriteName, savePiniaFavoriteEdit, siteListDetailData, siteListDetailData, siteListDetailData, siteListEditMode, editedSiteListPattern, saveSiteListEdit, mockData, mockData, mockData, blacklistData, blacklistData, blacklistData, favoriteData, favoriteData, favoriteData, favoriteData, favoriteData, favoriteData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, formatFileSize, isImageFile, getFileUrl, getFileUrl, getFileUrl, isAudioFile, isVideoFile, isTextFile, textPreviewContent,];
            var __VLS_193;
        }
        else if (__VLS_ctx.savedFileData.mimeType === 'application/pdf') {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.iframe)({
                src: (__VLS_ctx.getFileUrl(__VLS_ctx.savedFileData)),
                ...{ class: "w-full h-[300px] mt-2 rounded-lg border" },
            });
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-[300px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
        }
        else if (__VLS_ctx.isOfficeFile(__VLS_ctx.savedFileData.mimeType)) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 rounded-lg border bg-muted/20 overflow-hidden" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col items-center justify-center py-8 px-4 gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            const __VLS_196 = (__VLS_ctx.savedFileData.mimeType.includes('sheet') || __VLS_ctx.savedFileData.mimeType.includes('excel') ? __VLS_ctx.FileSpreadsheet : __VLS_ctx.FileText);
            // @ts-ignore
            const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
                ...{ class: "h-12 w-12 text-muted-foreground/60" },
            }));
            const __VLS_198 = __VLS_197({
                ...{ class: "h-12 w-12 text-muted-foreground/60" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_197));
            /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground/60']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-center" },
            });
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-sm font-medium" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (__VLS_ctx.getOfficeFileLabel(__VLS_ctx.savedFileData.mimeType));
            __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-xs text-muted-foreground mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.savedFileData.name);
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex gap-2 mt-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            if (__VLS_ctx.officeBlobUrl) {
                let __VLS_201;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_202 = __VLS_asFunctionalComponent(__VLS_201, new __VLS_201({
                    variant: "outline",
                    size: "sm",
                    ...{ class: "gap-1.5 text-xs" },
                    as: "a",
                    href: (__VLS_ctx.officeBlobUrl),
                    target: "_blank",
                }));
                const __VLS_203 = __VLS_202({
                    variant: "outline",
                    size: "sm",
                    ...{ class: "gap-1.5 text-xs" },
                    as: "a",
                    href: (__VLS_ctx.officeBlobUrl),
                    target: "_blank",
                }, ...__VLS_functionalComponentArgsRest(__VLS_202));
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                const { default: __VLS_206 } = __VLS_204.slots;
                // @ts-ignore
                [savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, savedFileData, getFileUrl, isOfficeFile, FileSpreadsheet, FileText, getOfficeFileLabel, officeBlobUrl, officeBlobUrl,];
                var __VLS_204;
            }
            let __VLS_207;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_208 = __VLS_asFunctionalComponent(__VLS_207, new __VLS_207({
                ...{ 'onClick': {} },
                variant: "outline",
                size: "sm",
                ...{ class: "gap-1.5 text-xs" },
            }));
            const __VLS_209 = __VLS_208({
                ...{ 'onClick': {} },
                variant: "outline",
                size: "sm",
                ...{ class: "gap-1.5 text-xs" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_208));
            let __VLS_212;
            const __VLS_213 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.releaseInfo && !__VLS_ctx.selectedItem))
                            return;
                        if (!(__VLS_ctx.selectedItem))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'breakpoint' && __VLS_ctx.breakpointData))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'mock' && __VLS_ctx.mockData))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'blacklist' && __VLS_ctx.blacklistData))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'favorite' && __VLS_ctx.favoriteData))
                            return;
                        if (!!(__VLS_ctx.selectedItem.type === 'pinia-favorite' && __VLS_ctx.piniaFavoriteData))
                            return;
                        if (!!((__VLS_ctx.selectedItem.type === 'site-blacklist' || __VLS_ctx.selectedItem.type === 'site-whitelist') && __VLS_ctx.siteListDetailData))
                            return;
                        if (!(__VLS_ctx.selectedItem.type === 'saved-file' && __VLS_ctx.savedFileData))
                            return;
                        if (!!(__VLS_ctx.isImageFile(__VLS_ctx.savedFileData.mimeType)))
                            return;
                        if (!!(__VLS_ctx.isAudioFile(__VLS_ctx.savedFileData.mimeType)))
                            return;
                        if (!!(__VLS_ctx.isVideoFile(__VLS_ctx.savedFileData.mimeType)))
                            return;
                        if (!!(__VLS_ctx.isTextFile(__VLS_ctx.savedFileData.mimeType)))
                            return;
                        if (!!(__VLS_ctx.savedFileData.mimeType === 'application/pdf'))
                            return;
                        if (!(__VLS_ctx.isOfficeFile(__VLS_ctx.savedFileData.mimeType)))
                            return;
                        __VLS_ctx.downloadSavedFile(__VLS_ctx.savedFileData);
                        // @ts-ignore
                        [savedFileData, downloadSavedFile,];
                    } });
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            const { default: __VLS_214 } = __VLS_210.slots;
            let __VLS_215;
            /** @ts-ignore @type {typeof ___VLS_components.Download} */
            Download;
            // @ts-ignore
            const __VLS_216 = __VLS_asFunctionalComponent(__VLS_215, new __VLS_215({
                ...{ class: "h-3.5 w-3.5" },
            }));
            const __VLS_217 = __VLS_216({
                ...{ class: "h-3.5 w-3.5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_216));
            /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
            // @ts-ignore
            [];
            var __VLS_210;
            var __VLS_211;
        }
        else if (__VLS_ctx.savedFileData.mimeType === 'image/svg+xml') {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 rounded-lg border overflow-hidden bg-muted/20 flex items-center justify-center p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.img)({
                src: (__VLS_ctx.getFileUrl(__VLS_ctx.savedFileData)),
                alt: (__VLS_ctx.savedFileData.name),
                ...{ class: "max-w-full max-h-[300px] object-contain" },
            });
            /** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-[300px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['object-contain']} */ ;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-center py-8 text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    // @ts-ignore
    [savedFileData, savedFileData, savedFileData, getFileUrl,];
    var __VLS_167;
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
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=SettingsDetails.vue.js.map