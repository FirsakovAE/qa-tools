import { computed } from 'vue';
import { TableCell } from '@/components/ui/table';
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue';
import SettingsTableSection from '../components/SettingsTableSection.vue';
import { Power, Trash, Pencil } from 'lucide-vue-next';
const props = defineProps();
const emit = defineEmits();
const searchItems = [
    { key: 'byStatus', label: 'Search by status code' },
    { key: 'byMethod', label: 'Search by method' },
    { key: 'byPath', label: 'Search by path' },
    { key: 'byName', label: 'Search by name' },
    { key: 'byKey', label: 'Search by key' },
    { key: 'byValue', label: 'Search by value' },
];
function toggleSearch(key) {
    props.settings.networkSearch[key] = !props.settings.networkSearch[key];
}
const breakpointRows = computed(() => {
    if (!props.settings.breakpoints)
        return [];
    return [
        ...props.settings.breakpoints.active.map(bp => ({ ...bp, active: true })),
        ...props.settings.breakpoints.inactive.map(bp => ({ ...bp, active: false })),
    ];
});
const breakpointColumns = [
    { header: 'Description' },
    { header: 'Status', width: '70px', class: 'text-center' },
];
function toggleBreakpoint(breakpointId, currentlyActive) {
    const bps = props.settings.breakpoints;
    const from = currentlyActive ? bps.active : bps.inactive;
    const to = currentlyActive ? bps.inactive : bps.active;
    const index = from.findIndex(bp => bp.id === breakpointId);
    if (index !== -1) {
        const [bp] = from.splice(index, 1);
        to.push(bp);
    }
}
function removeBreakpoint(breakpointId) {
    props.settings.breakpoints.active = props.settings.breakpoints.active.filter(bp => bp.id !== breakpointId);
    props.settings.breakpoints.inactive = props.settings.breakpoints.inactive.filter(bp => bp.id !== breakpointId);
}
function formatBreakpointUrl(bp) {
    let url = `${bp.scheme}://${bp.host}`;
    if (bp.port)
        url += `:${bp.port}`;
    url += bp.path;
    if (bp.query)
        url += `?${bp.query}`;
    return url;
}
function getBreakpointActions(row) {
    return [
        { label: 'Edit', icon: Pencil, onClick: () => emit('edit-breakpoint', row.id) },
        { label: row.active ? 'Disable' : 'Enable', icon: Power, onClick: () => toggleBreakpoint(row.id, row.active) },
        { label: 'Delete', icon: Trash, onClick: () => removeBreakpoint(row.id), destructiveText: true },
    ];
}
const mockRows = computed(() => {
    if (!props.settings.mocks)
        return [];
    return [
        ...props.settings.mocks.active.map(m => ({ ...m, active: true })),
        ...props.settings.mocks.inactive.map(m => ({ ...m, active: false })),
    ];
});
const mockColumns = [
    { header: 'Description' },
    { header: 'Code', width: '60px', class: 'text-center' },
    { header: 'Delay', width: '60px', class: 'text-center' },
    { header: 'Status', width: '60px', class: 'text-center' },
];
function toggleMock(mockId, currentlyActive) {
    const mocks = props.settings.mocks;
    const from = currentlyActive ? mocks.active : mocks.inactive;
    const to = currentlyActive ? mocks.inactive : mocks.active;
    const index = from.findIndex(m => m.id === mockId);
    if (index !== -1) {
        const [mock] = from.splice(index, 1);
        to.push(mock);
    }
}
function removeMock(mockId) {
    props.settings.mocks.active = props.settings.mocks.active.filter(m => m.id !== mockId);
    props.settings.mocks.inactive = props.settings.mocks.inactive.filter(m => m.id !== mockId);
}
function formatMockUrl(mock) {
    let url = '';
    if (mock.method)
        url += `${mock.method} `;
    url += `${mock.scheme || '*'}://${mock.host || '*'}`;
    if (mock.port)
        url += `:${mock.port}`;
    url += mock.path || '/*';
    if (mock.query)
        url += `?${mock.query}`;
    return url;
}
function getMockActions(row) {
    return [
        { label: 'Edit', icon: Pencil, onClick: () => emit('edit-mock', row.id) },
        { label: row.active ? 'Disable' : 'Enable', icon: Power, onClick: () => toggleMock(row.id, row.active) },
        { label: 'Delete', icon: Trash, onClick: () => removeMock(row.id), destructiveText: true },
    ];
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
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
const __VLS_0 = SearchSettingsBlock;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onToggle': {} },
    searchSettings: __VLS_ctx.settings.networkSearch,
    searchItems: (__VLS_ctx.searchItems),
    idPrefix: "network-search",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onToggle': {} },
    searchSettings: __VLS_ctx.settings.networkSearch,
    searchItems: (__VLS_ctx.searchItems),
    idPrefix: "network-search",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ toggle: {} },
    { onToggle: ((k) => __VLS_ctx.toggleSearch(k)) });
