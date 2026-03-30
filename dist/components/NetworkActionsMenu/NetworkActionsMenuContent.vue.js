import { computed } from 'vue';
import { Terminal, PauseCircle, Shuffle, Power, Trash } from 'lucide-vue-next';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, } from '@/components/ui/ContextMenu';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, } from '@/components/ui/DropdownMenu';
import { matchesBreakpoint, matchesMock } from '@/features/network/composables/useBreakpointMatching';
const props = withDefaults(defineProps(), { contentClass: 'w-48' });
const emit = defineEmits();
const Content = computed(() => props.variant === 'context' ? ContextMenuContent : DropdownMenuContent);
const Item = computed(() => props.variant === 'context' ? ContextMenuItem : DropdownMenuItem);
const Separator = computed(() => props.variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator);
function matchesBreakpointPattern(entryId) {
    return props.breakpointMatchingIds?.has(entryId) ?? false;
}
function matchesMockPattern(entryId) {
    return props.mockMatchingIds?.has(entryId) ?? false;
}
function getMatchingBreakpointActive(entry) {
    if (!props.allBreakpoints?.length)
        return null;
    for (const bp of props.allBreakpoints) {
        if (matchesBreakpoint(entry, { ...bp, enabled: true })) {
            return bp.isActive;
        }
    }
    return null;
}
function getMatchingMockActive(entry) {
    if (!props.allMocks?.length)
        return null;
    for (const mock of props.allMocks) {
        if (matchesMock(entry, { ...mock, enabled: true })) {
            return mock.isActive;
        }
    }
    return null;
}
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
            __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('copyCurl', __VLS_ctx.entry));
            // @ts-ignore
            [Content, contentClass, variant, Item, handleClick, emit, entry,];
        } });
const { default: __VLS_14 } = __VLS_10.slots;
let __VLS_15;
/** @ts-ignore @type {typeof ___VLS_components.Terminal} */
Terminal;
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
// @ts-ignore
[];
var __VLS_10;
var __VLS_11;
const __VLS_20 = (__VLS_ctx.Separator);
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_25 = (__VLS_ctx.Item);
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ 'onClick': {} },
}));
const __VLS_27 = __VLS_26({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_30;
const __VLS_31 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('setBreakpoint', __VLS_ctx.entry));
            // @ts-ignore
            [Item, handleClick, emit, entry, Separator,];
        } });
const { default: __VLS_32 } = __VLS_28.slots;
let __VLS_33;
/** @ts-ignore @type {typeof ___VLS_components.PauseCircle} */
PauseCircle;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_35 = __VLS_34({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
(__VLS_ctx.matchesBreakpointPattern(__VLS_ctx.entry.id) ? 'Rewrite Breakpoint' : 'Breakpoint Request');
// @ts-ignore
[entry, matchesBreakpointPattern,];
var __VLS_28;
var __VLS_29;
const __VLS_38 = (__VLS_ctx.Item);
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
    ...{ 'onClick': {} },
}));
const __VLS_40 = __VLS_39({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
let __VLS_43;
const __VLS_44 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('mockResponse', __VLS_ctx.entry));
            // @ts-ignore
            [Item, handleClick, emit, entry,];
        } });
