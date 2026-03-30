import { AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, useForwardPropsEmits, } from 'reka-ui';
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
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogPortal} */
AlertDialogPortal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogOverlay} */
AlertDialogOverlay;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/80']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=open]:animate-in']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=closed]:animate-out']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=closed]:fade-out-0']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=open]:fade-in-0']} */ ;
let __VLS_12;
/** @ts-ignore @type {typeof ___VLS_components.AlertDialogContent} */
AlertDialogContent;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 text-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_14 = __VLS_13({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 text-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const { default: __VLS_17 } = __VLS_15.slots;
var __VLS_18 = {};
// @ts-ignore
[forwarded, cn, $attrs,];
var __VLS_15;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_19 = __VLS_18;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=AlertDialogContent.vue.js.map