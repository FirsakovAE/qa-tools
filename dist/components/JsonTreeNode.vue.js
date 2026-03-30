import { ref, computed, inject, onMounted, onUnmounted } from 'vue';
import { ChevronRight, ChevronDown } from 'lucide-vue-next';
const props = defineProps();
const emit = defineEmits();
// Инъектируем функции управления редактированием
const treeEditing = inject('treeEditing');
const isExpanded = ref(false);
const isEditing = ref(false);
const editValue = ref('');
// Создаем уникальный ID для элемента
const elementId = computed(() => `${props.level}-${props.keyName}`);
// Проверяем, редактируется ли этот элемент
const isElementEditing = computed(() => {
    return treeEditing ? treeEditing.isEditing(elementId.value) : isEditing.value;
});
// Обработчик клика вне input для завершения редактирования
function handleClickOutside(event) {
    if (isElementEditing.value) {
        const target = event.target;
        // Проверяем, что клик не внутри нашего input
        if (!target.closest('input')) {
            // Просто завершаем редактирование без сохранения
            if (treeEditing) {
                treeEditing.stopEditing();
            }
            else {
                isEditing.value = false;
            }
        }
    }
}
// Добавляем/удаляем слушатель клика
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
const isObject = computed(() => {
    return typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value);
});
const isArray = computed(() => {
    return Array.isArray(props.value);
});
const isPrimitive = computed(() => {
    return !isObject.value && !isArray.value;
});
const hasChildren = computed(() => {
    if (isArray.value)
        return props.value.length > 0;
    if (isObject.value)
        return Object.keys(props.value).length > 0;
    return false;
});
const displayValue = computed(() => {
    if (isPrimitive.value) {
        if (typeof props.value === 'string')
            return `"${props.value}"`;
        return String(props.value);
    }
    if (isArray.value)
        return `Array(${props.value.length})`;
    if (isObject.value)
        return `Object(${Object.keys(props.value).length})`;
    return 'null';
});
const children = computed(() => {
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
function startEdit() {
    if (!props.editable)
        return;
    if (treeEditing) {
        treeEditing.startEditing(elementId.value);
    }
    else {
        isEditing.value = true;
    }
    editValue.value = isPrimitive.value ? String(props.value) : JSON.stringify(props.value, null, 2);
}
function commitEdit() {
    if (!isElementEditing.value)
        return;
    try {
        let newValue;
        if (typeof props.value === 'string') {
            // Remove quotes if present for string editing
            const cleanValue = editValue.value.replace(/^["']|["']$/g, '');
            newValue = cleanValue;
        }
        else if (typeof props.value === 'number') {
            const numValue = Number(editValue.value);
            if (isNaN(numValue)) {
                throw new Error('Invalid number');
            }
            newValue = numValue;
        }
        else if (typeof props.value === 'boolean') {
            const lowerValue = editValue.value.toLowerCase();
            if (lowerValue !== 'true' && lowerValue !== 'false') {
                throw new Error('Invalid boolean');
            }
            newValue = lowerValue === 'true';
        }
        else {
            // Try to parse as JSON for complex values
            newValue = JSON.parse(editValue.value);
        }
        emit('update:value', newValue);
        if (treeEditing) {
            treeEditing.stopEditing();
        }
        else {
            isEditing.value = false;
        }
    }
    catch (error) {
        // Не сохраняем невалидное значение, просто выходим из режима редактирования
        if (treeEditing) {
            treeEditing.stopEditing();
        }
        else {
            isEditing.value = false;
        }
    }
}
function cancelEdit() {
    if (treeEditing) {
        treeEditing.stopEditing();
    }
    else {
        isEditing.value = false;
    }
}
function toggleExpanded() {
    if ((isObject.value || isArray.value) && hasChildren.value) {
        isExpanded.value = !isExpanded.value;
    }
}
function updateChildValue(childKey, newValue) {
    const updated = { ...props.value };
    if (isArray.value) {
        const index = parseInt(childKey);
        updated[index] = newValue;
    }
    else {
        updated[childKey] = newValue;
    }
    emit('update:value', updated);
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
    ...{ class: "json-tree-node" },
});
/** @type {__VLS_StyleScopedClasses['json-tree-node']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            (__VLS_ctx.isObject || __VLS_ctx.isArray) && __VLS_ctx.hasChildren && !__VLS_ctx.isElementEditing ? __VLS_ctx.toggleExpanded() : undefined;
            // @ts-ignore
            [isObject, isArray, hasChildren, isElementEditing, toggleExpanded,];
        } },
    ...{ class: "flex items-start gap-1 hover:bg-accent/50" },
    ...{ class: ({ 'cursor-pointer': (__VLS_ctx.isObject || __VLS_ctx.isArray) && __VLS_ctx.hasChildren }) },
    ...{ style: ({ paddingLeft: `${__VLS_ctx.level * 16}px` }) },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-accent/50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-4 h-4 flex-shrink-0 flex items-center justify-center self-center" },
});
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['self-center']} */ ;
if ((__VLS_ctx.isObject || __VLS_ctx.isArray) && __VLS_ctx.hasChildren) {
    const __VLS_0 = (__VLS_ctx.isExpanded ? __VLS_ctx.ChevronDown : __VLS_ctx.ChevronRight);
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "w-4 h-4 text-muted-foreground fill-current" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "w-4 h-4 text-muted-foreground fill-current" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['fill-current']} */ ;
}
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-base leading-relaxed font-normal text-muted-foreground min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
(__VLS_ctx.keyName);
if (__VLS_ctx.isElementEditing) {
    __VLS_asFunctionalElement(__VLS_intrinsics.input)({
        ...{ onBlur: (__VLS_ctx.commitEdit) },
        ...{ onKeyup: (__VLS_ctx.commitEdit) },
        ...{ onKeyup: (__VLS_ctx.cancelEdit) },
        ...{ onClick: () => { } },
        ...{ class: "flex-1 bg-background border rounded text-base leading-relaxed font-normal min-w-0" },
    });
    (__VLS_ctx.editValue);
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isElementEditing))
                    return;
                (__VLS_ctx.isObject || __VLS_ctx.isArray) ? __VLS_ctx.toggleExpanded() : (__VLS_ctx.isPrimitive && __VLS_ctx.editable) ? __VLS_ctx.startEdit() : undefined;
                // @ts-ignore
                [isObject, isObject, isObject, isArray, isArray, isArray, hasChildren, hasChildren, isElementEditing, toggleExpanded, level, isExpanded, ChevronDown, ChevronRight, keyName, commitEdit, commitEdit, cancelEdit, editValue, isPrimitive, editable, startEdit,];
            } },
        ...{ class: "text-base leading-relaxed font-normal flex-1 min-w-0" },
        ...{ class: ({
                'text-green-500': typeof __VLS_ctx.value === 'string',
                'text-blue-500': typeof __VLS_ctx.value === 'number',
                'text-amber-500': typeof __VLS_ctx.value === 'boolean',
                'text-red-500': __VLS_ctx.value === null,
                'text-gray-500': __VLS_ctx.value === undefined,
                'cursor-pointer': (__VLS_ctx.isObject || __VLS_ctx.isArray) ? true : (__VLS_ctx.isPrimitive && __VLS_ctx.editable)
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.displayValue);
}
if (__VLS_ctx.isExpanded && (__VLS_ctx.isObject || __VLS_ctx.isArray)) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    for (const [child] of __VLS_getVForSourceType((__VLS_ctx.children))) {
        let __VLS_5;
        /** @ts-ignore @type {typeof ___VLS_components.JsonTreeNode} */
        JsonTreeNode;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
            ...{ 'onUpdate:value': {} },
            key: (child.key),
            keyName: (child.isArrayItem ? child.key : child.key),
            value: (child.value),
            level: (__VLS_ctx.level + 1),
            isArrayItem: (child.isArrayItem),
            editable: (__VLS_ctx.editable),
        }));
        const __VLS_7 = __VLS_6({
            ...{ 'onUpdate:value': {} },
            key: (child.key),
            keyName: (child.isArrayItem ? child.key : child.key),
            value: (child.value),
            level: (__VLS_ctx.level + 1),
            isArrayItem: (child.isArrayItem),
            editable: (__VLS_ctx.editable),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        let __VLS_10;
        const __VLS_11 = ({ 'update:value': {} },
            { 'onUpdate:value': (...[$event]) => {
                    if (!(__VLS_ctx.isExpanded && (__VLS_ctx.isObject || __VLS_ctx.isArray)))
                        return;
                    __VLS_ctx.updateChildValue(child.key, $event);
                    // @ts-ignore
                    [isObject, isObject, isArray, isArray, level, isExpanded, isPrimitive, editable, editable, value, value, value, value, value, displayValue, children, updateChildValue,];
                } });
        var __VLS_8;
        var __VLS_9;
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=JsonTreeNode.vue.js.map