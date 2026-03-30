import { ref, computed, watch, nextTick, onMounted } from 'vue';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import { Copy, Check } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
// Skip Prism highlighting for payloads larger than this (bytes).
// Prism wraps every token in a <span>, which creates 10k+ DOM nodes on big JSON
// and freezes the UI. Plain text rendering is instant regardless of size.
const HIGHLIGHT_SIZE_LIMIT = 200 * 1024;
const PRISM_LANG_MAP = {
    json: 'json',
    xml: 'markup',
    html: 'markup',
    css: 'css',
    javascript: 'javascript',
};
const props = withDefaults(defineProps(), {
    fullHeight: false,
    language: 'json'
});
const emit = defineEmits();
const editedJson = ref(props.modelValue.trim());
const copied = ref(false);
watch(() => props.modelValue, v => {
    editedJson.value = v.trim();
    highlight();
});
const isLargePayload = computed(() => editedJson.value.length > HIGHLIGHT_SIZE_LIMIT);
const prismLang = computed(() => PRISM_LANG_MAP[props.language] || null);
const prismClass = computed(() => prismLang.value ? `language-${prismLang.value}` : '');
const isJsonValid = computed(() => {
    if (props.language !== 'json')
        return true;
    try {
        JSON.parse(editedJson.value);
        return true;
    }
    catch {
        return false;
    }
});
const codeRef = ref(null);
const editableRef = ref(null);
function highlight() {
    nextTick(() => {
        if (codeRef.value && !props.editable) {
            codeRef.value.textContent = editedJson.value;
            codeRef.value.className = prismClass.value;
            if (!isLargePayload.value && prismLang.value) {
                Prism.highlightElement(codeRef.value);
            }
        }
    });
}
function updateEditableContent() {
    nextTick(() => {
        if (editableRef.value && props.editable) {
            editableRef.value.textContent = editedJson.value;
        }
    });
}
onMounted(() => {
    highlight();
    updateEditableContent();
});
watch(() => props.editable, () => {
    highlight();
    updateEditableContent();
});
function copyToClipboard() {
    let textToCopy = editedJson.value;
    if (props.language === 'json' && textToCopy.length <= HIGHLIGHT_SIZE_LIMIT) {
        try {
            const parsed = JSON.parse(textToCopy);
            if (typeof parsed === 'object' && parsed !== null) {
                textToCopy = JSON.stringify(parsed, null, 2);
            }
        }
        catch { /* keep original */ }
    }
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
function onInput(e) {
    editedJson.value = e.target.textContent || '';
    emit('update:modelValue', editedJson.value);
}
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
    ...{ class: (__VLS_ctx.fullHeight ? 'h-full flex flex-col' : '') },
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
    ...{ class: ([__VLS_ctx.fullHeight ? 'flex-1 min-h-0 full-height-scroll' : 'h-[330px]']) },
}));
const __VLS_15 = __VLS_14({
    ...{ class: ([__VLS_ctx.fullHeight ? 'flex-1 min-h-0 full-height-scroll' : 'h-[330px]']) },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
const { default: __VLS_18 } = __VLS_16.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['p-2', __VLS_ctx.fullHeight ? 'min-h-full w-full' : '']) },
});
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
if (__VLS_ctx.editable) {
    __VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ onInput: (__VLS_ctx.onInput) },
        ...{ onKeydown: ((e) => { if (e.key !== 'Escape')
                e.stopPropagation(); }) },
        ref: "editableRef",
        ...{ class: "\u006a\u0073\u006f\u006e\u002d\u0065\u0064\u0069\u0074\u006f\u0072\u0020\u0066\u006f\u006e\u0074\u002d\u0073\u0061\u006e\u0073\u0020\u006c\u0065\u0061\u0064\u0069\u006e\u0067\u002d\u0072\u0065\u006c\u0061\u0078\u0065\u0064\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0077\u0068\u0069\u0074\u0065\u0073\u0070\u0061\u0063\u0065\u002d\u0070\u0072\u0065\u002d\u0077\u0072\u0061\u0070\u0020\u0062\u0072\u0065\u0061\u006b\u002d\u0061\u006c\u006c\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0067\u002d\u0074\u0072\u0061\u006e\u0073\u0070\u0061\u0072\u0065\u006e\u0074\u0020\u006f\u0075\u0074\u006c\u0069\u006e\u0065\u002d\u006e\u006f\u006e\u0065\u0020\u0066\u006f\u0063\u0075\u0073\u003a\u006f\u0075\u0074\u006c\u0069\u006e\u0065\u002d\u006e\u006f\u006e\u0065\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0063\u0075\u0072\u0073\u006f\u0072\u002d\u0074\u0065\u0078\u0074" },
        ...{ class: (__VLS_ctx.fullHeight ? 'min-h-full' : 'min-h-[300px]') },
        ...{ style: ({
                color: 'hsl(var(--foreground))',
                caretColor: 'hsl(var(--foreground))'
            }) },
        contenteditable: "plaintext-only",
        spellcheck: "false",
        'data-content': (__VLS_ctx.editedJson),
    });
    /** @type {__VLS_StyleScopedClasses['json-editor']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-sans']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed
    ']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all
    ']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
    /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus:outline-none
    ']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-text']} */ ;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "\u006a\u0073\u006f\u006e\u002d\u0076\u0069\u0065\u0077\u0065\u0072\u0020\u0070\u002d\u0032\u0020\u006c\u0065\u0061\u0064\u0069\u006e\u0067\u002d\u0072\u0065\u006c\u0061\u0078\u0065\u0064\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0077\u0068\u0069\u0074\u0065\u0073\u0070\u0061\u0063\u0065\u002d\u0070\u0072\u0065\u002d\u0077\u0072\u0061\u0070\u0020\u0062\u0072\u0065\u0061\u006b\u002d\u0077\u006f\u0072\u0064\u0073" },
        ...{ class: ([
                __VLS_ctx.fullHeight ? 'min-h-full' : 'min-h-[300px]',
                __VLS_ctx.isLargePayload && 'json-viewer--plain'
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['json-viewer']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed
    ']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.code, __VLS_intrinsics.code)({
        ref: "codeRef",
        ...{ class: (__VLS_ctx.prismClass) },
    });
}
let __VLS_19;
/** @ts-ignore @type {typeof ___VLS_components.ScrollBar} */
ScrollBar;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    orientation: "vertical",
}));
const __VLS_21 = __VLS_20({
    orientation: "vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
// @ts-ignore
[fullHeight, fullHeight, fullHeight, fullHeight, editable, onInput, editedJson, isLargePayload, prismClass,];
var __VLS_16;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=JsonTextEditor.vue.js.map