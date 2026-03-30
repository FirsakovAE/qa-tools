;
import { Primitive } from 'reka-ui';
import { Loader2Icon } from 'lucide-vue-next';
import { cn } from '@/components/ui/utils';
import { buttonVariants } from '.';
const props = withDefaults(defineProps(), {
    as: 'button',
    isLoading: false,
});
const __VLS_defaults = {
    as: 'button',
    isLoading: false,
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
/** @ts-ignore @type {typeof ___VLS_components.Primitive} */
Primitive;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    as: (__VLS_ctx.as),
    asChild: (__VLS_ctx.asChild),
    ...{ class: (__VLS_ctx.cn(__VLS_ctx.buttonVariants({ variant: __VLS_ctx.variant, size: __VLS_ctx.size }), __VLS_ctx.$attrs.class ?? '')) },
    disabled: (__VLS_ctx.isLoading || __VLS_ctx.$attrs.disabled),
}));
const __VLS_2 = __VLS_1({
    as: (__VLS_ctx.as),
    asChild: (__VLS_ctx.asChild),
    ...{ class: (__VLS_ctx.cn(__VLS_ctx.buttonVariants({ variant: __VLS_ctx.variant, size: __VLS_ctx.size }), __VLS_ctx.$attrs.class ?? '')) },
    disabled: (__VLS_ctx.isLoading || __VLS_ctx.$attrs.disabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
if (__VLS_ctx.isLoading) {
    let __VLS_7;
    /** @ts-ignore @type {typeof ___VLS_components.Loader2Icon} */
    Loader2Icon;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        ...{ class: "w-4 h-4 mr-2 animate-spin" },
    }));
    const __VLS_9 = __VLS_8({
        ...{ class: "w-4 h-4 mr-2 animate-spin" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
}
if (!__VLS_ctx.isLoading || (__VLS_ctx.isLoading && !__VLS_ctx.loadingText)) {
    var __VLS_12 = {};
}
else {
    (__VLS_ctx.loadingText);
}
// @ts-ignore
[as, asChild, cn, buttonVariants, variant, size, $attrs, $attrs, isLoading, isLoading, isLoading, isLoading, loadingText, loadingText,];
var __VLS_3;
// @ts-ignore
var __VLS_13 = __VLS_12;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=Button.vue.js.map