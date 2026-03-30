import { Columns3Cog } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/DropdownMenu';
import { Checkbox } from '@/components/ui/checkbox';
const props = withDefaults(defineProps(), { disabledColumns: () => [] });
const emit = defineEmits();
function toggleColumn(key) {
    if (props.disabledColumns?.includes(key))
        return;
    const current = props.columns[key] ?? true;
    emit('update:column', key, !current);
}
function isColumnDisabled(key) {
    return props.disabledColumns?.includes(key) ?? false;
}
const __VLS_defaults = { disabledColumns: () => [] };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenu} */
DropdownMenu;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenuTrigger} */
DropdownMenuTrigger;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    asChild: true,
}));
const __VLS_9 = __VLS_8({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
let __VLS_13;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    variant: "ghost",
    size: "icon",
    ...{ class: "h-6 w-6 p-0" },
    title: "Column visibility",
}));
const __VLS_15 = __VLS_14({
    variant: "ghost",
    size: "icon",
    ...{ class: "h-6 w-6 p-0" },
    title: "Column visibility",
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
const { default: __VLS_18 } = __VLS_16.slots;
let __VLS_19;
/** @ts-ignore @type {typeof ___VLS_components.Columns3Cog} */
Columns3Cog;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    ...{ class: "h-4 w-4" },
}));
const __VLS_21 = __VLS_20({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
var __VLS_16;
var __VLS_10;
let __VLS_24;
/** @ts-ignore @type {typeof ___VLS_components.DropdownMenuContent} */
DropdownMenuContent;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    align: "end",
    ...{ class: "w-48" },
}));
const __VLS_26 = __VLS_25({
    align: "end",
    ...{ class: "w-48" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
const { default: __VLS_29 } = __VLS_27.slots;
for (const [def] of __VLS_getVForSourceType((__VLS_ctx.columnDefinitions))) {
    let __VLS_30;
    /** @ts-ignore @type {typeof ___VLS_components.DropdownMenuItem} */
    DropdownMenuItem;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ 'onSelect': {} },
        key: (def.key),
        ...{ class: (['cursor-pointer', __VLS_ctx.isColumnDisabled(def.key) && 'opacity-50 cursor-not-allowed']) },
    }));
    const __VLS_32 = __VLS_31({
        ...{ 'onSelect': {} },
        key: (def.key),
        ...{ class: (['cursor-pointer', __VLS_ctx.isColumnDisabled(def.key) && 'opacity-50 cursor-not-allowed']) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    let __VLS_35;
    const __VLS_36 = ({ select: {} },
        { onSelect: ((e) => { if (__VLS_ctx.isColumnDisabled(def.key))
                return; e.preventDefault(); __VLS_ctx.toggleColumn(def.key); }) });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    const { default: __VLS_37 } = __VLS_33.slots;
    let __VLS_38;
    /** @ts-ignore @type {typeof ___VLS_components.Checkbox} */
    Checkbox;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
        modelValue: (__VLS_ctx.columns[def.key] ?? true),
        disabled: (__VLS_ctx.isColumnDisabled(def.key)),
        ...{ class: "pointer-events-none mr-2 shrink-0" },
    }));
    const __VLS_40 = __VLS_39({
        modelValue: (__VLS_ctx.columns[def.key] ?? true),
        disabled: (__VLS_ctx.isColumnDisabled(def.key)),
        ...{ class: "pointer-events-none mr-2 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    (def.label);
    // @ts-ignore
    [columnDefinitions, isColumnDisabled, isColumnDisabled, isColumnDisabled, toggleColumn, columns,];
    var __VLS_33;
    var __VLS_34;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_27;
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
//# sourceMappingURL=TableColumnSelector.vue.js.map