import { computed, ref } from 'vue';
import { TableCell } from '@/components/ui/table';
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue';
import SettingsTableSection from '../components/SettingsTableSection.vue';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Power, Trash } from 'lucide-vue-next';
const props = defineProps();
const emit = defineEmits();
const searchItems = [
    { key: 'byName', label: 'Search by component name' },
    { key: 'byLabel', label: 'Search by component label' },
    { key: 'byRootElement', label: 'Search by root element' },
    { key: 'byKey', label: 'Search by key' },
    { key: 'byValue', label: 'Search by value' },
];
function toggleSearch(key) {
    props.settings.propsSearch[key] = !props.settings.propsSearch[key];
}
const newBlockedName = ref('');
const blacklistError = ref(null);
const blacklistRows = computed(() => {
    return [
        ...props.settings.blacklist.active.map(name => ({ name, active: true })),
        ...props.settings.blacklist.inactive.map(name => ({ name, active: false })),
    ];
});
const blacklistColumns = [
    { header: 'Component Name' },
    { header: 'Status', width: '70px', class: 'text-center' },
];
function addToBlacklist() {
    const value = newBlockedName.value.trim();
    blacklistError.value = null;
    if (!value) {
        blacklistError.value = 'Name cannot be empty';
        return;
    }
    if (props.settings.blacklist.active.includes(value) || props.settings.blacklist.inactive.includes(value)) {
        blacklistError.value = 'This name is already in the blacklist';
        return;
    }
    props.settings.blacklist.active.push(value);
    newBlockedName.value = '';
}
function toggleBlacklist(name, active) {
    const from = active ? props.settings.blacklist.active : props.settings.blacklist.inactive;
    const to = active ? props.settings.blacklist.inactive : props.settings.blacklist.active;
    const index = from.indexOf(name);
    if (index !== -1) {
        from.splice(index, 1);
        to.push(name);
    }
}
function removeFromBlacklist(name) {
    props.settings.blacklist.active = props.settings.blacklist.active.filter(n => n !== name);
    props.settings.blacklist.inactive = props.settings.blacklist.inactive.filter(n => n !== name);
}
function getBlacklistActions(row) {
    return [
        { label: row.active ? 'Allow' : 'Block', icon: Power, onClick: () => toggleBlacklist(row.name, row.active) },
        { label: 'Delete', icon: Trash, onClick: () => removeFromBlacklist(row.name), destructiveText: true },
    ];
}
// -------------------- FAVORITES --------------------
const favoritesList = computed(() => props.settings.favorites || []);
const favoritesColumns = [
    { header: 'Component' },
    { header: 'Added', width: '80px', class: 'text-center' },
];
function removeFromFavorites(id) {
    props.settings.favorites = props.settings.favorites.filter(f => f.id !== id);
}
function getFavoritesActions(fav) {
    return [
        { label: 'Delete', icon: Trash, onClick: () => removeFromFavorites(fav.id), destructiveText: true },
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
    searchSettings: __VLS_ctx.settings.propsSearch,
    searchItems: (__VLS_ctx.searchItems),
    idPrefix: "props-search",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onToggle': {} },
    searchSettings: __VLS_ctx.settings.propsSearch,
    searchItems: (__VLS_ctx.searchItems),
    idPrefix: "props-search",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ toggle: {} },
    { onToggle: ((k) => __VLS_ctx.toggleSearch(k)) });
var __VLS_3;
var __VLS_4;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4 border-t border-border pt-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-border']} */ ;
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
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.Checkbox} */
Checkbox;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ 'onUpdate:modelValue': {} },
    id: "props-collapse-overlay-inspect",
    modelValue: (__VLS_ctx.settings.collapseOverlayOnPropsInspect),
}));
const __VLS_9 = __VLS_8({
    ...{ 'onUpdate:modelValue': {} },
    id: "props-collapse-overlay-inspect",
    modelValue: (__VLS_ctx.settings.collapseOverlayOnPropsInspect),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.settings.collapseOverlayOnPropsInspect = $event;
            // @ts-ignore
            [settings, settings, settings, searchItems, toggleSearch,];
        } });
