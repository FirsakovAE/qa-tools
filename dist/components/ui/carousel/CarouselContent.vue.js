import { useCarousel } from './useCarousel';
import { cn } from '@/components/ui/utils';
defineOptions({
    inheritAttrs: false,
});
const { carouselRef, orientation } = useCarousel();
const __VLS_ctx = {
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "carouselRef",
    ...{ class: "overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (__VLS_ctx.cn('flex', __VLS_ctx.orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', __VLS_ctx.$attrs.class ?? '')) },
});
(__VLS_ctx.$attrs);
var __VLS_0 = {};
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[cn, orientation, $attrs, $attrs,];
const __VLS_base = (await import('vue')).defineComponent({});
const __VLS_export = {};
export default {};
//# sourceMappingURL=CarouselContent.vue.js.map