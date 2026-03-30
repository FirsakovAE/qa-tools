import { computed } from 'vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { ContextMenu, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { OptionsItemActionsMenuContent } from '@/components/OptionsItemActionsMenu';
import { MoreHorizontal } from 'lucide-vue-next';
const props = withDefaults(defineProps(), {
    showAdd: false,
    addPlaceholder: '',
    addModelValue: '',
    addError: null,
});
const emit = defineEmits();
const tableHeight = computed(() => {
    const rowCount = Math.max(props.rows.length, 1);
    return Math.min(rowCount * 41, 205);
});
const needsScroll = computed(() => props.rows.length > 4);
const colspan = computed(() => props.columns.length + 1);
function onRowClick(row) {
    emit('select', row);
}
function onAdd() {
    emit('add');
}
function onAddInputKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        onAdd();
    }
}
const __VLS_defaults = {
    showAdd: false,
    addPlaceholder: '',
    addModelValue: '',
    addError: null,
};
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
    id: (__VLS_ctx.sectionId),
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
(__VLS_ctx.title);
if (__VLS_ctx.description) {
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (__VLS_ctx.description);
}
if (__VLS_ctx.showAdd) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onUpdate:modelValue': {} },
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.addModelValue),
        placeholder: (__VLS_ctx.addPlaceholder),
        'aria-invalid': (!!__VLS_ctx.addError),
        ...{ class: "flex-1 h-8" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onUpdate:modelValue': {} },
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.addModelValue),
        placeholder: (__VLS_ctx.addPlaceholder),
        'aria-invalid': (!!__VLS_ctx.addError),
        ...{ class: "flex-1 h-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!(__VLS_ctx.showAdd))
                    return;
                __VLS_ctx.emit('update:addModelValue', typeof $event === 'string' ? $event : String($event ?? ''));
                // @ts-ignore
                [sectionId, title, description, description, showAdd, addModelValue, addPlaceholder, addError, emit,];
            } });
    const __VLS_7 = ({ keydown: {} },
        { onKeydown: (__VLS_ctx.onAddInputKeydown) });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    var __VLS_3;
    var __VLS_4;
    let __VLS_8;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ 'onClick': {} },
        size: "sm",
        ...{ class: "h-8" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClick': {} },
        size: "sm",
        ...{ class: "h-8" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_13;
    const __VLS_14 = ({ click: {} },
        { onClick: (__VLS_ctx.onAdd) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    const { default: __VLS_15 } = __VLS_11.slots;
    // @ts-ignore
    [onAddInputKeydown, onAdd,];
    var __VLS_11;
    var __VLS_12;
}
if (__VLS_ctx.addError) {
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-destructive_text" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    (__VLS_ctx.addError);
}
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
let __VLS_16;
/** @ts-ignore @type {typeof ___VLS_components.Table} */
Table;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ class: "table-fixed" },
}));
const __VLS_18 = __VLS_17({
    ...{ class: "table-fixed" },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
/** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
const { default: __VLS_21 } = __VLS_19.slots;
let __VLS_22;
/** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
TableHeader;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
    ...{ class: "[&_th]:h-10" },
}));
const __VLS_24 = __VLS_23({
    ...{ class: "[&_th]:h-10" },
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
/** @type {__VLS_StyleScopedClasses['[&_th]:h-10']} */ ;
const { default: __VLS_27 } = __VLS_25.slots;
let __VLS_28;
/** @ts-ignore @type {typeof ___VLS_components.TableRow} */
TableRow;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ class: "hover:bg-transparent" },
}));
const __VLS_30 = __VLS_29({
    ...{ class: "hover:bg-transparent" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
/** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
const { default: __VLS_33 } = __VLS_31.slots;
for (const [col] of __VLS_getVForSourceType((__VLS_ctx.columns))) {
    let __VLS_34;
    /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
    TableHead;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
        key: (col.header),
        ...{ class: "text-xs font-semibold" },
        ...{ class: (col.class) },
        ...{ style: (col.width ? { width: col.width } : undefined) },
    }));
    const __VLS_36 = __VLS_35({
        key: (col.header),
        ...{ class: "text-xs font-semibold" },
        ...{ class: (col.class) },
        ...{ style: (col.width ? { width: col.width } : undefined) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    const { default: __VLS_39 } = __VLS_37.slots;
    (col.header);
    // @ts-ignore
    [addError, addError, columns,];
    var __VLS_37;
    // @ts-ignore
    [];
}
let __VLS_40;
/** @ts-ignore @type {typeof ___VLS_components.TableHead} */
TableHead;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ class: "w-[48px] text-center p-0" },
}));
const __VLS_42 = __VLS_41({
    ...{ class: "w-[48px] text-center p-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
/** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
// @ts-ignore
[];
var __VLS_31;
// @ts-ignore
[];
var __VLS_25;
// @ts-ignore
[];
var __VLS_19;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-h-0 max-h-[205px] overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[205px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
if (__VLS_ctx.needsScroll) {
    let __VLS_45;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ style: ({ height: `${__VLS_ctx.tableHeight}px` }) },
    }));
    const __VLS_47 = __VLS_46({
        ...{ style: ({ height: `${__VLS_ctx.tableHeight}px` }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    const { default: __VLS_50 } = __VLS_48.slots;
    let __VLS_51;
    /** @ts-ignore @type {typeof ___VLS_components.Table} */
    Table;
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({
        ...{ class: "table-fixed" },
    }));
    const __VLS_53 = __VLS_52({
        ...{ class: "table-fixed" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_52));
    /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
    const { default: __VLS_56 } = __VLS_54.slots;
    let __VLS_57;
    /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
    TableBody;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({}));
    const __VLS_59 = __VLS_58({}, ...__VLS_functionalComponentArgsRest(__VLS_58));
    const { default: __VLS_62 } = __VLS_60.slots;
    for (const [row] of __VLS_getVForSourceType((__VLS_ctx.rows))) {
        let __VLS_63;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
        ContextMenu;
        // @ts-ignore
        const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({
            key: (__VLS_ctx.rowKey(row)),
        }));
        const __VLS_65 = __VLS_64({
            key: (__VLS_ctx.rowKey(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_64));
        const { default: __VLS_68 } = __VLS_66.slots;
        let __VLS_69;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
        ContextMenuTrigger;
        // @ts-ignore
        const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
            asChild: true,
        }));
        const __VLS_71 = __VLS_70({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_70));
        const { default: __VLS_74 } = __VLS_72.slots;
        let __VLS_75;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === __VLS_ctx.rowKey(row) }) },
        }));
        const __VLS_77 = __VLS_76({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === __VLS_ctx.rowKey(row) }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_76));
        let __VLS_80;
        const __VLS_81 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.needsScroll))
                        return;
                    __VLS_ctx.onRowClick(row);
                    // @ts-ignore
                    [needsScroll, tableHeight, rows, rowKey, rowKey, selectedItemId, onRowClick,];
                } });
        /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
        const { default: __VLS_82 } = __VLS_78.slots;
        var __VLS_83 = {
            row: (row),
        };
        let __VLS_85;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
            ...{ class: "w-[48px] text-center p-0" },
        }));
        const __VLS_87 = __VLS_86({
            ...{ class: "w-[48px] text-center p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_86));
        /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_90 } = __VLS_88.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-center items-center" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        let __VLS_91;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
        DropdownMenu;
        // @ts-ignore
        const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({}));
        const __VLS_93 = __VLS_92({}, ...__VLS_functionalComponentArgsRest(__VLS_92));
        const { default: __VLS_96 } = __VLS_94.slots;
        let __VLS_97;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
        DropdownMenuTrigger;
        // @ts-ignore
        const __VLS_98 = __VLS_asFunctionalComponent(__VLS_97, new __VLS_97({
            asChild: true,
        }));
        const __VLS_99 = __VLS_98({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_98));
        const { default: __VLS_102 } = __VLS_100.slots;
        let __VLS_103;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "icon",
            ...{ class: "h-6 w-6 p-0" },
        }));
        const __VLS_105 = __VLS_104({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "icon",
            ...{ class: "h-6 w-6 p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_104));
        let __VLS_108;
        const __VLS_109 = ({ click: {} },
            { onClick: () => { } });
        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_110 } = __VLS_106.slots;
        let __VLS_111;
        /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
        MoreHorizontal;
        // @ts-ignore
        const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_113 = __VLS_112({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_112));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        // @ts-ignore
        [];
        var __VLS_106;
        var __VLS_107;
        // @ts-ignore
        [];
        var __VLS_100;
        let __VLS_116;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            variant: "dropdown",
            actions: (__VLS_ctx.getActions(row)),
        }));
        const __VLS_118 = __VLS_117({
            variant: "dropdown",
            actions: (__VLS_ctx.getActions(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        // @ts-ignore
        [getActions,];
        var __VLS_94;
        // @ts-ignore
        [];
        var __VLS_88;
        // @ts-ignore
        [];
        var __VLS_78;
        var __VLS_79;
        // @ts-ignore
        [];
        var __VLS_72;
        let __VLS_121;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_122 = __VLS_asFunctionalComponent(__VLS_121, new __VLS_121({
            variant: "context",
            actions: (__VLS_ctx.getActions(row)),
        }));
        const __VLS_123 = __VLS_122({
            variant: "context",
            actions: (__VLS_ctx.getActions(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_122));
        // @ts-ignore
        [getActions,];
        var __VLS_66;
        // @ts-ignore
        [];
    }
    if (!__VLS_ctx.rows.length) {
        let __VLS_126;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({}));
        const __VLS_128 = __VLS_127({}, ...__VLS_functionalComponentArgsRest(__VLS_127));
        const { default: __VLS_131 } = __VLS_129.slots;
        let __VLS_132;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
            colspan: (__VLS_ctx.colspan),
            ...{ class: "text-center text-muted-foreground py-8" },
        }));
        const __VLS_134 = __VLS_133({
            colspan: (__VLS_ctx.colspan),
            ...{ class: "text-center text-muted-foreground py-8" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_133));
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
        const { default: __VLS_137 } = __VLS_135.slots;
        (__VLS_ctx.emptyMessage);
        // @ts-ignore
        [rows, colspan, emptyMessage,];
        var __VLS_135;
        // @ts-ignore
        [];
        var __VLS_129;
    }
    // @ts-ignore
    [];
    var __VLS_60;
    // @ts-ignore
    [];
    var __VLS_54;
    // @ts-ignore
    [];
    var __VLS_48;
}
else {
    let __VLS_138;
    /** @ts-ignore @type {typeof ___VLS_components.Table} */
    Table;
    // @ts-ignore
    const __VLS_139 = __VLS_asFunctionalComponent(__VLS_138, new __VLS_138({
        ...{ class: "table-fixed" },
    }));
    const __VLS_140 = __VLS_139({
        ...{ class: "table-fixed" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_139));
    /** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
    const { default: __VLS_143 } = __VLS_141.slots;
    let __VLS_144;
    /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
    TableBody;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({}));
    const __VLS_146 = __VLS_145({}, ...__VLS_functionalComponentArgsRest(__VLS_145));
    const { default: __VLS_149 } = __VLS_147.slots;
    for (const [row] of __VLS_getVForSourceType((__VLS_ctx.rows))) {
        let __VLS_150;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
        ContextMenu;
        // @ts-ignore
        const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
            key: (__VLS_ctx.rowKey(row)),
        }));
        const __VLS_152 = __VLS_151({
            key: (__VLS_ctx.rowKey(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_151));
        const { default: __VLS_155 } = __VLS_153.slots;
        let __VLS_156;
        /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
        ContextMenuTrigger;
        // @ts-ignore
        const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
            asChild: true,
        }));
        const __VLS_158 = __VLS_157({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_157));
        const { default: __VLS_161 } = __VLS_159.slots;
        let __VLS_162;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === __VLS_ctx.rowKey(row) }) },
        }));
        const __VLS_164 = __VLS_163({
            ...{ 'onClick': {} },
            ...{ class: "h-[41px] cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-muted': __VLS_ctx.selectedItemId === __VLS_ctx.rowKey(row) }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_163));
        let __VLS_167;
        const __VLS_168 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.needsScroll))
                        return;
                    __VLS_ctx.onRowClick(row);
                    // @ts-ignore
                    [rows, rowKey, rowKey, selectedItemId, onRowClick,];
                } });
        /** @type {__VLS_StyleScopedClasses['h-[41px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
        const { default: __VLS_169 } = __VLS_165.slots;
        var __VLS_170 = {
            row: (row),
        };
        let __VLS_172;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
            ...{ class: "w-[48px] text-center p-0" },
        }));
        const __VLS_174 = __VLS_173({
            ...{ class: "w-[48px] text-center p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_173));
        /** @type {__VLS_StyleScopedClasses['w-[48px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_177 } = __VLS_175.slots;
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-center items-center" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        let __VLS_178;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
        DropdownMenu;
        // @ts-ignore
        const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({}));
        const __VLS_180 = __VLS_179({}, ...__VLS_functionalComponentArgsRest(__VLS_179));
        const { default: __VLS_183 } = __VLS_181.slots;
        let __VLS_184;
        /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
        DropdownMenuTrigger;
        // @ts-ignore
        const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
            asChild: true,
        }));
        const __VLS_186 = __VLS_185({
            asChild: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_185));
        const { default: __VLS_189 } = __VLS_187.slots;
        let __VLS_190;
        /** @ts-ignore @type {typeof ___VLS_components.Button} */
        Button;
        // @ts-ignore
        const __VLS_191 = __VLS_asFunctionalComponent(__VLS_190, new __VLS_190({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "icon",
            ...{ class: "h-6 w-6 p-0" },
        }));
        const __VLS_192 = __VLS_191({
            ...{ 'onClick': {} },
            variant: "ghost",
            size: "icon",
            ...{ class: "h-6 w-6 p-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_191));
        let __VLS_195;
        const __VLS_196 = ({ click: {} },
            { onClick: () => { } });
        /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
        const { default: __VLS_197 } = __VLS_193.slots;
        let __VLS_198;
        /** @ts-ignore @type {typeof ___VLS_components.MoreHorizontal} */
        MoreHorizontal;
        // @ts-ignore
        const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_200 = __VLS_199({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_199));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        // @ts-ignore
        [];
        var __VLS_193;
        var __VLS_194;
        // @ts-ignore
        [];
        var __VLS_187;
        let __VLS_203;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_204 = __VLS_asFunctionalComponent(__VLS_203, new __VLS_203({
            variant: "dropdown",
            actions: (__VLS_ctx.getActions(row)),
        }));
        const __VLS_205 = __VLS_204({
            variant: "dropdown",
            actions: (__VLS_ctx.getActions(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_204));
        // @ts-ignore
        [getActions,];
        var __VLS_181;
        // @ts-ignore
        [];
        var __VLS_175;
        // @ts-ignore
        [];
        var __VLS_165;
        var __VLS_166;
        // @ts-ignore
        [];
        var __VLS_159;
        let __VLS_208;
        /** @ts-ignore @type {typeof ___VLS_components.OptionsItemActionsMenuContent} */
        OptionsItemActionsMenuContent;
        // @ts-ignore
        const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
            variant: "context",
            actions: (__VLS_ctx.getActions(row)),
        }));
        const __VLS_210 = __VLS_209({
            variant: "context",
            actions: (__VLS_ctx.getActions(row)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_209));
        // @ts-ignore
        [getActions,];
        var __VLS_153;
        // @ts-ignore
        [];
    }
    if (!__VLS_ctx.rows.length) {
        let __VLS_213;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_214 = __VLS_asFunctionalComponent(__VLS_213, new __VLS_213({}));
        const __VLS_215 = __VLS_214({}, ...__VLS_functionalComponentArgsRest(__VLS_214));
        const { default: __VLS_218 } = __VLS_216.slots;
        let __VLS_219;
        /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
        TableCell;
        // @ts-ignore
        const __VLS_220 = __VLS_asFunctionalComponent(__VLS_219, new __VLS_219({
            colspan: (__VLS_ctx.colspan),
            ...{ class: "text-center text-muted-foreground py-8" },
        }));
        const __VLS_221 = __VLS_220({
            colspan: (__VLS_ctx.colspan),
            ...{ class: "text-center text-muted-foreground py-8" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_220));
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
        const { default: __VLS_224 } = __VLS_222.slots;
        (__VLS_ctx.emptyMessage);
        // @ts-ignore
        [rows, colspan, emptyMessage,];
        var __VLS_222;
        // @ts-ignore
        [];
        var __VLS_216;
    }
    // @ts-ignore
    [];
    var __VLS_147;
    // @ts-ignore
    [];
    var __VLS_141;
}
// @ts-ignore
var __VLS_84 = __VLS_83, __VLS_171 = __VLS_170;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=SettingsTableSection.vue.js.map