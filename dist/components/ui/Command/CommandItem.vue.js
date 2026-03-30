import { ComboboxItem, useForwardPropsEmits } from 'reka-ui';
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
/** @ts-ignore @type {typeof ___VLS_components.ComboboxItem} */
ComboboxItem;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
var __VLS_7 = {};
// @ts-ignore
[forwarded, cn, $attrs,];
var __VLS_3;
// @ts-ignore
var __VLS_8 = __VLS_7;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=CommandItem.vue.js.map