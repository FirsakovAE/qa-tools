import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, MoreHorizontal } from 'lucide-vue-next';
import { ContextMenu, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { DropdownMenu, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { PiniaTableActionsMenuContent } from '@/components/PiniaTableActionsMenu';
import { TableColumnSelector } from '@/components/ui/TableColumnSelector';
import { Skeleton } from '@/components/ui/Skeleton';
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings';
import { defaultInspectorSettings } from '@/settings/inspectorSettings';
import { isStoreInFavorites } from '@/utils/piniaFavoritesMatcher';
const props = defineProps();
const emit = defineEmits();
function isFavorite(store) {
    if (!props.piniaFavorites?.length)
        return false;
    const name = store.baseId || '';
    return isStoreInFavorites(name, props.piniaFavorites);
}
function handleToggleFavorite(event, store) {
    event.stopPropagation();
    emit('toggleFavorite', store);
}
// Has state
function hasStateKeys(store) {
    return store.stateKeys > 0;
}
// Has getters
function hasGetterKeys(store) {
    return store.getterKeys > 0;
}
const handleRowClick = (store) => {
    emit('select', store);
};
// Column visibility from settings
const settings = useInspectorSettingsSync();
const columns = computed(() => {
    const cols = settings.value?.piniaTableColumns ?? defaultInspectorSettings.piniaTableColumns;
    return cols ?? { name: true, state: true, getters: true };
});
function setColumn(key, value) {
    if (!settings.value)
        return;
    if (!settings.value.piniaTableColumns) {
        settings.value.piniaTableColumns = { ...defaultInspectorSettings.piniaTableColumns };
    }
    settings.value.piniaTableColumns[key] = value;
}
const piniaColumnDefs = [
    { key: 'state', label: 'State' },
    { key: 'getters', label: 'Getters' },
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
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-scroll-area']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-scroll-area']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-cell-star']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-cell-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['star-favorite']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "tableContainerRef",
    ...{ class: "h-full flex flex-col border rounded-lg overflow-hidden table-scroll-x" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-[360px] flex flex-col h-full" },
});
/** @type {__VLS_StyleScopedClasses['min-w-[360px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 border-b bg-muted/30" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Table} */
Table;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    noScroll: true,
    ...{ class: "pinia-table" },
}));
const __VLS_2 = __VLS_1({
    noScroll: true,
    ...{ class: "pinia-table" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['pinia-table']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
let __VLS_6;
/** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
TableHeader;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    ...{ class: "[&_th]:h-10 [&_th]:px-2" },
}));
const __VLS_8 = __VLS_7({
    ...{ class: "[&_th]:h-10 [&_th]:px-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
/** @type {__VLS_StyleScopedClasses['[&_th]:h-10']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_th]:px-2']} */ ;
const { default: __VLS_11 } = __VLS_9.slots;
let __VLS_12;
/** @ts-ignore @type {typeof ___VLS_components.TableRow} */
TableRow;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ class: "hover:bg-transparent" },
}));
const __VLS_14 = __VLS_13({
    ...{ class: "hover:bg-transparent" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
/** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
const { default: __VLS_17 } = __VLS_15.slots;
let __VLS_18;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
    ...{ class: "pinia-cell-star" },
}));
const __VLS_20 = __VLS_19({
    ...{ class: "pinia-cell-star" },
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
/** @type {__VLS_StyleScopedClasses['pinia-cell-star']} */ ;
let __VLS_23;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
    ...{ class: "text-xs font-semibold" },
}));
const __VLS_25 = __VLS_24({
    ...{ class: "text-xs font-semibold" },
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
const { default: __VLS_28 } = __VLS_26.slots;
var __VLS_26;
if (__VLS_ctx.columns.state) {
    let __VLS_29;
    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
    TableHead;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        ...{ class: "pinia-cell-state text-xs font-semibold text-center" },
    }));
    const __VLS_31 = __VLS_30({
        ...{ class: "pinia-cell-state text-xs font-semibold text-center" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    /** @type {__VLS_StyleScopedClasses['pinia-cell-state']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    const { default: __VLS_34 } = __VLS_32.slots;
    // @ts-ignore
    [columns,];
    var __VLS_32;
}
if (__VLS_ctx.columns.getters) {
    let __VLS_35;
    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
    TableHead;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
        ...{ class: "pinia-cell-getters text-xs font-semibold text-center" },
    }));
    const __VLS_37 = __VLS_36({
        ...{ class: "pinia-cell-getters text-xs font-semibold text-center" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    /** @type {__VLS_StyleScopedClasses['pinia-cell-getters']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    const { default: __VLS_40 } = __VLS_38.slots;
    // @ts-ignore
    [columns,];
    var __VLS_38;
}
let __VLS_41;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    ...{ class: "pinia-cell-actions" },
}));
const __VLS_43 = __VLS_42({
    ...{ class: "pinia-cell-actions" },
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
/** @type {__VLS_StyleScopedClasses['pinia-cell-actions']} */ ;
const { default: __VLS_46 } = __VLS_44.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-center" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
let __VLS_47;
/** @ts-ignore @type {typeof ___VLS_components.TableColumnSelector} */
TableColumnSelector;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
    ...{ 'onUpdate:column': {} },
    columns: ({ ...__VLS_ctx.columns }),
    columnDefinitions: (__VLS_ctx.piniaColumnDefs),
}));
const __VLS_49 = __VLS_48({
    ...{ 'onUpdate:column': {} },
    columns: ({ ...__VLS_ctx.columns }),
    columnDefinitions: (__VLS_ctx.piniaColumnDefs),
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
let __VLS_52;
const __VLS_53 = ({ 'update:column': {} },
    { 'onUpdate:column': ((k, v) => __VLS_ctx.setColumn(k, v)) });
var __VLS_50;
var __VLS_51;
// @ts-ignore
[columns, piniaColumnDefs, setColumn,];
var __VLS_44;
// @ts-ignore
[];
var __VLS_15;
// @ts-ignore
[];
var __VLS_9;
// @ts-ignore
[];
var __VLS_3;
let __VLS_54;
/** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
ScrollArea;
// @ts-ignore
const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
    ...{ class: "flex-1 min-h-0 pinia-scroll-area" },
}));
const __VLS_56 = __VLS_55({
    ...{ class: "flex-1 min-h-0 pinia-scroll-area" },
}, ...__VLS_functionalComponentArgsRest(__VLS_55));
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pinia-scroll-area']} */ ;
const { default: __VLS_59 } = __VLS_57.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pinia-scroll-content" },
});
/** @type {__VLS_StyleScopedClasses['pinia-scroll-content']} */ ;
if (__VLS_ctx.entries.length === 0 && !__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pinia-empty-container" },
    });
    /** @type {__VLS_StyleScopedClasses['pinia-empty-container']} */ ;
}
else {
    let __VLS_60;
    /** @ts-ignore @type {typeof ___VLS_components.Table} */
    Table;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        noScroll: true,
        ...{ class: "pinia-table" },
    }));
    const __VLS_62 = __VLS_61({
        noScroll: true,
        ...{ class: "pinia-table" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    /** @type {__VLS_StyleScopedClasses['pinia-table']} */ ;
    const { default: __VLS_65 } = __VLS_63.slots;
    let __VLS_66;
    /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
    TableBody;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({}));
    const __VLS_68 = __VLS_67({}, ...__VLS_functionalComponentArgsRest(__VLS_67));
    const { default: __VLS_71 } = __VLS_69.slots;
    for (const [store] of __VLS_getVForSourceType((__VLS_ctx.entries))) {
        let __VLS_72;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
        ContextMenu;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            key: (store.id),
        }));
        const __VLS_74 = __VLS_73({
            key: (store.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        const { default: __VLS_77 } = __VLS_75.slots;
        let __VLS_78;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
        ContextMenuTrigger;
        // @ts-ignore
        const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
            asChild: true,
        }));
        const __VLS_80 = __VLS_79({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_79));
        const { default: __VLS_83 } = __VLS_81.slots;
        let __VLS_84;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            ...{ 'onClick': {} },
            ...{ class: "cursor-pointer transition-colors" },
            ...{ class: ({
                    'bg-muted': __VLS_ctx.selectedId === store.id,
                    'hover:bg-accent': __VLS_ctx.selectedId !== store.id
                }) },
        }));
        const __VLS_86 = __VLS_85({
            ...{ 'onClick': {} },
            ...{ class: "cursor-pointer transition-colors" },
            ...{ class: ({
                    'bg-muted': __VLS_ctx.selectedId === store.id,
                    'hover:bg-accent': __VLS_ctx.selectedId !== store.id
                }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        let __VLS_89;
        const __VLS_90 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.entries.length === 0 && !__VLS_ctx.isLoading))
                        return;
                    __VLS_ctx.handleRowClick(store);
                    // @ts-ignore
                    [entries, entries, isLoading, selectedId, selectedId, handleRowClick,];
                } });
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-accent']} */ ;
        const { default: __VLS_91 } = __VLS_87.slots;
        let __VLS_92;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            ...{ class: "pinia-cell-star py-2" },
        }));
        const __VLS_94 = __VLS_93({
            ...{ class: "pinia-cell-star py-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        /** @type {__VLS_StyleScopedClasses['pinia-cell-star']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        const { default: __VLS_97 } = __VLS_95.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "star-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['star-cell']} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.entries.length === 0 && !__VLS_ctx.isLoading))
                        return;
                    __VLS_ctx.handleToggleFavorite($event, store);
                    // @ts-ignore
                    [handleToggleFavorite,];
                } },
            ...{ class: "star-btn" },
            ...{ class: ({ 'star-visible': __VLS_ctx.isFavorite(store), 'star-favorite': __VLS_ctx.isFavorite(store) }) },
            title: (__VLS_ctx.isFavorite(store) ? 'Remove from favorites' : 'Add to favorites'),
        });
        /** @type {__VLS_StyleScopedClasses['star-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['star-visible']} */ ;
        /** @type {__VLS_StyleScopedClasses['star-favorite']} */ ;
        let __VLS_98;
        /** @ts-ignore @type {typeof ___VLS_components.Star} */
        Star;
        // @ts-ignore
        const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
            ...{ class: "h-3.5 w-3.5" },
            ...{ class: (__VLS_ctx.isFavorite(store) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground') },
        }));
        const __VLS_100 = __VLS_99({
            ...{ class: "h-3.5 w-3.5" },
            ...{ class: (__VLS_ctx.isFavorite(store) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground') },
        }, ...__VLS_functionalComponentArgsRest(__VLS_99));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        // @ts-ignore
        [isFavorite, isFavorite, isFavorite, isFavorite,];
        var __VLS_95;
        let __VLS_103;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
            ...{ class: "py-2 max-w-0" },
        }));
        const __VLS_105 = __VLS_104({
            ...{ class: "py-2 max-w-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_104));
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-0']} */ ;
        const { default: __VLS_108 } = __VLS_106.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "truncate text-sm font-medium" },
            title: (store.baseId),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (store.baseId || 'Unknown Store');
        // @ts-ignore
        [];
        var __VLS_106;
        if (__VLS_ctx.columns.state) {
            let __VLS_109;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({
                ...{ class: "pinia-cell-state py-2 text-center" },
            }));
            const __VLS_111 = __VLS_110({
                ...{ class: "pinia-cell-state py-2 text-center" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_110));
            /** @type {__VLS_StyleScopedClasses['pinia-cell-state']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            const { default: __VLS_114 } = __VLS_112.slots;
            if (__VLS_ctx.hasStateKeys(store)) {
                let __VLS_115;
                /** @ts-ignore @type {typeof ___VLS_components.Badge} */
                Badge;
                // @ts-ignore
                const __VLS_116 = __VLS_asFunctionalComponent(__VLS_115, new __VLS_115({
                    variant: "outline",
                    ...{ class: "text-xs font-mono" },
                }));
                const __VLS_117 = __VLS_116({
                    variant: "outline",
                    ...{ class: "text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_116));
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                const { default: __VLS_120 } = __VLS_118.slots;
                (store.stateKeys);
                // @ts-ignore
                [columns, hasStateKeys,];
                var __VLS_118;
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-xs text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            }
            // @ts-ignore
            [];
            var __VLS_112;
        }
        if (__VLS_ctx.columns.getters) {
            let __VLS_121;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_122 = __VLS_asFunctionalComponent(__VLS_121, new __VLS_121({
                ...{ class: "pinia-cell-getters py-2 text-center" },
            }));
            const __VLS_123 = __VLS_122({
                ...{ class: "pinia-cell-getters py-2 text-center" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_122));
            /** @type {__VLS_StyleScopedClasses['pinia-cell-getters']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            const { default: __VLS_126 } = __VLS_124.slots;
            if (__VLS_ctx.hasGetterKeys(store)) {
                let __VLS_127;
                /** @ts-ignore @type {typeof ___VLS_components.Badge} */
                Badge;
                // @ts-ignore
                const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
                    variant: "secondary",
                    ...{ class: "text-xs font-mono" },
                }));
                const __VLS_129 = __VLS_128({
                    variant: "secondary",
                    ...{ class: "text-xs font-mono" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_128));
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                const { default: __VLS_132 } = __VLS_130.slots;
                (store.getterKeys);
                // @ts-ignore
                [columns, hasGetterKeys,];
                var __VLS_130;
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-xs text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            }
            // @ts-ignore
            [];
            var __VLS_124;
        }
        let __VLS_133;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_134 = __VLS_asFunctionalComponent(__VLS_133, new __VLS_133({
            ...{ class: "pinia-cell-actions py-2" },
        }));
        const __VLS_135 = __VLS_134({
            ...{ class: "pinia-cell-actions py-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_134));
        /** @type {__VLS_StyleScopedClasses['pinia-cell-actions']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        const { default: __VLS_138 } = __VLS_136.slots;
        let __VLS_139;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
        DropdownMenu;
        // @ts-ignore
        const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({}));
        const __VLS_141 = __VLS_140({}, ...__VLS_functionalComponentArgsRest(__VLS_140));
        const { default: __VLS_144 } = __VLS_142.slots;
        let __VLS_145;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
        DropdownMenuTrigger;
        // @ts-ignore
        const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
            asChild: true,
        }));
        const __VLS_147 = __VLS_146({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_146));
        const { default: __VLS_150 } = __VLS_148.slots;
        let __VLS_151;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "icon",
            ...{ class: "h-6 w-6 p-0" },
        }));
        const __VLS_153 = __VLS_152({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "icon",
            ...{ class: "h-6 w-6 p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_152));
        let __VLS_156;
        const __VLS_157 = ({ click: {} },
            { onClick: () => { } });
        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_158 } = __VLS_154.slots;
        let __VLS_159;
        /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
        MoreHorizontal;
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
        [];
        var __VLS_154;
        var __VLS_155;
        // @ts-ignore
        [];
        var __VLS_148;
        let __VLS_164;
        /** @ts-ignore @type {typeof ___VLS_components.PiniaTableActionsMenuContent} */
        PiniaTableActionsMenuContent;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
            ...{ 'onToggleFavorite': {} },
            variant: "dropdown",
            store: (store),
            isFavorite: (__VLS_ctx.isFavorite(store)),
        }));
        const __VLS_166 = __VLS_165({
            ...{ 'onToggleFavorite': {} },
            variant: "dropdown",
            store: (store),
            isFavorite: (__VLS_ctx.isFavorite(store)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_165));
        let __VLS_169;
        const __VLS_170 = ({ toggleFavorite: {} },
            { onToggleFavorite: (__VLS_ctx.handleToggleFavorite) });
        var __VLS_167;
        var __VLS_168;
        // @ts-ignore
        [handleToggleFavorite, isFavorite,];
        var __VLS_142;
        // @ts-ignore
        [];
        var __VLS_136;
        // @ts-ignore
        [];
        var __VLS_87;
        var __VLS_88;
        // @ts-ignore
        [];
        var __VLS_81;
        let __VLS_171;
        /** @ts-ignore @type {typeof ___VLS_components.PiniaTableActionsMenuContent} */
        PiniaTableActionsMenuContent;
        // @ts-ignore
        const __VLS_172 = __VLS_asFunctionalComponent(__VLS_171, new __VLS_171({
            ...{ 'onToggleFavorite': {} },
            variant: "context",
            store: (store),
            isFavorite: (__VLS_ctx.isFavorite(store)),
        }));
        const __VLS_173 = __VLS_172({
            ...{ 'onToggleFavorite': {} },
            variant: "context",
            store: (store),
            isFavorite: (__VLS_ctx.isFavorite(store)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_172));
        let __VLS_176;
        const __VLS_177 = ({ toggleFavorite: {} },
            { onToggleFavorite: (__VLS_ctx.handleToggleFavorite) });
        var __VLS_174;
        var __VLS_175;
        // @ts-ignore
        [handleToggleFavorite, isFavorite,];
        var __VLS_75;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.isLoading && __VLS_ctx.entries.length === 0) {
        for (const [i] of __VLS_getVForSourceType((__VLS_ctx.skeletonRowCount))) {
            let __VLS_178;
            /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
            TableRow;
            // @ts-ignore
            const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
                key: (`skeleton-${i}`),
            }));
            const __VLS_180 = __VLS_179({
                key: (`skeleton-${i}`),
            }, ...__VLS_functionalComponentArgsRest(__VLS_179));
            const { default: __VLS_183 } = __VLS_181.slots;
            let __VLS_184;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
                ...{ class: "pinia-cell-star py-2" },
            }));
            const __VLS_186 = __VLS_185({
                ...{ class: "pinia-cell-star py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_185));
            /** @type {__VLS_StyleScopedClasses['pinia-cell-star']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            const { default: __VLS_189 } = __VLS_187.slots;
            let __VLS_190;
            /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
            Skeleton;
            // @ts-ignore
            const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
                ...{ class: "h-3.5 w-3.5 rounded mx-auto" },
            }));
            const __VLS_192 = __VLS_191({
                ...{ class: "h-3.5 w-3.5 rounded mx-auto" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_191));
            /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            // @ts-ignore
            [entries, isLoading, skeletonRowCount,];
            var __VLS_187;
            let __VLS_195;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_196 = __VLS_asFunctionalComponent(__VLS_195, new __VLS_195({
                ...{ class: "py-2" },
            }));
            const __VLS_197 = __VLS_196({
                ...{ class: "py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_196));
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            const { default: __VLS_200 } = __VLS_198.slots;
            let __VLS_201;
            /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
            Skeleton;
            // @ts-ignore
            const __VLS_202 = __VLS_asFunctionalComponent(__VLS_201, new __VLS_201({
                ...{ class: "h-4 w-32" },
            }));
            const __VLS_203 = __VLS_202({
                ...{ class: "h-4 w-32" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_202));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-32']} */ ;
            // @ts-ignore
            [];
            var __VLS_198;
            if (__VLS_ctx.columns.state) {
                let __VLS_206;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_207 = __VLS_asFunctionalComponent(__VLS_206, new __VLS_206({
                    ...{ class: "pinia-cell-state py-2 text-center" },
                }));
                const __VLS_208 = __VLS_207({
                    ...{ class: "pinia-cell-state py-2 text-center" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_207));
                /** @type {__VLS_StyleScopedClasses['pinia-cell-state']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                const { default: __VLS_211 } = __VLS_209.slots;
                let __VLS_212;
                /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
                Skeleton;
                // @ts-ignore
                const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
                    ...{ class: "h-5 w-8 mx-auto" },
                }));
                const __VLS_214 = __VLS_213({
                    ...{ class: "h-5 w-8 mx-auto" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_213));
                /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
                /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
                // @ts-ignore
                [columns,];
                var __VLS_209;
            }
            if (__VLS_ctx.columns.getters) {
                let __VLS_217;
                /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
                TableCell;
                // @ts-ignore
                const __VLS_218 = __VLS_asFunctionalComponent(__VLS_217, new __VLS_217({
                    ...{ class: "pinia-cell-getters py-2 text-center" },
                }));
                const __VLS_219 = __VLS_218({
                    ...{ class: "pinia-cell-getters py-2 text-center" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_218));
                /** @type {__VLS_StyleScopedClasses['pinia-cell-getters']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                const { default: __VLS_222 } = __VLS_220.slots;
                let __VLS_223;
                /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
                Skeleton;
                // @ts-ignore
                const __VLS_224 = __VLS_asFunctionalComponent(__VLS_223, new __VLS_223({
                    ...{ class: "h-5 w-8 mx-auto" },
                }));
                const __VLS_225 = __VLS_224({
                    ...{ class: "h-5 w-8 mx-auto" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_224));
                /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
                /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
                // @ts-ignore
                [columns,];
                var __VLS_220;
            }
            let __VLS_228;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
                ...{ class: "pinia-cell-actions py-2" },
            }));
            const __VLS_230 = __VLS_229({
                ...{ class: "pinia-cell-actions py-2" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_229));
            /** @type {__VLS_StyleScopedClasses['pinia-cell-actions']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            const { default: __VLS_233 } = __VLS_231.slots;
            let __VLS_234;
            /** @ts-ignore @type {typeof ___VLS_components.Skeleton} */
            Skeleton;
            // @ts-ignore
            const __VLS_235 = __VLS_asFunctionalComponent(__VLS_234, new __VLS_234({
                ...{ class: "h-6 w-6 rounded mx-auto" },
            }));
            const __VLS_236 = __VLS_235({
                ...{ class: "h-6 w-6 rounded mx-auto" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_235));
            /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            // @ts-ignore
            [];
            var __VLS_231;
            // @ts-ignore
            [];
            var __VLS_181;
            // @ts-ignore
            [];
        }
    }
    // @ts-ignore
    [];
    var __VLS_69;
    // @ts-ignore
    [];
    var __VLS_63;
}
// @ts-ignore
[];
var __VLS_57;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=PiniaTable.vue.js.map