import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from 'reka-ui';
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
/** @ts-ignore @type {typeof ___VLS_components.SliderRoot} */
SliderRoot;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('relative flex w-full min-w-[50px] touch-none select-none items-center', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('relative flex w-full min-w-[50px] touch-none select-none items-center', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.SliderTrack} */
SliderTrack;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "relative h-2 w-full grow overflow-hidden rounded-full bg-secondary" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "relative h-2 w-full grow overflow-hidden rounded-full bg-secondary" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.SliderRange} */
SliderRange;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    ...{ class: "absolute h-full bg-primary" },
}));
const __VLS_15 = __VLS_14({
    ...{ class: "absolute h-full bg-primary" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
// @ts-ignore
[forwarded, cn, $attrs,];
var __VLS_10;
for (const [_, key] of __VLS_getVForSourceType((__VLS_ctx.modelValue))) {
    let __VLS_18;
    /** @ts-ignore @type {typeof ___VLS_components.SliderThumb} */
    SliderThumb;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
        key: (key),
        ...{ class: "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" },
    }));
    const __VLS_20 = __VLS_19({
        key: (key),
        ...{ class: "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-offset-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:ring-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:ring-ring']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    // @ts-ignore
    [modelValue,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=Slider.vue.js.map