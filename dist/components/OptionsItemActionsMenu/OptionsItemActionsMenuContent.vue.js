import { computed } from 'vue';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, } from '@/components/ui/ContextMenu';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, } from '@/components/ui/DropdownMenu';
const props = withDefaults(defineProps(), { contentClass: 'w-44' });
const Content = computed(() => props.variant === 'context' ? ContextMenuContent : DropdownMenuContent);
const Item = computed(() => props.variant === 'context' ? ContextMenuItem : DropdownMenuItem);
const Separator = computed(() => props.variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator);
function handleClick(e, action) {
    if (props.variant === 'dropdown') {
        ;
        e.stopPropagation();
    }
    action.onClick?.();
}
const __VLS_defaults = { contentClass: 'w-44' };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
const __VLS_0 = (__VLS_ctx.Content);
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: (__VLS_ctx.contentClass) },
    ...(__VLS_ctx.variant === 'dropdown' ? { align: 'end' } : {}),
}));
const __VLS_2 = __VLS_1({
    ...{ class: (__VLS_ctx.contentClass) },
    ...(__VLS_ctx.variant === 'dropdown' ? { align: 'end' } : {}),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
for (const [action, idx] of __VLS_getVForSourceType((__VLS_ctx.actions))) {
    (idx);
    if (action.destructiveText && idx > 0 && !__VLS_ctx.actions.slice(0, idx).some(a => a.destructiveText)) {
        const __VLS_7 = (__VLS_ctx.Separator);
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({}));
        const __VLS_9 = __VLS_8({}, ...__VLS_functionalComponentArgsRest(__VLS_8));
    }
    if (action.slot) {
        const __VLS_12 = (__VLS_ctx.Item);
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            asChild: true,
            ...{ class: (action.destructiveText ? 'text-destructive_text' : undefined) },
        }));
        const __VLS_14 = __VLS_13({
            asChild: true,
            ...{ class: (action.destructiveText ? 'text-destructive_text' : undefined) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        const { default: __VLS_17 } = __VLS_15.slots;
        var __VLS_18 = {
            item: (__VLS_ctx.item),
            variant: (__VLS_ctx.variant),
        };
        var __VLS_19 = __VLS_tryAsConstant(action.slot);
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "flex items-center" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        const __VLS_22 = (action.icon);
        // @ts-ignore
        const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
            ...{ class: "h-4 w-4 mr-2" },
        }));
        const __VLS_24 = __VLS_23({
            ...{ class: "h-4 w-4 mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_23));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
        (action.label);
        // @ts-ignore
        [Content, contentClass, variant, variant, actions, actions, Separator, Item, item,];
        var __VLS_15;
    }
    else {
        const __VLS_27 = (__VLS_ctx.Item);
        // @ts-ignore
        const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
            ...{ 'onClick': {} },
            ...{ class: (action.destructiveText ? 'text-destructive_text' : undefined) },
        }));
        const __VLS_29 = __VLS_28({
            ...{ 'onClick': {} },
            ...{ class: (action.destructiveText ? 'text-destructive_text' : undefined) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_28));
        let __VLS_32;
        const __VLS_33 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(action.slot))
                        return;
                    __VLS_ctx.handleClick($event, action);
                    // @ts-ignore
                    [Item, handleClick,];
                } });
        const { default: __VLS_34 } = __VLS_30.slots;
        const __VLS_35 = (action.icon);
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
            ...{ class: "h-4 w-4 mr-2" },
        }));
        const __VLS_37 = __VLS_36({
            ...{ class: "h-4 w-4 mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
        (action.label);
        // @ts-ignore
        [];
        var __VLS_30;
        var __VLS_31;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
var __VLS_20 = __VLS_19, __VLS_21 = __VLS_18;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=OptionsItemActionsMenuContent.vue.js.map