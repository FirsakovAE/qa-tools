import { computed, ref } from 'vue';
import { CheckIcon, CirclePlusIcon } from 'lucide-vue-next';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Separator } from '@/components/ui/Separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, } from '@/components/ui/Command';
const props = withDefaults(defineProps(), {
    maxBadges: 2,
    allowCreate: false,
    minWidth: 200,
});
const emit = defineEmits();
const searchQuery = ref('');
const commandKey = ref(0);
const trimmedSearchQuery = computed(() => searchQuery.value.trim());
const selectedValues = computed(() => new Set(props.modelValue));
const filteredOptions = computed(() => {
    const normalizedSearch = searchQuery.value.trim().toLowerCase();
    if (!normalizedSearch)
        return props.options;
    return props.options.filter(option => option.toLowerCase().includes(normalizedSearch));
});
const canCreate = computed(() => {
    if (!props.allowCreate)
        return false;
    const value = trimmedSearchQuery.value;
    if (value.length === 0)
        return false;
    const normalizedValue = value.toLowerCase();
    return !props.options.some(option => option.toLowerCase() === normalizedValue);
});
const selectedBadges = computed(() => {
    return props.options.filter(option => selectedValues.value.has(option)).slice(0, props.maxBadges);
});
const contentStyle = computed(() => props.minWidth ? ({ minWidth: `${props.minWidth}px` }) : undefined);
function toggleValue(value) {
    const next = new Set(props.modelValue);
    if (next.has(value))
        next.delete(value);
    else
        next.add(value);
    emit('update:modelValue', Array.from(next));
}
function createFromSearchQuery() {
    const value = trimmedSearchQuery.value;
    if (!value)
        return;
    emit('create', value);
    clearSearch();
    commandKey.value += 1;
}
function clearSearch() {
    searchQuery.value = '';
}
const __VLS_defaults = {
    maxBadges: 2,
    allowCreate: false,
    minWidth: 200,
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
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Popover} */
Popover;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.PopoverTrigger} */
PopoverTrigger;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    asChild: true,
}));
const __VLS_9 = __VLS_8({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    variant: "outline",
    size: "xs",
    ...{ class: "gap-2 border-dashed font-normal" },
}));
const __VLS_15 = __VLS_14({
    variant: "outline",
    size: "xs",
    ...{ class: "gap-2 border-dashed font-normal" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
const { default: __VLS_18 } = __VLS_16.slots;
let __VLS_19;
/** @ts-ignore @type {typeof ___VLS_components.CirclePlusIcon} */
CirclePlusIcon;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    ...{ class: "size-3.5" },
}));
const __VLS_21 = __VLS_20({
    ...{ class: "size-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
(props.title);
if (__VLS_ctx.selectedValues.size > 0) {
    let __VLS_24;
    /** @ts-ignore @type {typeof ___VLS_components.Separator} */
    Separator;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        orientation: "vertical",
        ...{ class: "mx-1.5 h-3.5" },
    }));
    const __VLS_26 = __VLS_25({
        orientation: "vertical",
        ...{ class: "mx-1.5 h-3.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    /** @type {__VLS_StyleScopedClasses['mx-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-1.5 faceted-badges" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['faceted-badges']} */ ;
    for (const [badge] of __VLS_getVForSourceType((__VLS_ctx.selectedBadges))) {
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (badge),
            ...{ class: "inline-flex h-4 items-center justify-center rounded-md bg-secondary px-1.5 text-[11px] text-secondary-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-secondary-foreground']} */ ;
        (badge);
        // @ts-ignore
        [selectedValues, selectedBadges,];
    }
    if (__VLS_ctx.selectedValues.size > props.maxBadges) {
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex h-4 items-center justify-center rounded-md bg-secondary px-1.5 text-[11px] text-secondary-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-secondary-foreground']} */ ;
        (__VLS_ctx.selectedValues.size - props.maxBadges);
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "hidden faceted-compact-count h-4 items-center justify-center rounded-md bg-secondary px-1.5 text-[11px] text-secondary-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['faceted-compact-count']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-secondary-foreground']} */ ;
    (__VLS_ctx.selectedValues.size);
}
// @ts-ignore
[selectedValues, selectedValues, selectedValues,];
var __VLS_16;
// @ts-ignore
[];
var __VLS_10;
let __VLS_29;
/** @ts-ignore @type {typeof ___VLS_components.PopoverContent} */
PopoverContent;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    ...{ class: "w-80 p-0" },
    align: "start",
    ...{ style: (__VLS_ctx.contentStyle) },
}));
const __VLS_31 = __VLS_30({
    ...{ class: "w-80 p-0" },
    align: "start",
    ...{ style: (__VLS_ctx.contentStyle) },
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
/** @type {__VLS_StyleScopedClasses['w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
const { default: __VLS_34 } = __VLS_32.slots;
let __VLS_35;
/** @ts-ignore @type {typeof ___VLS_components.Command} */
Command;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
    key: (__VLS_ctx.commandKey),
}));
const __VLS_37 = __VLS_36({
    key: (__VLS_ctx.commandKey),
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
const { default: __VLS_40 } = __VLS_38.slots;
let __VLS_41;
/** @ts-ignore @type {typeof ___VLS_components.CommandInput} */
CommandInput;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.searchQuery),
    placeholder: (props.title),
}));
const __VLS_43 = __VLS_42({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.searchQuery),
    placeholder: (props.title),
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
let __VLS_46;
const __VLS_47 = ({ keydown: {} },
    { onKeydown: (__VLS_ctx.clearSearch) });
var __VLS_44;
var __VLS_45;
let __VLS_48;
/** @ts-ignore @type {typeof ___VLS_components.CommandList} */
CommandList;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({}));
const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
const { default: __VLS_53 } = __VLS_51.slots;
if (__VLS_ctx.filteredOptions.length === 0 && !__VLS_ctx.canCreate) {
    let __VLS_54;
    /** @ts-ignore @type {typeof ___VLS_components.CommandEmpty} */
    CommandEmpty;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({}));
    const __VLS_56 = __VLS_55({}, ...__VLS_functionalComponentArgsRest(__VLS_55));
    const { default: __VLS_59 } = __VLS_57.slots;
    // @ts-ignore
    [contentStyle, commandKey, searchQuery, clearSearch, filteredOptions, canCreate,];
    var __VLS_57;
}
if (__VLS_ctx.canCreate) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-2.5" },
    });
    /** @type {__VLS_StyleScopedClasses['p-2.5']} */ ;
    let __VLS_60;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "w-full justify-start gap-2" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "w-full justify-start gap-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    const __VLS_66 = ({ click: {} },
        { onClick: (__VLS_ctx.createFromSearchQuery) });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const { default: __VLS_67 } = __VLS_63.slots;
    let __VLS_68;
    /** @ts-ignore @type {typeof ___VLS_components.CirclePlusIcon} */
    CirclePlusIcon;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ class: "size-4" },
    }));
    const __VLS_70 = __VLS_69({
        ...{ class: "size-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    /** @type {__VLS_StyleScopedClasses['size-4']} */ ;
    (__VLS_ctx.trimmedSearchQuery);
    // @ts-ignore
    [canCreate, createFromSearchQuery, trimmedSearchQuery,];
    var __VLS_63;
    var __VLS_64;
}
let __VLS_73;
/** @ts-ignore @type {typeof ___VLS_components.CommandGroup} */
CommandGroup;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({}));
const __VLS_75 = __VLS_74({}, ...__VLS_functionalComponentArgsRest(__VLS_74));
const { default: __VLS_78 } = __VLS_76.slots;
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.filteredOptions))) {
    let __VLS_79;
    /** @ts-ignore @type {typeof ___VLS_components.CommandItem} */
    CommandItem;
    // @ts-ignore
    const __VLS_80 = __VLS_asFunctionalComponent(__VLS_79, new __VLS_79({
        ...{ 'onSelect': {} },
        key: (option),
        value: (option),
    }));
    const __VLS_81 = __VLS_80({
        ...{ 'onSelect': {} },
        key: (option),
        value: (option),
    }, ...__VLS_functionalComponentArgsRest(__VLS_80));
    let __VLS_84;
    const __VLS_85 = ({ select: {} },
        { onSelect: (() => __VLS_ctx.toggleValue(option)) });
    const { default: __VLS_86 } = __VLS_82.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.cn('mr-2.5 flex size-4 shrink-0 items-center justify-center rounded border border-border opacity-60', __VLS_ctx.selectedValues.has(option) && 'border-primary/60 bg-primary/15 opacity-100')) },
    });
    let __VLS_87;
    /** @ts-ignore @type {typeof ___VLS_components.CheckIcon} */
    CheckIcon;
    // @ts-ignore
    const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({
        ...{ class: (__VLS_ctx.cn('size-3.5 text-primary', !__VLS_ctx.selectedValues.has(option) && 'invisible')) },
    }));
    const __VLS_89 = __VLS_88({
        ...{ class: (__VLS_ctx.cn('size-3.5 text-primary', !__VLS_ctx.selectedValues.has(option) && 'invisible')) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_88));
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "truncate select-text" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-text']} */ ;
    (option);
    // @ts-ignore
    [selectedValues, selectedValues, filteredOptions, toggleValue, cn, cn,];
    var __VLS_82;
    var __VLS_83;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_76;
if (__VLS_ctx.$slots.footer) {
    let __VLS_92;
    /** @ts-ignore @type {typeof ___VLS_components.CommandSeparator} */
    CommandSeparator;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({}));
    const __VLS_94 = __VLS_93({}, ...__VLS_functionalComponentArgsRest(__VLS_93));
}
if (__VLS_ctx.$slots.footer) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "px-2.5 pb-3 pt-2.5" },
    });
    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['pb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-2.5']} */ ;
    var __VLS_97 = {};
}
// @ts-ignore
[$slots, $slots,];
var __VLS_51;
// @ts-ignore
[];
var __VLS_38;
// @ts-ignore
[];
var __VLS_32;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_98 = __VLS_97;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=FacetedFilter.vue.js.map