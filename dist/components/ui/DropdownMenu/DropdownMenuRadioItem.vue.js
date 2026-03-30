import { DropdownMenuItemIndicator, DropdownMenuRadioItem, useForwardPropsEmits, } from 'reka-ui';
import { CircleIcon } from 'lucide-vue-next';
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
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenuRadioItem} */
DropdownMenuRadioItem;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors focus:bg-secondary focus:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors focus:bg-secondary focus:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenuItemIndicator} */
DropdownMenuItemIndicator;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({}));
const __VLS_9 = __VLS_8({}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.CircleIcon} */
CircleIcon;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    ...{ class: "h-2 w-2 fill-current" },
}));
const __VLS_15 = __VLS_14({
    ...{ class: "h-2 w-2 fill-current" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['fill-current']} */ ;
// @ts-ignore
[forwarded, cn, $attrs,];
var __VLS_10;
var __VLS_18 = {};
// @ts-ignore
[];
var __VLS_3;
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
//# sourceMappingURL=DropdownMenuRadioItem.vue.js.map