const { default: __VLS_45 } = __VLS_41.slots;
let __VLS_46;
/** @ts-ignore @type {typeof ___VLS_components.Shuffle} */
Shuffle;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_48 = __VLS_47({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
(__VLS_ctx.matchesMockPattern(__VLS_ctx.entry.id) ? 'Rewrite Mock' : 'Mock Response');
// @ts-ignore
[entry, matchesMockPattern,];
var __VLS_41;
var __VLS_42;
if (__VLS_ctx.getMatchingBreakpointActive(__VLS_ctx.entry) != null) {
    const __VLS_51 = (__VLS_ctx.Separator);
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({}));
    const __VLS_53 = __VLS_52({}, ...__VLS_functionalComponentArgsRest(__VLS_52));
    const __VLS_56 = (__VLS_ctx.Item);
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        ...{ 'onClick': {} },
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_61;
    const __VLS_62 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.getMatchingBreakpointActive(__VLS_ctx.entry) != null))
                    return;
                __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('toggleBreakpoint', __VLS_ctx.entry));
                // @ts-ignore
                [Item, handleClick, emit, entry, entry, Separator, getMatchingBreakpointActive,];
            } });
    const { default: __VLS_63 } = __VLS_59.slots;
    let __VLS_64;
    /** @ts-ignore @type {typeof ___VLS_components.Power} */
    Power;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ class: "h-4 w-4 mr-2" },
    }));
    const __VLS_66 = __VLS_65({
        ...{ class: "h-4 w-4 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    (__VLS_ctx.getMatchingBreakpointActive(__VLS_ctx.entry) ? 'Disable' : 'Enable');
    // @ts-ignore
    [entry, getMatchingBreakpointActive,];
    var __VLS_59;
    var __VLS_60;
    const __VLS_69 = (__VLS_ctx.Item);
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }));
    const __VLS_71 = __VLS_70({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    let __VLS_74;
    const __VLS_75 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.getMatchingBreakpointActive(__VLS_ctx.entry) != null))
                    return;
                __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('deleteBreakpoint', __VLS_ctx.entry));
                // @ts-ignore
                [Item, handleClick, emit, entry,];
            } });
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    const { default: __VLS_76 } = __VLS_72.slots;
    let __VLS_77;
    /** @ts-ignore @type {typeof ___VLS_components.Trash} */
    Trash;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ class: "h-4 w-4 mr-2" },
    }));
    const __VLS_79 = __VLS_78({
        ...{ class: "h-4 w-4 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    // @ts-ignore
    [];
    var __VLS_72;
    var __VLS_73;
}
if (__VLS_ctx.getMatchingMockActive(__VLS_ctx.entry) != null) {
    const __VLS_82 = (__VLS_ctx.Separator);
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({}));
    const __VLS_84 = __VLS_83({}, ...__VLS_functionalComponentArgsRest(__VLS_83));
    const __VLS_87 = (__VLS_ctx.Item);
    // @ts-ignore
    const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({
        ...{ 'onClick': {} },
    }));
    const __VLS_89 = __VLS_88({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_88));
    let __VLS_92;
    const __VLS_93 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.getMatchingMockActive(__VLS_ctx.entry) != null))
                    return;
                __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('toggleMock', __VLS_ctx.entry));
                // @ts-ignore
                [Item, handleClick, emit, entry, entry, Separator, getMatchingMockActive,];
            } });
    const { default: __VLS_94 } = __VLS_90.slots;
    let __VLS_95;
    /** @ts-ignore @type {typeof ___VLS_components.Power} */
    Power;
    // @ts-ignore
    const __VLS_96 = __VLS_asFunctionalComponent(__VLS_95, new __VLS_95({
        ...{ class: "h-4 w-4 mr-2" },
    }));
    const __VLS_97 = __VLS_96({
        ...{ class: "h-4 w-4 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_96));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    (__VLS_ctx.getMatchingMockActive(__VLS_ctx.entry) ? 'Disable' : 'Enable');
    // @ts-ignore
    [entry, getMatchingMockActive,];
    var __VLS_90;
    var __VLS_91;
    const __VLS_100 = (__VLS_ctx.Item);
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }));
    const __VLS_102 = __VLS_101({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    let __VLS_105;
    const __VLS_106 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.getMatchingMockActive(__VLS_ctx.entry) != null))
                    return;
                __VLS_ctx.handleClick($event, () => __VLS_ctx.emit('deleteMock', __VLS_ctx.entry));
                // @ts-ignore
                [Item, handleClick, emit, entry,];
            } });
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    const { default: __VLS_107 } = __VLS_103.slots;
    let __VLS_108;
    /** @ts-ignore @type {typeof ___VLS_components.Trash} */
    Trash;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        ...{ class: "h-4 w-4 mr-2" },
    }));
    const __VLS_110 = __VLS_109({
        ...{ class: "h-4 w-4 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    // @ts-ignore
    [];
    var __VLS_103;
    var __VLS_104;
}
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
//# sourceMappingURL=NetworkActionsMenuContent.vue.js.map