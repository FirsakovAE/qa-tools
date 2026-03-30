import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui';
import { CheckIcon } from 'lucide-vue-next';
import { cn } from '@/components/ui/utils';
const props = defineProps();
const emits = defineEmits();
const forwarded = useForwardPropsEmits(props, emits);
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
    ...{ class: (__VLS_ctx.cn('peer flex items-center gap-2', { 'items-start': props.description })) },
});
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.CheckboxRoot} */
CheckboxRoot;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwarded),
    id: ((props.label && props.id) || __VLS_ctx.forwarded.id),
    ...{ class: (__VLS_ctx.cn('peer h-4 w-4 shrink-0 rounded-xs border border-primary ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground overflow-hidden')) },
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwarded),
    id: ((props.label && props.id) || __VLS_ctx.forwarded.id),
    ...{ class: (__VLS_ctx.cn('peer h-4 w-4 shrink-0 rounded-xs border border-primary ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground overflow-hidden')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
let __VLS_6;
/** @ts-ignore @type {typeof ___VLS_components.transition | typeof ___VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    name: "fade-slide-top",
}));
const __VLS_8 = __VLS_7({
    name: "fade-slide-top",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
let __VLS_12;
/** @ts-ignore @type {typeof ___VLS_components.CheckboxIndicator} */
CheckboxIndicator;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ class: "flex h-full w-full items-center justify-center text-current" },
}));
const __VLS_14 = __VLS_13({
    ...{ class: "flex h-full w-full items-center justify-center text-current" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-current']} */ ;
const { default: __VLS_17 } = __VLS_15.slots;
var __VLS_18 = {};
let __VLS_20;
/** @ts-ignore @type {typeof ___VLS_components.CheckIcon} */
CheckIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "h-4 w-4" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[cn, cn, forwarded, forwarded,];
var __VLS_15;
// @ts-ignore
[];
var __VLS_9;
// @ts-ignore
[];
var __VLS_3;
if (props.label) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1.5 leading-none peer-disabled:opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['peer-disabled:opacity-70']} */ ;
    if (props.label) {
        __VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "text-sm font-medium leading-none select-none" },
            for: (props.id),
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
        (props.label);
    }
    if (props.description) {
        __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm leading-5 text-muted-foreground select-none" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
        (props.description);
    }
}
// @ts-ignore
var __VLS_19 = __VLS_18;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=Checkbox.vue.js.map