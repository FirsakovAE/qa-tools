import { DrawerContent, DrawerPortal } from 'vaul-vue';
import { useForwardPropsEmits } from 'reka-ui';
import DrawerOverlay from './DrawerOverlay.vue';
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
/** @ts-ignore @type {typeof ___VLS_components.DrawerPortal} */
DrawerPortal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
const __VLS_7 = DrawerOverlay;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({}));
const __VLS_9 = __VLS_8({}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
/** @ts-ignore @type {typeof ___VLS_components.DrawerContent} */
DrawerContent;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_14 = __VLS_13({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const { default: __VLS_17 } = __VLS_15.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div)({
    ...{ class: "mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" },
});
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-muted']} */ ;
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
//# sourceMappingURL=DrawerContent.vue.js.map