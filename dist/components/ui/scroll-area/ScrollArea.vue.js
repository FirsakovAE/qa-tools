import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport, } from 'reka-ui';
import ScrollBar from './ScrollBar.vue';
import { cn } from '@/components/ui/utils';
const props = defineProps();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.ScrollAreaRoot} */
ScrollAreaRoot;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(props),
    ...{ class: (__VLS_ctx.cn('relative overflow-hidden', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(props),
    ...{ class: (__VLS_ctx.cn('relative overflow-hidden', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.ScrollAreaViewport} */
ScrollAreaViewport;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "h-full w-full rounded-[inherit]" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "h-full w-full rounded-[inherit]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[inherit]']} */ ;
const { default: __VLS_12 } = __VLS_10.slots;
var __VLS_13 = {};
// @ts-ignore
[cn, $attrs,];
var __VLS_10;
const __VLS_15 = ScrollBar;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    orientation: "horizontal",
}));
const __VLS_17 = __VLS_16({
    orientation: "horizontal",
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const __VLS_20 = ScrollBar;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    orientation: "vertical",
}));
const __VLS_22 = __VLS_21({
    orientation: "vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_25;
/** @ts-ignore @type {typeof ___VLS_components.ScrollAreaCorner} */
ScrollAreaCorner;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({}));
const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_14 = __VLS_13;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=ScrollArea.vue.js.map