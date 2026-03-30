import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits, } from 'reka-ui';
import { XIcon } from 'lucide-vue-next';
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
/** @ts-ignore @type {typeof ___VLS_components.DialogPortal} */
DialogPortal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.DialogOverlay} */
DialogOverlay;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['place-items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/80']} */ ;
/** @type {__VLS_StyleScopedClasses['']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=open]:animate-in']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=closed]:animate-out']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=closed]:fade-out-0']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=open]:fade-in-0']} */ ;
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.DialogContent} */
DialogContent;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    ...{ 'onPointerDownOutside': {} },
    ...{ class: (__VLS_ctx.cn('relative z-50 grid w-full max-w-lg my-8 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full', __VLS_ctx.$attrs.class ?? '')) },
    ...(__VLS_ctx.forwarded),
}));
const __VLS_15 = __VLS_14({
    ...{ 'onPointerDownOutside': {} },
    ...{ class: (__VLS_ctx.cn('relative z-50 grid w-full max-w-lg my-8 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full', __VLS_ctx.$attrs.class ?? '')) },
    ...(__VLS_ctx.forwarded),
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
let __VLS_18;
const __VLS_19 = ({ pointerDownOutside: {} },
    { onPointerDownOutside: ((event) => {
            const originalEvent = event.detail.originalEvent;
            const target = originalEvent.target;
            if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
                event.preventDefault();
            }
        }) });
const { default: __VLS_20 } = __VLS_16.slots;
var __VLS_21 = {};
let __VLS_23;
/** @ts-ignore @type {typeof ___VLS_components.DialogClose} */
DialogClose;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
    ...{ class: "absolute top-3 right-3 p-0.5 transition-colors rounded-md hover:bg-secondary" },
}));
const __VLS_25 = __VLS_24({
    ...{ class: "absolute top-3 right-3 p-0.5 transition-colors rounded-md hover:bg-secondary" },
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-3']} */ ;
/** @type {__VLS_StyleScopedClasses['right-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-secondary']} */ ;
const { default: __VLS_28 } = __VLS_26.slots;
let __VLS_29;
/** @ts-ignore @type {typeof ___VLS_components.XIcon} */
XIcon;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    ...{ class: "w-4 h-4" },
}));
const __VLS_31 = __VLS_30({
    ...{ class: "w-4 h-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sr-only" },
});
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
// @ts-ignore
[cn, $attrs, forwarded,];
var __VLS_26;
// @ts-ignore
[];
var __VLS_16;
var __VLS_17;
// @ts-ignore
[];
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_22 = __VLS_21;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=DialogScrollContent.vue.js.map