import { ContextMenuSubTrigger, useForwardProps, } from 'reka-ui';
import { ChevronRightIcon } from 'lucide-vue-next';
import { cn } from '@/components/ui/utils';
const props = defineProps();
const forwardedProps = useForwardProps(props);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.ContextMenuSubTrigger} */
ContextMenuSubTrigger;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwardedProps),
    ...{ class: (__VLS_ctx.cn('flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-secondary focus:text-secondary-foreground data-[state=open]:bg-secondary data-[state=open]:text-secondary-foreground', __VLS_ctx.inset && 'pl-8', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwardedProps),
    ...{ class: (__VLS_ctx.cn('flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-secondary focus:text-secondary-foreground data-[state=open]:bg-secondary data-[state=open]:text-secondary-foreground', __VLS_ctx.inset && 'pl-8', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
var __VLS_7 = {};
let __VLS_9;
/** @ts-ignore @type {typeof ___VLS_components.ChevronRightIcon} */
ChevronRightIcon;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    ...{ class: "ml-auto h-4 w-4" },
}));
const __VLS_11 = __VLS_10({
    ...{ class: "ml-auto h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[forwardedProps, cn, inset, $attrs,];
var __VLS_3;
// @ts-ignore
var __VLS_8 = __VLS_7;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=ContextMenuSubTrigger.vue.js.map