import { Separator } from 'reka-ui';
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
/** @ts-ignore @type {typeof ___VLS_components.Separator} */
Separator;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(props),
    ...{ class: (__VLS_ctx.cn('shrink-0 bg-border relative', props.orientation === 'vertical' ? 'w-px h-full' : 'h-px w-full', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(props),
    ...{ class: (__VLS_ctx.cn('shrink-0 bg-border relative', props.orientation === 'vertical' ? 'w-px h-full' : 'h-px w-full', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
if (props.label) {
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (__VLS_ctx.cn('text-xs text-muted-foreground bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center items-center', props.orientation === 'vertical' ? 'w-[1px] px-1 py-2' : 'h-[1px] py-1 px-2')) },
    });
    (props.label);
}
// @ts-ignore
[cn, cn, $attrs,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
//# sourceMappingURL=Separator.vue.js.map