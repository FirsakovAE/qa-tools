import { ref, computed, onUnmounted } from 'vue';
import { useElementSize } from '@vueuse/core';
import VirtualTable from '@/components/VirtualTable.vue';
import { Badge } from '@/components/ui/badge';
import { Star, MoreHorizontal } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { DropdownMenu, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { PropsTableActionsMenuContent } from '@/components/PropsTableActionsMenu';
import { TableColumnSelector } from '@/components/ui/TableColumnSelector';
import { Skeleton } from '@/components/ui/Skeleton';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { defaultInspectorSettings } from '@/settings/inspectorSettings';
import { useRuntime } from '@/runtime';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
const runtime = useRuntime();
const props = defineProps();
// Column visibility from settings
const settings = useInspectorSettingsSync();
const columns = computed(() => {
    const cols = settings.value?.propsTableColumns ?? defaultInspectorSettings.propsTableColumns;
    return cols ?? { name: true, rootElement: true, propsReceived: true, propsDeclared: true };
});
function setColumn(key, value) {
    if (!settings.value)
        return;
    if (!settings.value.propsTableColumns) {
        settings.value.propsTableColumns = { ...defaultInspectorSettings.propsTableColumns };
    }
    settings.value.propsTableColumns[key] = value;
}
const propsColumnDefs = [
    { key: 'rootElement', label: 'Root Element' },
    { key: 'propsReceived', label: 'Received' },
    { key: 'propsDeclared', label: 'Declared' },
];
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;
const MAX_SKELETON_ROWS = 15;
const tableContainerRef = ref(null);
const { height: containerHeight } = useElementSize(tableContainerRef);
const skeletonRowCount = computed(() => {
    const h = containerHeight.value - HEADER_HEIGHT;
    if (h <= 0)
        return 1;
    const count = Math.floor(h / ROW_HEIGHT);
    return Math.min(MAX_SKELETON_ROWS, Math.max(1, count));
});
const emit = defineEmits();
// ============================================================================
// Hover Pipeline (rAF-throttle, non-reactive state)
// ============================================================================
// NON-REACTIVE hover state (prevents Vue reactivity overhead)
let hoveredUid = null;
let pendingHighlightUid = null;
let highlightScheduled = false;
let hoveredEl = null;
/**
 * rAF-throttled highlight sender
 * Guarantees max 60 events/sec, no bridge spam
 */
function scheduleHighlight(uid) {
    pendingHighlightUid = uid;
    if (highlightScheduled)
        return;
    highlightScheduled = true;
    requestAnimationFrame(() => {
        highlightScheduled = false;
        if (pendingHighlightUid === null) {
            sendUnhighlight();
        }
        else {
            sendHighlight(pendingHighlightUid);
        }
    });
}
async function sendHighlight(uid) {
    try {
        await runtime.sendMessage({
            type: 'HIGHLIGHT_BY_UID',
            uid
        });
    }
    catch (error) {
        if (!isExpectedExtensionError(error)) {
            console.error('[props/PropsTable] sendHighlight failed:', error);
        }
    }
}
async function sendUnhighlight() {
    try {
        await runtime.sendMessage({
            type: 'UNHIGHLIGHT_ELEMENT'
        });
    }
    catch (error) {
        if (!isExpectedExtensionError(error)) {
            console.error('[props/PropsTable] sendUnhighlight failed:', error);
        }
    }
}
/**
 * Handle row hover - only mouseenter, NO mousemove
 * Uses pre-calculated flags from PropsRow
 */
function onRowHover(row, event) {
    // Use pre-calculated uid and hasDomElement
    const canHighlight = row.uid !== null && row.hasDomElement;
    const effectiveUid = canHighlight ? row.uid : null;
    // Skip if same effective UID
    if (effectiveUid === hoveredUid)
        return;
    // Remove hover class from previous row
    if (hoveredEl) {
        hoveredEl.classList.remove('props-row-hovered');
    }
    // Add hover class to current row (NEVER for favorites)
    const target = event.target.closest('.props-row');
    if (target && !row.isFavoriteFlag) {
        target.classList.add('props-row-hovered');
        hoveredEl = target;
    }
    else {
        hoveredEl = null;
    }
    hoveredUid = effectiveUid;
    // Send highlight for elements with DOM, or unhighlight for "Logic only"
    scheduleHighlight(effectiveUid);
}
/**
 * Handle mouse leave from scroller area
 */
function onScrollerLeave() {
    if (hoveredEl) {
        hoveredEl.classList.remove('props-row-hovered');
        hoveredEl = null;
    }
    hoveredUid = null;
    scheduleHighlight(null);
}
// Cleanup on unmount
onUnmounted(() => {
    if (hoveredEl) {
        hoveredEl.classList.remove('props-row-hovered');
        hoveredEl = null;
    }
    if (hoveredUid !== null) {
        sendUnhighlight();
    }
});
// ============================================================================
// Data helpers (use pre-calculated fields)
// ============================================================================
function truncateElementInfo(info) {
    return info.length > 25 ? info.substring(0, 25) + '...' : info;
}
function getPropsPassed(row) {
    if (row.props && Object.keys(row.props).length > 0) {
        return Object.keys(row.props).length;
    }
    return row.propsCountPassed ?? row.propsCount ?? 0;
}
function getPropsDeclared(row) {
    return row.propsCount ?? 0;
}
function handleRowClick(row) {
    if (row.hasPropsFlag) {
        emit('select', row);
    }
}
function handleToggleFavorite(event, row) {
    event.stopPropagation();
    emit('toggleFavorite', row);
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
/** @type {__VLS_StyleScopedClasses['props-row']} */ ;
/** @type {__VLS_StyleScopedClasses['props-row-clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['props-row-clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['props-row-favorite']} */ ;
/** @type {__VLS_StyleScopedClasses['props-row-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['props-row-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-favorite']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "tableContainerRef",
    ...{ class: "h-full" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
const __VLS_0 = VirtualTable || VirtualTable;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onMouseleave': {} },
    items: (__VLS_ctx.rows),
    keyField: "id",
    itemSize: (40),
    minWidth: "360px",
    emptyMessage: "No components found",
    isLoading: (__VLS_ctx.isLoading),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onMouseleave': {} },
    items: (__VLS_ctx.rows),
    keyField: "id",
    itemSize: (40),
    minWidth: "360px",
    emptyMessage: "No components found",
    isLoading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ mouseleave: {} },
    { onMouseleave: (__VLS_ctx.onScrollerLeave) });
const { default: __VLS_7 } = __VLS_3.slots;
{
    const { header: __VLS_8 } = __VLS_3.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "props-cell props-cell-star" },
    });
    /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-cell-star']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "props-cell props-cell-name text-xs font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-cell-name']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    if (__VLS_ctx.columns.rootElement) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "props-cell props-cell-element text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['props-cell-element']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    }
    if (__VLS_ctx.columns.propsReceived) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "props-cell props-cell-props text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['props-cell-props']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    }
    if (__VLS_ctx.columns.propsDeclared) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "props-cell props-cell-props text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['props-cell-props']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "props-cell props-cell-actions virtual-table__cell-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-cell-actions']} */ ;
    /** @type {__VLS_StyleScopedClasses['virtual-table__cell-actions']} */ ;
    let __VLS_9;
    /** @ts-ignore @type {typeof ___VLS_components.TableColumnSelector} */
    TableColumnSelector;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        ...{ 'onUpdate:column': {} },
        columns: ({ ...__VLS_ctx.columns }),
        columnDefinitions: (__VLS_ctx.propsColumnDefs),
    }));
    const __VLS_11 = __VLS_10({
        ...{ 'onUpdate:column': {} },
        columns: ({ ...__VLS_ctx.columns }),
        columnDefinitions: (__VLS_ctx.propsColumnDefs),
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    let __VLS_14;
    const __VLS_15 = ({ 'update:column': {} },
        { 'onUpdate:column': ((k, v) => __VLS_ctx.setColumn(k, v)) });
    var __VLS_12;
    var __VLS_13;
    // @ts-ignore
    [rows, isLoading, onScrollerLeave, columns, columns, columns, columns, propsColumnDefs, setColumn,];
}
{
    const { default: __VLS_16 } = __VLS_3.slots;
    const [{ item: row }] = __VLS_getSlotParameters(__VLS_16);
    let __VLS_17;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
    ContextMenu;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({}));
    const __VLS_19 = __VLS_18({}, ...__VLS_functionalComponentArgsRest(__VLS_18));
    const { default: __VLS_22 } = __VLS_20.slots;
    let __VLS_23;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
    ContextMenuTrigger;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
        asChild: true,
    }));
    const __VLS_25 = __VLS_24({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    const { default: __VLS_28 } = __VLS_26.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleRowClick(row);
                // @ts-ignore
                [handleRowClick,];
            } },
        ...{ onMouseenter: (...[$event]) => {
                __VLS_ctx.onRowHover(row, $event);
                // @ts-ignore
                [onRowHover,];
            } },
        ...{ class: "props-row virtual-table__row" },
        ...{ class: ({
                'props-row-selected': __VLS_ctx.selectedId === row.id,
                'props-row-clickable': row.hasPropsFlag,
                'props-row-disabled': !row.hasPropsFlag,
                'props-row-favorite': row.isFavoriteFlag
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['props-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['virtual-table__row']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-row-selected']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-row-clickable']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-row-disabled']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-row-favorite']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "props-cell props-cell-star" },
    });
    /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-cell-star']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: ((e) => __VLS_ctx.handleToggleFavorite(e, row)) },
        ...{ class: "star-btn" },
        ...{ class: ({
                'star-visible': row.isFavoriteFlag,
                'star-favorite': row.isFavoriteFlag
            }) },
        title: (row.isFavoriteFlag ? 'Remove from favorites' : 'Add to favorites'),
    });
    /** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['star-visible']} */ ;
    /** @type {__VLS_StyleScopedClasses['star-favorite']} */ ;
    let __VLS_29;
    /** @ts-ignore @type {typeof ___VLS_components.Star} */
    Star;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        ...{ class: "h-3.5 w-3.5" },
        ...{ class: (row.isFavoriteFlag
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-muted-foreground') },
    }));
    const __VLS_31 = __VLS_30({
        ...{ class: "h-3.5 w-3.5" },
        ...{ class: (row.isFavoriteFlag
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-muted-foreground') },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "props-cell props-cell-name" },
    });
    /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-cell-name']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "truncate text-sm font-medium" },
        title: (row.name),
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (row.name);
    if (__VLS_ctx.columns.rootElement) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "props-cell props-cell-element" },
        });
        /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['props-cell-element']} */ ;
        let __VLS_34;
        /** @ts-ignore @type {typeof ___VLS_components.Badge} */
        Badge;
        // @ts-ignore
        const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
            variant: (row.elementInfo === 'Logic only' ? 'destructive_text' : 'secondary'),
            ...{ class: "text-xs truncate max-w-full" },
            title: (row.elementInfo),
        }));
        const __VLS_36 = __VLS_35({
            variant: (row.elementInfo === 'Logic only' ? 'destructive_text' : 'secondary'),
            ...{ class: "text-xs truncate max-w-full" },
            title: (row.elementInfo),
        }, ...__VLS_functionalComponentArgsRest(__VLS_35));
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
        const { default: __VLS_39 } = __VLS_37.slots;
        (__VLS_ctx.truncateElementInfo(row.elementInfo));
        // @ts-ignore
        [columns, selectedId, handleToggleFavorite, truncateElementInfo,];
        var __VLS_37;
    }
    if (__VLS_ctx.columns.propsReceived) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "props-cell props-cell-props" },
        });
        /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['props-cell-props']} */ ;
        if (row.hasPropsFlag) {
            let __VLS_40;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                variant: "outline",
                ...{ class: "text-xs font-mono" },
            }));
            const __VLS_42 = __VLS_41({
                variant: "outline",
                ...{ class: "text-xs font-mono" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            const { default: __VLS_45 } = __VLS_43.slots;
            (__VLS_ctx.getPropsPassed(row));
            // @ts-ignore
            [columns, getPropsPassed,];
            var __VLS_43;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        }
    }
    if (__VLS_ctx.columns.propsDeclared) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "props-cell props-cell-props" },
        });
        /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['props-cell-props']} */ ;
        if (row.hasPropsFlag) {
            let __VLS_46;
            /** @ts-ignore @type {typeof ___VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
                variant: "secondary",
                ...{ class: "text-xs font-mono" },
            }));
            const __VLS_48 = __VLS_47({
                variant: "secondary",
                ...{ class: "text-xs font-mono" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_47));
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            const { default: __VLS_51 } = __VLS_49.slots;
            (__VLS_ctx.getPropsDeclared(row));
            // @ts-ignore
            [columns, getPropsDeclared,];
            var __VLS_49;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "props-cell props-cell-actions virtual-table__cell-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['props-cell-actions']} */ ;
    /** @type {__VLS_StyleScopedClasses['virtual-table__cell-actions']} */ ;
    let __VLS_52;
    /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
    DropdownMenu;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
    const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const { default: __VLS_57 } = __VLS_55.slots;
    let __VLS_58;
    /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
    DropdownMenuTrigger;
    // @ts-ignore
    const __VLS_59 = __VLS_asFunctionalComponent(__VLS_58, new __VLS_58({
        asChild: true,
    }));
    const __VLS_60 = __VLS_59({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_59));
    const { default: __VLS_63 } = __VLS_61.slots;
    let __VLS_64;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-6 w-6 p-0" },
    }));
    const __VLS_66 = __VLS_65({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-6 w-6 p-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    let __VLS_69;
    const __VLS_70 = ({ click: {} },
        { onClick: () => { } });
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
    const { default: __VLS_71 } = __VLS_67.slots;
    let __VLS_72;
    /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
    MoreHorizontal;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_74 = __VLS_73({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [];
    var __VLS_67;
    var __VLS_68;
    // @ts-ignore
    [];
    var __VLS_61;
    let __VLS_77;
    /** @ts-ignore @type {typeof ___VLS_components.PropsTableActionsMenuContent} */
    PropsTableActionsMenuContent;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ 'onToggleFavorite': {} },
        ...{ 'onIgnoreByName': {} },
        variant: "dropdown",
        row: (row),
    }));
    const __VLS_79 = __VLS_78({
        ...{ 'onToggleFavorite': {} },
        ...{ 'onIgnoreByName': {} },
        variant: "dropdown",
        row: (row),
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    let __VLS_82;
    const __VLS_83 = ({ toggleFavorite: {} },
        { onToggleFavorite: (...[$event]) => {
                __VLS_ctx.emit('toggleFavorite', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_84 = ({ ignoreByName: {} },
        { onIgnoreByName: (...[$event]) => {
                __VLS_ctx.emit('ignoreByName', $event);
                // @ts-ignore
                [emit,];
            } });
    var __VLS_80;
    var __VLS_81;
    // @ts-ignore
    [];
    var __VLS_55;
    // @ts-ignore
    [];
    var __VLS_26;
    let __VLS_85;
    /** @ts-ignore @type {typeof ___VLS_components.PropsTableActionsMenuContent} */
    PropsTableActionsMenuContent;
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
        ...{ 'onToggleFavorite': {} },
        ...{ 'onIgnoreByName': {} },
        variant: "context",
        row: (row),
    }));
    const __VLS_87 = __VLS_86({
        ...{ 'onToggleFavorite': {} },
        ...{ 'onIgnoreByName': {} },
        variant: "context",
        row: (row),
    }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    let __VLS_90;
    const __VLS_91 = ({ toggleFavorite: {} },
        { onToggleFavorite: (...[$event]) => {
                __VLS_ctx.emit('toggleFavorite', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_92 = ({ ignoreByName: {} },
        { onIgnoreByName: (...[$event]) => {
                __VLS_ctx.emit('ignoreByName', $event);
                // @ts-ignore
                [emit,];
            } });
    var __VLS_88;
    var __VLS_89;
    // @ts-ignore
    [];
    var __VLS_20;
    // @ts-ignore
    [];
}
{
    const { after: __VLS_93 } = __VLS_3.slots;
    if (__VLS_ctx.isLoading && __VLS_ctx.rows.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
        for (const [i] of __VLS_getVForSourceType((__VLS_ctx.skeletonRowCount))) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: "props-row virtual-table__row flex items-center h-10 px-2 border-b border-border/50" },
            });
            /** @type {__VLS_StyleScopedClasses['props-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['virtual-table__row']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-10']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-border/50']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "props-cell props-cell-star w-10 flex justify-center" },
            });
            /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
            /** @type {__VLS_StyleScopedClasses['props-cell-star']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            let __VLS_94;
            /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
            Skeleton;
            // @ts-ignore
            const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
                ...{ class: "h-3.5 w-3.5 rounded" },
            }));
            const __VLS_96 = __VLS_95({
                ...{ class: "h-3.5 w-3.5 rounded" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_95));
            /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "props-cell props-cell-name flex-1 min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
            /** @type {__VLS_StyleScopedClasses['props-cell-name']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            let __VLS_99;
            /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
            Skeleton;
            // @ts-ignore
            const __VLS_100 = __VLS_asFunctionalComponent(__VLS_99, new __VLS_99({
                ...{ class: "h-4 w-32" },
            }));
            const __VLS_101 = __VLS_100({
                ...{ class: "h-4 w-32" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_100));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-32']} */ ;
            if (__VLS_ctx.columns.rootElement) {
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "props-cell props-cell-element" },
                });
                /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
                /** @type {__VLS_StyleScopedClasses['props-cell-element']} */ ;
                let __VLS_104;
                /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
                Skeleton;
                // @ts-ignore
                const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
                    ...{ class: "h-5 w-24" },
                }));
                const __VLS_106 = __VLS_105({
                    ...{ class: "h-5 w-24" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_105));
                /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
            }
            if (__VLS_ctx.columns.propsReceived) {
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "props-cell props-cell-props" },
                });
                /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
                /** @type {__VLS_StyleScopedClasses['props-cell-props']} */ ;
                let __VLS_109;
                /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
                Skeleton;
                // @ts-ignore
                const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({
                    ...{ class: "h-5 w-8 mx-auto" },
                }));
                const __VLS_111 = __VLS_110({
                    ...{ class: "h-5 w-8 mx-auto" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_110));
                /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
                /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            }
            if (__VLS_ctx.columns.propsDeclared) {
                __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "props-cell props-cell-props" },
                });
                /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
                /** @type {__VLS_StyleScopedClasses['props-cell-props']} */ ;
                let __VLS_114;
                /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
                Skeleton;
                // @ts-ignore
                const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
                    ...{ class: "h-5 w-8 mx-auto" },
                }));
                const __VLS_116 = __VLS_115({
                    ...{ class: "h-5 w-8 mx-auto" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_115));
                /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
                /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            }
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "props-cell props-cell-actions virtual-table__cell-actions" },
            });
            /** @type {__VLS_StyleScopedClasses['props-cell']} */ ;
            /** @type {__VLS_StyleScopedClasses['props-cell-actions']} */ ;
            /** @type {__VLS_StyleScopedClasses['virtual-table__cell-actions']} */ ;
            let __VLS_119;
            /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
            Skeleton;
            // @ts-ignore
            const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
                ...{ class: "h-6 w-6 rounded mx-auto" },
            }));
            const __VLS_121 = __VLS_120({
                ...{ class: "h-6 w-6 rounded mx-auto" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_120));
            /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            // @ts-ignore
            [rows, isLoading, columns, columns, columns, skeletonRowCount,];
        }
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
var __VLS_4;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=PropsTable.vue.js.map