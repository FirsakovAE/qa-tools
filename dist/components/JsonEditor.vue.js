import { computed } from 'vue';
import JsonTextEditor from './JsonTextEditor.vue';
import JsonTreeEditor from './JsonTreeEditor.vue';
import JsonEditorReadOnlyLarge from './JsonEditorReadOnlyLarge.vue';
/** For read-only payloads larger than this, use lightweight view (no Prism, no tree) */
const LARGE_READ_THRESHOLD = 500 * 1024;
const props = withDefaults(defineProps(), {
    fullHeight: false,
    language: 'json'
});
const emit = defineEmits();
const mode = computed(() => props.mode ?? 'text');
const useTreeMode = computed(() => mode.value === 'tree' && props.language === 'json');
/** Use lightweight read-only view for large payloads to avoid DOM overload */
const useLargeReadOnly = computed(() => !props.editable && props.modelValue.length > LARGE_READ_THRESHOLD);
const __VLS_defaults = {
    fullHeight: false,
    language: 'json'
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
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative json-viewer-wrapper rounded" },
    ...{ class: (__VLS_ctx.fullHeight ? 'h-full flex flex-col' : 'min-h-[350px]') },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['json-viewer-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
if (__VLS_ctx.useLargeReadOnly) {
    const __VLS_0 = JsonEditorReadOnlyLarge;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        modelValue: (__VLS_ctx.modelValue),
        fullHeight: (__VLS_ctx.fullHeight),
    }));
    const __VLS_2 = __VLS_1({
        modelValue: (__VLS_ctx.modelValue),
        fullHeight: (__VLS_ctx.fullHeight),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    const __VLS_5 = (__VLS_ctx.useTreeMode ? JsonTreeEditor : JsonTextEditor);
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.modelValue),
        editable: (__VLS_ctx.editable),
        showCopy: (__VLS_ctx.showCopy),
        fullHeight: (__VLS_ctx.fullHeight),
        language: (__VLS_ctx.language),
    }));
    const __VLS_7 = __VLS_6({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.modelValue),
        editable: (__VLS_ctx.editable),
        showCopy: (__VLS_ctx.showCopy),
        fullHeight: (__VLS_ctx.fullHeight),
        language: (__VLS_ctx.language),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    let __VLS_10;
    const __VLS_11 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (...[$event]) => {
                if (!!(__VLS_ctx.useLargeReadOnly))
                    return;
                __VLS_ctx.$emit('update:modelValue', $event);
                // @ts-ignore
                [fullHeight, fullHeight, fullHeight, useLargeReadOnly, modelValue, modelValue, useTreeMode, editable, showCopy, language, $emit,];
            } });
    var __VLS_8;
    var __VLS_9;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=JsonEditor.vue.js.map