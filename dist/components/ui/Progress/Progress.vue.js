import { ProgressIndicator, ProgressRoot, } from 'reka-ui';
import { cn } from '@/components/ui/utils';
const props = withDefaults(defineProps(), {
    modelValue: 0,
});
const __VLS_defaults = {
    modelValue: 0,
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
/** @ts-ignore @type {typeof ___VLS_components.ProgressRoot} */
ProgressRoot;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(props),
    ...{ class: (__VLS_ctx.cn('relative h-4 w-full min-w-[50px] overflow-hidden rounded-full bg-secondary', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(props),
    ...{ class: (__VLS_ctx.cn('relative h-4 w-full min-w-[50px] overflow-hidden rounded-full bg-secondary', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.ProgressIndicator} */
ProgressIndicator;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "h-full w-full flex-1 bg-primary transition-all" },
    ...{ style: (`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`) },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "h-full w-full flex-1 bg-primary transition-all" },
    ...{ style: (`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`) },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
// @ts-ignore
[cn, $attrs,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=Progress.vue.js.map