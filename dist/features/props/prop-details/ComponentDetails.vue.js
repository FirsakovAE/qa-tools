import { computed, ref, watch } from 'vue';
import { ArrowLeft, Star, X, Save, Edit, RefreshCw } from 'lucide-vue-next';
import { useEscapeClose } from '@/composables/useEscapeClose';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import JsonEditor from '@/components/JsonEditor.vue';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { useRuntime } from '@/runtime';
import { isInFavorites, matchFavoriteIds } from '@/utils/favoritesMatcher';
import { useComponentsTab } from '@/hooks/useComponentsTab';
import { ref as createRef } from 'vue';
import { getPropsFavoriteNodeId, isPropsRowResolvedFavorite } from '../propsFavorites';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
const runtime = useRuntime();
const props = withDefaults(defineProps(), { refreshing: false, allRows: () => [] });
const emit = defineEmits();
// --- Settings ---
const settings = useInspectorSettingsSync();
const jsonMode = ref('text');
watch(settings, (s) => {
    if (s)
        jsonMode.value = s.json?.mode ?? 'text';
}, { immediate: true });
// --- Favorites (same resolution as PropsTab.updateFavoriteFlags when allRows is provided) ---
const isFavorite = computed(() => {
    if (!settings.value?.favorites?.length)
        return false;
    const rows = props.allRows;
    if (rows.length > 0) {
        return isPropsRowResolvedFavorite(props.node, settings.value.favorites, rows);
    }
    return isInFavorites(getPropsFavoriteNodeId(props.node), settings.value.favorites);
});
async function toggleFavorite() {
    if (!settings.value)
        return;
    const elementId = getPropsFavoriteNodeId(props.node);
    if (isFavorite.value) {
        const stableMatches = settings.value.favorites.filter(f => matchFavoriteIds(elementId, f.id));
        const toRemove = stableMatches.find(f => f.nodeId === props.node.id) || stableMatches[0];
        if (toRemove) {
            settings.value.favorites = settings.value.favorites.filter((fav) => fav !== toRemove);
        }
    }
    else {
        const favoriteItem = {
            id: elementId,
            nodeId: props.node.id,
            tagName: props.node.element?.tagName || props.node.rootElement?.tagName || 'div',
            className: props.node.element?.className || props.node.rootElement?.className,
            name: props.node.name,
            timestamp: new Date().toISOString()
        };
        settings.value.favorites.push(favoriteItem);
    }
    try {
        const settingsToSave = JSON.parse(JSON.stringify(settings.value));
        await runtime.storage.set('vue-inspector-settings', settingsToSave);
    }
    catch (error) {
        console.error('[props/ComponentDetails] toggleFavorite save failed:', error);
    }
}
// --- Editing Props Hook ---
const { startEditingProps, saveEditedProps, cancelEditing: cancelPropsEditing, updateEditedProp, } = useComponentsTab(createRef([]), {});
const componentUid = computed(() => props.node.componentUid || '');
// Path for updateComponentProps: use uid: format when available (required for save)
const componentPath = computed(() => props.node.id?.startsWith('uid:') ? props.node.id : (props.node.componentUid || props.node.id || ''));
const activeSection = ref('received');
const sections = computed(() => [
    { id: 'received', label: 'Received' },
    { id: 'declared', label: 'Declared' }
]);
// --- JSON State ---
const json = computed(() => {
    if (props.node.props)
        return JSON.stringify(props.node.props, null, 2);
    if (props.node.jsonProps)
        return props.node.jsonProps;
    return '{}';
});
const editedJson = ref(json.value.trim());
const isEditing = ref(false);
const isJsonValid = computed(() => {
    try {
        JSON.parse(editedJson.value);
        return true;
    }
    catch {
        return false;
    }
});
/** Declared section: rawProps as JSON (read-only) */
const rawPropsJson = computed(() => {
    const raw = props.node.rawProps;
    if (!raw || typeof raw !== 'object')
        return '{}';
    return JSON.stringify(raw, null, 2);
});
// Watch for node changes
watch(() => props.node.id, () => {
    editedJson.value = json.value.trim();
    isEditing.value = false;
});
watch(json, (newJson) => {
    if (!isEditing.value) {
        editedJson.value = newJson.trim();
    }
});
// --- Component Info ---
const nodeName = computed(() => props.node.name || '—');
const elementInfo = computed(() => {
    if (props.node.element) {
        if (props.node.element instanceof HTMLElement) {
            const tag = props.node.element.tagName.toLowerCase();
            const cls = props.node.element.className
                ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
                : '';
            return tag + cls;
        }
        else if (props.node.element.tagName) {
            const tag = props.node.element.tagName.toLowerCase();
            const cls = props.node.element.className
                ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
                : '';
            return tag + cls;
        }
    }
    if (props.node.rootElement?.tagName) {
        const tag = props.node.rootElement.tagName.toLowerCase();
        const cls = props.node.rootElement.className
            ? '.' + props.node.rootElement.className.trim().replace(/\s+/g, '.')
            : '';
        return tag + cls;
    }
    return 'div';
});
const truncatedElementInfo = computed(() => {
    const info = elementInfo.value;
    return info.length > 40 ? info.substring(0, 40) + '...' : info;
});
const formattedTime = computed(() => {
    if (!props.node.timestamp)
        return '—';
    const d = new Date(props.node.timestamp);
    return d.toISOString().replace('T', ' ').slice(0, 19);
});
/** Фактический размер props в байтах (честный расчёт через TextEncoder) */
const propsSizeFormatted = computed(() => {
    const str = json.value;
    if (!str || str === '{}')
        return null;
    const bytes = new TextEncoder().encode(str).length;
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});
// --- Actions ---
function startEditing() {
    editedJson.value = json.value.trim();
    isEditing.value = true;
    startEditingProps?.(componentPath.value);
}
function cancelEdit() {
    editedJson.value = json.value.trim();
    isEditing.value = false;
    cancelPropsEditing?.();
}
useEscapeClose(computed(() => true), () => {
    if (isEditing.value)
        cancelEdit();
    else
        emit('back');
});
async function saveChanges() {
    if (!isJsonValid.value)
        return;
    try {
        const parsed = JSON.parse(editedJson.value);
        // Update props via hook
        Object.entries(parsed).forEach(([key, value]) => {
            updateEditedProp?.(key, value);
        });
        // Save via service
        const saveResult = await saveEditedProps?.();
        if (saveResult === true) {
            // Update local state
            props.node.props = { ...parsed };
            props.node.jsonProps = JSON.stringify(parsed, null, 2);
            props.node.timestamp = new Date().toISOString();
            editedJson.value = JSON.stringify(parsed, null, 2);
        }
        isEditing.value = false;
    }
    catch (err) {
        if (!isExpectedExtensionError(err)) {
            console.error('[props/ComponentDetails] saveChanges failed:', err);
        }
        // Keep editing on error
    }
}
const __VLS_defaults = { refreshing: false, allRows: () => [] };
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
(__VLS_ctx.nodeName);
let __VLS_20;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const { default: __VLS_25 } = __VLS_23.slots;
let __VLS_26;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
    asChild: true,
}));
const __VLS_28 = __VLS_27({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
const { default: __VLS_31 } = __VLS_29.slots;
let __VLS_32;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    variant: "secondary",
    ...{ class: "text-xs truncate max-w-[200px]" },
}));
const __VLS_34 = __VLS_33({
    variant: "secondary",
    ...{ class: "text-xs truncate max-w-[200px]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[200px]']} */ ;
const { default: __VLS_37 } = __VLS_35.slots;
(__VLS_ctx.truncatedElementInfo);
// @ts-ignore
[nodeName, truncatedElementInfo,];
var __VLS_35;
// @ts-ignore
[];
var __VLS_29;
if (__VLS_ctx.elementInfo.length > 40) {
    let __VLS_38;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({}));
    const __VLS_40 = __VLS_39({}, ...__VLS_functionalComponentArgsRest(__VLS_39));
    const { default: __VLS_43 } = __VLS_41.slots;
    (__VLS_ctx.elementInfo);
    // @ts-ignore
    [elementInfo, elementInfo,];
    var __VLS_41;
}
// @ts-ignore
[];
var __VLS_23;
if (__VLS_ctx.propsSizeFormatted) {
    let __VLS_44;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        variant: "outline",
        ...{ class: "text-xs font-mono shrink-0" },
    }));
    const __VLS_46 = __VLS_45({
        variant: "outline",
        ...{ class: "text-xs font-mono shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    const { default: __VLS_49 } = __VLS_47.slots;
    (__VLS_ctx.propsSizeFormatted);
    // @ts-ignore
    [propsSizeFormatted, propsSizeFormatted,];
    var __VLS_47;
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
(__VLS_ctx.formattedTime);
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1 shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
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
let __VLS_62;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}));
const __VLS_64 = __VLS_63({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
let __VLS_67;
const __VLS_68 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleFavorite) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_69 } = __VLS_65.slots;
let __VLS_70;
/** @ts-ignore @type {typeof ___VLS_components.Star} */
Star;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.isFavorite ? 'text-yellow-500 fill-yellow-500' : '') },
}));
const __VLS_72 = __VLS_71({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.isFavorite ? 'text-yellow-500 fill-yellow-500' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[formattedTime, toggleFavorite, isFavorite,];
var __VLS_65;
var __VLS_66;
// @ts-ignore
[];
var __VLS_59;
let __VLS_75;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
    side: "bottom",
}));
const __VLS_77 = __VLS_76({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_76));
const { default: __VLS_80 } = __VLS_78.slots;
(__VLS_ctx.isFavorite ? 'Remove from favorites' : 'Add to favorites');
// @ts-ignore
[isFavorite,];
var __VLS_78;
// @ts-ignore
[];
var __VLS_53;
if (!__VLS_ctx.isEditing) {
    let __VLS_81;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({}));
    const __VLS_83 = __VLS_82({}, ...__VLS_functionalComponentArgsRest(__VLS_82));
    const { default: __VLS_86 } = __VLS_84.slots;
    let __VLS_87;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({
        asChild: true,
    }));
    const __VLS_89 = __VLS_88({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_88));
    const { default: __VLS_92 } = __VLS_90.slots;
    let __VLS_93;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (__VLS_ctx.refreshing),
    }));
    const __VLS_95 = __VLS_94({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (__VLS_ctx.refreshing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_94));
    let __VLS_98;
    const __VLS_99 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(!__VLS_ctx.isEditing))
                    return;
                __VLS_ctx.emit('refresh');
                // @ts-ignore
                [emit, isEditing, refreshing,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_100 } = __VLS_96.slots;
    let __VLS_101;
    /** @ts-ignore @type {typeof ___VLS_components.RefreshCw} */
    RefreshCw;
    // @ts-ignore
    const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
        ...{ class: "h-4 w-4" },
        ...{ class: ({ 'animate-spin': __VLS_ctx.refreshing }) },
    }));
    const __VLS_103 = __VLS_102({
        ...{ class: "h-4 w-4" },
        ...{ class: ({ 'animate-spin': __VLS_ctx.refreshing }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_102));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    // @ts-ignore
    [refreshing,];
    var __VLS_96;
    var __VLS_97;
    // @ts-ignore
    [];
    var __VLS_90;
    let __VLS_106;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
        side: "bottom",
    }));
    const __VLS_108 = __VLS_107({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
    const { default: __VLS_111 } = __VLS_109.slots;
    // @ts-ignore
    [];
    var __VLS_109;
    // @ts-ignore
    [];
    var __VLS_84;
}
if (!__VLS_ctx.isEditing && __VLS_ctx.activeSection === 'received') {
    let __VLS_112;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({}));
    const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
    const { default: __VLS_117 } = __VLS_115.slots;
    let __VLS_118;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({
        asChild: true,
    }));
    const __VLS_120 = __VLS_119({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_119));
    const { default: __VLS_123 } = __VLS_121.slots;
    let __VLS_124;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }));
    const __VLS_126 = __VLS_125({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    let __VLS_129;
    const __VLS_130 = ({ click: {} },
        { onClick: (__VLS_ctx.startEditing) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_131 } = __VLS_127.slots;
    let __VLS_132;
    /** @ts-ignore @type {typeof ___VLS_components.Edit} */
    Edit;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_134 = __VLS_133({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [isEditing, activeSection, startEditing,];
    var __VLS_127;
    var __VLS_128;
    // @ts-ignore
    [];
    var __VLS_121;
    let __VLS_137;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
        side: "bottom",
    }));
    const __VLS_139 = __VLS_138({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_138));
    const { default: __VLS_142 } = __VLS_140.slots;
    // @ts-ignore
    [];
    var __VLS_140;
    // @ts-ignore
    [];
    var __VLS_115;
}
if (__VLS_ctx.isEditing) {
    let __VLS_143;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({}));
    const __VLS_145 = __VLS_144({}, ...__VLS_functionalComponentArgsRest(__VLS_144));
    const { default: __VLS_148 } = __VLS_146.slots;
    let __VLS_149;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_150 = __VLS_asFunctionalComponent(__VLS_149, new __VLS_149({
        asChild: true,
    }));
    const __VLS_151 = __VLS_150({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_150));
    const { default: __VLS_154 } = __VLS_152.slots;
    let __VLS_155;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }));
    const __VLS_157 = __VLS_156({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_156));
    let __VLS_160;
    const __VLS_161 = ({ click: {} },
        { onClick: (__VLS_ctx.cancelEdit) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_162 } = __VLS_158.slots;
    let __VLS_163;
    /** @ts-ignore @type {typeof ___VLS_components.X} */
    X;
    // @ts-ignore
    const __VLS_164 = __VLS_asFunctionalComponent(__VLS_163, new __VLS_163({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_165 = __VLS_164({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_164));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [isEditing, cancelEdit,];
    var __VLS_158;
    var __VLS_159;
    // @ts-ignore
    [];
    var __VLS_152;
    let __VLS_168;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
        side: "bottom",
    }));
    const __VLS_170 = __VLS_169({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    const { default: __VLS_173 } = __VLS_171.slots;
    // @ts-ignore
    [];
    var __VLS_171;
    // @ts-ignore
    [];
    var __VLS_146;
    let __VLS_174;
    /** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
    Tooltip;
    // @ts-ignore
    const __VLS_175 = __VLS_asFunctionalComponent(__VLS_174, new __VLS_174({}));
    const __VLS_176 = __VLS_175({}, ...__VLS_functionalComponentArgsRest(__VLS_175));
    const { default: __VLS_179 } = __VLS_177.slots;
    let __VLS_180;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
    TooltipTrigger;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        asChild: true,
    }));
    const __VLS_182 = __VLS_181({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    const { default: __VLS_185 } = __VLS_183.slots;
    let __VLS_186;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_187 = __VLS_asFunctionalComponent(__VLS_186, new __VLS_186({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (!__VLS_ctx.isJsonValid),
    }));
    const __VLS_188 = __VLS_187({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-8 w-8" },
        disabled: (!__VLS_ctx.isJsonValid),
    }, ...__VLS_functionalComponentArgsRest(__VLS_187));
    let __VLS_191;
    const __VLS_192 = ({ click: {} },
        { onClick: (__VLS_ctx.saveChanges) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    const { default: __VLS_193 } = __VLS_189.slots;
    let __VLS_194;
    /** @ts-ignore @type {typeof ___VLS_components.Save} */
    Save;
    // @ts-ignore
    const __VLS_195 = __VLS_asFunctionalComponent(__VLS_194, new __VLS_194({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_196 = __VLS_195({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_195));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [isJsonValid, saveChanges,];
    var __VLS_189;
    var __VLS_190;
    // @ts-ignore
    [];
    var __VLS_183;
    let __VLS_199;
    /** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
    TooltipContent;
    // @ts-ignore
    const __VLS_200 = __VLS_asFunctionalComponent(__VLS_199, new __VLS_199({
        side: "bottom",
    }));
    const __VLS_201 = __VLS_200({
        side: "bottom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_200));
    const { default: __VLS_204 } = __VLS_202.slots;
    // @ts-ignore
    [];
    var __VLS_202;
    // @ts-ignore
    [];
    var __VLS_177;
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
if (__VLS_ctx.activeSection === 'received') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1 min-h-0" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    const __VLS_205 = JsonEditor;
    // @ts-ignore
    const __VLS_206 = __VLS_asFunctionalComponent(__VLS_205, new __VLS_205({
        modelValue: (__VLS_ctx.editedJson),
        editable: (__VLS_ctx.isEditing),
        showCopy: (true),
        mode: (__VLS_ctx.jsonMode),
        fullHeight: (true),
        ...{ class: "h-full" },
    }));
    const __VLS_207 = __VLS_206({
        modelValue: (__VLS_ctx.editedJson),
        editable: (__VLS_ctx.isEditing),
        showCopy: (true),
        mode: (__VLS_ctx.jsonMode),
        fullHeight: (true),
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_206));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
}
else if (__VLS_ctx.activeSection === 'declared') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1 min-h-0" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    const __VLS_210 = JsonEditor;
    // @ts-ignore
    const __VLS_211 = __VLS_asFunctionalComponent(__VLS_210, new __VLS_210({
        modelValue: (__VLS_ctx.rawPropsJson),
        editable: (false),
        showCopy: (true),
        mode: (__VLS_ctx.jsonMode),
        fullHeight: (true),
        ...{ class: "h-full" },
    }));
    const __VLS_212 = __VLS_211({
        modelValue: (__VLS_ctx.rawPropsJson),
        editable: (false),
        showCopy: (true),
        mode: (__VLS_ctx.jsonMode),
        fullHeight: (true),
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_211));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
}
// @ts-ignore
[isEditing, activeSection, activeSection, editedJson, jsonMode, jsonMode, rawPropsJson,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=ComponentDetails.vue.js.map