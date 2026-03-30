import { computed } from 'vue';
import { Star, StarOff, EyeOff } from 'lucide-vue-next';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, } from '@/components/ui/ContextMenu';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, } from '@/components/ui/DropdownMenu';
const props = withDefaults(defineProps(), { contentClass: 'w-48' });
const emit = defineEmits();
const Content = computed(() => props.variant === 'context' ? ContextMenuContent : DropdownMenuContent);
const Item = computed(() => props.variant === 'context' ? ContextMenuItem : DropdownMenuItem);
const Separator = computed(() => props.variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator);
function handleClick(e, action) {
    if (props.variant === 'dropdown') {
        ;
        e.stopPropagation();
    }
    action();
}
const __VLS_defaults = { contentClass: 'w-48' };
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
    { onClick: (...[$event]) => {
            __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('toggleFavorite', __VLS_ctx.row));
            // @ts-ignore
            [Content, contentClass, variant, Item, handleClick, emit, row,];
        } });
const { default: __VLS_14 } = __VLS_10.slots;
if (__VLS_ctx.row.isFavoriteFlag) {
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
(__VLS_ctx.row.isFavoriteFlag ? 'Remove favorite' : 'Add favorite');
// @ts-ignore
[row, row,];
var __VLS_10;
var __VLS_11;
const __VLS_25 = (__VLS_ctx.Separator);
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({}));
const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
const __VLS_30 = (__VLS_ctx.Item);
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
    ...{ 'onClick': {} },
    ...{ class: "text-destructive_text" },
}));
const __VLS_32 = __VLS_31({
    ...{ 'onClick': {} },
    ...{ class: "text-destructive_text" },
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_35;
const __VLS_36 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('ignoreByName', __VLS_ctx.row));
            // @ts-ignore
            [Item, handleClick, emit, row, Separator,];
        } });
/** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
const { default: __VLS_37 } = __VLS_33.slots;
let __VLS_38;
/** @ts-ignore @type {typeof ___VLS_components.EyeOff} */
EyeOff;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_40 = __VLS_39({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
// @ts-ignore
[];
var __VLS_33;
var __VLS_34;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=PropsTableActionsMenuContent.vue.js.map