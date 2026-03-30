import { computed } from 'vue';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits, } from 'reka-ui';
import { XIcon } from 'lucide-vue-next';
import { sheetVariants } from '.';
import { cn } from '@/components/ui/utils';
defineOptions({
    inheritAttrs: false,
});
const props = defineProps();
const emits = defineEmits();
const delegatedProps = computed(() => ({ ...props, side: undefined }));
const forwarded = useForwardPropsEmits(delegatedProps, emits);
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
/** @ts-ignore @type {typeof ___VLS_components.DialogContent} */
DialogContent;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ class: (__VLS_ctx.cn(__VLS_ctx.sheetVariants({ side: __VLS_ctx.side }), __VLS_ctx.$attrs.class ?? '')) },
    ...({ ...__VLS_ctx.forwarded, ...__VLS_ctx.$attrs }),
}));
const __VLS_14 = __VLS_13({
    ...{ class: (__VLS_ctx.cn(__VLS_ctx.sheetVariants({ side: __VLS_ctx.side }), __VLS_ctx.$attrs.class ?? '')) },
    ...({ ...__VLS_ctx.forwarded, ...__VLS_ctx.$attrs }),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const { default: __VLS_17 } = __VLS_15.slots;
var __VLS_18 = {};
let __VLS_20;
/** @ts-ignore @type {typeof ___VLS_components.DialogClose} */
DialogClose;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-2 focus:outline-ring focus:outline-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-2 focus:outline-ring focus:outline-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-4']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-ring']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['data-[state=open]:bg-secondary']} */ ;
const { default: __VLS_25 } = __VLS_23.slots;
let __VLS_26;
/** @ts-ignore @type {typeof ___VLS_components.XIcon} */
XIcon;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
    ...{ class: "w-4 h-4 text-muted-foreground" },
}));
const __VLS_28 = __VLS_27({
    ...{ class: "w-4 h-4 text-muted-foreground" },
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
// @ts-ignore
[cn, sheetVariants, side, $attrs, $attrs, forwarded,];
var __VLS_23;
// @ts-ignore
[];
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
//# sourceMappingURL=SheetContent.vue.js.map