import { MenubarContent, MenubarPortal, useForwardProps, } from 'reka-ui';
import { cn } from '@/components/ui/utils';
const props = withDefaults(defineProps(), {
    align: 'start',
    alignOffset: -4,
    sideOffset: 8,
});
const forwardedProps = useForwardProps(props);
const __VLS_defaults = {
    align: 'start',
    alignOffset: -4,
    sideOffset: 8,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.MenubarPortal} */
MenubarPortal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.MenubarContent} */
MenubarContent;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...(__VLS_ctx.forwardedProps),
    ...{ class: (__VLS_ctx.cn('z-50 min-w-48 overflow-hidden rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_9 = __VLS_8({
    ...(__VLS_ctx.forwardedProps),
    ...{ class: (__VLS_ctx.cn('z-50 min-w-48 overflow-hidden rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
var __VLS_13 = {};
// @ts-ignore
[forwardedProps, cn, $attrs,];
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_14 = __VLS_13;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=MenubarContent.vue.js.map