import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
const __VLS_props = defineProps();
const emit = defineEmits();
function toggle(key) {
    emit('toggle', key);
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.searchItems))) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (item.key),
        ...{ class: "flex items-center space-x-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof ___VLS_components.Checkbox} */
    Checkbox;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onUpdate:modelValue': {} },
        id: (`${__VLS_ctx.idPrefix}-${item.key}`),
        modelValue: (__VLS_ctx.searchSettings[item.key]),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onUpdate:modelValue': {} },
        id: (`${__VLS_ctx.idPrefix}-${item.key}`),
        modelValue: (__VLS_ctx.searchSettings[item.key]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                __VLS_ctx.toggle(item.key);
                // @ts-ignore
                [searchItems, idPrefix, searchSettings, toggle,];
            } });
    var __VLS_3;
    var __VLS_4;
    let __VLS_7;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        for: (`${__VLS_ctx.idPrefix}-${item.key}`),
        ...{ class: "text-sm" },
    }));
    const __VLS_9 = __VLS_8({
        for: (`${__VLS_ctx.idPrefix}-${item.key}`),
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const { default: __VLS_12 } = __VLS_10.slots;
    (item.label);
    // @ts-ignore
    [idPrefix,];
    var __VLS_10;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=SearchSettingsBlock.vue.js.map