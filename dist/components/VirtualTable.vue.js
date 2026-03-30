import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps(), {
    keyField: 'id',
    itemSize: 40,
    minWidth: '360px',
    emptyMessage: '',
    showEmpty: true,
    isLoading: false,
});
const emit = defineEmits();
const __VLS_defaults = {
    keyField: 'id',
    itemSize: 40,
    minWidth: '360px',
    emptyMessage: '',
    showEmpty: true,
    isLoading: false,
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
/** @type {__VLS_StyleScopedClasses['vue-recycle-scroller']} */ ;
/** @type {__VLS_StyleScopedClasses['vue-recycle-scroller']} */ ;
/** @type {__VLS_StyleScopedClasses['vue-recycle-scroller']} */ ;
/** @type {__VLS_StyleScopedClasses['vue-recycle-scroller']} */ ;
/** @type {__VLS_StyleScopedClasses['vue-recycle-scroller']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "virtual-table h-full flex flex-col border rounded-lg overflow-hidden table-scroll-x" },
});
/** @type {__VLS_StyleScopedClasses['virtual-table']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['table-scroll-x']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col h-full min-h-0" },
    ...{ style: ({ minWidth: __VLS_ctx.minWidth }) },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
if (__VLS_ctx.$slots.header) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 border-b bg-muted/30" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "virtual-table__header" },
    });
    /** @type {__VLS_StyleScopedClasses['virtual-table__header']} */ ;
    var __VLS_0 = {};
}
if (__VLS_ctx.items.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onMouseleave: (...[$event]) => {
                if (!(__VLS_ctx.items.length > 0))
                    return;
                __VLS_ctx.emit('mouseleave', $event);
                // @ts-ignore
                [minWidth, $slots, items, emit,];
            } },
        ...{ class: "flex-1 min-h-0 flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    let __VLS_2;
    /** @ts-ignore @type {typeof ___VLS_components.RecycleScroller} */
    RecycleScroller;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(__VLS_2, new __VLS_2({
        ...{ class: "flex-1 min-h-0" },
        items: (__VLS_ctx.items),
        itemSize: (__VLS_ctx.itemSize),
        keyField: (__VLS_ctx.keyField),
    }));
    const __VLS_4 = __VLS_3({
        ...{ class: "flex-1 min-h-0" },
        items: (__VLS_ctx.items),
        itemSize: (__VLS_ctx.itemSize),
        keyField: (__VLS_ctx.keyField),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    const { default: __VLS_7 } = __VLS_5.slots;
    {
        const { default: __VLS_8 } = __VLS_5.slots;
        const [scope] = __VLS_getSlotParameters(__VLS_8);
        var __VLS_9 = {
            ...(scope),
        };
        // @ts-ignore
        [items, itemSize, keyField,];
    }
    if (__VLS_ctx.$slots.after) {
        {
            const { after: __VLS_11 } = __VLS_5.slots;
            var __VLS_12 = {};
            // @ts-ignore
            [$slots,];
        }
    }
    // @ts-ignore
    [];
    var __VLS_5;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1 min-h-0 overflow-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
    if (__VLS_ctx.isLoading && __VLS_ctx.$slots.after) {
        var __VLS_14 = {};
    }
    else if (__VLS_ctx.showEmpty && __VLS_ctx.emptyMessage) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "virtual-table__empty" },
        });
        /** @type {__VLS_StyleScopedClasses['virtual-table__empty']} */ ;
        (__VLS_ctx.emptyMessage);
    }
}
// @ts-ignore
var __VLS_1 = __VLS_0, __VLS_10 = __VLS_9, __VLS_13 = __VLS_12, __VLS_15 = __VLS_14;
// @ts-ignore
[$slots, isLoading, showEmpty, emptyMessage, emptyMessage,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
//# sourceMappingURL=VirtualTable.vue.js.map