var __VLS_10;
var __VLS_11;
let __VLS_14;
/** @ts-ignore @type {typeof ___VLS_components.Label} */
Label;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
    for: "props-collapse-overlay-inspect",
    ...{ class: "text-sm leading-snug cursor-pointer" },
}));
const __VLS_16 = __VLS_15({
    for: "props-collapse-overlay-inspect",
    ...{ class: "text-sm leading-snug cursor-pointer" },
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-snug']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
const { default: __VLS_19 } = __VLS_17.slots;
// @ts-ignore
[];
var __VLS_17;
const __VLS_20 = SettingsTableSection || SettingsTableSection;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ 'onAdd': {} },
    ...{ 'onSelect': {} },
    title: "Component Blacklist",
    columns: (__VLS_ctx.blacklistColumns),
    rows: (__VLS_ctx.blacklistRows),
    rowKey: ((r) => r.name),
    getActions: ((row) => __VLS_ctx.getBlacklistActions(row)),
    emptyMessage: "No components in blacklist",
    selectedItemId: (__VLS_ctx.selectedItemId),
    showAdd: true,
    addPlaceholder: "Component name (supports wildcards: *Comp*)",
    addModelValue: (__VLS_ctx.newBlockedName),
    addError: (__VLS_ctx.blacklistError),
}));
const __VLS_22 = __VLS_21({
    ...{ 'onAdd': {} },
    ...{ 'onSelect': {} },
    title: "Component Blacklist",
    columns: (__VLS_ctx.blacklistColumns),
    rows: (__VLS_ctx.blacklistRows),
    rowKey: ((r) => r.name),
    getActions: ((row) => __VLS_ctx.getBlacklistActions(row)),
    emptyMessage: "No components in blacklist",
    selectedItemId: (__VLS_ctx.selectedItemId),
    showAdd: true,
    addPlaceholder: "Component name (supports wildcards: *Comp*)",
    addModelValue: (__VLS_ctx.newBlockedName),
    addError: (__VLS_ctx.blacklistError),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_25;
const __VLS_26 = ({ add: {} },
    { onAdd: (__VLS_ctx.addToBlacklist) });
const __VLS_27 = ({ select: {} },
    { onSelect: ((row) => __VLS_ctx.emit('select', { type: 'blacklist', id: row.name })) });
const { default: __VLS_28 } = __VLS_23.slots;
{
    const { row: __VLS_29 } = __VLS_23.slots;
    const [{ row }] = __VLS_getSlotParameters(__VLS_29);
    let __VLS_30;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "overflow-hidden !py-2" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "overflow-hidden !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_35 } = __VLS_33.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "font-mono text-sm truncate" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (row.name);
    // @ts-ignore
    [blacklistColumns, blacklistRows, getBlacklistActions, selectedItemId, newBlockedName, blacklistError, addToBlacklist, emit,];
    var __VLS_33;
    let __VLS_36;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ class: "w-[70px] text-center !py-2" },
    }));
    const __VLS_38 = __VLS_37({
        ...{ class: "w-[70px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    /** @type {__VLS_StyleScopedClasses['w-[70px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_41 } = __VLS_39.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (!row.active ? 'opacity-50' : '') },
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.active ? 'Blocked' : 'Allowed');
    // @ts-ignore
    [];
    var __VLS_39;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_23;
var __VLS_24;
const __VLS_42 = SettingsTableSection || SettingsTableSection;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
    ...{ 'onSelect': {} },
    sectionId: "favorites-section",
    title: "Favorite Components",
    columns: (__VLS_ctx.favoritesColumns),
    rows: (__VLS_ctx.favoritesList),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getFavoritesActions(row)),
    emptyMessage: "No favorite components",
    selectedItemId: (__VLS_ctx.selectedItemId),
}));
const __VLS_44 = __VLS_43({
    ...{ 'onSelect': {} },
    sectionId: "favorites-section",
    title: "Favorite Components",
    columns: (__VLS_ctx.favoritesColumns),
    rows: (__VLS_ctx.favoritesList),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getFavoritesActions(row)),
    emptyMessage: "No favorite components",
    selectedItemId: (__VLS_ctx.selectedItemId),
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
let __VLS_47;
const __VLS_48 = ({ select: {} },
    { onSelect: ((row) => __VLS_ctx.emit('select', { type: 'favorite', id: row.id })) });
const { default: __VLS_49 } = __VLS_45.slots;
{
    const { row: __VLS_50 } = __VLS_45.slots;
    const [{ row }] = __VLS_getSlotParameters(__VLS_50);
    let __VLS_51;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({
        ...{ class: "overflow-hidden !py-2" },
    }));
    const __VLS_53 = __VLS_52({
        ...{ class: "overflow-hidden !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_52));
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_56 } = __VLS_54.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-mono text-sm truncate" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (row.name);
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs text-muted-foreground mt-0.5 font-mono truncate" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (row.tagName);
    (row.className ? '.' + row.className : '');
    // @ts-ignore
    [selectedItemId, emit, favoritesColumns, favoritesList, getFavoritesActions,];
    var __VLS_54;
    let __VLS_57;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        ...{ class: "w-[80px] text-center !py-2" },
    }));
    const __VLS_59 = __VLS_58({
        ...{ class: "w-[80px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    /** @type {__VLS_StyleScopedClasses['w-[80px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_62 } = __VLS_60.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (new Date(row.timestamp).toLocaleDateString());
    // @ts-ignore
    [];
    var __VLS_60;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_45;
var __VLS_46;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=PropsSection.vue.js.map