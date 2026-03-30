import { PopoverContent, PopoverPortal, useForwardPropsEmits, } from 'reka-ui';
import { cn } from '@/components/ui/utils';
defineOptions({
    inheritAttrs: false,
});
const props = withDefaults(defineProps(), {
    align: 'center',
    sideOffset: 4,
});
const emits = defineEmits();
const forwarded = useForwardPropsEmits(props, emits);
const __VLS_defaults = {
    align: 'center',
    sideOffset: 4,
};
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
/** @ts-ignore @type {typeof ___VLS_components.PopoverPortal} */
PopoverPortal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.PopoverContent} */
PopoverContent;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...({ ...__VLS_ctx.forwarded, ...__VLS_ctx.$attrs }),
    ...{ class: (__VLS_ctx.cn([
            'z-50 w-72 rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) p-4 text-popover-foreground shadow-md outline-hidden',
            'data-[state=closed]:animate-popover-fade-scale-blur-out',
            'data-[side=bottom]:data-[state=open]:animate-popover-slide-blur-from-top',
            'data-[side=left]:data-[state=open]:animate-popover-slide-blur-from-right',
            'data-[side=right]:data-[state=open]:animate-popover-slide-blur-from-left',
            'data-[side=top]:data-[state=open]:animate-popover-slide-blur-from-bottom',
            '[transform-origin:var(--reka-popover-content-transform-origin)]',
        ], __VLS_ctx.$attrs.class ?? '')) },
}));
const __VLS_9 = __VLS_8({
    ...({ ...__VLS_ctx.forwarded, ...__VLS_ctx.$attrs }),
    ...{ class: (__VLS_ctx.cn([
            'z-50 w-72 rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) p-4 text-popover-foreground shadow-md outline-hidden',
            'data-[state=closed]:animate-popover-fade-scale-blur-out',
            'data-[side=bottom]:data-[state=open]:animate-popover-slide-blur-from-top',
            'data-[side=left]:data-[state=open]:animate-popover-slide-blur-from-right',
            'data-[side=right]:data-[state=open]:animate-popover-slide-blur-from-left',
            'data-[side=top]:data-[state=open]:animate-popover-slide-blur-from-bottom',
            '[transform-origin:var(--reka-popover-content-transform-origin)]',
        ], __VLS_ctx.$attrs.class ?? '')) },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
var __VLS_13 = {};
// @ts-ignore
[forwarded, $attrs, $attrs, cn,];
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_14 = __VLS_13;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=PopoverContent.vue.js.map