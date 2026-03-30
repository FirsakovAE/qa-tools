import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits, } from 'reka-ui';
import { SelectScrollDownButton, SelectScrollUpButton } from '.';
import { cn } from '@/components/ui/utils';
defineOptions({
    inheritAttrs: false,
});
const props = withDefaults(defineProps(), {
    position: 'popper',
});
const emits = defineEmits();
const forwarded = useForwardPropsEmits(props, emits);
const __VLS_defaults = {
    position: 'popper',
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
/** @ts-ignore @type {typeof ___VLS_components.SelectPortal} */
SelectPortal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.SelectContent} */
SelectContent;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...({ ...__VLS_ctx.forwarded, ...__VLS_ctx.$attrs }),
    ...{ class: (__VLS_ctx.cn('relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', __VLS_ctx.position === 'popper'
            && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_9 = __VLS_8({
    ...({ ...__VLS_ctx.forwarded, ...__VLS_ctx.$attrs }),
    ...{ class: (__VLS_ctx.cn('relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', __VLS_ctx.position === 'popper'
            && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.SelectScrollUpButton} */
SelectScrollUpButton;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({}));
const __VLS_15 = __VLS_14({}, ...__VLS_functionalComponentArgsRest(__VLS_14));
let __VLS_18;
/** @ts-ignore @type {typeof ___VLS_components.SelectViewport} */
SelectViewport;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
    ...{ class: (__VLS_ctx.cn('p-1', __VLS_ctx.position === 'popper' && 'h-(--reka-select-trigger-height) w-full min-w-(--reka-select-trigger-width)')) },
}));
const __VLS_20 = __VLS_19({
    ...{ class: (__VLS_ctx.cn('p-1', __VLS_ctx.position === 'popper' && 'h-(--reka-select-trigger-height) w-full min-w-(--reka-select-trigger-width)')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
const { default: __VLS_23 } = __VLS_21.slots;
var __VLS_24 = {};
// @ts-ignore
[forwarded, $attrs, $attrs, cn, cn, position, position,];
var __VLS_21;
let __VLS_26;
/** @ts-ignore @type {typeof ___VLS_components.SelectScrollDownButton} */
SelectScrollDownButton;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({}));
const __VLS_28 = __VLS_27({}, ...__VLS_functionalComponentArgsRest(__VLS_27));
// @ts-ignore
[];
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_25 = __VLS_24;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=SelectContent.vue.js.map