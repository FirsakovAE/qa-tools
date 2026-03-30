import { ref, computed, watch, onMounted, nextTick, onUnmounted, defineAsyncComponent } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { ArrowLeft, Copy, Check, Send, MoreHorizontal } from 'lucide-vue-next';
import { useEscapeClose } from '@/composables/useEscapeClose';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { ContextMenu, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { NetworkActionsMenuContent } from '@/components/NetworkActionsMenu';
/** Lazy load JsonEditor (Prism, tree) - only when user opens Request/Response tab */
const JsonEditor = defineAsyncComponent({
    loader: () => import('@/components/JsonEditor.vue'),
    loadingComponent: {
        template: '<div class="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>'
    },
    delay: 100
});
import { getStatusCategory, formatBytes, formatDuration } from '@/types/network';
import { copyToClipboard } from '@/utils/networkUtils';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { useCurlCopy } from '@/composables/useCurlCopy';
import { formatBodyForDisplay, detectLanguage } from './utils';
import { useBreakpointEditor, useFormDataEditor, } from './composables';
const props = defineProps();
const emit = defineEmits();
// ============================================================================
// Composables
// ============================================================================
const emitUpdateDraft = (updates) => emit('updateDraft', updates);
const formData = useFormDataEditor({
    entry: () => props.entry,
    emitUpdateDraft,
    editableRequestBody: () => editor.editableRequestBody.value,
    settings: () => settings.value,
});
const editor = useBreakpointEditor({
    entry: () => props.entry,
    breakpointMode: () => props.breakpointMode,
    breakpointTrigger: () => props.breakpointTrigger,
    breakpointDraft: () => props.breakpointDraft,
    emitUpdateDraft,
    bodyFormatMode: formData.bodyFormatMode,
    editableFormData: formData.editableFormData,
    serializeFormDataToDraft: formData.serializeFormDataToDraft,
});
const { activeSection, editableMethod, editableScheme, editableHost, editablePath, editableParams, editableRequestHeaders, editableResponseHeaders, editableRequestBody, editableResponseBody, canEditRequest, canEditResponse, methodAllowsBody, displayMethod, displayUrl, fullUrlPreview, updateUrlField, updateRequestHeader, updateResponseHeader, updateParam, addParam, removeParam, removeAllParams, addRequestHeader, removeRequestHeader, removeAllRequestHeaders, updateRequestBody, updateResponseBody, buildApplyData, } = editor;
const { bodyFormatMode, editableFormData, copiedFormDataIndex, isFormDataBody, readonlyFormData, hasFileOptions, updateFormDataField, addFormDataEntry, removeFormDataEntry, removeAllFormDataEntries, copyFormDataValue, handleBodyFormatChange, handleFileSelected, getFileDisplayLabel, getFileOptions, getSelectedFileOption, selectFileOption, } = formData;
// ============================================================================
// Local UI state
// ============================================================================
const settings = useInspectorSettingsSync();
const jsonMode = ref('text');
const copiedHeaderIndex = ref(null);
const copiedResponseHeaderIndex = ref(null);
const { curlCopied, copyCurl: copyCurlCommand } = useCurlCopy();
const urlRef = ref(null);
const urlContainerRef = ref(null);
const isUrlTruncated = ref(false);
function checkUrlTruncation() {
    if (!urlRef.value)
        return;
    isUrlTruncated.value = urlRef.value.scrollWidth > urlRef.value.clientWidth;
}
const debouncedCheckUrlTruncation = useDebounceFn(checkUrlTruncation, 50);
let urlResizeObserver = null;
watch(settings, (s) => {
    if (s)
        jsonMode.value = s.json?.mode ?? 'text';
}, { immediate: true });
onMounted(() => {
    nextTick(() => {
        checkUrlTruncation();
        if (urlContainerRef.value) {
            urlResizeObserver = new ResizeObserver(() => debouncedCheckUrlTruncation());
            urlResizeObserver.observe(urlContainerRef.value);
        }
    });
});
onUnmounted(() => urlResizeObserver?.disconnect());
watch(() => ({ id: props.entry?.id, url: displayUrl.value }), () => nextTick(checkUrlTruncation), { immediate: false });
const sections = computed(() => {
    const baseSections = [
        { id: 'params', label: 'Params' },
        { id: 'headers', label: 'Headers' },
        { id: 'request', label: 'Request' },
        { id: 'response', label: 'Response' }
    ];
    if (canEditRequest.value) {
        return [{ id: 'url', label: 'URL' }, ...baseSections];
    }
    return baseSections;
});
const statusClass = computed(() => {
    if (props.entry.pending)
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    const category = getStatusCategory(props.entry.status);
    switch (category) {
        case 'success': return 'bg-green-500/20 text-green-500 border-green-500/30';
        case 'redirect': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
        case 'client-error': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
        case 'server-error': return 'bg-red-500/20 text-red-500 border-red-500/30';
        default: return 'bg-red-500/20 text-red-500 border-red-500/30';
    }
});
const LARGE_BODY_THRESHOLD = 200 * 1024;
const requestBodyJson = computed(() => {
    if (!props.entry.requestBody?.text)
        return '';
    if (isFormDataBody.value)
        return '';
    const raw = props.entry.requestBody.text;
    if (raw.length > LARGE_BODY_THRESHOLD)
        return raw;
    return formatBodyForDisplay(raw, props.entry.requestBody.contentType);
});
const responseBodyJson = computed(() => {
    if (!props.entry.responseBody?.text)
        return '';
    const raw = props.entry.responseBody.text;
    if (raw.length > LARGE_BODY_THRESHOLD)
        return raw;
    return formatBodyForDisplay(raw, props.entry.responseBody.contentType);
});
const requestBodyLanguage = computed(() => detectLanguage(props.entry.requestBody?.contentType));
const responseBodyLanguage = computed(() => detectLanguage(props.entry.responseBody?.contentType));
const xRequestId = computed(() => {
    const header = props.entry.responseHeaders.find(h => h.name.toLowerCase() === 'x-request-id');
    return header?.value || null;
});
// ============================================================================
// Handlers
// ============================================================================
function handleBack() {
    if (props.breakpointMode) {
        emit('cancelBreakpoint', props.entry.id);
    }
    else {
        emit('back');
    }
}
useEscapeClose(computed(() => true), handleBack);
function handleApplyBreakpoint() {
    if (!props.breakpointMode)
        return;
    emit('applyBreakpoint', buildApplyData());
}
watch(() => ({ id: props.entry?.id, version: props.entry?.version ?? 1 }), (newVal, oldVal) => {
    if (!newVal.id)
        return;
    if (newVal.id !== oldVal?.id) {
        curlCopied.value = false;
        copiedHeaderIndex.value = null;
        copiedResponseHeaderIndex.value = null;
        if (!props.breakpointMode) {
            activeSection.value = 'response';
        }
    }
}, { immediate: true });
async function copyHeaderValue(value, index, isResponse = false) {
    const success = await copyToClipboard(value);
    if (success) {
        if (isResponse) {
            copiedResponseHeaderIndex.value = index;
            setTimeout(() => { copiedResponseHeaderIndex.value = null; }, 2000);
        }
        else {
            copiedHeaderIndex.value = index;
            setTimeout(() => { copiedHeaderIndex.value = null; }, 2000);
        }
    }
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
/** @type {__VLS_StyleScopedClasses['network-headers-table']} */ ;
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
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
ContextMenu;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({}));
const __VLS_9 = __VLS_8({}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
ContextMenuTrigger;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    asChild: true,
}));
const __VLS_15 = __VLS_14({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
const { default: __VLS_18 } = __VLS_16.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex items-center gap-3 p-3 border-b" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
let __VLS_19;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}));
const __VLS_21 = __VLS_20({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
let __VLS_24;
const __VLS_25 = ({ click: {} },
    { onClick: (__VLS_ctx.handleBack) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_26 } = __VLS_22.slots;
let __VLS_27;
/** @ts-ignore @type {typeof ___VLS_components.ArrowLeft} */
ArrowLeft;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
    ...{ class: "h-4 w-4" },
}));
const __VLS_29 = __VLS_28({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[handleBack,];
var __VLS_22;
var __VLS_23;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "urlContainerRef",
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
let __VLS_32;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    variant: "outline",
    ...{ class: "font-mono text-xs" },
    ...{ class: ({ 'text-amber-500 border-amber-500/50': __VLS_ctx.breakpointMode && __VLS_ctx.editableMethod !== __VLS_ctx.entry.method }) },
}));
const __VLS_34 = __VLS_33({
    variant: "outline",
    ...{ class: "font-mono text-xs" },
    ...{ class: ({ 'text-amber-500 border-amber-500/50': __VLS_ctx.breakpointMode && __VLS_ctx.editableMethod !== __VLS_ctx.entry.method }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-500/50']} */ ;
const { default: __VLS_37 } = __VLS_35.slots;
(__VLS_ctx.displayMethod);
// @ts-ignore
[breakpointMode, editableMethod, entry, displayMethod,];
var __VLS_35;
let __VLS_38;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
    variant: "outline",
    ...{ class: (__VLS_ctx.statusClass) },
    ...{ class: "font-mono text-xs" },
}));
const __VLS_40 = __VLS_39({
    variant: "outline",
    ...{ class: (__VLS_ctx.statusClass) },
    ...{ class: "font-mono text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_43 } = __VLS_41.slots;
(__VLS_ctx.entry.pending ? '⏳ Pending' : __VLS_ctx.entry.status);
// @ts-ignore
[entry, entry, statusClass,];
var __VLS_41;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
(__VLS_ctx.formatDuration(__VLS_ctx.entry.duration));
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
(__VLS_ctx.formatBytes(__VLS_ctx.entry.size));
if (__VLS_ctx.breakpointMode) {
    let __VLS_44;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        variant: "outline",
        ...{ class: "text-xs text-amber-500 border-amber-500/50" },
    }));
    const __VLS_46 = __VLS_45({
        variant: "outline",
        ...{ class: "text-xs text-amber-500 border-amber-500/50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/50']} */ ;
    const { default: __VLS_49 } = __VLS_47.slots;
    // @ts-ignore
    [breakpointMode, entry, entry, formatDuration, formatBytes,];
    var __VLS_47;
}
if (__VLS_ctx.isUrlTruncated) {
    let __VLS_50;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({}));
    const __VLS_52 = __VLS_51({}, ...__VLS_functionalComponentArgsRest(__VLS_51));
    const { default: __VLS_55 } = __VLS_53.slots;
    let __VLS_56;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        asChild: true,
    }));
    const __VLS_58 = __VLS_57({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    const { default: __VLS_61 } = __VLS_59.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "urlRef",
        ...{ class: "text-sm truncate text-muted-foreground cursor-default" },
        ...{ class: ({ 'text-amber-500': __VLS_ctx.breakpointMode && __VLS_ctx.displayUrl !== __VLS_ctx.entry.url }) },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    (__VLS_ctx.displayUrl);
    // @ts-ignore
    [breakpointMode, entry, isUrlTruncated, displayUrl, displayUrl,];
    var __VLS_59;
    let __VLS_62;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
        side: "bottom",
        ...{ class: "max-w-[90vw] break-all font-mono text-xs" },
    }));
    const __VLS_64 = __VLS_63({
        side: "bottom",
        ...{ class: "max-w-[90vw] break-all font-mono text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    /** @type {__VLS_StyleScopedClasses['max-w-[90vw]']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_67 } = __VLS_65.slots;
    (__VLS_ctx.displayUrl);
    // @ts-ignore
    [displayUrl,];
    var __VLS_65;
    // @ts-ignore
    [];
    var __VLS_53;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "urlRef",
        ...{ class: "text-sm truncate text-muted-foreground" },
        ...{ class: ({ 'text-amber-500': __VLS_ctx.breakpointMode && __VLS_ctx.displayUrl !== __VLS_ctx.entry.url }) },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    (__VLS_ctx.displayUrl);
}
let __VLS_68;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({}));
const __VLS_70 = __VLS_69({}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const { default: __VLS_73 } = __VLS_71.slots;
let __VLS_74;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
    asChild: true,
}));
const __VLS_76 = __VLS_75({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_75));
const { default: __VLS_79 } = __VLS_77.slots;
let __VLS_80;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "details-header-copy-curl h-8 shrink-0 text-xs gap-1.5 transition-colors" },
    ...{ class: ({ 'text-green-500 border-green-500/50': __VLS_ctx.curlCopied }) },
}));
const __VLS_82 = __VLS_81({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "details-header-copy-curl h-8 shrink-0 text-xs gap-1.5 transition-colors" },
    ...{ class: ({ 'text-green-500 border-green-500/50': __VLS_ctx.curlCopied }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
let __VLS_85;
const __VLS_86 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.copyCurlCommand(props.entry);
            // @ts-ignore
            [breakpointMode, entry, displayUrl, displayUrl, curlCopied, copyCurlCommand,];
        } });
