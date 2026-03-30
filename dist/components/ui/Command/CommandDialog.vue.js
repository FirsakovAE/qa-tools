import { useForwardPropsEmits } from 'reka-ui';
import Command from './Command.vue';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
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
/** @ts-ignore @type {typeof ___VLS_components.Dialog} */
Dialog;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwarded),
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwarded),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.DialogContent} */
DialogContent;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ class: "overflow-hidden p-0 shadow-lg" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "overflow-hidden p-0 shadow-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
const { default: __VLS_12 } = __VLS_10.slots;
const __VLS_13 = Command || Command;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    ...{ class: "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5" },
}));
const __VLS_15 = __VLS_14({
    ...{ class: "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-group-heading]]:px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-group-heading]]:font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-group-heading]]:text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-group]]:px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-input-wrapper]_svg]:h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-input-wrapper]_svg]:w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-input]]:h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-item]]:px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-item]]:py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-item]_svg]:h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['[&_[cmdk-item]_svg]:w-5']} */ ;
const { default: __VLS_18 } = __VLS_16.slots;
var __VLS_19 = {};
// @ts-ignore
[forwarded,];
var __VLS_16;
// @ts-ignore
[];
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_20 = __VLS_19;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=CommandDialog.vue.js.map