import { ArrowLeftIcon } from 'lucide-vue-next';
import { useCarousel } from './useCarousel';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';
const { orientation, canScrollPrev, scrollPrev } = useCarousel();
const __VLS_ctx = {
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.canScrollPrev),
    ...{ class: (__VLS_ctx.cn('touch-manipulation absolute h-8 w-8 rounded p-0', __VLS_ctx.orientation === 'horizontal'
            ? '-left-12 top-1/2 -translate-y-1/2'
            : '-top-12 left-1/2 -translate-x-1/2 rotate-90', __VLS_ctx.$attrs.class ?? '')) },
    variant: "outline",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.canScrollPrev),
    ...{ class: (__VLS_ctx.cn('touch-manipulation absolute h-8 w-8 rounded p-0', __VLS_ctx.orientation === 'horizontal'
            ? '-left-12 top-1/2 -translate-y-1/2'
            : '-top-12 left-1/2 -translate-x-1/2 rotate-90', __VLS_ctx.$attrs.class ?? '')) },
    variant: "outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ click: {} },
    { onClick: (__VLS_ctx.scrollPrev) });
var __VLS_7 = {};
const { default: __VLS_8 } = __VLS_3.slots;
var __VLS_9 = {};
let __VLS_11;
/** @ts-ignore @type {typeof ___VLS_components.ArrowLeftIcon} */
ArrowLeftIcon;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    ...{ class: "h-4 w-4 text-current" },
}));
const __VLS_13 = __VLS_12({
    ...{ class: "h-4 w-4 text-current" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-current']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sr-only" },
});
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
// @ts-ignore
[canScrollPrev, cn, orientation, $attrs, scrollPrev,];
var __VLS_3;
var __VLS_4;
// @ts-ignore
var __VLS_10 = __VLS_9;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({});
const __VLS_export = {};
export default {};
//# sourceMappingURL=CarouselPrevious.vue.js.map