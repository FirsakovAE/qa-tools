import { ref, computed, watch } from 'vue';
import { ArrowLeft, Check, CirclePause } from 'lucide-vue-next';
import { useEscapeClose } from '@/composables/useEscapeClose';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { parseUrl, buildUrlPreview, getStatusClass, generateId } from './utils';
const props = defineProps();
const emit = defineEmits();
useEscapeClose(computed(() => true), () => emit('back'));
// Whether we're editing an existing breakpoint
const isRewrite = computed(() => !!props.existingBreakpoint);
const activeSection = ref('matching');
// URL Matching fields
const scheme = ref('');
const host = ref('');
const port = ref('');
const path = ref('');
const query = ref('');
const method = ref('');
const description = ref('');
// Function to fill form from entry
function fillFromEntry(entry) {
    const parsed = parseUrl(entry.url);
    scheme.value = parsed.scheme;
    host.value = parsed.host;
    port.value = parsed.port;
    path.value = parsed.path;
    query.value = parsed.query;
    method.value = entry.method || '';
    description.value = `Breakpoint for ${entry.method} ${entry.path}`;
}
// Function to fill form from existing breakpoint
function fillFromExisting(bp) {
    scheme.value = bp.scheme || '';
    host.value = bp.host || '';
    port.value = bp.port || '';
    path.value = bp.path || '';
    query.value = bp.query || '';
    method.value = bp.method || '';
    description.value = bp.description || '';
}
// Watch for entry/existingBreakpoint changes
watch([() => props.entry, () => props.existingBreakpoint], ([entry, existing]) => {
    if (existing) {
        fillFromExisting(existing);
    }
    else if (entry) {
        fillFromEntry(entry);
    }
}, { immediate: true });
// Handle confirm
function handleConfirm() {
    if (!props.entry || !isValid.value)
        return;
    const breakpoint = {
        id: props.existingBreakpoint?.id ?? generateId('bp'),
        scheme: scheme.value,
        host: host.value,
        port: port.value || undefined,
        path: path.value,
        query: query.value || undefined,
        method: method.value || undefined,
        trigger: props.existingBreakpoint?.trigger ?? 'request',
        enabled: props.existingBreakpoint?.enabled ?? true,
        timestamp: new Date().toISOString(),
        description: description.value || undefined
    };
    emit('confirm', breakpoint);
}
// Validation
const isValid = computed(() => {
    return host.value.trim() !== '';
});
// Preview URL pattern
const urlPreview = computed(() => {
    return buildUrlPreview(scheme.value, host.value, port.value, path.value, query.value);
});
// Status styling
const statusClass = computed(() => {
    return getStatusClass(props.entry.status, props.entry.pending);
});
// Section definitions
const sections = [
    { id: 'matching', label: 'URL Matching' }
];
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
/** @ts-ignore @type {typeof ___VLS_components.TooltipProvider} */
TooltipProvider;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "h-full flex flex-col" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex items-center gap-3 p-3 border-b" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
let __VLS_7;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}));
const __VLS_9 = __VLS_8({
    ...{ 'onClick': {} },
    variant: "ghost",
    size: "icon",
    ...{ class: "h-8 w-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('back');
            // @ts-ignore
            [emit,];
        } });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
