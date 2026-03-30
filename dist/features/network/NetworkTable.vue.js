import { computed } from 'vue';
import VirtualTable from '@/components/VirtualTable.vue';
import { Badge } from '@/components/ui/badge';
import { ContextMenu, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { NetworkActionsMenuContent } from '@/components/NetworkActionsMenu';
import { MoreHorizontal } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { TableColumnSelector } from '@/components/ui/TableColumnSelector';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { defaultInspectorSettings } from '@/settings/inspectorSettings';
import { formatBytes, formatDuration } from '@/types/network';
import { getStatusClass } from './utils';
const props = defineProps();
const emit = defineEmits();
// Method badge variant based on HTTP method
function getMethodVariant(method) {
    switch (method.toUpperCase()) {
        case 'GET': return 'secondary';
        case 'POST': return 'default';
        case 'PUT':
        case 'PATCH': return 'outline';
        case 'DELETE': return 'destructive_text';
        default: return 'secondary';
    }
}
// Format status display
function formatStatus(entry) {
    if (entry.pending)
        return '⏳';
    if (entry.error)
        return '✗';
    return String(entry.status);
}
// Column visibility from settings
const settings = useInspectorSettingsSync();
const columns = computed(() => {
    const cols = settings.value?.networkTableColumns ?? defaultInspectorSettings.networkTableColumns;
    return cols ?? {
        status: true,
        method: true,
        name: false,
        path: true,
        time: true,
        size: true,
    };
});
function setColumn(key, value) {
    if (!settings.value)
        return;
    if (!settings.value.networkTableColumns) {
        settings.value.networkTableColumns = { ...defaultInspectorSettings.networkTableColumns };
    }
    // AnyOf: cannot disable both name and path — at least one must stay enabled
    if ((key === 'name' || key === 'path') && value === false) {
        const other = key === 'name' ? 'path' : 'name';
        const otherVal = settings.value.networkTableColumns[other];
        if (!otherVal)
            return; // would leave both disabled — reject
    }
    settings.value.networkTableColumns[key] = value;
}
// Columns that cannot be toggled off (AnyOf: name | path must stay enabled)
const networkDisabledColumns = computed(() => {
    const name = columns.value.name;
    const path = columns.value.path;
    if (name && !path)
        return ['name']; // only name on — can't disable it
    if (!name && path)
        return ['path']; // only path on — can't disable it
    return [];
});
const networkColumnDefs = [
    { key: 'status', label: 'Status' },
    { key: 'method', label: 'Method' },
    { key: 'name', label: 'Name' },
    { key: 'path', label: 'Path' },
    { key: 'time', label: 'Time' },
    { key: 'size', label: 'Size' },
];
// Sorted entries (newest first) — virtualization requires array for scroll height
const sortedEntries = computed(() => [...props.entries].reverse());
// Check if entry has an active breakpoint
function hasBreakpoint(entryId) {
    return props.breakpointEntryIds?.has(entryId) ?? false;
}
function matchesBreakpointPattern(entryId) {
    return props.breakpointMatchingIds?.has(entryId) ?? false;
}
function matchesMockPattern(entryId) {
    return props.mockMatchingIds?.has(entryId) ?? false;
}
const ROW_HEIGHT = 40;
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
/** @type {__VLS_StyleScopedClasses['network-row-breakpoint']} */ ;
/** @type {__VLS_StyleScopedClasses['network-row-mock-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['network-row']} */ ;
/** @type {__VLS_StyleScopedClasses['network-row-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['network-row-breakpoint']} */ ;
/** @type {__VLS_StyleScopedClasses['network-row-mock-selected']} */ ;
const __VLS_0 = VirtualTable || VirtualTable;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    items: (__VLS_ctx.sortedEntries),
    keyField: "id",
    itemSize: (__VLS_ctx.ROW_HEIGHT),
    minWidth: "460px",
    emptyMessage: "No network requests captured yet",
}));
const __VLS_2 = __VLS_1({
    items: (__VLS_ctx.sortedEntries),
    keyField: "id",
    itemSize: (__VLS_ctx.ROW_HEIGHT),
    minWidth: "460px",
    emptyMessage: "No network requests captured yet",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
{
    const { header: __VLS_7 } = __VLS_3.slots;
    if (__VLS_ctx.columns.status) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-status" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-status']} */ ;
    }
    if (__VLS_ctx.columns.method) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-method" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-method']} */ ;
    }
    if (__VLS_ctx.columns.name) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (['network-cell network-cell-name', __VLS_ctx.columns.path ? 'network-cell-name-with-path' : '']) },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-name']} */ ;
    }
    if (__VLS_ctx.columns.path) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-path" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-path']} */ ;
    }
    if (__VLS_ctx.columns.time) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-time" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-time']} */ ;
    }
    if (__VLS_ctx.columns.size) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-size" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-size']} */ ;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "network-cell network-cell-actions virtual-table__cell-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-cell-actions']} */ ;
    /** @type {__VLS_StyleScopedClasses['virtual-table__cell-actions']} */ ;
    let __VLS_8;
    /** @ts-ignore @type {typeof ___VLS_components.TableColumnSelector} */
    TableColumnSelector;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ 'onUpdate:column': {} },
        columns: ({ ...__VLS_ctx.columns }),
        columnDefinitions: (__VLS_ctx.networkColumnDefs),
        disabledColumns: (__VLS_ctx.networkDisabledColumns),
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onUpdate:column': {} },
        columns: ({ ...__VLS_ctx.columns }),
        columnDefinitions: (__VLS_ctx.networkColumnDefs),
        disabledColumns: (__VLS_ctx.networkDisabledColumns),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_13;
    const __VLS_14 = ({ 'update:column': {} },
        { 'onUpdate:column': ((k, v) => __VLS_ctx.setColumn(k, v)) });
    var __VLS_11;
    var __VLS_12;
    // @ts-ignore
    [sortedEntries, ROW_HEIGHT, columns, columns, columns, columns, columns, columns, columns, columns, networkColumnDefs, networkDisabledColumns, setColumn,];
}
{
    const { default: __VLS_15 } = __VLS_3.slots;
    const [{ item: entry }] = __VLS_getSlotParameters(__VLS_15);
    let __VLS_16;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
    ContextMenu;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
    const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
    const { default: __VLS_21 } = __VLS_19.slots;
    let __VLS_22;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
    ContextMenuTrigger;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
        asChild: true,
    }));
    const __VLS_24 = __VLS_23({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    const { default: __VLS_27 } = __VLS_25.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('select', entry.id);
                // @ts-ignore
                [emit,];
            } },
        ...{ class: "network-row virtual-table__row" },
        ...{ class: ({
                'network-row-selected': __VLS_ctx.selectedId === entry.id && !__VLS_ctx.hasBreakpoint(entry.id) && !__VLS_ctx.matchesMockPattern(entry.id),
                'network-row-pending': entry.pending,
                'network-row-breakpoint': __VLS_ctx.hasBreakpoint(entry.id),
                'network-row-breakpoint-match': __VLS_ctx.matchesBreakpointPattern(entry.id) && !__VLS_ctx.hasBreakpoint(entry.id) && !__VLS_ctx.matchesMockPattern(entry.id),
                'network-row-mock-selected': __VLS_ctx.matchesMockPattern(entry.id) && __VLS_ctx.selectedId === entry.id && !__VLS_ctx.hasBreakpoint(entry.id),
                'network-row-mock-match': __VLS_ctx.matchesMockPattern(entry.id) && __VLS_ctx.selectedId !== entry.id && !__VLS_ctx.hasBreakpoint(entry.id)
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['network-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['virtual-table__row']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-row-selected']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-row-pending']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-row-breakpoint']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-row-breakpoint-match']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-row-mock-selected']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-row-mock-match']} */ ;
    if (__VLS_ctx.columns.status) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-status" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-status']} */ ;
        let __VLS_28;
        /** @ts-ignore @type {typeof ___VLS_components.Badge} */
        Badge;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
            variant: "outline",
            ...{ class: "text-xs font-mono px-1.5 py-0" },
            ...{ class: (__VLS_ctx.getStatusClass(entry.status, entry.pending)) },
        }));
        const __VLS_30 = __VLS_29({
            variant: "outline",
            ...{ class: "text-xs font-mono px-1.5 py-0" },
            ...{ class: (__VLS_ctx.getStatusClass(entry.status, entry.pending)) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0']} */ ;
        const { default: __VLS_33 } = __VLS_31.slots;
        (__VLS_ctx.formatStatus(entry));
        // @ts-ignore
        [columns, selectedId, selectedId, selectedId, hasBreakpoint, hasBreakpoint, hasBreakpoint, hasBreakpoint, hasBreakpoint, matchesMockPattern, matchesMockPattern, matchesMockPattern, matchesMockPattern, matchesBreakpointPattern, getStatusClass, formatStatus,];
        var __VLS_31;
    }
    if (__VLS_ctx.columns.method) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-method" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-method']} */ ;
        let __VLS_34;
        /** @ts-ignore @type {typeof ___VLS_components.Badge} */
        Badge;
        // @ts-ignore
        const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
            variant: (__VLS_ctx.getMethodVariant(entry.method)),
            ...{ class: "text-xs font-mono px-1.5 py-0" },
        }));
        const __VLS_36 = __VLS_35({
            variant: (__VLS_ctx.getMethodVariant(entry.method)),
            ...{ class: "text-xs font-mono px-1.5 py-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_35));
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0']} */ ;
        const { default: __VLS_39 } = __VLS_37.slots;
        (entry.method);
        // @ts-ignore
        [columns, getMethodVariant,];
        var __VLS_37;
    }
    if (__VLS_ctx.columns.name) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (['network-cell network-cell-name', __VLS_ctx.columns.path ? 'network-cell-name-with-path' : '']) },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-name']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "truncate text-sm" },
            title: (entry.url),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        (entry.name);
    }
    if (__VLS_ctx.columns.path) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-path" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-path']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "truncate text-sm" },
            title: (entry.url),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        (entry.path);
        if (entry.error) {
            __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs text-destructive_text truncate" },
                title: (entry.error),
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (entry.error);
        }
    }
    if (__VLS_ctx.columns.time) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-time" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-time']} */ ;
        (entry.pending ? '...' : __VLS_ctx.formatDuration(entry.duration));
    }
    if (__VLS_ctx.columns.size) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "network-cell network-cell-size" },
        });
        /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['network-cell-size']} */ ;
        (entry.pending ? '...' : __VLS_ctx.formatBytes(entry.size));
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "network-cell network-cell-actions virtual-table__cell-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['network-cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['network-cell-actions']} */ ;
    /** @type {__VLS_StyleScopedClasses['virtual-table__cell-actions']} */ ;
    let __VLS_40;
    /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
    DropdownMenu;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const { default: __VLS_45 } = __VLS_43.slots;
    let __VLS_46;
    /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
    DropdownMenuTrigger;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
        asChild: true,
    }));
    const __VLS_48 = __VLS_47({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    const { default: __VLS_51 } = __VLS_49.slots;
    let __VLS_52;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-6 w-6 p-0" },
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "icon",
        ...{ class: "h-6 w-6 p-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_57;
    const __VLS_58 = ({ click: {} },
        { onClick: () => { } });
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
    const { default: __VLS_59 } = __VLS_55.slots;
    let __VLS_60;
    /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
    MoreHorizontal;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [columns, columns, columns, columns, columns, formatDuration, formatBytes,];
    var __VLS_55;
    var __VLS_56;
    // @ts-ignore
    [];
    var __VLS_49;
    let __VLS_65;
    /** @ts-ignore @type {typeof ___VLS_components.NetworkActionsMenuContent} */
    NetworkActionsMenuContent;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        ...{ 'onCopyCurl': {} },
        ...{ 'onSetBreakpoint': {} },
        ...{ 'onMockResponse': {} },
        ...{ 'onToggleBreakpoint': {} },
        ...{ 'onDeleteBreakpoint': {} },
        ...{ 'onToggleMock': {} },
        ...{ 'onDeleteMock': {} },
        variant: "dropdown",
        entry: (entry),
        breakpointMatchingIds: (__VLS_ctx.breakpointMatchingIds),
        mockMatchingIds: (__VLS_ctx.mockMatchingIds),
        allBreakpoints: (__VLS_ctx.allBreakpoints),
        allMocks: (__VLS_ctx.allMocks),
    }));
    const __VLS_67 = __VLS_66({
        ...{ 'onCopyCurl': {} },
        ...{ 'onSetBreakpoint': {} },
        ...{ 'onMockResponse': {} },
        ...{ 'onToggleBreakpoint': {} },
        ...{ 'onDeleteBreakpoint': {} },
        ...{ 'onToggleMock': {} },
        ...{ 'onDeleteMock': {} },
        variant: "dropdown",
        entry: (entry),
        breakpointMatchingIds: (__VLS_ctx.breakpointMatchingIds),
        mockMatchingIds: (__VLS_ctx.mockMatchingIds),
        allBreakpoints: (__VLS_ctx.allBreakpoints),
        allMocks: (__VLS_ctx.allMocks),
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    let __VLS_70;
    const __VLS_71 = ({ copyCurl: {} },
        { onCopyCurl: (...[$event]) => {
                __VLS_ctx.emit('copyCurl', $event);
                // @ts-ignore
                [emit, breakpointMatchingIds, mockMatchingIds, allBreakpoints, allMocks,];
            } });
    const __VLS_72 = ({ setBreakpoint: {} },
        { onSetBreakpoint: (...[$event]) => {
                __VLS_ctx.emit('setBreakpoint', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_73 = ({ mockResponse: {} },
        { onMockResponse: (...[$event]) => {
                __VLS_ctx.emit('mockResponse', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_74 = ({ toggleBreakpoint: {} },
        { onToggleBreakpoint: (...[$event]) => {
                __VLS_ctx.emit('toggleBreakpoint', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_75 = ({ deleteBreakpoint: {} },
        { onDeleteBreakpoint: (...[$event]) => {
                __VLS_ctx.emit('deleteBreakpoint', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_76 = ({ toggleMock: {} },
        { onToggleMock: (...[$event]) => {
                __VLS_ctx.emit('toggleMock', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_77 = ({ deleteMock: {} },
        { onDeleteMock: (...[$event]) => {
                __VLS_ctx.emit('deleteMock', $event);
                // @ts-ignore
                [emit,];
            } });
    var __VLS_68;
    var __VLS_69;
    // @ts-ignore
    [];
    var __VLS_43;
    // @ts-ignore
    [];
    var __VLS_25;
    let __VLS_78;
    /** @ts-ignore @type {typeof ___VLS_components.NetworkActionsMenuContent} */
    NetworkActionsMenuContent;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
        ...{ 'onCopyCurl': {} },
        ...{ 'onSetBreakpoint': {} },
        ...{ 'onMockResponse': {} },
        ...{ 'onToggleBreakpoint': {} },
        ...{ 'onDeleteBreakpoint': {} },
        ...{ 'onToggleMock': {} },
        ...{ 'onDeleteMock': {} },
        variant: "context",
        entry: (entry),
        breakpointMatchingIds: (__VLS_ctx.breakpointMatchingIds),
        mockMatchingIds: (__VLS_ctx.mockMatchingIds),
        allBreakpoints: (__VLS_ctx.allBreakpoints),
        allMocks: (__VLS_ctx.allMocks),
    }));
    const __VLS_80 = __VLS_79({
        ...{ 'onCopyCurl': {} },
        ...{ 'onSetBreakpoint': {} },
        ...{ 'onMockResponse': {} },
        ...{ 'onToggleBreakpoint': {} },
        ...{ 'onDeleteBreakpoint': {} },
        ...{ 'onToggleMock': {} },
        ...{ 'onDeleteMock': {} },
        variant: "context",
        entry: (entry),
        breakpointMatchingIds: (__VLS_ctx.breakpointMatchingIds),
        mockMatchingIds: (__VLS_ctx.mockMatchingIds),
        allBreakpoints: (__VLS_ctx.allBreakpoints),
        allMocks: (__VLS_ctx.allMocks),
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    let __VLS_83;
    const __VLS_84 = ({ copyCurl: {} },
        { onCopyCurl: (...[$event]) => {
                __VLS_ctx.emit('copyCurl', $event);
                // @ts-ignore
                [emit, breakpointMatchingIds, mockMatchingIds, allBreakpoints, allMocks,];
            } });
    const __VLS_85 = ({ setBreakpoint: {} },
        { onSetBreakpoint: (...[$event]) => {
                __VLS_ctx.emit('setBreakpoint', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_86 = ({ mockResponse: {} },
        { onMockResponse: (...[$event]) => {
                __VLS_ctx.emit('mockResponse', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_87 = ({ toggleBreakpoint: {} },
        { onToggleBreakpoint: (...[$event]) => {
                __VLS_ctx.emit('toggleBreakpoint', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_88 = ({ deleteBreakpoint: {} },
        { onDeleteBreakpoint: (...[$event]) => {
                __VLS_ctx.emit('deleteBreakpoint', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_89 = ({ toggleMock: {} },
        { onToggleMock: (...[$event]) => {
                __VLS_ctx.emit('toggleMock', $event);
                // @ts-ignore
                [emit,];
            } });
    const __VLS_90 = ({ deleteMock: {} },
        { onDeleteMock: (...[$event]) => {
                __VLS_ctx.emit('deleteMock', $event);
                // @ts-ignore
                [emit,];
            } });
    var __VLS_81;
    var __VLS_82;
    // @ts-ignore
    [];
    var __VLS_19;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=NetworkTable.vue.js.map