import { SearchIcon } from 'lucide-vue-next';
import { ComboboxInput, useForwardProps } from 'reka-ui';
import { cn } from '@/components/ui/utils';
defineOptions({
    inheritAttrs: false,
});
const props = defineProps();
const forwardedProps = useForwardProps(props);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center border-b px-3" },
    'cmdk-input-wrapper': true,
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.SearchIcon} */
SearchIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "mr-2 h-4 w-4 shrink-0 opacity-50" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "mr-2 h-4 w-4 shrink-0 opacity-50" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof ___VLS_components.ComboboxInput} */
ComboboxInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...({ ...__VLS_ctx.forwardedProps, ...__VLS_ctx.$attrs }),
    autoFocus: true,
    ...{ class: (__VLS_ctx.cn('flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_7 = __VLS_6({
    ...({ ...__VLS_ctx.forwardedProps, ...__VLS_ctx.$attrs }),
    autoFocus: true,
    ...{ class: (__VLS_ctx.cn('flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
// @ts-ignore
[forwardedProps, $attrs, $attrs, cn,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
//# sourceMappingURL=CommandInput.vue.js.map