const { default: __VLS_14 } = __VLS_10.slots;
let __VLS_15;
/** @ts-ignore @type {typeof ___VLS_components.ArrowLeft} */
ArrowLeft;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-4 w-4" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[];
var __VLS_10;
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1 min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 mb-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
let __VLS_20;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    variant: "outline",
    ...{ class: "text-amber-500 border-amber-500/50 gap-1" },
}));
const __VLS_22 = __VLS_21({
    variant: "outline",
    ...{ class: "text-amber-500 border-amber-500/50 gap-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
/** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-500/50']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
const { default: __VLS_25 } = __VLS_23.slots;
let __VLS_26;
/** @ts-ignore @type {typeof ___VLS_components.CirclePause} */
CirclePause;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
    ...{ class: "h-3 w-3" },
}));
const __VLS_28 = __VLS_27({
    ...{ class: "h-3 w-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
// @ts-ignore
[];
var __VLS_23;
let __VLS_31;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
    variant: "outline",
    ...{ class: "font-mono text-xs" },
}));
const __VLS_33 = __VLS_32({
    variant: "outline",
    ...{ class: "font-mono text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_32));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_36 } = __VLS_34.slots;
(__VLS_ctx.entry.method);
// @ts-ignore
[entry,];
var __VLS_34;
let __VLS_37;
/** @ts-ignore @type {typeof ___VLS_components.Badge} */
Badge;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    variant: "outline",
    ...{ class: (__VLS_ctx.statusClass) },
    ...{ class: "font-mono text-xs" },
}));
const __VLS_39 = __VLS_38({
    variant: "outline",
    ...{ class: (__VLS_ctx.statusClass) },
    ...{ class: "font-mono text-xs" },
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
const { default: __VLS_42 } = __VLS_40.slots;
(__VLS_ctx.entry.pending ? '⏳ Pending' : __VLS_ctx.entry.status);
// @ts-ignore
[entry, entry, statusClass,];
var __VLS_40;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm truncate text-muted-foreground" },
    title: (__VLS_ctx.entry.url),
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
(__VLS_ctx.entry.url);
let __VLS_43;
/** @ts-ignore @type {typeof ___VLS_components.Tooltip} */
Tooltip;
// @ts-ignore
const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({}));
const __VLS_45 = __VLS_44({}, ...__VLS_functionalComponentArgsRest(__VLS_44));
const { default: __VLS_48 } = __VLS_46.slots;
let __VLS_49;
/** @ts-ignore @type {typeof ___VLS_components.TooltipTrigger} */
TooltipTrigger;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    asChild: true,
}));
const __VLS_51 = __VLS_50({
    asChild: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const { default: __VLS_54 } = __VLS_52.slots;
let __VLS_55;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
    ...{ 'onClick': {} },
    variant: "default",
    size: "sm",
    ...{ class: "h-8 shrink-0 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600" },
    disabled: (!__VLS_ctx.isValid),
}));
const __VLS_57 = __VLS_56({
    ...{ 'onClick': {} },
    variant: "default",
    size: "sm",
    ...{ class: "h-8 shrink-0 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600" },
    disabled: (!__VLS_ctx.isValid),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
const __VLS_61 = ({ click: {} },
    { onClick: (__VLS_ctx.handleConfirm) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-amber-600']} */ ;
const { default: __VLS_62 } = __VLS_58.slots;
let __VLS_63;
/** @ts-ignore @type {typeof ___VLS_components.Check} */
Check;
// @ts-ignore
const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({
    ...{ class: "h-3.5 w-3.5" },
}));
const __VLS_65 = __VLS_64({
    ...{ class: "h-3.5 w-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_64));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
// @ts-ignore
[entry, entry, isValid, handleConfirm,];
var __VLS_58;
var __VLS_59;
// @ts-ignore
[];
var __VLS_52;
let __VLS_68;
/** @ts-ignore @type {typeof ___VLS_components.TooltipContent} */
TooltipContent;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    side: "bottom",
}));
const __VLS_70 = __VLS_69({
    side: "bottom",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const { default: __VLS_73 } = __VLS_71.slots;
(__VLS_ctx.isRewrite ? 'Update existing breakpoint' : 'Create breakpoint to intercept matching requests');
// @ts-ignore
[isRewrite,];
var __VLS_71;
// @ts-ignore
[];
var __VLS_46;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 flex items-center gap-1 p-1 border-b bg-muted/30" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
for (const [section] of __VLS_getVForSourceType((__VLS_ctx.sections))) {
    __VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.activeSection = section.id;
                // @ts-ignore
                [sections, activeSection,];
            } },
        key: (section.id),
        ...{ class: "px-3 py-1.5 text-sm font-medium rounded-sm transition-colors" },
        ...{ class: ({
                'bg-secondary text-secondary-foreground': __VLS_ctx.activeSection === section.id,
                'hover:bg-secondary/50 text-muted-foreground': __VLS_ctx.activeSection !== section.id
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-secondary-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-secondary/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (section.label);
    // @ts-ignore
    [activeSection, activeSection,];
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1 min-h-0 overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
if (__VLS_ctx.activeSection === 'matching') {
    let __VLS_74;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
        ...{ class: "h-full" },
    }));
    const __VLS_76 = __VLS_75({
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    const { default: __VLS_79 } = __VLS_77.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 bg-muted/50 rounded-md" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-3 gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_80;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        for: "bp-method",
        ...{ class: "text-xs" },
    }));
    const __VLS_82 = __VLS_81({
        for: "bp-method",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_85 } = __VLS_83.slots;
    // @ts-ignore
    [activeSection,];
    var __VLS_83;
    let __VLS_86;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
        id: "bp-method",
        modelValue: (__VLS_ctx.method),
        placeholder: "All",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_88 = __VLS_87({
        id: "bp-method",
        modelValue: (__VLS_ctx.method),
        placeholder: "All",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_91;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
        for: "scheme",
        ...{ class: "text-xs" },
    }));
    const __VLS_93 = __VLS_92({
        for: "scheme",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_92));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_96 } = __VLS_94.slots;
    // @ts-ignore
    [method,];
    var __VLS_94;
    let __VLS_97;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_98 = __VLS_asFunctionalComponent(__VLS_97, new __VLS_97({
        id: "scheme",
        modelValue: (__VLS_ctx.scheme),
        placeholder: "https",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_99 = __VLS_98({
        id: "scheme",
        modelValue: (__VLS_ctx.scheme),
        placeholder: "https",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_98));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_102;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({
        for: "port",
        ...{ class: "text-xs" },
    }));
    const __VLS_104 = __VLS_103({
        for: "port",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_103));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_107 } = __VLS_105.slots;
    // @ts-ignore
    [scheme,];
    var __VLS_105;
    let __VLS_108;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        id: "port",
        modelValue: (__VLS_ctx.port),
        placeholder: "443",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_110 = __VLS_109({
        id: "port",
        modelValue: (__VLS_ctx.port),
        placeholder: "443",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_113;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_114 = __VLS_asFunctionalComponent(__VLS_113, new __VLS_113({
        for: "host",
        ...{ class: "text-xs" },
    }));
    const __VLS_115 = __VLS_114({
        for: "host",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_114));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_118 } = __VLS_116.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-destructive_text" },
    });
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    // @ts-ignore
    [port,];
    var __VLS_116;
    let __VLS_119;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
        id: "host",
        modelValue: (__VLS_ctx.host),
        placeholder: "api.example.com",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_121 = __VLS_120({
        id: "host",
        modelValue: (__VLS_ctx.host),
        placeholder: "api.example.com",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_120));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_124;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        for: "path",
        ...{ class: "text-xs" },
    }));
    const __VLS_126 = __VLS_125({
        for: "path",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_129 } = __VLS_127.slots;
    // @ts-ignore
    [host,];
    var __VLS_127;
    let __VLS_130;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_131 = __VLS_asFunctionalComponent(__VLS_130, new __VLS_130({
        id: "path",
        modelValue: (__VLS_ctx.path),
        placeholder: "/api/v1/users/*",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_132 = __VLS_131({
        id: "path",
        modelValue: (__VLS_ctx.path),
        placeholder: "/api/v1/users/*",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_131));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_135;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({
        for: "query",
        ...{ class: "text-xs" },
    }));
    const __VLS_137 = __VLS_136({
        for: "query",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_136));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_140 } = __VLS_138.slots;
    // @ts-ignore
    [path,];
    var __VLS_138;
    let __VLS_141;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_142 = __VLS_asFunctionalComponent(__VLS_141, new __VLS_141({
        id: "query",
        modelValue: (__VLS_ctx.query),
        placeholder: "page=*",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_143 = __VLS_142({
        id: "query",
        modelValue: (__VLS_ctx.query),
        placeholder: "page=*",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_142));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_146;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
        for: "bp-description",
        ...{ class: "text-xs" },
    }));
    const __VLS_148 = __VLS_147({
        for: "bp-description",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_147));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_151 } = __VLS_149.slots;
    // @ts-ignore
    [query,];
    var __VLS_149;
    let __VLS_152;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        id: "bp-description",
        modelValue: (__VLS_ctx.description),
        placeholder: "Breakpoint for user API",
        ...{ class: "h-8 text-sm" },
    }));
    const __VLS_154 = __VLS_153({
        id: "bp-description",
        modelValue: (__VLS_ctx.description),
        placeholder: "Breakpoint for user API",
        ...{ class: "h-8 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 bg-muted/50 rounded-md" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    let __VLS_157;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
        ...{ class: "text-xs text-muted-foreground" },
    }));
    const __VLS_159 = __VLS_158({
        ...{ class: "text-xs text-muted-foreground" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_158));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    const { default: __VLS_162 } = __VLS_160.slots;
    // @ts-ignore
    [description,];
    var __VLS_160;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-mono text-sm mt-1 break-all" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    (__VLS_ctx.urlPreview);
    // @ts-ignore
    [urlPreview,];
    var __VLS_77;
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=BreakpointForm.vue.js.map