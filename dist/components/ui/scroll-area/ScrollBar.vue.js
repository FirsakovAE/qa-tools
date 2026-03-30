import { ScrollAreaScrollbar, ScrollAreaThumb } from 'reka-ui';
import { cn } from '@/components/ui/utils';
const props = withDefaults(defineProps(), {
    orientation: 'vertical',
});
const __VLS_defaults = {
    orientation: 'vertical',
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
/** @ts-ignore @type {typeof ___VLS_components.ScrollAreaScrollbar} */
ScrollAreaScrollbar;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(props),
    ...{ class: (__VLS_ctx.cn('flex touch-none select-none transition-colors', __VLS_ctx.orientation === 'vertical'
            && 'h-full w-2.5 border-l border-l-transparent p-px', __VLS_ctx.orientation === 'horizontal'
            && 'h-2.5 flex-col border-t border-t-transparent p-px', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(props),
    ...{ class: (__VLS_ctx.cn('flex touch-none select-none transition-colors', __VLS_ctx.orientation === 'vertical'
            && 'h-full w-2.5 border-l border-l-transparent p-px', __VLS_ctx.orientation === 'horizontal'
            && 'h-2.5 flex-col border-t border-t-transparent p-px', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.ScrollAreaThumb} */
ScrollAreaThumb;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "relative flex-1 rounded-full bg-border" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "relative flex-1 rounded-full bg-border" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-border']} */ ;
// @ts-ignore
[cn, orientation, orientation, $attrs,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=ScrollBar.vue.js.map