/** @type {__VLS_StyleScopedClasses['details-header-copy-curl']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-green-500/50']} */ ;
const { default: __VLS_87 } = __VLS_83.slots;
const __VLS_88 = (__VLS_ctx.curlCopied ? __VLS_ctx.Check : __VLS_ctx.Copy);
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ class: "h-3.5 w-3.5" },
}));
const __VLS_90 = __VLS_89({
    ...{ class: "h-3.5 w-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
(__VLS_ctx.curlCopied ? 'Copied!' : 'Copy cURL');
// @ts-ignore
[curlCopied, curlCopied, Check, Copy,];
var __VLS_83;
var __VLS_84;
// @ts-ignore
[];
var __VLS_77;
let __VLS_93;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
    side: "bottom",
}));
const __VLS_95 = __VLS_94({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_94));
const { default: __VLS_98 } = __VLS_96.slots;
// @ts-ignore
[];
var __VLS_96;
// @ts-ignore
[];
var __VLS_71;
let __VLS_99;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
DropdownMenu;
// @ts-ignore
const __VLS_100 = __VLS_asFunctionalComponent(__VLS_99, new __VLS_99({}));
const __VLS_101 = __VLS_100({}, ...__VLS_functionalComponentArgsRest(__VLS_100));
const { default: __VLS_104 } = __VLS_102.slots;
let __VLS_105;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
DropdownMenuTrigger;
// @ts-ignore
const __VLS_106 = __VLS_asFunctionalComponent(__VLS_105, new __VLS_105({
    asChild: true,
}));
const __VLS_107 = __VLS_106({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_106));
const { default: __VLS_110 } = __VLS_108.slots;
let __VLS_111;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
    variant: "outline",
    size: "icon",
    ...{ class: "details-header-actions-menu h-8 w-8 shrink-0" },
}));
const __VLS_113 = __VLS_112({
    variant: "outline",
    size: "icon",
    ...{ class: "details-header-actions-menu h-8 w-8 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_112));
/** @type {__VLS_StyleScopedClasses['details-header-actions-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const { default: __VLS_116 } = __VLS_114.slots;
let __VLS_117;
/** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
MoreHorizontal;
// @ts-ignore
const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({
    ...{ class: "h-4 w-4" },
}));
const __VLS_119 = __VLS_118({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_118));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[];
var __VLS_114;
// @ts-ignore
[];
var __VLS_108;
let __VLS_122;
/** @ts-ignore @type {typeof ___VLS_components.NetworkActionsMenuContent} */
NetworkActionsMenuContent;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
    ...{ 'onCopyCurl': {} },
    ...{ 'onSetBreakpoint': {} },
    ...{ 'onMockResponse': {} },
    ...{ 'onToggleBreakpoint': {} },
    ...{ 'onDeleteBreakpoint': {} },
    ...{ 'onToggleMock': {} },
    ...{ 'onDeleteMock': {} },
    variant: "dropdown",
    entry: (props.entry),
    breakpointMatchingIds: (props.breakpointMatchingIds),
    mockMatchingIds: (props.mockMatchingIds),
    allBreakpoints: (props.allBreakpoints),
    allMocks: (props.allMocks),
}));
const __VLS_124 = __VLS_123({
    ...{ 'onCopyCurl': {} },
    ...{ 'onSetBreakpoint': {} },
    ...{ 'onMockResponse': {} },
    ...{ 'onToggleBreakpoint': {} },
    ...{ 'onDeleteBreakpoint': {} },
    ...{ 'onToggleMock': {} },
    ...{ 'onDeleteMock': {} },
    variant: "dropdown",
    entry: (props.entry),
    breakpointMatchingIds: (props.breakpointMatchingIds),
    mockMatchingIds: (props.mockMatchingIds),
    allBreakpoints: (props.allBreakpoints),
    allMocks: (props.allMocks),
}, ...__VLS_functionalComponentArgsRest(__VLS_123));
let __VLS_127;
const __VLS_128 = ({ copyCurl: {} },
    { onCopyCurl: (...[$event]) => {
            __VLS_ctx.emit('copyCurl', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_129 = ({ setBreakpoint: {} },
    { onSetBreakpoint: (...[$event]) => {
            __VLS_ctx.emit('setBreakpoint', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_130 = ({ mockResponse: {} },
    { onMockResponse: (...[$event]) => {
            __VLS_ctx.emit('mockResponse', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_131 = ({ toggleBreakpoint: {} },
    { onToggleBreakpoint: (...[$event]) => {
            __VLS_ctx.emit('toggleBreakpoint', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_132 = ({ deleteBreakpoint: {} },
    { onDeleteBreakpoint: (...[$event]) => {
            __VLS_ctx.emit('deleteBreakpoint', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_133 = ({ toggleMock: {} },
    { onToggleMock: (...[$event]) => {
            __VLS_ctx.emit('toggleMock', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_134 = ({ deleteMock: {} },
    { onDeleteMock: (...[$event]) => {
            __VLS_ctx.emit('deleteMock', $event);
            // @ts-ignore
            [emit,];
        } });
var __VLS_125;
var __VLS_126;
// @ts-ignore
[];
var __VLS_102;
if (__VLS_ctx.breakpointMode) {
    let __VLS_135;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({}));
    const __VLS_137 = __VLS_136({}, ...__VLS_functionalComponentArgsRest(__VLS_136));
    const { default: __VLS_140 } = __VLS_138.slots;
    let __VLS_141;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_142 = __VLS_asFunctionalComponent(__VLS_141, new __VLS_141({
        asChild: true,
    }));
    const __VLS_143 = __VLS_142({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_142));
    const { default: __VLS_146 } = __VLS_144.slots;
    let __VLS_147;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_148 = __VLS_asFunctionalComponent(__VLS_147, new __VLS_147({
        ...{ 'onClick': {} },
        variant: "default",
        size: "sm",
        ...{ class: "h-8 shrink-0 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600" },
    }));
    const __VLS_149 = __VLS_148({
        ...{ 'onClick': {} },
        variant: "default",
        size: "sm",
        ...{ class: "h-8 shrink-0 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_148));
    let __VLS_152;
    const __VLS_153 = ({ click: {} },
        { onClick: (__VLS_ctx.handleApplyBreakpoint) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-amber-600']} */ ;
    const { default: __VLS_154 } = __VLS_150.slots;
    let __VLS_155;
    /** @ts-ignore @type {typeof ___VLS_components.Send} */
    Send;
    // @ts-ignore
    const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
        ...{ class: "h-3.5 w-3.5" },
    }));
    const __VLS_157 = __VLS_156({
        ...{ class: "h-3.5 w-3.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_156));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    // @ts-ignore
    [breakpointMode, handleApplyBreakpoint,];
    var __VLS_150;
    var __VLS_151;
    // @ts-ignore
    [];
    var __VLS_144;
    let __VLS_160;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        side: "bottom",
    }));
    const __VLS_162 = __VLS_161({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    const { default: __VLS_165 } = __VLS_163.slots;
    // @ts-ignore
    [];
    var __VLS_163;
    // @ts-ignore
    [];
    var __VLS_138;
}
// @ts-ignore
[];
var __VLS_16;
let __VLS_166;
/** @ts-ignore @type {typeof ___VLS_components.NetworkActionsMenuContent} */
NetworkActionsMenuContent;
// @ts-ignore
const __VLS_167 = __VLS_asFunctionalComponent(__VLS_166, new __VLS_166({
    ...{ 'onCopyCurl': {} },
    ...{ 'onSetBreakpoint': {} },
    ...{ 'onMockResponse': {} },
    ...{ 'onToggleBreakpoint': {} },
    ...{ 'onDeleteBreakpoint': {} },
    ...{ 'onToggleMock': {} },
    ...{ 'onDeleteMock': {} },
    variant: "context",
    entry: (props.entry),
    breakpointMatchingIds: (props.breakpointMatchingIds),
    mockMatchingIds: (props.mockMatchingIds),
    allBreakpoints: (props.allBreakpoints),
    allMocks: (props.allMocks),
}));
const __VLS_168 = __VLS_167({
    ...{ 'onCopyCurl': {} },
    ...{ 'onSetBreakpoint': {} },
    ...{ 'onMockResponse': {} },
    ...{ 'onToggleBreakpoint': {} },
    ...{ 'onDeleteBreakpoint': {} },
    ...{ 'onToggleMock': {} },
    ...{ 'onDeleteMock': {} },
    variant: "context",
    entry: (props.entry),
    breakpointMatchingIds: (props.breakpointMatchingIds),
    mockMatchingIds: (props.mockMatchingIds),
    allBreakpoints: (props.allBreakpoints),
    allMocks: (props.allMocks),
}, ...__VLS_functionalComponentArgsRest(__VLS_167));
let __VLS_171;
const __VLS_172 = ({ copyCurl: {} },
    { onCopyCurl: (...[$event]) => {
            __VLS_ctx.emit('copyCurl', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_173 = ({ setBreakpoint: {} },
    { onSetBreakpoint: (...[$event]) => {
            __VLS_ctx.emit('setBreakpoint', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_174 = ({ mockResponse: {} },
    { onMockResponse: (...[$event]) => {
            __VLS_ctx.emit('mockResponse', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_175 = ({ toggleBreakpoint: {} },
    { onToggleBreakpoint: (...[$event]) => {
            __VLS_ctx.emit('toggleBreakpoint', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_176 = ({ deleteBreakpoint: {} },
    { onDeleteBreakpoint: (...[$event]) => {
            __VLS_ctx.emit('deleteBreakpoint', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_177 = ({ toggleMock: {} },
    { onToggleMock: (...[$event]) => {
            __VLS_ctx.emit('toggleMock', $event);
            // @ts-ignore
            [emit,];
        } });
const __VLS_178 = ({ deleteMock: {} },
    { onDeleteMock: (...[$event]) => {
            __VLS_ctx.emit('deleteMock', $event);
            // @ts-ignore
            [emit,];
        } });
var __VLS_169;
var __VLS_170;
// @ts-ignore
[];
var __VLS_10;
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
                [sections, activeSection,];
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
if (__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest) {
    let __VLS_179;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_180 = __VLS_asFunctionalComponent(__VLS_179, new __VLS_179({
        ...{ class: "h-full" },
    }));
    const __VLS_181 = __VLS_180({
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_180));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    const { default: __VLS_184 } = __VLS_182.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 bg-amber-500/10 border border-amber-500/30 rounded-md" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-amber-600 dark:text-amber-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-amber-400']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-2 gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_185;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
        ...{ class: "text-xs" },
    }));
    const __VLS_187 = __VLS_186({
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_186));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_190 } = __VLS_188.slots;
    // @ts-ignore
    [activeSection, canEditRequest,];
    var __VLS_188;
    let __VLS_191;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_192 = __VLS_asFunctionalComponent(__VLS_191, new __VLS_191({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editableMethod),
        placeholder: "GET",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_193 = __VLS_192({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editableMethod),
        placeholder: "GET",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_192));
    let __VLS_196;
    const __VLS_197 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                    return;
                __VLS_ctx.updateUrlField('method', String($event));
                // @ts-ignore
                [editableMethod, updateUrlField,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    var __VLS_194;
    var __VLS_195;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_198;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
        ...{ class: "text-xs" },
    }));
    const __VLS_200 = __VLS_199({
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_199));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_203 } = __VLS_201.slots;
    // @ts-ignore
    [];
    var __VLS_201;
    let __VLS_204;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editableScheme),
        placeholder: "https",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_206 = __VLS_205({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editableScheme),
        placeholder: "https",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    let __VLS_209;
    const __VLS_210 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                    return;
                __VLS_ctx.updateUrlField('scheme', String($event));
                // @ts-ignore
                [updateUrlField, editableScheme,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    var __VLS_207;
    var __VLS_208;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_211;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_212 = __VLS_asFunctionalComponent(__VLS_211, new __VLS_211({
        ...{ class: "text-xs" },
    }));
    const __VLS_213 = __VLS_212({
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_212));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_216 } = __VLS_214.slots;
    // @ts-ignore
    [];
    var __VLS_214;
    let __VLS_217;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_218 = __VLS_asFunctionalComponent(__VLS_217, new __VLS_217({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editableHost),
        placeholder: "api.example.com",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_219 = __VLS_218({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editableHost),
        placeholder: "api.example.com",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_218));
    let __VLS_222;
    const __VLS_223 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                    return;
                __VLS_ctx.updateUrlField('host', String($event));
                // @ts-ignore
                [updateUrlField, editableHost,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    var __VLS_220;
    var __VLS_221;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_224;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
        ...{ class: "text-xs" },
    }));
    const __VLS_226 = __VLS_225({
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_229 } = __VLS_227.slots;
    // @ts-ignore
    [];
    var __VLS_227;
    let __VLS_230;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_231 = __VLS_asFunctionalComponent(__VLS_230, new __VLS_230({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editablePath),
        placeholder: "/api/v1/users",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_232 = __VLS_231({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.editablePath),
        placeholder: "/api/v1/users",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_231));
    let __VLS_235;
    const __VLS_236 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                    return;
                __VLS_ctx.updateUrlField('path', String($event));
                // @ts-ignore
                [updateUrlField, editablePath,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    var __VLS_233;
    var __VLS_234;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 bg-muted/50 rounded-md" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    let __VLS_237;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_238 = __VLS_asFunctionalComponent(__VLS_237, new __VLS_237({
        ...{ class: "text-xs text-muted-foreground" },
    }));
    const __VLS_239 = __VLS_238({
        ...{ class: "text-xs text-muted-foreground" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_238));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    const { default: __VLS_242 } = __VLS_240.slots;
    // @ts-ignore
    [];
    var __VLS_240;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-mono text-sm mt-1 break-all" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    (__VLS_ctx.fullUrlPreview);
    // @ts-ignore
    [fullUrlPreview,];
    var __VLS_182;
}
else if (__VLS_ctx.activeSection === 'params') {
    let __VLS_243;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_244 = __VLS_asFunctionalComponent(__VLS_243, new __VLS_243({
        ...{ class: "h-full" },
    }));
    const __VLS_245 = __VLS_244({
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_244));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    const { default: __VLS_248 } = __VLS_246.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.canEditRequest) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
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
        let __VLS_249;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_250 = __VLS_asFunctionalComponent(__VLS_249, new __VLS_249({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
            disabled: (__VLS_ctx.editableParams.length === 0),
        }));
        const __VLS_251 = __VLS_250({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
            disabled: (__VLS_ctx.editableParams.length === 0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_250));
        let __VLS_254;
        const __VLS_255 = ({ click: {} },
            { onClick: (__VLS_ctx.removeAllParams) });
        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
        const { default: __VLS_256 } = __VLS_252.slots;
        // @ts-ignore
        [activeSection, canEditRequest, editableParams, removeAllParams,];
        var __VLS_252;
        var __VLS_253;
        let __VLS_257;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_258 = __VLS_asFunctionalComponent(__VLS_257, new __VLS_257({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs" },
        }));
        const __VLS_259 = __VLS_258({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_258));
        let __VLS_262;
        const __VLS_263 = ({ click: {} },
            { onClick: (__VLS_ctx.addParam) });
        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        const { default: __VLS_264 } = __VLS_260.slots;
        // @ts-ignore
        [addParam,];
        var __VLS_260;
        var __VLS_261;
    }
    if ((__VLS_ctx.canEditRequest ? __VLS_ctx.editableParams : __VLS_ctx.entry.params).length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm text-muted-foreground text-center py-8" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
    }
    else {
        let __VLS_265;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_266 = __VLS_asFunctionalComponent(__VLS_265, new __VLS_265({}));
        const __VLS_267 = __VLS_266({}, ...__VLS_functionalComponentArgsRest(__VLS_266));
        const { default: __VLS_270 } = __VLS_268.slots;
        let __VLS_271;
        /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
        TableHeader;
        // @ts-ignore
        const __VLS_272 = __VLS_asFunctionalComponent(__VLS_271, new __VLS_271({}));
        const __VLS_273 = __VLS_272({}, ...__VLS_functionalComponentArgsRest(__VLS_272));
        const { default: __VLS_276 } = __VLS_274.slots;
        let __VLS_277;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_278 = __VLS_asFunctionalComponent(__VLS_277, new __VLS_277({}));
        const __VLS_279 = __VLS_278({}, ...__VLS_functionalComponentArgsRest(__VLS_278));
        const { default: __VLS_282 } = __VLS_280.slots;
        let __VLS_283;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_284 = __VLS_asFunctionalComponent(__VLS_283, new __VLS_283({
            ...{ class: "w-1/3" },
        }));
        const __VLS_285 = __VLS_284({
            ...{ class: "w-1/3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_284));
        /** @type {__VLS_StyleScopedClasses['w-1/3']} */ ;
        const { default: __VLS_288 } = __VLS_286.slots;
        // @ts-ignore
        [entry, canEditRequest, editableParams,];
        var __VLS_286;
        let __VLS_289;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_290 = __VLS_asFunctionalComponent(__VLS_289, new __VLS_289({}));
        const __VLS_291 = __VLS_290({}, ...__VLS_functionalComponentArgsRest(__VLS_290));
        const { default: __VLS_294 } = __VLS_292.slots;
        // @ts-ignore
        [];
        var __VLS_292;
        if (__VLS_ctx.canEditRequest) {
            let __VLS_295;
            /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
            TableHead;
            // @ts-ignore
            const __VLS_296 = __VLS_asFunctionalComponent(__VLS_295, new __VLS_295({
                ...{ class: "w-10" },
            }));
            const __VLS_297 = __VLS_296({
                ...{ class: "w-10" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_296));
            /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
        }
        // @ts-ignore
        [canEditRequest,];
        var __VLS_280;
        // @ts-ignore
        [];
        var __VLS_274;
        let __VLS_300;
        /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
        TableBody;
        // @ts-ignore
        const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({}));
        const __VLS_302 = __VLS_301({}, ...__VLS_functionalComponentArgsRest(__VLS_301));
        const { default: __VLS_305 } = __VLS_303.slots;
        if (__VLS_ctx.canEditRequest) {
            for (const [param, index] of __VLS_getVForSourceType((__VLS_ctx.editableParams))) {
                let __VLS_306;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_307 = __VLS_asFunctionalComponent(__VLS_306, new __VLS_306({
                    key: (index),
                }));
                const __VLS_308 = __VLS_307({
                    key: (index),
                }, ...__VLS_functionalComponentArgsRest(__VLS_307));
                const { default: __VLS_311 } = __VLS_309.slots;
                let __VLS_312;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
                    ...{ class: "py-2 align-top" },
                }));
                const __VLS_314 = __VLS_313({
                    ...{ class: "py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_313));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_317 } = __VLS_315.slots;
                let __VLS_318;
                /** @ts-ignore @type {typeof ___VLS_components.Input} */
                Input;
                // @ts-ignore
                const __VLS_319 = __VLS_asFunctionalComponent(__VLS_318, new __VLS_318({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (param.key),
                    ...{ class: "h-7 text-xs font-mono" },
                }));
                const __VLS_320 = __VLS_319({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (param.key),
                    ...{ class: "h-7 text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_319));
                let __VLS_323;
                const __VLS_324 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableParams : __VLS_ctx.entry.params).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.updateParam(index, 'key', $event);
                            // @ts-ignore
                            [canEditRequest, editableParams, updateParam,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                var __VLS_321;
                var __VLS_322;
                // @ts-ignore
                [];
                var __VLS_315;
                let __VLS_325;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_326 = __VLS_asFunctionalComponent(__VLS_325, new __VLS_325({
                    ...{ class: "py-2 align-top" },
                }));
                const __VLS_327 = __VLS_326({
                    ...{ class: "py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_326));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_330 } = __VLS_328.slots;
                let __VLS_331;
                /** @ts-ignore @type {typeof ___VLS_components.Input} */
                Input;
                // @ts-ignore
                const __VLS_332 = __VLS_asFunctionalComponent(__VLS_331, new __VLS_331({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (param.value),
                    ...{ class: "h-7 text-xs font-mono" },
                }));
                const __VLS_333 = __VLS_332({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (param.value),
                    ...{ class: "h-7 text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_332));
                let __VLS_336;
                const __VLS_337 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableParams : __VLS_ctx.entry.params).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.updateParam(index, 'value', $event);
                            // @ts-ignore
                            [updateParam,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                var __VLS_334;
                var __VLS_335;
                // @ts-ignore
                [];
                var __VLS_328;
                let __VLS_338;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_339 = __VLS_asFunctionalComponent(__VLS_338, new __VLS_338({
                    ...{ class: "py-2 text-center align-top" },
                }));
                const __VLS_340 = __VLS_339({
                    ...{ class: "py-2 text-center align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_339));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_343 } = __VLS_341.slots;
                let __VLS_344;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_345 = __VLS_asFunctionalComponent(__VLS_344, new __VLS_344({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
                }));
                const __VLS_346 = __VLS_345({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_345));
                let __VLS_349;
                const __VLS_350 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableParams : __VLS_ctx.entry.params).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.removeParam(index);
                            // @ts-ignore
                            [removeParam,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
                const { default: __VLS_351 } = __VLS_347.slots;
                // @ts-ignore
                [];
                var __VLS_347;
                var __VLS_348;
                // @ts-ignore
                [];
                var __VLS_341;
                // @ts-ignore
                [];
                var __VLS_309;
                // @ts-ignore
                [];
            }
        }
        else {
            for (const [param, index] of __VLS_getVForSourceType((__VLS_ctx.entry.params))) {
                let __VLS_352;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
                    key: (index),
                }));
                const __VLS_354 = __VLS_353({
                    key: (index),
                }, ...__VLS_functionalComponentArgsRest(__VLS_353));
                const { default: __VLS_357 } = __VLS_355.slots;
                let __VLS_358;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_359 = __VLS_asFunctionalComponent(__VLS_358, new __VLS_358({
                    ...{ class: "font-mono text-xs py-2 align-top" },
                }));
                const __VLS_360 = __VLS_359({
                    ...{ class: "font-mono text-xs py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_359));
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_363 } = __VLS_361.slots;
                (param.key);
                // @ts-ignore
                [entry,];
                var __VLS_361;
                let __VLS_364;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
                    ...{ class: "font-mono text-xs py-2 break-all align-top" },
                }));
                const __VLS_366 = __VLS_365({
                    ...{ class: "font-mono text-xs py-2 break-all align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_365));
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_369 } = __VLS_367.slots;
                (param.value);
                // @ts-ignore
                [];
                var __VLS_367;
                // @ts-ignore
                [];
                var __VLS_355;
                // @ts-ignore
                [];
            }
        }
        // @ts-ignore
        [];
        var __VLS_303;
        // @ts-ignore
        [];
        var __VLS_268;
    }
    // @ts-ignore
    [];
    var __VLS_246;
}
else if (__VLS_ctx.activeSection === 'headers') {
    let __VLS_370;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_371 = __VLS_asFunctionalComponent(__VLS_370, new __VLS_370({
        ...{ class: "h-full" },
    }));
    const __VLS_372 = __VLS_371({
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_371));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    const { default: __VLS_375 } = __VLS_373.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    if (__VLS_ctx.xRequestId) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2 p-2 bg-muted/50 rounded-md" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        let __VLS_376;
        /** @ts-ignore @type {typeof ___VLS_components.Badge} */
        Badge;
        // @ts-ignore
        const __VLS_377 = __VLS_asFunctionalComponent(__VLS_376, new __VLS_376({
            variant: "outline",
            ...{ class: "text-xs" },
        }));
        const __VLS_378 = __VLS_377({
            variant: "outline",
            ...{ class: "text-xs" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_377));
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        const { default: __VLS_381 } = __VLS_379.slots;
        // @ts-ignore
        [activeSection, xRequestId,];
        var __VLS_379;
        __VLS_asFunctionalElement(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "text-xs font-mono flex-1 truncate" },
            title: (__VLS_ctx.xRequestId),
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (__VLS_ctx.xRequestId);
        let __VLS_382;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_383 = __VLS_asFunctionalComponent(__VLS_382, new __VLS_382({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "sm",
            ...{ class: "h-6 w-6 p-0 shrink-0" },
        }));
        const __VLS_384 = __VLS_383({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "sm",
            ...{ class: "h-6 w-6 p-0 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_383));
        let __VLS_387;
        const __VLS_388 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                        return;
                    if (!!(__VLS_ctx.activeSection === 'params'))
                        return;
                    if (!(__VLS_ctx.activeSection === 'headers'))
                        return;
                    if (!(__VLS_ctx.xRequestId))
                        return;
                    __VLS_ctx.copyToClipboard(__VLS_ctx.xRequestId);
                    // @ts-ignore
                    [xRequestId, xRequestId, xRequestId, copyToClipboard,];
                } });
        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        const { default: __VLS_389 } = __VLS_385.slots;
        let __VLS_390;
        /** @ts-ignore @type {typeof ___VLS_components.Copy} */
        Copy;
        // @ts-ignore
        const __VLS_391 = __VLS_asFunctionalComponent(__VLS_390, new __VLS_390({
            ...{ class: "h-3 w-3" },
        }));
        const __VLS_392 = __VLS_391({
            ...{ class: "h-3 w-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_391));
        /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
        // @ts-ignore
        [];
        var __VLS_385;
        var __VLS_386;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between mb-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    if (__VLS_ctx.canEditRequest) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        let __VLS_395;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_396 = __VLS_asFunctionalComponent(__VLS_395, new __VLS_395({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
            disabled: (__VLS_ctx.editableRequestHeaders.length === 0),
        }));
        const __VLS_397 = __VLS_396({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
            disabled: (__VLS_ctx.editableRequestHeaders.length === 0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_396));
        let __VLS_400;
        const __VLS_401 = ({ click: {} },
            { onClick: (__VLS_ctx.removeAllRequestHeaders) });
        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
        const { default: __VLS_402 } = __VLS_398.slots;
        // @ts-ignore
        [canEditRequest, editableRequestHeaders, removeAllRequestHeaders,];
        var __VLS_398;
        var __VLS_399;
        let __VLS_403;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_404 = __VLS_asFunctionalComponent(__VLS_403, new __VLS_403({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs" },
        }));
        const __VLS_405 = __VLS_404({
            ...{ 'onClick': {} },
            variant: "outline",
            size: "sm",
            ...{ class: "h-7 text-xs" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_404));
        let __VLS_408;
        const __VLS_409 = ({ click: {} },
            { onClick: (__VLS_ctx.addRequestHeader) });
        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        const { default: __VLS_410 } = __VLS_406.slots;
        // @ts-ignore
        [addRequestHeader,];
        var __VLS_406;
        var __VLS_407;
    }
    if ((__VLS_ctx.canEditRequest ? __VLS_ctx.editableRequestHeaders : __VLS_ctx.entry.requestHeaders).length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    else {
        let __VLS_411;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_412 = __VLS_asFunctionalComponent(__VLS_411, new __VLS_411({
            ...{ class: "network-headers-table" },
        }));
        const __VLS_413 = __VLS_412({
            ...{ class: "network-headers-table" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_412));
        /** @type {__VLS_StyleScopedClasses['network-headers-table']} */ ;
        const { default: __VLS_416 } = __VLS_414.slots;
        let __VLS_417;
        /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
        TableHeader;
        // @ts-ignore
        const __VLS_418 = __VLS_asFunctionalComponent(__VLS_417, new __VLS_417({}));
        const __VLS_419 = __VLS_418({}, ...__VLS_functionalComponentArgsRest(__VLS_418));
        const { default: __VLS_422 } = __VLS_420.slots;
        let __VLS_423;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_424 = __VLS_asFunctionalComponent(__VLS_423, new __VLS_423({}));
        const __VLS_425 = __VLS_424({}, ...__VLS_functionalComponentArgsRest(__VLS_424));
        const { default: __VLS_428 } = __VLS_426.slots;
        let __VLS_429;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_430 = __VLS_asFunctionalComponent(__VLS_429, new __VLS_429({
            ...{ class: "w-1/3" },
        }));
        const __VLS_431 = __VLS_430({
            ...{ class: "w-1/3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_430));
        /** @type {__VLS_StyleScopedClasses['w-1/3']} */ ;
        const { default: __VLS_434 } = __VLS_432.slots;
        // @ts-ignore
        [entry, canEditRequest, editableRequestHeaders,];
        var __VLS_432;
        let __VLS_435;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_436 = __VLS_asFunctionalComponent(__VLS_435, new __VLS_435({}));
        const __VLS_437 = __VLS_436({}, ...__VLS_functionalComponentArgsRest(__VLS_436));
        const { default: __VLS_440 } = __VLS_438.slots;
        // @ts-ignore
        [];
        var __VLS_438;
        let __VLS_441;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_442 = __VLS_asFunctionalComponent(__VLS_441, new __VLS_441({
            ...{ class: "w-10 text-center" },
        }));
        const __VLS_443 = __VLS_442({
            ...{ class: "w-10 text-center" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_442));
        /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        const { default: __VLS_446 } = __VLS_444.slots;
        (__VLS_ctx.canEditRequest ? '' : 'Copy');
        // @ts-ignore
        [canEditRequest,];
        var __VLS_444;
        // @ts-ignore
        [];
        var __VLS_426;
        // @ts-ignore
        [];
        var __VLS_420;
        let __VLS_447;
        /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
        TableBody;
        // @ts-ignore
        const __VLS_448 = __VLS_asFunctionalComponent(__VLS_447, new __VLS_447({}));
        const __VLS_449 = __VLS_448({}, ...__VLS_functionalComponentArgsRest(__VLS_448));
        const { default: __VLS_452 } = __VLS_450.slots;
        if (__VLS_ctx.canEditRequest) {
            for (const [header, index] of __VLS_getVForSourceType((__VLS_ctx.editableRequestHeaders))) {
                let __VLS_453;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_454 = __VLS_asFunctionalComponent(__VLS_453, new __VLS_453({
                    key: (index),
                }));
                const __VLS_455 = __VLS_454({
                    key: (index),
                }, ...__VLS_functionalComponentArgsRest(__VLS_454));
                const { default: __VLS_458 } = __VLS_456.slots;
                let __VLS_459;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_460 = __VLS_asFunctionalComponent(__VLS_459, new __VLS_459({
                    ...{ class: "py-2 align-top" },
                }));
                const __VLS_461 = __VLS_460({
                    ...{ class: "py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_460));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_464 } = __VLS_462.slots;
                let __VLS_465;
                /** @ts-ignore @type {typeof ___VLS_components.Input} */
                Input;
                // @ts-ignore
                const __VLS_466 = __VLS_asFunctionalComponent(__VLS_465, new __VLS_465({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.name),
                    placeholder: "Header name",
                    ...{ class: "h-7 text-xs font-mono" },
                }));
                const __VLS_467 = __VLS_466({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.name),
                    placeholder: "Header name",
                    ...{ class: "h-7 text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_466));
                let __VLS_470;
                const __VLS_471 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableRequestHeaders : __VLS_ctx.entry.requestHeaders).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.updateRequestHeader(index, 'name', $event);
                            // @ts-ignore
                            [canEditRequest, editableRequestHeaders, updateRequestHeader,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                var __VLS_468;
                var __VLS_469;
                // @ts-ignore
                [];
                var __VLS_462;
                let __VLS_472;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
                    ...{ class: "py-2 align-top" },
                }));
                const __VLS_474 = __VLS_473({
                    ...{ class: "py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_473));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_477 } = __VLS_475.slots;
                let __VLS_478;
                /** @ts-ignore @type {typeof ___VLS_components.Input} */
                Input;
                // @ts-ignore
                const __VLS_479 = __VLS_asFunctionalComponent(__VLS_478, new __VLS_478({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.value),
                    placeholder: "Header value",
                    ...{ class: "h-7 text-xs font-mono" },
                }));
                const __VLS_480 = __VLS_479({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.value),
                    placeholder: "Header value",
                    ...{ class: "h-7 text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_479));
                let __VLS_483;
                const __VLS_484 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableRequestHeaders : __VLS_ctx.entry.requestHeaders).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.updateRequestHeader(index, 'value', $event);
                            // @ts-ignore
                            [updateRequestHeader,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                var __VLS_481;
                var __VLS_482;
                // @ts-ignore
                [];
                var __VLS_475;
                let __VLS_485;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_486 = __VLS_asFunctionalComponent(__VLS_485, new __VLS_485({
                    ...{ class: "py-2 text-center align-top" },
                }));
                const __VLS_487 = __VLS_486({
                    ...{ class: "py-2 text-center align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_486));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_490 } = __VLS_488.slots;
                let __VLS_491;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_492 = __VLS_asFunctionalComponent(__VLS_491, new __VLS_491({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
                }));
                const __VLS_493 = __VLS_492({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_492));
                let __VLS_496;
                const __VLS_497 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableRequestHeaders : __VLS_ctx.entry.requestHeaders).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.removeRequestHeader(index);
                            // @ts-ignore
                            [removeRequestHeader,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
                const { default: __VLS_498 } = __VLS_494.slots;
                // @ts-ignore
                [];
                var __VLS_494;
                var __VLS_495;
                // @ts-ignore
                [];
                var __VLS_488;
                // @ts-ignore
                [];
                var __VLS_456;
                // @ts-ignore
                [];
            }
        }
        else {
            for (const [header, index] of __VLS_getVForSourceType((__VLS_ctx.entry.requestHeaders))) {
                let __VLS_499;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_500 = __VLS_asFunctionalComponent(__VLS_499, new __VLS_499({
                    key: (index),
                }));
                const __VLS_501 = __VLS_500({
                    key: (index),
                }, ...__VLS_functionalComponentArgsRest(__VLS_500));
                const { default: __VLS_504 } = __VLS_502.slots;
                let __VLS_505;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_506 = __VLS_asFunctionalComponent(__VLS_505, new __VLS_505({
                    ...{ class: "font-mono text-xs py-2 align-top" },
                }));
                const __VLS_507 = __VLS_506({
                    ...{ class: "font-mono text-xs py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_506));
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_510 } = __VLS_508.slots;
                (header.name);
                // @ts-ignore
                [entry,];
                var __VLS_508;
                let __VLS_511;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_512 = __VLS_asFunctionalComponent(__VLS_511, new __VLS_511({
                    ...{ class: "font-mono text-xs py-2 break-all align-top whitespace-pre-wrap" },
                }));
                const __VLS_513 = __VLS_512({
                    ...{ class: "font-mono text-xs py-2 break-all align-top whitespace-pre-wrap" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_512));
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
                const { default: __VLS_516 } = __VLS_514.slots;
                (header.value);
                // @ts-ignore
                [];
                var __VLS_514;
                let __VLS_517;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_518 = __VLS_asFunctionalComponent(__VLS_517, new __VLS_517({
                    ...{ class: "py-2 text-center align-top" },
                }));
                const __VLS_519 = __VLS_518({
                    ...{ class: "py-2 text-center align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_518));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_522 } = __VLS_520.slots;
                let __VLS_523;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_524 = __VLS_asFunctionalComponent(__VLS_523, new __VLS_523({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 transition-colors" },
                    ...{ class: ({ 'text-green-500': __VLS_ctx.copiedHeaderIndex === index }) },
                }));
                const __VLS_525 = __VLS_524({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 transition-colors" },
                    ...{ class: ({ 'text-green-500': __VLS_ctx.copiedHeaderIndex === index }) },
                }, ...__VLS_functionalComponentArgsRest(__VLS_524));
                let __VLS_528;
                const __VLS_529 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditRequest ? __VLS_ctx.editableRequestHeaders : __VLS_ctx.entry.requestHeaders).length === 0))
                                return;
                            if (!!(__VLS_ctx.canEditRequest))
                                return;
                            __VLS_ctx.copyHeaderValue(header.value, index);
                            // @ts-ignore
                            [copiedHeaderIndex, copyHeaderValue,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
                const { default: __VLS_530 } = __VLS_526.slots;
                const __VLS_531 = (__VLS_ctx.copiedHeaderIndex === index ? __VLS_ctx.Check : __VLS_ctx.Copy);
                // @ts-ignore
                const __VLS_532 = __VLS_asFunctionalComponent(__VLS_531, new __VLS_531({
                    ...{ class: "h-3 w-3" },
                }));
                const __VLS_533 = __VLS_532({
                    ...{ class: "h-3 w-3" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_532));
                /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                // @ts-ignore
                [Check, Copy, copiedHeaderIndex,];
                var __VLS_526;
                var __VLS_527;
                // @ts-ignore
                [];
                var __VLS_520;
                // @ts-ignore
                [];
                var __VLS_502;
                // @ts-ignore
                [];
            }
        }
        // @ts-ignore
        [];
        var __VLS_450;
        // @ts-ignore
        [];
        var __VLS_414;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-sm font-semibold mb-2" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    if ((__VLS_ctx.canEditResponse ? __VLS_ctx.editableResponseHeaders : __VLS_ctx.entry.responseHeaders).length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        (__VLS_ctx.entry.pending ? 'Waiting for response...' : 'No response headers');
    }
    else {
        let __VLS_536;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
            ...{ class: "network-headers-table" },
        }));
        const __VLS_538 = __VLS_537({
            ...{ class: "network-headers-table" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_537));
        /** @type {__VLS_StyleScopedClasses['network-headers-table']} */ ;
        const { default: __VLS_541 } = __VLS_539.slots;
        let __VLS_542;
        /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
        TableHeader;
        // @ts-ignore
        const __VLS_543 = __VLS_asFunctionalComponent(__VLS_542, new __VLS_542({}));
        const __VLS_544 = __VLS_543({}, ...__VLS_functionalComponentArgsRest(__VLS_543));
        const { default: __VLS_547 } = __VLS_545.slots;
        let __VLS_548;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({}));
        const __VLS_550 = __VLS_549({}, ...__VLS_functionalComponentArgsRest(__VLS_549));
        const { default: __VLS_553 } = __VLS_551.slots;
        let __VLS_554;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_555 = __VLS_asFunctionalComponent(__VLS_554, new __VLS_554({
            ...{ class: "w-1/3" },
        }));
        const __VLS_556 = __VLS_555({
            ...{ class: "w-1/3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_555));
        /** @type {__VLS_StyleScopedClasses['w-1/3']} */ ;
        const { default: __VLS_559 } = __VLS_557.slots;
        // @ts-ignore
        [entry, entry, canEditResponse, editableResponseHeaders,];
        var __VLS_557;
        let __VLS_560;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({}));
        const __VLS_562 = __VLS_561({}, ...__VLS_functionalComponentArgsRest(__VLS_561));
        const { default: __VLS_565 } = __VLS_563.slots;
        // @ts-ignore
        [];
        var __VLS_563;
        let __VLS_566;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_567 = __VLS_asFunctionalComponent(__VLS_566, new __VLS_566({
            ...{ class: "w-10 text-center" },
        }));
        const __VLS_568 = __VLS_567({
            ...{ class: "w-10 text-center" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_567));
        /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        const { default: __VLS_571 } = __VLS_569.slots;
        // @ts-ignore
        [];
        var __VLS_569;
        // @ts-ignore
        [];
        var __VLS_551;
        // @ts-ignore
        [];
        var __VLS_545;
        let __VLS_572;
        /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
        TableBody;
        // @ts-ignore
        const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({}));
        const __VLS_574 = __VLS_573({}, ...__VLS_functionalComponentArgsRest(__VLS_573));
        const { default: __VLS_577 } = __VLS_575.slots;
        if (__VLS_ctx.canEditResponse) {
            for (const [header, index] of __VLS_getVForSourceType((__VLS_ctx.editableResponseHeaders))) {
                let __VLS_578;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_579 = __VLS_asFunctionalComponent(__VLS_578, new __VLS_578({
                    key: (index),
                }));
                const __VLS_580 = __VLS_579({
                    key: (index),
                }, ...__VLS_functionalComponentArgsRest(__VLS_579));
                const { default: __VLS_583 } = __VLS_581.slots;
                let __VLS_584;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
                    ...{ class: "py-2 align-top" },
                }));
                const __VLS_586 = __VLS_585({
                    ...{ class: "py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_585));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_589 } = __VLS_587.slots;
                let __VLS_590;
                /** @ts-ignore @type {typeof ___VLS_components.Input} */
                Input;
                // @ts-ignore
                const __VLS_591 = __VLS_asFunctionalComponent(__VLS_590, new __VLS_590({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.name),
                    ...{ class: "h-7 text-xs font-mono" },
                }));
                const __VLS_592 = __VLS_591({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.name),
                    ...{ class: "h-7 text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_591));
                let __VLS_595;
                const __VLS_596 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditResponse ? __VLS_ctx.editableResponseHeaders : __VLS_ctx.entry.responseHeaders).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditResponse))
                                return;
                            __VLS_ctx.updateResponseHeader(index, 'name', $event);
                            // @ts-ignore
                            [canEditResponse, editableResponseHeaders, updateResponseHeader,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                var __VLS_593;
                var __VLS_594;
                // @ts-ignore
                [];
                var __VLS_587;
                let __VLS_597;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_598 = __VLS_asFunctionalComponent(__VLS_597, new __VLS_597({
                    ...{ class: "py-2 align-top" },
                }));
                const __VLS_599 = __VLS_598({
                    ...{ class: "py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_598));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_602 } = __VLS_600.slots;
                let __VLS_603;
                /** @ts-ignore @type {typeof ___VLS_components.Input} */
                Input;
                // @ts-ignore
                const __VLS_604 = __VLS_asFunctionalComponent(__VLS_603, new __VLS_603({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.value),
                    ...{ class: "h-7 text-xs font-mono" },
                }));
                const __VLS_605 = __VLS_604({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (header.value),
                    ...{ class: "h-7 text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_604));
                let __VLS_608;
                const __VLS_609 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditResponse ? __VLS_ctx.editableResponseHeaders : __VLS_ctx.entry.responseHeaders).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditResponse))
                                return;
                            __VLS_ctx.updateResponseHeader(index, 'value', $event);
                            // @ts-ignore
                            [updateResponseHeader,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                var __VLS_606;
                var __VLS_607;
                // @ts-ignore
                [];
                var __VLS_600;
                let __VLS_610;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_611 = __VLS_asFunctionalComponent(__VLS_610, new __VLS_610({
                    ...{ class: "py-2 text-center align-top" },
                }));
                const __VLS_612 = __VLS_611({
                    ...{ class: "py-2 text-center align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_611));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_615 } = __VLS_613.slots;
                let __VLS_616;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_617 = __VLS_asFunctionalComponent(__VLS_616, new __VLS_616({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 transition-colors" },
                    ...{ class: ({ 'text-green-500': __VLS_ctx.copiedResponseHeaderIndex === index }) },
                }));
                const __VLS_618 = __VLS_617({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 transition-colors" },
                    ...{ class: ({ 'text-green-500': __VLS_ctx.copiedResponseHeaderIndex === index }) },
                }, ...__VLS_functionalComponentArgsRest(__VLS_617));
                let __VLS_621;
                const __VLS_622 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditResponse ? __VLS_ctx.editableResponseHeaders : __VLS_ctx.entry.responseHeaders).length === 0))
                                return;
                            if (!(__VLS_ctx.canEditResponse))
                                return;
                            __VLS_ctx.copyHeaderValue(header.value, index, true);
                            // @ts-ignore
                            [copyHeaderValue, copiedResponseHeaderIndex,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
                const { default: __VLS_623 } = __VLS_619.slots;
                const __VLS_624 = (__VLS_ctx.copiedResponseHeaderIndex === index ? __VLS_ctx.Check : __VLS_ctx.Copy);
                // @ts-ignore
                const __VLS_625 = __VLS_asFunctionalComponent(__VLS_624, new __VLS_624({
                    ...{ class: "h-3 w-3" },
                }));
                const __VLS_626 = __VLS_625({
                    ...{ class: "h-3 w-3" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_625));
                /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                // @ts-ignore
                [Check, Copy, copiedResponseHeaderIndex,];
                var __VLS_619;
                var __VLS_620;
                // @ts-ignore
                [];
                var __VLS_613;
                // @ts-ignore
                [];
                var __VLS_581;
                // @ts-ignore
                [];
            }
        }
        else {
            for (const [header, index] of __VLS_getVForSourceType((__VLS_ctx.entry.responseHeaders))) {
                let __VLS_629;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_630 = __VLS_asFunctionalComponent(__VLS_629, new __VLS_629({
                    key: (index),
                    ...{ class: ({ 'bg-blue-500/10': header.name.toLowerCase() === 'x-request-id' }) },
                }));
                const __VLS_631 = __VLS_630({
                    key: (index),
                    ...{ class: ({ 'bg-blue-500/10': header.name.toLowerCase() === 'x-request-id' }) },
                }, ...__VLS_functionalComponentArgsRest(__VLS_630));
                /** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
                const { default: __VLS_634 } = __VLS_632.slots;
                let __VLS_635;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_636 = __VLS_asFunctionalComponent(__VLS_635, new __VLS_635({
                    ...{ class: "font-mono text-xs py-2 align-top" },
                }));
                const __VLS_637 = __VLS_636({
                    ...{ class: "font-mono text-xs py-2 align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_636));
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_640 } = __VLS_638.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: ({ 'text-blue-500 font-semibold': header.name.toLowerCase() === 'x-request-id' }) },
                });
                /** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (header.name);
                // @ts-ignore
                [entry,];
                var __VLS_638;
                let __VLS_641;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_642 = __VLS_asFunctionalComponent(__VLS_641, new __VLS_641({
                    ...{ class: "font-mono text-xs py-2 break-all align-top whitespace-pre-wrap" },
                }));
                const __VLS_643 = __VLS_642({
                    ...{ class: "font-mono text-xs py-2 break-all align-top whitespace-pre-wrap" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_642));
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
                const { default: __VLS_646 } = __VLS_644.slots;
                (header.value);
                // @ts-ignore
                [];
                var __VLS_644;
                let __VLS_647;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_648 = __VLS_asFunctionalComponent(__VLS_647, new __VLS_647({
                    ...{ class: "py-2 text-center align-top" },
                }));
                const __VLS_649 = __VLS_648({
                    ...{ class: "py-2 text-center align-top" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_648));
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                const { default: __VLS_652 } = __VLS_650.slots;
                let __VLS_653;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_654 = __VLS_asFunctionalComponent(__VLS_653, new __VLS_653({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 transition-colors" },
                    ...{ class: ({ 'text-green-500': __VLS_ctx.copiedResponseHeaderIndex === index }) },
                }));
                const __VLS_655 = __VLS_654({
                    ...{ 'onClick': {} },
                    variant: "ghost",
                    size: "sm",
                    ...{ class: "h-6 w-6 p-0 transition-colors" },
                    ...{ class: ({ 'text-green-500': __VLS_ctx.copiedResponseHeaderIndex === index }) },
                }, ...__VLS_functionalComponentArgsRest(__VLS_654));
                let __VLS_658;
                const __VLS_659 = ({ click: {} },
                    { onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                return;
                            if (!!(__VLS_ctx.activeSection === 'params'))
                                return;
                            if (!(__VLS_ctx.activeSection === 'headers'))
                                return;
                            if (!!((__VLS_ctx.canEditResponse ? __VLS_ctx.editableResponseHeaders : __VLS_ctx.entry.responseHeaders).length === 0))
                                return;
                            if (!!(__VLS_ctx.canEditResponse))
                                return;
                            __VLS_ctx.copyHeaderValue(header.value, index, true);
                            // @ts-ignore
                            [copyHeaderValue, copiedResponseHeaderIndex,];
                        } });
                /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
                const { default: __VLS_660 } = __VLS_656.slots;
                const __VLS_661 = (__VLS_ctx.copiedResponseHeaderIndex === index ? __VLS_ctx.Check : __VLS_ctx.Copy);
                // @ts-ignore
                const __VLS_662 = __VLS_asFunctionalComponent(__VLS_661, new __VLS_661({
                    ...{ class: "h-3 w-3" },
                }));
                const __VLS_663 = __VLS_662({
                    ...{ class: "h-3 w-3" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_662));
                /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                // @ts-ignore
                [Check, Copy, copiedResponseHeaderIndex,];
                var __VLS_656;
                var __VLS_657;
                // @ts-ignore
                [];
                var __VLS_650;
                // @ts-ignore
                [];
                var __VLS_632;
                // @ts-ignore
                [];
            }
        }
        // @ts-ignore
        [];
        var __VLS_575;
        // @ts-ignore
        [];
        var __VLS_539;
    }
    // @ts-ignore
    [];
    var __VLS_373;
}
else if (__VLS_ctx.activeSection === 'request') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    if (!__VLS_ctx.methodAllowsBody) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.displayMethod);
        if (__VLS_ctx.canEditRequest) {
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        }
    }
    else if (!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest) {
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
    else {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "shrink-0 flex items-center justify-between px-3 py-2 border-b" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.canEditRequest && __VLS_ctx.methodAllowsBody) {
            let __VLS_666;
            /** @ts-ignore @type {typeof ___VLS_components.Select} */
            Select;
            // @ts-ignore
            const __VLS_667 = __VLS_asFunctionalComponent(__VLS_666, new __VLS_666({
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (__VLS_ctx.bodyFormatMode),
            }));
            const __VLS_668 = __VLS_667({
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (__VLS_ctx.bodyFormatMode),
            }, ...__VLS_functionalComponentArgsRest(__VLS_667));
            let __VLS_671;
            const __VLS_672 = ({ 'update:modelValue': {} },
                { 'onUpdate:modelValue': (...[$event]) => {
                        if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                            return;
                        if (!!(__VLS_ctx.activeSection === 'params'))
                            return;
                        if (!!(__VLS_ctx.activeSection === 'headers'))
                            return;
                        if (!(__VLS_ctx.activeSection === 'request'))
                            return;
                        if (!!(!__VLS_ctx.methodAllowsBody))
                            return;
                        if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                            return;
                        if (!(__VLS_ctx.canEditRequest && __VLS_ctx.methodAllowsBody))
                            return;
                        __VLS_ctx.handleBodyFormatChange($event);
                        // @ts-ignore
                        [entry, displayMethod, activeSection, canEditRequest, canEditRequest, canEditRequest, methodAllowsBody, methodAllowsBody, bodyFormatMode, handleBodyFormatChange,];
                    } });
            const { default: __VLS_673 } = __VLS_669.slots;
            let __VLS_674;
            /** @ts-ignore @type {typeof ___VLS_components.SelectTrigger} */
            SelectTrigger;
            // @ts-ignore
            const __VLS_675 = __VLS_asFunctionalComponent(__VLS_674, new __VLS_674({
                ...{ class: "h-7 w-[130px] text-xs" },
            }));
            const __VLS_676 = __VLS_675({
                ...{ class: "h-7 w-[130px] text-xs" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_675));
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-[130px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            const { default: __VLS_679 } = __VLS_677.slots;
            let __VLS_680;
            /** @ts-ignore @type {typeof ___VLS_components.SelectValue} */
            SelectValue;
            // @ts-ignore
            const __VLS_681 = __VLS_asFunctionalComponent(__VLS_680, new __VLS_680({}));
            const __VLS_682 = __VLS_681({}, ...__VLS_functionalComponentArgsRest(__VLS_681));
            // @ts-ignore
            [];
            var __VLS_677;
            let __VLS_685;
            /** @ts-ignore @type {typeof ___VLS_components.SelectContent} */
            SelectContent;
            // @ts-ignore
            const __VLS_686 = __VLS_asFunctionalComponent(__VLS_685, new __VLS_685({}));
            const __VLS_687 = __VLS_686({}, ...__VLS_functionalComponentArgsRest(__VLS_686));
            const { default: __VLS_690 } = __VLS_688.slots;
            let __VLS_691;
            /** @ts-ignore @type {typeof ___VLS_components.SelectItem} */
            SelectItem;
            // @ts-ignore
            const __VLS_692 = __VLS_asFunctionalComponent(__VLS_691, new __VLS_691({
                value: "raw",
            }));
            const __VLS_693 = __VLS_692({
                value: "raw",
            }, ...__VLS_functionalComponentArgsRest(__VLS_692));
            const { default: __VLS_696 } = __VLS_694.slots;
            // @ts-ignore
            [];
            var __VLS_694;
            let __VLS_697;
            /** @ts-ignore @type {typeof ___VLS_components.SelectItem} */
            SelectItem;
            // @ts-ignore
            const __VLS_698 = __VLS_asFunctionalComponent(__VLS_697, new __VLS_697({
                value: "form-data",
            }));
            const __VLS_699 = __VLS_698({
                value: "form-data",
            }, ...__VLS_functionalComponentArgsRest(__VLS_698));
            const { default: __VLS_702 } = __VLS_700.slots;
            // @ts-ignore
            [];
            var __VLS_700;
            // @ts-ignore
            [];
            var __VLS_688;
            // @ts-ignore
            [];
            var __VLS_669;
            var __VLS_670;
            let __VLS_703;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_704 = __VLS_asFunctionalComponent(__VLS_703, new __VLS_703({
                variant: "outline",
                ...{ class: "text-xs text-amber-500 border-amber-500/50" },
            }));
            const __VLS_705 = __VLS_704({
                variant: "outline",
                ...{ class: "text-xs text-amber-500 border-amber-500/50" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_704));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-amber-500/50']} */ ;
            const { default: __VLS_708 } = __VLS_706.slots;
            // @ts-ignore
            [];
            var __VLS_706;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-sm text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.entry.requestBody?.contentType || 'application/json');
        }
        if (__VLS_ctx.entry.requestBody) {
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.formatBytes(__VLS_ctx.entry.requestBody.originalSize));
        }
        if (__VLS_ctx.entry.requestBody?.truncated) {
            let __VLS_709;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_710 = __VLS_asFunctionalComponent(__VLS_709, new __VLS_709({
                variant: "outline",
                ...{ class: "text-xs" },
            }));
            const __VLS_711 = __VLS_710({
                variant: "outline",
                ...{ class: "text-xs" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_710));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            const { default: __VLS_714 } = __VLS_712.slots;
            // @ts-ignore
            [entry, entry, entry, entry, formatBytes,];
            var __VLS_712;
        }
        if (__VLS_ctx.entry.requestBody?.isBinary) {
            let __VLS_715;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_716 = __VLS_asFunctionalComponent(__VLS_715, new __VLS_715({
                variant: "outline",
                ...{ class: "text-xs" },
            }));
            const __VLS_717 = __VLS_716({
                variant: "outline",
                ...{ class: "text-xs" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_716));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            const { default: __VLS_720 } = __VLS_718.slots;
            // @ts-ignore
            [entry,];
            var __VLS_718;
        }
        if (__VLS_ctx.entry.requestBody?.isBinary) {
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
        else if (__VLS_ctx.canEditRequest) {
            if (__VLS_ctx.bodyFormatMode === 'form-data') {
                let __VLS_721;
                /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
                ScrollArea;
                // @ts-ignore
                const __VLS_722 = __VLS_asFunctionalComponent(__VLS_721, new __VLS_721({
                    ...{ class: "flex-1" },
                }));
                const __VLS_723 = __VLS_722({
                    ...{ class: "flex-1" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_722));
                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                const { default: __VLS_726 } = __VLS_724.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "p-3 space-y-3" },
                });
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center justify-between" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
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
                let __VLS_727;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_728 = __VLS_asFunctionalComponent(__VLS_727, new __VLS_727({
                    ...{ 'onClick': {} },
                    variant: "outline",
                    size: "sm",
                    ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
                    disabled: (__VLS_ctx.editableFormData.length === 0),
                }));
                const __VLS_729 = __VLS_728({
                    ...{ 'onClick': {} },
                    variant: "outline",
                    size: "sm",
                    ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
                    disabled: (__VLS_ctx.editableFormData.length === 0),
                }, ...__VLS_functionalComponentArgsRest(__VLS_728));
                let __VLS_732;
                const __VLS_733 = ({ click: {} },
                    { onClick: (__VLS_ctx.removeAllFormDataEntries) });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
                const { default: __VLS_734 } = __VLS_730.slots;
                // @ts-ignore
                [entry, canEditRequest, bodyFormatMode, editableFormData, removeAllFormDataEntries,];
                var __VLS_730;
                var __VLS_731;
                let __VLS_735;
                /** @ts-ignore @type {typeof ___VLS_components.Button} */
                Button;
                // @ts-ignore
                const __VLS_736 = __VLS_asFunctionalComponent(__VLS_735, new __VLS_735({
                    ...{ 'onClick': {} },
                    variant: "outline",
                    size: "sm",
                    ...{ class: "h-7 text-xs" },
                }));
                const __VLS_737 = __VLS_736({
                    ...{ 'onClick': {} },
                    variant: "outline",
                    size: "sm",
                    ...{ class: "h-7 text-xs" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_736));
                let __VLS_740;
                const __VLS_741 = ({ click: {} },
                    { onClick: (__VLS_ctx.addFormDataEntry) });
                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                const { default: __VLS_742 } = __VLS_738.slots;
                // @ts-ignore
                [addFormDataEntry,];
                var __VLS_738;
                var __VLS_739;
                if (__VLS_ctx.editableFormData.length === 0) {
                    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "text-sm text-muted-foreground text-center py-8" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
                }
                else {
                    let __VLS_743;
                    /** @ts-ignore @type {typeof ___VLS_components.Table} */
                    Table;
                    // @ts-ignore
                    const __VLS_744 = __VLS_asFunctionalComponent(__VLS_743, new __VLS_743({
                        ...{ class: "network-headers-table" },
                    }));
                    const __VLS_745 = __VLS_744({
                        ...{ class: "network-headers-table" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_744));
                    /** @type {__VLS_StyleScopedClasses['network-headers-table']} */ ;
                    const { default: __VLS_748 } = __VLS_746.slots;
                    let __VLS_749;
                    /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
                    TableHeader;
                    // @ts-ignore
                    const __VLS_750 = __VLS_asFunctionalComponent(__VLS_749, new __VLS_749({}));
                    const __VLS_751 = __VLS_750({}, ...__VLS_functionalComponentArgsRest(__VLS_750));
                    const { default: __VLS_754 } = __VLS_752.slots;
                    let __VLS_755;
                    /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                    TableRow;
                    // @ts-ignore
                    const __VLS_756 = __VLS_asFunctionalComponent(__VLS_755, new __VLS_755({}));
                    const __VLS_757 = __VLS_756({}, ...__VLS_functionalComponentArgsRest(__VLS_756));
                    const { default: __VLS_760 } = __VLS_758.slots;
                    let __VLS_761;
                    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                    TableHead;
                    // @ts-ignore
                    const __VLS_762 = __VLS_asFunctionalComponent(__VLS_761, new __VLS_761({
                        ...{ class: "w-[30%]" },
                    }));
                    const __VLS_763 = __VLS_762({
                        ...{ class: "w-[30%]" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_762));
                    /** @type {__VLS_StyleScopedClasses['w-[30%]']} */ ;
                    const { default: __VLS_766 } = __VLS_764.slots;
                    // @ts-ignore
                    [editableFormData,];
                    var __VLS_764;
                    let __VLS_767;
                    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                    TableHead;
                    // @ts-ignore
                    const __VLS_768 = __VLS_asFunctionalComponent(__VLS_767, new __VLS_767({
                        ...{ class: "w-20" },
                    }));
                    const __VLS_769 = __VLS_768({
                        ...{ class: "w-20" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_768));
                    /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
                    const { default: __VLS_772 } = __VLS_770.slots;
                    // @ts-ignore
                    [];
                    var __VLS_770;
                    let __VLS_773;
                    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                    TableHead;
                    // @ts-ignore
                    const __VLS_774 = __VLS_asFunctionalComponent(__VLS_773, new __VLS_773({}));
                    const __VLS_775 = __VLS_774({}, ...__VLS_functionalComponentArgsRest(__VLS_774));
                    const { default: __VLS_778 } = __VLS_776.slots;
                    // @ts-ignore
                    [];
                    var __VLS_776;
                    let __VLS_779;
                    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                    TableHead;
                    // @ts-ignore
                    const __VLS_780 = __VLS_asFunctionalComponent(__VLS_779, new __VLS_779({
                        ...{ class: "w-10" },
                    }));
                    const __VLS_781 = __VLS_780({
                        ...{ class: "w-10" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_780));
                    /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
                    // @ts-ignore
                    [];
                    var __VLS_758;
                    // @ts-ignore
                    [];
                    var __VLS_752;
                    let __VLS_784;
                    /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
                    TableBody;
                    // @ts-ignore
                    const __VLS_785 = __VLS_asFunctionalComponent(__VLS_784, new __VLS_784({}));
                    const __VLS_786 = __VLS_785({}, ...__VLS_functionalComponentArgsRest(__VLS_785));
                    const { default: __VLS_789 } = __VLS_787.slots;
                    for (const [fd, index] of __VLS_getVForSourceType((__VLS_ctx.editableFormData))) {
                        let __VLS_790;
                        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                        TableRow;
                        // @ts-ignore
                        const __VLS_791 = __VLS_asFunctionalComponent(__VLS_790, new __VLS_790({
                            key: (index),
                        }));
                        const __VLS_792 = __VLS_791({
                            key: (index),
                        }, ...__VLS_functionalComponentArgsRest(__VLS_791));
                        const { default: __VLS_795 } = __VLS_793.slots;
                        let __VLS_796;
                        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                        TableCell;
                        // @ts-ignore
                        const __VLS_797 = __VLS_asFunctionalComponent(__VLS_796, new __VLS_796({
                            ...{ class: "py-2 align-top" },
                        }));
                        const __VLS_798 = __VLS_797({
                            ...{ class: "py-2 align-top" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_797));
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                        const { default: __VLS_801 } = __VLS_799.slots;
                        let __VLS_802;
                        /** @ts-ignore @type {typeof ___VLS_components.Input} */
                        Input;
                        // @ts-ignore
                        const __VLS_803 = __VLS_asFunctionalComponent(__VLS_802, new __VLS_802({
                            ...{ 'onUpdate:modelValue': {} },
                            modelValue: (fd.key),
                            placeholder: "Key",
                            ...{ class: "h-7 text-xs font-mono" },
                        }));
                        const __VLS_804 = __VLS_803({
                            ...{ 'onUpdate:modelValue': {} },
                            modelValue: (fd.key),
                            placeholder: "Key",
                            ...{ class: "h-7 text-xs font-mono" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_803));
                        let __VLS_807;
                        const __VLS_808 = ({ 'update:modelValue': {} },
                            { 'onUpdate:modelValue': (...[$event]) => {
                                    if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                        return;
                                    if (!!(__VLS_ctx.activeSection === 'params'))
                                        return;
                                    if (!!(__VLS_ctx.activeSection === 'headers'))
                                        return;
                                    if (!(__VLS_ctx.activeSection === 'request'))
                                        return;
                                    if (!!(!__VLS_ctx.methodAllowsBody))
                                        return;
                                    if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                        return;
                                    if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                        return;
                                    if (!(__VLS_ctx.canEditRequest))
                                        return;
                                    if (!(__VLS_ctx.bodyFormatMode === 'form-data'))
                                        return;
                                    if (!!(__VLS_ctx.editableFormData.length === 0))
                                        return;
                                    __VLS_ctx.updateFormDataField(index, 'key', String($event));
                                    // @ts-ignore
                                    [editableFormData, updateFormDataField,];
                                } });
                        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                        var __VLS_805;
                        var __VLS_806;
                        // @ts-ignore
                        [];
                        var __VLS_799;
                        let __VLS_809;
                        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                        TableCell;
                        // @ts-ignore
                        const __VLS_810 = __VLS_asFunctionalComponent(__VLS_809, new __VLS_809({
                            ...{ class: "py-2 align-top" },
                        }));
                        const __VLS_811 = __VLS_810({
                            ...{ class: "py-2 align-top" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_810));
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                        const { default: __VLS_814 } = __VLS_812.slots;
                        let __VLS_815;
                        /** @ts-ignore @type {typeof ___VLS_components.Select} */
                        Select;
                        // @ts-ignore
                        const __VLS_816 = __VLS_asFunctionalComponent(__VLS_815, new __VLS_815({
                            ...{ 'onUpdate:modelValue': {} },
                            modelValue: (fd.type),
                        }));
                        const __VLS_817 = __VLS_816({
                            ...{ 'onUpdate:modelValue': {} },
                            modelValue: (fd.type),
                        }, ...__VLS_functionalComponentArgsRest(__VLS_816));
                        let __VLS_820;
                        const __VLS_821 = ({ 'update:modelValue': {} },
                            { 'onUpdate:modelValue': (...[$event]) => {
                                    if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                        return;
                                    if (!!(__VLS_ctx.activeSection === 'params'))
                                        return;
                                    if (!!(__VLS_ctx.activeSection === 'headers'))
                                        return;
                                    if (!(__VLS_ctx.activeSection === 'request'))
                                        return;
                                    if (!!(!__VLS_ctx.methodAllowsBody))
                                        return;
                                    if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                        return;
                                    if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                        return;
                                    if (!(__VLS_ctx.canEditRequest))
                                        return;
                                    if (!(__VLS_ctx.bodyFormatMode === 'form-data'))
                                        return;
                                    if (!!(__VLS_ctx.editableFormData.length === 0))
                                        return;
                                    __VLS_ctx.updateFormDataField(index, 'type', String($event));
                                    // @ts-ignore
                                    [updateFormDataField,];
                                } });
                        const { default: __VLS_822 } = __VLS_818.slots;
                        let __VLS_823;
                        /** @ts-ignore @type {typeof ___VLS_components.SelectTrigger} */
                        SelectTrigger;
                        // @ts-ignore
                        const __VLS_824 = __VLS_asFunctionalComponent(__VLS_823, new __VLS_823({
                            ...{ class: "h-7 text-xs w-[72px]" },
                        }));
                        const __VLS_825 = __VLS_824({
                            ...{ class: "h-7 text-xs w-[72px]" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_824));
                        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-[72px]']} */ ;
                        const { default: __VLS_828 } = __VLS_826.slots;
                        let __VLS_829;
                        /** @ts-ignore @type {typeof ___VLS_components.SelectValue} */
                        SelectValue;
                        // @ts-ignore
                        const __VLS_830 = __VLS_asFunctionalComponent(__VLS_829, new __VLS_829({}));
                        const __VLS_831 = __VLS_830({}, ...__VLS_functionalComponentArgsRest(__VLS_830));
                        // @ts-ignore
                        [];
                        var __VLS_826;
                        let __VLS_834;
                        /** @ts-ignore @type {typeof ___VLS_components.SelectContent} */
                        SelectContent;
                        // @ts-ignore
                        const __VLS_835 = __VLS_asFunctionalComponent(__VLS_834, new __VLS_834({}));
                        const __VLS_836 = __VLS_835({}, ...__VLS_functionalComponentArgsRest(__VLS_835));
                        const { default: __VLS_839 } = __VLS_837.slots;
                        let __VLS_840;
                        /** @ts-ignore @type {typeof ___VLS_components.SelectItem} */
                        SelectItem;
                        // @ts-ignore
                        const __VLS_841 = __VLS_asFunctionalComponent(__VLS_840, new __VLS_840({
                            value: "text",
                        }));
                        const __VLS_842 = __VLS_841({
                            value: "text",
                        }, ...__VLS_functionalComponentArgsRest(__VLS_841));
                        const { default: __VLS_845 } = __VLS_843.slots;
                        // @ts-ignore
                        [];
                        var __VLS_843;
                        let __VLS_846;
                        /** @ts-ignore @type {typeof ___VLS_components.SelectItem} */
                        SelectItem;
                        // @ts-ignore
                        const __VLS_847 = __VLS_asFunctionalComponent(__VLS_846, new __VLS_846({
                            value: "file",
                        }));
                        const __VLS_848 = __VLS_847({
                            value: "file",
                        }, ...__VLS_functionalComponentArgsRest(__VLS_847));
                        const { default: __VLS_851 } = __VLS_849.slots;
                        // @ts-ignore
                        [];
                        var __VLS_849;
                        // @ts-ignore
                        [];
                        var __VLS_837;
                        // @ts-ignore
                        [];
                        var __VLS_818;
                        var __VLS_819;
                        // @ts-ignore
                        [];
                        var __VLS_812;
                        let __VLS_852;
                        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                        TableCell;
                        // @ts-ignore
                        const __VLS_853 = __VLS_asFunctionalComponent(__VLS_852, new __VLS_852({
                            ...{ class: "py-2 align-top" },
                        }));
                        const __VLS_854 = __VLS_853({
                            ...{ class: "py-2 align-top" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_853));
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                        const { default: __VLS_857 } = __VLS_855.slots;
                        if (fd.type === 'text') {
                            let __VLS_858;
                            /** @ts-ignore @type {typeof ___VLS_components.Input} */
                            Input;
                            // @ts-ignore
                            const __VLS_859 = __VLS_asFunctionalComponent(__VLS_858, new __VLS_858({
                                ...{ 'onUpdate:modelValue': {} },
                                modelValue: (fd.value),
                                placeholder: "Value",
                                ...{ class: "h-7 text-xs font-mono" },
                            }));
                            const __VLS_860 = __VLS_859({
                                ...{ 'onUpdate:modelValue': {} },
                                modelValue: (fd.value),
                                placeholder: "Value",
                                ...{ class: "h-7 text-xs font-mono" },
                            }, ...__VLS_functionalComponentArgsRest(__VLS_859));
                            let __VLS_863;
                            const __VLS_864 = ({ 'update:modelValue': {} },
                                { 'onUpdate:modelValue': (...[$event]) => {
                                        if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                            return;
                                        if (!!(__VLS_ctx.activeSection === 'params'))
                                            return;
                                        if (!!(__VLS_ctx.activeSection === 'headers'))
                                            return;
                                        if (!(__VLS_ctx.activeSection === 'request'))
                                            return;
                                        if (!!(!__VLS_ctx.methodAllowsBody))
                                            return;
                                        if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                            return;
                                        if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                            return;
                                        if (!(__VLS_ctx.canEditRequest))
                                            return;
                                        if (!(__VLS_ctx.bodyFormatMode === 'form-data'))
                                            return;
                                        if (!!(__VLS_ctx.editableFormData.length === 0))
                                            return;
                                        if (!(fd.type === 'text'))
                                            return;
                                        __VLS_ctx.updateFormDataField(index, 'value', String($event));
                                        // @ts-ignore
                                        [updateFormDataField,];
                                    } });
                            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                            var __VLS_861;
                            var __VLS_862;
                        }
                        else {
                            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "flex items-center gap-1" },
                            });
                            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                            if (__VLS_ctx.hasFileOptions) {
                                let __VLS_865;
                                /** @ts-ignore @type {typeof ___VLS_components.Select} */
                                Select;
                                // @ts-ignore
                                const __VLS_866 = __VLS_asFunctionalComponent(__VLS_865, new __VLS_865({
                                    ...{ 'onUpdate:modelValue': {} },
                                    modelValue: (__VLS_ctx.getSelectedFileOption(fd)),
                                }));
                                const __VLS_867 = __VLS_866({
                                    ...{ 'onUpdate:modelValue': {} },
                                    modelValue: (__VLS_ctx.getSelectedFileOption(fd)),
                                }, ...__VLS_functionalComponentArgsRest(__VLS_866));
                                let __VLS_870;
                                const __VLS_871 = ({ 'update:modelValue': {} },
                                    { 'onUpdate:modelValue': (...[$event]) => {
                                            if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                                return;
                                            if (!!(__VLS_ctx.activeSection === 'params'))
                                                return;
                                            if (!!(__VLS_ctx.activeSection === 'headers'))
                                                return;
                                            if (!(__VLS_ctx.activeSection === 'request'))
                                                return;
                                            if (!!(!__VLS_ctx.methodAllowsBody))
                                                return;
                                            if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                                return;
                                            if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                                return;
                                            if (!(__VLS_ctx.canEditRequest))
                                                return;
                                            if (!(__VLS_ctx.bodyFormatMode === 'form-data'))
                                                return;
                                            if (!!(__VLS_ctx.editableFormData.length === 0))
                                                return;
                                            if (!!(fd.type === 'text'))
                                                return;
                                            if (!(__VLS_ctx.hasFileOptions))
                                                return;
                                            __VLS_ctx.selectFileOption(index, String($event));
                                            // @ts-ignore
                                            [hasFileOptions, getSelectedFileOption, selectFileOption,];
                                        } });
                                const { default: __VLS_872 } = __VLS_868.slots;
                                let __VLS_873;
                                /** @ts-ignore @type {typeof ___VLS_components.SelectTrigger} */
                                SelectTrigger;
                                // @ts-ignore
                                const __VLS_874 = __VLS_asFunctionalComponent(__VLS_873, new __VLS_873({
                                    ...{ class: "h-7 text-xs font-mono flex-1" },
                                }));
                                const __VLS_875 = __VLS_874({
                                    ...{ class: "h-7 text-xs font-mono flex-1" },
                                }, ...__VLS_functionalComponentArgsRest(__VLS_874));
                                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                                const { default: __VLS_878 } = __VLS_876.slots;
                                let __VLS_879;
                                /** @ts-ignore @type {typeof ___VLS_components.SelectValue} */
                                SelectValue;
                                // @ts-ignore
                                const __VLS_880 = __VLS_asFunctionalComponent(__VLS_879, new __VLS_879({
                                    placeholder: (__VLS_ctx.getFileDisplayLabel(fd)),
                                }));
                                const __VLS_881 = __VLS_880({
                                    placeholder: (__VLS_ctx.getFileDisplayLabel(fd)),
                                }, ...__VLS_functionalComponentArgsRest(__VLS_880));
                                const { default: __VLS_884 } = __VLS_882.slots;
                                (__VLS_ctx.getFileDisplayLabel(fd));
                                // @ts-ignore
                                [getFileDisplayLabel, getFileDisplayLabel,];
                                var __VLS_882;
                                // @ts-ignore
                                [];
                                var __VLS_876;
                                let __VLS_885;
                                /** @ts-ignore @type {typeof ___VLS_components.SelectContent} */
                                SelectContent;
                                // @ts-ignore
                                const __VLS_886 = __VLS_asFunctionalComponent(__VLS_885, new __VLS_885({}));
                                const __VLS_887 = __VLS_886({}, ...__VLS_functionalComponentArgsRest(__VLS_886));
                                const { default: __VLS_890 } = __VLS_888.slots;
                                for (const [opt] of __VLS_getVForSourceType((__VLS_ctx.getFileOptions(fd)))) {
                                    let __VLS_891;
                                    /** @ts-ignore @type {typeof ___VLS_components.SelectItem} */
                                    SelectItem;
                                    // @ts-ignore
                                    const __VLS_892 = __VLS_asFunctionalComponent(__VLS_891, new __VLS_891({
                                        key: (opt.id),
                                        value: (opt.id),
                                    }));
                                    const __VLS_893 = __VLS_892({
                                        key: (opt.id),
                                        value: (opt.id),
                                    }, ...__VLS_functionalComponentArgsRest(__VLS_892));
                                    const { default: __VLS_896 } = __VLS_894.slots;
                                    (opt.label);
                                    // @ts-ignore
                                    [getFileOptions,];
                                    var __VLS_894;
                                    // @ts-ignore
                                    [];
                                }
                                // @ts-ignore
                                [];
                                var __VLS_888;
                                // @ts-ignore
                                [];
                                var __VLS_868;
                                var __VLS_869;
                            }
                            else {
                                __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                    ...{ class: "flex-1 truncate text-xs font-mono px-2 h-7 flex items-center border rounded-md bg-background" },
                                });
                                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                                /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                                /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
                                /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
                                (__VLS_ctx.getFileDisplayLabel(fd));
                            }
                            __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                                ...{ class: "shrink-0 inline-flex items-center justify-center h-7 px-2 text-xs rounded-md border cursor-pointer hover:bg-muted/50 transition-colors" },
                            });
                            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                            /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                            /** @type {__VLS_StyleScopedClasses['hover:bg-muted/50']} */ ;
                            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                            __VLS_asFunctionalElement(__VLS_intrinsics.input)({
                                ...{ onChange: (...[$event]) => {
                                        if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                            return;
                                        if (!!(__VLS_ctx.activeSection === 'params'))
                                            return;
                                        if (!!(__VLS_ctx.activeSection === 'headers'))
                                            return;
                                        if (!(__VLS_ctx.activeSection === 'request'))
                                            return;
                                        if (!!(!__VLS_ctx.methodAllowsBody))
                                            return;
                                        if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                            return;
                                        if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                            return;
                                        if (!(__VLS_ctx.canEditRequest))
                                            return;
                                        if (!(__VLS_ctx.bodyFormatMode === 'form-data'))
                                            return;
                                        if (!!(__VLS_ctx.editableFormData.length === 0))
                                            return;
                                        if (!!(fd.type === 'text'))
                                            return;
                                        __VLS_ctx.handleFileSelected($event, index);
                                        // @ts-ignore
                                        [getFileDisplayLabel, handleFileSelected,];
                                    } },
                                type: "file",
                                ...{ class: "sr-only" },
                            });
                            /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
                        }
                        // @ts-ignore
                        [];
                        var __VLS_855;
                        let __VLS_897;
                        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                        TableCell;
                        // @ts-ignore
                        const __VLS_898 = __VLS_asFunctionalComponent(__VLS_897, new __VLS_897({
                            ...{ class: "py-2 text-center align-top" },
                        }));
                        const __VLS_899 = __VLS_898({
                            ...{ class: "py-2 text-center align-top" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_898));
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                        const { default: __VLS_902 } = __VLS_900.slots;
                        let __VLS_903;
                        /** @ts-ignore @type {typeof ___VLS_components.Button} */
                        Button;
                        // @ts-ignore
                        const __VLS_904 = __VLS_asFunctionalComponent(__VLS_903, new __VLS_903({
                            ...{ 'onClick': {} },
                            variant: "ghost",
                            size: "sm",
                            ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
                        }));
                        const __VLS_905 = __VLS_904({
                            ...{ 'onClick': {} },
                            variant: "ghost",
                            size: "sm",
                            ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_904));
                        let __VLS_908;
                        const __VLS_909 = ({ click: {} },
                            { onClick: (...[$event]) => {
                                    if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                        return;
                                    if (!!(__VLS_ctx.activeSection === 'params'))
                                        return;
                                    if (!!(__VLS_ctx.activeSection === 'headers'))
                                        return;
                                    if (!(__VLS_ctx.activeSection === 'request'))
                                        return;
                                    if (!!(!__VLS_ctx.methodAllowsBody))
                                        return;
                                    if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                        return;
                                    if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                        return;
                                    if (!(__VLS_ctx.canEditRequest))
                                        return;
                                    if (!(__VLS_ctx.bodyFormatMode === 'form-data'))
                                        return;
                                    if (!!(__VLS_ctx.editableFormData.length === 0))
                                        return;
                                    __VLS_ctx.removeFormDataEntry(index);
                                    // @ts-ignore
                                    [removeFormDataEntry,];
                                } });
                        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
                        /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
                        const { default: __VLS_910 } = __VLS_906.slots;
                        // @ts-ignore
                        [];
                        var __VLS_906;
                        var __VLS_907;
                        // @ts-ignore
                        [];
                        var __VLS_900;
                        // @ts-ignore
                        [];
                        var __VLS_793;
                        // @ts-ignore
                        [];
                    }
                    // @ts-ignore
                    [];
                    var __VLS_787;
                    // @ts-ignore
                    [];
                    var __VLS_746;
                }
                // @ts-ignore
                [];
                var __VLS_724;
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex-1 min-h-0" },
                });
                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
                let __VLS_911;
                /** @ts-ignore @type {typeof ___VLS_components.JsonEditor} */
                JsonEditor;
                // @ts-ignore
                const __VLS_912 = __VLS_asFunctionalComponent(__VLS_911, new __VLS_911({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (__VLS_ctx.editableRequestBody),
                    editable: (true),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.requestBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }));
                const __VLS_913 = __VLS_912({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (__VLS_ctx.editableRequestBody),
                    editable: (true),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.requestBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_912));
                let __VLS_916;
                const __VLS_917 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (__VLS_ctx.updateRequestBody) });
                /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
                var __VLS_914;
                var __VLS_915;
            }
        }
        else {
            if (__VLS_ctx.isFormDataBody) {
                let __VLS_918;
                /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
                ScrollArea;
                // @ts-ignore
                const __VLS_919 = __VLS_asFunctionalComponent(__VLS_918, new __VLS_918({
                    ...{ class: "flex-1" },
                }));
                const __VLS_920 = __VLS_919({
                    ...{ class: "flex-1" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_919));
                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                const { default: __VLS_923 } = __VLS_921.slots;
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                let __VLS_924;
                /** @ts-ignore @type {typeof ___VLS_components.Table} */
                Table;
                // @ts-ignore
                const __VLS_925 = __VLS_asFunctionalComponent(__VLS_924, new __VLS_924({
                    ...{ class: "network-headers-table" },
                }));
                const __VLS_926 = __VLS_925({
                    ...{ class: "network-headers-table" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_925));
                /** @type {__VLS_StyleScopedClasses['network-headers-table']} */ ;
                const { default: __VLS_929 } = __VLS_927.slots;
                let __VLS_930;
                /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
                TableHeader;
                // @ts-ignore
                const __VLS_931 = __VLS_asFunctionalComponent(__VLS_930, new __VLS_930({}));
                const __VLS_932 = __VLS_931({}, ...__VLS_functionalComponentArgsRest(__VLS_931));
                const { default: __VLS_935 } = __VLS_933.slots;
                let __VLS_936;
                /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                TableRow;
                // @ts-ignore
                const __VLS_937 = __VLS_asFunctionalComponent(__VLS_936, new __VLS_936({}));
                const __VLS_938 = __VLS_937({}, ...__VLS_functionalComponentArgsRest(__VLS_937));
                const { default: __VLS_941 } = __VLS_939.slots;
                let __VLS_942;
                /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                TableHead;
                // @ts-ignore
                const __VLS_943 = __VLS_asFunctionalComponent(__VLS_942, new __VLS_942({
                    ...{ class: "w-[30%]" },
                }));
                const __VLS_944 = __VLS_943({
                    ...{ class: "w-[30%]" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_943));
                /** @type {__VLS_StyleScopedClasses['w-[30%]']} */ ;
                const { default: __VLS_947 } = __VLS_945.slots;
                // @ts-ignore
                [editableRequestBody, jsonMode, requestBodyLanguage, updateRequestBody, isFormDataBody,];
                var __VLS_945;
                let __VLS_948;
                /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                TableHead;
                // @ts-ignore
                const __VLS_949 = __VLS_asFunctionalComponent(__VLS_948, new __VLS_948({
                    ...{ class: "w-16" },
                }));
                const __VLS_950 = __VLS_949({
                    ...{ class: "w-16" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_949));
                /** @type {__VLS_StyleScopedClasses['w-16']} */ ;
                const { default: __VLS_953 } = __VLS_951.slots;
                // @ts-ignore
                [];
                var __VLS_951;
                let __VLS_954;
                /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                TableHead;
                // @ts-ignore
                const __VLS_955 = __VLS_asFunctionalComponent(__VLS_954, new __VLS_954({}));
                const __VLS_956 = __VLS_955({}, ...__VLS_functionalComponentArgsRest(__VLS_955));
                const { default: __VLS_959 } = __VLS_957.slots;
                // @ts-ignore
                [];
                var __VLS_957;
                let __VLS_960;
                /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
                TableHead;
                // @ts-ignore
                const __VLS_961 = __VLS_asFunctionalComponent(__VLS_960, new __VLS_960({
                    ...{ class: "w-10 text-center" },
                }));
                const __VLS_962 = __VLS_961({
                    ...{ class: "w-10 text-center" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_961));
                /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                const { default: __VLS_965 } = __VLS_963.slots;
                // @ts-ignore
                [];
                var __VLS_963;
                // @ts-ignore
                [];
                var __VLS_939;
                // @ts-ignore
                [];
                var __VLS_933;
                let __VLS_966;
                /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
                TableBody;
                // @ts-ignore
                const __VLS_967 = __VLS_asFunctionalComponent(__VLS_966, new __VLS_966({}));
                const __VLS_968 = __VLS_967({}, ...__VLS_functionalComponentArgsRest(__VLS_967));
                const { default: __VLS_971 } = __VLS_969.slots;
                for (const [fd, index] of __VLS_getVForSourceType((__VLS_ctx.readonlyFormData))) {
                    let __VLS_972;
                    /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
                    TableRow;
                    // @ts-ignore
                    const __VLS_973 = __VLS_asFunctionalComponent(__VLS_972, new __VLS_972({
                        key: (index),
                    }));
                    const __VLS_974 = __VLS_973({
                        key: (index),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_973));
                    const { default: __VLS_977 } = __VLS_975.slots;
                    let __VLS_978;
                    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                    TableCell;
                    // @ts-ignore
                    const __VLS_979 = __VLS_asFunctionalComponent(__VLS_978, new __VLS_978({
                        ...{ class: "font-mono text-xs py-2 align-top" },
                    }));
                    const __VLS_980 = __VLS_979({
                        ...{ class: "font-mono text-xs py-2 align-top" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_979));
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                    const { default: __VLS_983 } = __VLS_981.slots;
                    (fd.key);
                    // @ts-ignore
                    [readonlyFormData,];
                    var __VLS_981;
                    let __VLS_984;
                    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                    TableCell;
                    // @ts-ignore
                    const __VLS_985 = __VLS_asFunctionalComponent(__VLS_984, new __VLS_984({
                        ...{ class: "font-mono text-xs py-2 align-top text-muted-foreground" },
                    }));
                    const __VLS_986 = __VLS_985({
                        ...{ class: "font-mono text-xs py-2 align-top text-muted-foreground" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_985));
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    const { default: __VLS_989 } = __VLS_987.slots;
                    (fd.type === 'file' ? 'File' : 'Text');
                    // @ts-ignore
                    [];
                    var __VLS_987;
                    let __VLS_990;
                    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                    TableCell;
                    // @ts-ignore
                    const __VLS_991 = __VLS_asFunctionalComponent(__VLS_990, new __VLS_990({
                        ...{ class: "font-mono text-xs py-2 break-all align-top whitespace-pre-wrap" },
                    }));
                    const __VLS_992 = __VLS_991({
                        ...{ class: "font-mono text-xs py-2 break-all align-top whitespace-pre-wrap" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_991));
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                    /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
                    const { default: __VLS_995 } = __VLS_993.slots;
                    if (fd.type === 'file') {
                        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "text-muted-foreground" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                        (fd.fileName || '(binary)');
                        if (fd.fileSize) {
                            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                ...{ class: "text-muted-foreground ml-1" },
                            });
                            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                            /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
                            (__VLS_ctx.formatBytes(fd.fileSize));
                        }
                    }
                    else {
                        (fd.value);
                    }
                    // @ts-ignore
                    [formatBytes,];
                    var __VLS_993;
                    let __VLS_996;
                    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                    TableCell;
                    // @ts-ignore
                    const __VLS_997 = __VLS_asFunctionalComponent(__VLS_996, new __VLS_996({
                        ...{ class: "py-2 text-center align-top" },
                    }));
                    const __VLS_998 = __VLS_997({
                        ...{ class: "py-2 text-center align-top" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_997));
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                    const { default: __VLS_1001 } = __VLS_999.slots;
                    let __VLS_1002;
                    /** @ts-ignore @type {typeof ___VLS_components.Button} */
                    Button;
                    // @ts-ignore
                    const __VLS_1003 = __VLS_asFunctionalComponent(__VLS_1002, new __VLS_1002({
                        ...{ 'onClick': {} },
                        variant: "ghost",
                        size: "sm",
                        ...{ class: "h-6 w-6 p-0 transition-colors" },
                        ...{ class: ({ 'text-green-500': __VLS_ctx.copiedFormDataIndex === index }) },
                    }));
                    const __VLS_1004 = __VLS_1003({
                        ...{ 'onClick': {} },
                        variant: "ghost",
                        size: "sm",
                        ...{ class: "h-6 w-6 p-0 transition-colors" },
                        ...{ class: ({ 'text-green-500': __VLS_ctx.copiedFormDataIndex === index }) },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_1003));
                    let __VLS_1007;
                    const __VLS_1008 = ({ click: {} },
                        { onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.activeSection === 'url' && __VLS_ctx.canEditRequest))
                                    return;
                                if (!!(__VLS_ctx.activeSection === 'params'))
                                    return;
                                if (!!(__VLS_ctx.activeSection === 'headers'))
                                    return;
                                if (!(__VLS_ctx.activeSection === 'request'))
                                    return;
                                if (!!(!__VLS_ctx.methodAllowsBody))
                                    return;
                                if (!!(!__VLS_ctx.entry.requestBody && !__VLS_ctx.canEditRequest))
                                    return;
                                if (!!(__VLS_ctx.entry.requestBody?.isBinary))
                                    return;
                                if (!!(__VLS_ctx.canEditRequest))
                                    return;
                                if (!(__VLS_ctx.isFormDataBody))
                                    return;
                                __VLS_ctx.copyFormDataValue(fd, index);
                                // @ts-ignore
                                [copiedFormDataIndex, copyFormDataValue,];
                            } });
                    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
                    const { default: __VLS_1009 } = __VLS_1005.slots;
                    const __VLS_1010 = (__VLS_ctx.copiedFormDataIndex === index ? __VLS_ctx.Check : __VLS_ctx.Copy);
                    // @ts-ignore
                    const __VLS_1011 = __VLS_asFunctionalComponent(__VLS_1010, new __VLS_1010({
                        ...{ class: "h-3 w-3" },
                    }));
                    const __VLS_1012 = __VLS_1011({
                        ...{ class: "h-3 w-3" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_1011));
                    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                    // @ts-ignore
                    [Check, Copy, copiedFormDataIndex,];
                    var __VLS_1005;
                    var __VLS_1006;
                    // @ts-ignore
                    [];
                    var __VLS_999;
                    // @ts-ignore
                    [];
                    var __VLS_975;
                    // @ts-ignore
                    [];
                }
                // @ts-ignore
                [];
                var __VLS_969;
                // @ts-ignore
                [];
                var __VLS_927;
                // @ts-ignore
                [];
                var __VLS_921;
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex-1 min-h-0" },
                });
                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
                let __VLS_1015;
                /** @ts-ignore @type {typeof ___VLS_components.JsonEditor} */
                JsonEditor;
                // @ts-ignore
                const __VLS_1016 = __VLS_asFunctionalComponent(__VLS_1015, new __VLS_1015({
                    modelValue: (__VLS_ctx.requestBodyJson),
                    editable: (false),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.requestBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }));
                const __VLS_1017 = __VLS_1016({
                    modelValue: (__VLS_ctx.requestBodyJson),
                    editable: (false),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.requestBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_1016));
                /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
            }
        }
    }
}
else if (__VLS_ctx.activeSection === 'response') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    if (__VLS_ctx.entry.pending && !__VLS_ctx.canEditResponse) {
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
    else if (__VLS_ctx.entry.error && !__VLS_ctx.canEditResponse) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex-1 flex items-center justify-center text-sm text-destructive_text" },
        });
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
        (__VLS_ctx.entry.error);
    }
    else if (!__VLS_ctx.entry.responseBody && !__VLS_ctx.canEditResponse) {
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
    else {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "shrink-0 flex items-center justify-between px-3 py-2 border-b" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        (__VLS_ctx.entry.responseBody?.contentType || 'application/json');
        if (__VLS_ctx.entry.responseBody) {
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.formatBytes(__VLS_ctx.entry.responseBody.originalSize));
        }
        if (__VLS_ctx.entry.responseBody?.truncated) {
            let __VLS_1020;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_1021 = __VLS_asFunctionalComponent(__VLS_1020, new __VLS_1020({
                variant: "outline",
                ...{ class: "text-xs" },
            }));
            const __VLS_1022 = __VLS_1021({
                variant: "outline",
                ...{ class: "text-xs" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1021));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            const { default: __VLS_1025 } = __VLS_1023.slots;
            // @ts-ignore
            [entry, entry, entry, entry, entry, entry, entry, entry, formatBytes, activeSection, canEditResponse, canEditResponse, canEditResponse, jsonMode, requestBodyLanguage, requestBodyJson,];
            var __VLS_1023;
        }
        if (__VLS_ctx.entry.responseBody?.isBinary) {
            let __VLS_1026;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_1027 = __VLS_asFunctionalComponent(__VLS_1026, new __VLS_1026({
                variant: "outline",
                ...{ class: "text-xs" },
            }));
            const __VLS_1028 = __VLS_1027({
                variant: "outline",
                ...{ class: "text-xs" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1027));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            const { default: __VLS_1031 } = __VLS_1029.slots;
            // @ts-ignore
            [entry,];
            var __VLS_1029;
        }
        if (__VLS_ctx.canEditResponse) {
            let __VLS_1032;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_1033 = __VLS_asFunctionalComponent(__VLS_1032, new __VLS_1032({
                variant: "outline",
                ...{ class: "text-xs text-amber-500 border-amber-500/50" },
            }));
            const __VLS_1034 = __VLS_1033({
                variant: "outline",
                ...{ class: "text-xs text-amber-500 border-amber-500/50" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1033));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-amber-500/50']} */ ;
            const { default: __VLS_1037 } = __VLS_1035.slots;
            // @ts-ignore
            [canEditResponse,];
            var __VLS_1035;
        }
        if (__VLS_ctx.entry.responseBody?.isBinary) {
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
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex-1 min-h-0" },
            });
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
            if (__VLS_ctx.canEditResponse) {
                let __VLS_1038;
                /** @ts-ignore @type {typeof ___VLS_components.JsonEditor} */
                JsonEditor;
                // @ts-ignore
                const __VLS_1039 = __VLS_asFunctionalComponent(__VLS_1038, new __VLS_1038({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (__VLS_ctx.editableResponseBody),
                    editable: (true),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.responseBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }));
                const __VLS_1040 = __VLS_1039({
                    ...{ 'onUpdate:modelValue': {} },
                    modelValue: (__VLS_ctx.editableResponseBody),
                    editable: (true),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.responseBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_1039));
                let __VLS_1043;
                const __VLS_1044 = ({ 'update:modelValue': {} },
                    { 'onUpdate:modelValue': (__VLS_ctx.updateResponseBody) });
                /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
                var __VLS_1041;
                var __VLS_1042;
            }
            else {
                let __VLS_1045;
                /** @ts-ignore @type {typeof ___VLS_components.JsonEditor} */
                JsonEditor;
                // @ts-ignore
                const __VLS_1046 = __VLS_asFunctionalComponent(__VLS_1045, new __VLS_1045({
                    modelValue: (__VLS_ctx.responseBodyJson),
                    editable: (false),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.responseBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }));
                const __VLS_1047 = __VLS_1046({
                    modelValue: (__VLS_ctx.responseBodyJson),
                    editable: (false),
                    showCopy: (true),
                    mode: (__VLS_ctx.jsonMode),
                    language: (__VLS_ctx.responseBodyLanguage),
                    fullHeight: (true),
                    ...{ class: "h-full" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_1046));
                /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
            }
        }
    }
}
// @ts-ignore
[entry, canEditResponse, jsonMode, jsonMode, editableResponseBody, responseBodyLanguage, responseBodyLanguage, updateResponseBody, responseBodyJson,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=NetworkDetails.vue.js.map