import { computed } from 'vue';
import { Star, StarOff } from 'lucide-vue-next';
import { ContextMenuContent, ContextMenuItem, } from '@/components/ui/ContextMenu';
import { DropdownMenuContent, DropdownMenuItem, } from '@/components/ui/DropdownMenu';
const __VLS_export = ((__VLS_props, __VLS_ctx, __VLS_exposed, __VLS_setup = (async () => {
    const props = withDefaults(defineProps(), { contentClass: 'w-44' });
    const emit = defineEmits();
    const Content = computed(() => props.variant === 'context' ? ContextMenuContent : DropdownMenuContent);
    const Item = computed(() => props.variant === 'context' ? ContextMenuItem : DropdownMenuItem);
    function handleClick(e) {
        if (props.variant === 'dropdown') {
            ;
            e.stopPropagation();
        }
        emit('toggleFavorite', e, props.store);
    }
    const __VLS_defaults = { contentClass: 'w-44' };
    const __VLS_ctx = {
        ...{},
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
    const __VLS_7 = (__VLS_ctx.Item);
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        ...{ 'onClick': {} },
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = ({ click: {} },
        { onClick: (__VLS_ctx.handleClick) });
    const { default: __VLS_14 } = __VLS_10.slots;
    if (__VLS_ctx.isFavorite) {
        let __VLS_15;
        /** @ts-ignore @type {typeof ___VLS_components.StarOff} */
        StarOff;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
            ...{ class: "h-4 w-4 mr-2" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "h-4 w-4 mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    }
    else {
        let __VLS_20;
        /** @ts-ignore @type {typeof ___VLS_components.Star} */
        Star;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            ...{ class: "h-4 w-4 mr-2" },
        }));
        const __VLS_22 = __VLS_21({
            ...{ class: "h-4 w-4 mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    }
    (__VLS_ctx.isFavorite ? 'Remove favorite' : 'Add favorite');
    // @ts-ignore
    [Content, contentClass, variant, Item, handleClick, isFavorite, isFavorite,];
    var __VLS_10;
    var __VLS_11;
    // @ts-ignore
    [];
    var __VLS_3;
    // @ts-ignore
    [];
    return {};
})()) => ({}));
export default {};
//# sourceMappingURL=PiniaTableActionsMenuContent.vue.js.map