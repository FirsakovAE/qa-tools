import TableRow from './TableRow.vue';
import TableCell from './TableCell.vue';
import { cn } from '@/components/ui/utils';
const props = withDefaults(defineProps(), {
    colspan: 1,
});
const __VLS_defaults = {
    colspan: 1,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
const __VLS_0 = TableRow || TableRow;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
const __VLS_7 = TableCell || TableCell;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...(props),
    ...{ class: (__VLS_ctx.cn('p-4 whitespace-nowrap align-middle text-sm text-foreground', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_9 = __VLS_8({
    ...(props),
    ...{ class: (__VLS_ctx.cn('p-4 whitespace-nowrap align-middle text-sm text-foreground', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-center py-10" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
var __VLS_13 = {};
// @ts-ignore
[cn, $attrs,];
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_14 = __VLS_13;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=TableEmpty.vue.js.map