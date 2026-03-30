import { computed, provide, ref } from 'vue';
import JsonTreeNode from './JsonTreeNode.vue';
const props = defineProps();
const emit = defineEmits();
// Глобальное состояние для отслеживания редактируемого элемента
const editingElement = ref(null);
// Функции для управления редактированием
function startEditing(elementId) {
    editingElement.value = elementId;
}
function stopEditing() {
    editingElement.value = null;
}
function isEditing(elementId) {
    return editingElement.value === elementId;
}
// Предоставляем функции дочерним компонентам
provide('treeEditing', {
    startEditing,
    stopEditing,
    isEditing
});
const isObject = computed(() => {
    return typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value);
});
const isArray = computed(() => {
    return Array.isArray(props.value);
});
const rootChildren = computed(() => {
    if (isArray.value) {
        return props.value.map((item, index) => ({
            key: index.toString(),
            value: item,
            isArrayItem: true
        }));
    }
    if (isObject.value) {
        return Object.entries(props.value).map(([key, value]) => ({
            key,
            value,
            isArrayItem: false
        }));
    }
    return [];
});
function handleItemUpdate(itemKey, newValue) {
    const updated = { ...props.value };
    if (isArray.value) {
        const index = parseInt(itemKey);
        updated[index] = newValue;
    }
    else {
        updated[itemKey] = newValue;
    }
    emit('commit', updated);
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
    ...{ class: "json-tree-view" },
});
/** @type {__VLS_StyleScopedClasses['json-tree-view']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base leading-relaxed font-normal text-muted-foreground mb-1" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
(__VLS_ctx.isArray ? '[' : '{');
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ml-4" },
});
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
for (const [child] of __VLS_getVForSourceType((__VLS_ctx.rootChildren))) {
    const __VLS_0 = JsonTreeNode;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onUpdate:value': {} },
        key: (child.key),
        keyName: (child.isArrayItem ? child.key : child.key),
        value: (child.value),
        level: (0),
        isArrayItem: (child.isArrayItem),
        editable: (__VLS_ctx.editable),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onUpdate:value': {} },
        key: (child.key),
        keyName: (child.isArrayItem ? child.key : child.key),
        value: (child.value),
        level: (0),
        isArrayItem: (child.isArrayItem),
        editable: (__VLS_ctx.editable),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ 'update:value': {} },
        { 'onUpdate:value': (...[$event]) => {
                __VLS_ctx.handleItemUpdate(child.key, $event);
                // @ts-ignore
                [isArray, rootChildren, editable, handleItemUpdate,];
            } });
    var __VLS_3;
    var __VLS_4;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base leading-relaxed font-normal text-muted-foreground mt-1" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
(__VLS_ctx.isArray ? ']' : '}');
// @ts-ignore
[isArray,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=JsonTreeView.vue.js.map