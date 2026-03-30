import { useProvideCarousel } from './useCarousel';
import { cn } from '@/components/ui/utils';
const props = withDefaults(defineProps(), {
    orientation: 'horizontal',
});
const emits = defineEmits();
const carouselArgs = useProvideCarousel(props, emits);
const __VLS_exposed = carouselArgs;
defineExpose(__VLS_exposed);
function onKeyDown(event) {
    const prevKey = props.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = props.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    if (event.key === prevKey) {
        event.preventDefault();
        carouselArgs.scrollPrev();
        return;
    }
    if (event.key === nextKey) {
        event.preventDefault();
        carouselArgs.scrollNext();
    }
}
const __VLS_defaults = {
    orientation: 'horizontal',
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
    ...{ onKeydown: (__VLS_ctx.onKeyDown) },
    ...{ class: (__VLS_ctx.cn('relative', __VLS_ctx.$attrs.class ?? '')) },
    role: "region",
    'aria-roledescription': "carousel",
    tabindex: "0",
});
var __VLS_0 = {
    ...(__VLS_ctx.carouselArgs),
};
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[onKeyDown, cn, $attrs, carouselArgs,];
const __VLS_base = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=Carousel.vue.js.map