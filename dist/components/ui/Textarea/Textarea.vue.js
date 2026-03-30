import { cn } from '@/components/ui/utils';
const props = defineProps();
const model = defineModel();
const __VLS_modelEmit = defineEmits();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.model),
    ...{ class: (__VLS_ctx.cn('flex min-h-20 w-full rounded-md border border-border bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
    autocomplete: "off",
});
// @ts-ignore
[model, cn, $attrs,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=Textarea.vue.js.map