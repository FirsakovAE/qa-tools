import { computed, ref } from 'vue';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-vue-next';
import JsonTreeView from './JsonTreeView.vue';
const props = withDefaults(defineProps(), {
    fullHeight: false
});
const emit = defineEmits();
const parsedValue = computed(() => {
    try {
        return JSON.parse(props.modelValue);
    }
    catch {
        return {};
    }
});
const copied = ref(false);
function copyToClipboard() {
    // Format JSON properly before copying
    let textToCopy = props.modelValue;
    try {
        const parsed = JSON.parse(props.modelValue);
        textToCopy = JSON.stringify(parsed, null, 2);
    }
    catch {
        // Keep original if not valid JSON
    }
    // Use execCommand first (works in iframes without permissions policy issues)
    try {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (success) {
            copied.value = true;
            setTimeout(() => copied.value = false, 1500);
        }
    }
    catch {
        // Silently fail if copy doesn't work
    }
}
function emitStringified(newValue) {
    try {
        const stringified = JSON.stringify(newValue, null, 2);
        emit('update:modelValue', stringified);
    }
    catch (error) {
        console.error('Failed to stringify JSON:', error);
    }
}
const __VLS_defaults = {
    fullHeight: false
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
    ...{ class: (__VLS_ctx.fullHeight ? 'h-full flex flex-col relative' : 'relative') },
});
if (__VLS_ctx.showCopy && !__VLS_ctx.editable) {
    let __VLS_0;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "sm",
        ...{ class: "absolute top-2 right-2 z-10 gap-1 text-xs pointer-events-auto bg-transparent hover:bg-transparent active:bg-transparent focus-visible:ring-0" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClick': {} },
        variant: "ghost",
        size: "sm",
        ...{ class: "absolute top-2 right-2 z-10 gap-1 text-xs pointer-events-auto bg-transparent hover:bg-transparent active:bg-transparent focus-visible:ring-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ click: {} },
        { onClick: (__VLS_ctx.copyToClipboard) });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-transparent']} */ ;
    /** @type {__VLS_StyleScopedClasses['active:bg-transparent']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:ring-0']} */ ;
    const { default: __VLS_7 } = __VLS_3.slots;
    const __VLS_8 = (__VLS_ctx.copied ? __VLS_ctx.Check : __VLS_ctx.Copy);
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    (__VLS_ctx.copied ? 'Copied' : 'Copy');
    // @ts-ignore
    [fullHeight, showCopy, editable, copyToClipboard, copied, copied, Check, Copy,];
    var __VLS_3;
    var __VLS_4;
}
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
ScrollArea;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    ...{ class: (__VLS_ctx.fullHeight ? 'flex-1 min-h-0' : 'h-[330px]') },
}));
const __VLS_15 = __VLS_14({
    ...{ class: (__VLS_ctx.fullHeight ? 'flex-1 min-h-0' : 'h-[330px]') },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
const { default: __VLS_18 } = __VLS_16.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "p-2" },
});
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (__VLS_ctx.fullHeight ? '' : 'min-h-[300px]') },
});
const __VLS_19 = JsonTreeView;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    ...{ 'onCommit': {} },
    value: (__VLS_ctx.parsedValue),
    editable: (__VLS_ctx.editable),
}));
const __VLS_21 = __VLS_20({
    ...{ 'onCommit': {} },
    value: (__VLS_ctx.parsedValue),
    editable: (__VLS_ctx.editable),
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
let __VLS_24;
const __VLS_25 = ({ commit: {} },
    { onCommit: (__VLS_ctx.emitStringified) });
var __VLS_22;
var __VLS_23;
let __VLS_26;
/** @ts-ignore @type {typeof ___VLS_components.ScrollBar} */
ScrollBar;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
    orientation: "vertical",
}));
const __VLS_28 = __VLS_27({
    orientation: "vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
// @ts-ignore
[fullHeight, fullHeight, editable, parsedValue, emitStringified,];
var __VLS_16;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=JsonTreeEditor.vue.js.map