import { computed, ref } from 'vue';
import { TableCell } from '@/components/ui/table';
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue';
import SettingsTableSection from '../components/SettingsTableSection.vue';
import { Pencil, Trash } from 'lucide-vue-next';
const props = defineProps();
const emit = defineEmits();
const searchItems = [
    { key: 'byName', label: 'Search by store name' },
    { key: 'byKey', label: 'Search by key' },
    { key: 'byValue', label: 'Search by value' },
];
function toggleSearch(key) {
    props.settings.piniaSearch[key] = !props.settings.piniaSearch[key];
}
// -------------------- FAVORITES --------------------
const newStoreName = ref('');
const addStoreError = ref(null);
const piniaFavoritesList = computed(() => props.settings.piniaFavorites || []);
const favoritesColumns = [
    { header: 'Store Name' },
    { header: 'Added', width: '80px', class: 'text-center' },
];
function addToFavoritesByName() {
    const value = newStoreName.value.trim();
    addStoreError.value = null;
    if (!value) {
        addStoreError.value = 'Name cannot be empty';
        return;
    }
    const exists = props.settings.piniaFavorites.some(f => f.id === value || f.name === value);
    if (exists) {
        addStoreError.value = 'This store is already in favorites';
        return;
    }
    props.settings.piniaFavorites.push({
        id: value,
        name: value,
        timestamp: new Date().toISOString()
    });
    newStoreName.value = '';
}
function removeFromFavorites(id) {
    props.settings.piniaFavorites = props.settings.piniaFavorites.filter(f => f.id !== id);
}
function getPiniaFavoriteActions(fav) {
    return [
        { label: 'Edit', icon: Pencil, onClick: () => emit('edit', { type: 'pinia-favorite', id: fav.id }) },
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
    searchSettings: __VLS_ctx.settings.piniaSearch,
    searchItems: (__VLS_ctx.searchItems),
    idPrefix: "pinia-search",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onToggle': {} },
    searchSettings: __VLS_ctx.settings.piniaSearch,
    searchItems: (__VLS_ctx.searchItems),
    idPrefix: "pinia-search",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ toggle: {} },
    { onToggle: ((k) => __VLS_ctx.toggleSearch(k)) });
var __VLS_3;
var __VLS_4;
const __VLS_7 = SettingsTableSection || SettingsTableSection;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ 'onAdd': {} },
    ...{ 'onSelect': {} },
    sectionId: "pinia-favorites-section",
    title: "Favorite Stores",
    columns: (__VLS_ctx.favoritesColumns),
    rows: (__VLS_ctx.piniaFavoritesList),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getPiniaFavoriteActions(row)),
    emptyMessage: "No favorite stores",
    selectedItemId: (__VLS_ctx.selectedItemId),
    showAdd: true,
    addPlaceholder: "Store name (supports wildcards: *Store*)",
    addModelValue: (__VLS_ctx.newStoreName),
    addError: (__VLS_ctx.addStoreError),
}));
const __VLS_9 = __VLS_8({
    ...{ 'onAdd': {} },
    ...{ 'onSelect': {} },
    sectionId: "pinia-favorites-section",
    title: "Favorite Stores",
    columns: (__VLS_ctx.favoritesColumns),
    rows: (__VLS_ctx.piniaFavoritesList),
    rowKey: ((r) => r.id),
    getActions: ((row) => __VLS_ctx.getPiniaFavoriteActions(row)),
    emptyMessage: "No favorite stores",
    selectedItemId: (__VLS_ctx.selectedItemId),
    showAdd: true,
    addPlaceholder: "Store name (supports wildcards: *Store*)",
    addModelValue: (__VLS_ctx.newStoreName),
    addError: (__VLS_ctx.addStoreError),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ add: {} },
    { onAdd: (__VLS_ctx.addToFavoritesByName) });
const __VLS_14 = ({ select: {} },
    { onSelect: ((row) => __VLS_ctx.emit('select', { type: 'pinia-favorite', id: row.id })) });
const { default: __VLS_15 } = __VLS_10.slots;
{
    const { row: __VLS_16 } = __VLS_10.slots;
    const [{ row }] = __VLS_getSlotParameters(__VLS_16);
    let __VLS_17;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        ...{ class: "overflow-hidden !py-2" },
    }));
    const __VLS_19 = __VLS_18({
        ...{ class: "overflow-hidden !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_22 } = __VLS_20.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-mono text-sm truncate" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (row.name);
    // @ts-ignore
    [settings, searchItems, toggleSearch, favoritesColumns, piniaFavoritesList, getPiniaFavoriteActions, selectedItemId, newStoreName, addStoreError, addToFavoritesByName, emit,];
    var __VLS_20;
    let __VLS_23;
    /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
    TableCell;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
        ...{ class: "w-[80px] text-center !py-2" },
    }));
    const __VLS_25 = __VLS_24({
        ...{ class: "w-[80px] text-center !py-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    /** @type {__VLS_StyleScopedClasses['w-[80px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['!py-2']} */ ;
    const { default: __VLS_28 } = __VLS_26.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (new Date(row.timestamp).toLocaleDateString());
    // @ts-ignore
    [];
    var __VLS_26;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_10;
var __VLS_11;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=PiniaSection.vue.js.map