var __VLS_3;
var __VLS_4;
const __VLS_7 = SettingsTableSection || SettingsTableSection;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ 'onSelect': {} },
    sectionId: "breakpoints-section",
    title: "Breakpoints Requests",
    description: "Network requests matching these patterns will be paused for inspection.",
    columns: (__VLS_ctx.breakpointColumns),
    rows: (__VLS_ctx.breakpointRows),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getBreakpointActions(row)),
    emptyMessage: "No breakpoints configured. Set breakpoints from the Network tab.",
    selectedItemId: (__VLS_ctx.selectedItemId),
}));
const __VLS_9 = __VLS_8({
    ...{ 'onSelect': {} },
    sectionId: "breakpoints-section",
    title: "Breakpoints Requests",
    description: "Network requests matching these patterns will be paused for inspection.",
    columns: (__VLS_ctx.breakpointColumns),
    rows: (__VLS_ctx.breakpointRows),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getBreakpointActions(row)),
    emptyMessage: "No breakpoints configured. Set breakpoints from the Network tab.",
    selectedItemId: (__VLS_ctx.selectedItemId),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ select: {} },
    { onSelect: ((row) => __VLS_ctx.emit('select', { type: 'breakpoint', id: row.id })) });
const { default: __VLS_14 } = __VLS_10.slots;
{
    const { row: __VLS_15 } = __VLS_10.slots;
    const [{ row }] = __VLS_getSlotParameters(__VLS_15);
    let __VLS_16;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ class: "overflow-hidden !py-2" },
    }));
    const __VLS_18 = __VLS_17({
        ...{ class: "overflow-hidden !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_21 } = __VLS_19.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "text-sm truncate" },
        title: (row.description || __VLS_ctx.formatBreakpointUrl(row)),
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (row.description || __VLS_ctx.formatBreakpointUrl(row));
    // @ts-ignore
    [settings, searchItems, toggleSearch, breakpointColumns, breakpointRows, getBreakpointActions, selectedItemId, emit, formatBreakpointUrl, formatBreakpointUrl,];
    var __VLS_19;
    let __VLS_22;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
        ...{ class: "w-[70px] text-center !py-2" },
    }));
    const __VLS_24 = __VLS_23({
        ...{ class: "w-[70px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    /** @type {__VLS_StyleScopedClasses['w-[70px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_27 } = __VLS_25.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.active ? 'Active' : 'Off');
    // @ts-ignore
    [];
    var __VLS_25;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_10;
var __VLS_11;
const __VLS_28 = SettingsTableSection || SettingsTableSection;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ 'onSelect': {} },
    sectionId: "mocks-section",
    title: "Mocks Responses",
    description: "Matching requests will return fake responses without hitting the network.",
    columns: (__VLS_ctx.mockColumns),
    rows: (__VLS_ctx.mockRows),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getMockActions(row)),
    emptyMessage: "No mocks configured. Click &quot;Mock Response&quot; on any request in the Network tab.",
    selectedItemId: (__VLS_ctx.selectedItemId),
}));
const __VLS_30 = __VLS_29({
    ...{ 'onSelect': {} },
    sectionId: "mocks-section",
    title: "Mocks Responses",
    description: "Matching requests will return fake responses without hitting the network.",
    columns: (__VLS_ctx.mockColumns),
    rows: (__VLS_ctx.mockRows),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getMockActions(row)),
    emptyMessage: "No mocks configured. Click &quot;Mock Response&quot; on any request in the Network tab.",
    selectedItemId: (__VLS_ctx.selectedItemId),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_33;
const __VLS_34 = ({ select: {} },
    { onSelect: ((row) => __VLS_ctx.emit('select', { type: 'mock', id: row.id })) });
const { default: __VLS_35 } = __VLS_31.slots;
{
    const { row: __VLS_36 } = __VLS_31.slots;
    const [{ row }] = __VLS_getSlotParameters(__VLS_36);
    let __VLS_37;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
        ...{ class: "overflow-hidden !py-2" },
    }));
    const __VLS_39 = __VLS_38({
        ...{ class: "overflow-hidden !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_42 } = __VLS_40.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "text-sm truncate" },
        title: (row.description || __VLS_ctx.formatMockUrl(row)),
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (row.description || __VLS_ctx.formatMockUrl(row));
    // @ts-ignore
    [selectedItemId, emit, mockColumns, mockRows, getMockActions, formatMockUrl, formatMockUrl,];
    var __VLS_40;
    let __VLS_43;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({
        ...{ class: "w-[60px] text-center !py-2" },
    }));
    const __VLS_45 = __VLS_44({
        ...{ class: "w-[60px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    /** @type {__VLS_StyleScopedClasses['w-[60px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_48 } = __VLS_46.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                !row.active ? 'opacity-50' : '',
                'text-xs font-mono',
                row.status >= 200 && row.status < 300 ? 'text-green-500' : '',
                row.status >= 400 && row.status < 500 ? 'text-orange-500' : '',
                row.status >= 500 ? 'text-red-500' : ''
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (row.status);
    // @ts-ignore
    [];
    var __VLS_46;
    let __VLS_49;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
        ...{ class: "w-[60px] text-center !py-2" },
    }));
    const __VLS_51 = __VLS_50({
        ...{ class: "w-[60px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    /** @type {__VLS_StyleScopedClasses['w-[60px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_54 } = __VLS_52.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (row.delay ? `${row.delay}ms` : '-');
    // @ts-ignore
    [];
    var __VLS_52;
    let __VLS_55;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
        ...{ class: "w-[60px] text-center !py-2" },
    }));
    const __VLS_57 = __VLS_56({
        ...{ class: "w-[60px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    /** @type {__VLS_StyleScopedClasses['w-[60px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_60 } = __VLS_58.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.active ? 'Active' : 'Off');
    // @ts-ignore
    [];
    var __VLS_58;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_31;
var __VLS_32;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=NetworkSection.vue.js.map