import { computed } from 'vue';
import { ArrowLeft, Check, Shuffle } from 'lucide-vue-next';
import { useEscapeClose } from '@/composables/useEscapeClose';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import JsonEditor from '@/components/JsonEditor.vue';
import { useMockFormState } from './composables';
import { detectLanguage } from './utils';
const props = defineProps();
const emit = defineEmits();
useEscapeClose(computed(() => true), () => emit('back'));
const { activeSection, jsonMode, isRewrite, scheme, host, port, path, query, method, status, statusText, statusTextPlaceholder, effectiveStatusText, responseBody, responseHeaders, delay, description, isValid, urlPreview, statusClass, sections, handleStatusTextChange, handleStatusCodeChange, addHeader, removeHeader, removeAllHeaders, handleConfirm, } = useMockFormState({
    entry: () => props.entry,
    existingMock: () => props.existingMock,
    emitConfirm: (mock) => emit('confirm', mock),
});
const mockContentType = computed(() => {
    const ct = responseHeaders.value.find(h => h.name.toLowerCase() === 'content-type');
    return ct?.value || 'application/json';
});
const bodyLanguage = computed(() => detectLanguage(mockContentType.value));
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
    ...{ class: "text-purple-500 border-purple-500/50 gap-1" },
}));
const __VLS_22 = __VLS_21({
    variant: "outline",
    ...{ class: "text-purple-500 border-purple-500/50 gap-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
/** @type {__VLS_StyleScopedClasses['text-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-purple-500/50']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
const { default: __VLS_25 } = __VLS_23.slots;
let __VLS_26;
/** @ts-ignore @type {typeof ___VLS_components.Shuffle} */
Shuffle;
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
    ...{ class: "h-8 shrink-0 text-xs gap-1.5 bg-purple-500 hover:bg-purple-600" },
    disabled: (!__VLS_ctx.isValid),
}));
const __VLS_57 = __VLS_56({
    ...{ 'onClick': {} },
    variant: "default",
    size: "sm",
    ...{ class: "h-8 shrink-0 text-xs gap-1.5 bg-purple-500 hover:bg-purple-600" },
    disabled: (!__VLS_ctx.isValid),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
const __VLS_61 = ({ click: {} },
    { onClick: (__VLS_ctx.handleConfirm) });
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-purple-600']} */ ;
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
(__VLS_ctx.isRewrite ? 'Update existing mock rule' : 'Create mock rule to intercept matching requests');
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
        for: "method",
        ...{ class: "text-xs" },
    }));
    const __VLS_82 = __VLS_81({
        for: "method",
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
        id: "method",
        modelValue: (__VLS_ctx.method),
        placeholder: "GET",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_88 = __VLS_87({
        id: "method",
        modelValue: (__VLS_ctx.method),
        placeholder: "GET",
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
        ...{ class: "p-3 bg-muted/50 rounded-md" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    let __VLS_146;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
        ...{ class: "text-xs text-muted-foreground" },
    }));
    const __VLS_148 = __VLS_147({
        ...{ class: "text-xs text-muted-foreground" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_147));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    const { default: __VLS_151 } = __VLS_149.slots;
    // @ts-ignore
    [query,];
    var __VLS_149;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-mono text-sm mt-1 break-all" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    (__VLS_ctx.urlPreview);
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-2 gap-3 pt-2 border-t" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_152;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        for: "delay",
        ...{ class: "text-xs" },
    }));
    const __VLS_154 = __VLS_153({
        for: "delay",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_157 } = __VLS_155.slots;
    // @ts-ignore
    [urlPreview,];
    var __VLS_155;
    let __VLS_158;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent(__VLS_158, new __VLS_158({
        id: "delay",
        modelValue: (__VLS_ctx.delay),
        modelModifiers: { number: true, },
        type: "number",
        min: (0),
        placeholder: "0",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_160 = __VLS_159({
        id: "delay",
        modelValue: (__VLS_ctx.delay),
        modelModifiers: { number: true, },
        type: "number",
        min: (0),
        placeholder: "0",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
    let __VLS_163;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_164 = __VLS_asFunctionalComponent(__VLS_163, new __VLS_163({
        for: "description",
        ...{ class: "text-xs" },
    }));
    const __VLS_165 = __VLS_164({
        for: "description",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_164));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_168 } = __VLS_166.slots;
    // @ts-ignore
    [delay,];
    var __VLS_166;
    let __VLS_169;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
        id: "description",
        modelValue: (__VLS_ctx.description),
        placeholder: "Mock for user API",
        ...{ class: "h-8 text-sm" },
    }));
    const __VLS_171 = __VLS_170({
        id: "description",
        modelValue: (__VLS_ctx.description),
        placeholder: "Mock for user API",
        ...{ class: "h-8 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_170));
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    // @ts-ignore
    [description,];
    var __VLS_77;
}
else if (__VLS_ctx.activeSection === 'response') {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "h-full flex flex-col" },
    });
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 flex items-center justify-between px-3 py-2 border-b" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    let __VLS_174;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_175 = __VLS_asFunctionalComponent(__VLS_174, new __VLS_174({
        variant: "outline",
        ...{ class: "text-xs font-mono" },
    }));
    const __VLS_176 = __VLS_175({
        variant: "outline",
        ...{ class: "text-xs font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_175));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    const { default: __VLS_179 } = __VLS_177.slots;
    (__VLS_ctx.mockContentType);
    // @ts-ignore
    [activeSection, mockContentType,];
    var __VLS_177;
    let __VLS_180;
    /** @ts-ignore @type {typeof ___VLS_components.Badge} */
    Badge;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
        variant: "outline",
        ...{ class: "text-xs text-purple-500 border-purple-500/50" },
    }));
    const __VLS_182 = __VLS_181({
        variant: "outline",
        ...{ class: "text-xs text-purple-500 border-purple-500/50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-purple-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-purple-500/50']} */ ;
    const { default: __VLS_185 } = __VLS_183.slots;
    // @ts-ignore
    [];
    var __VLS_183;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 grid grid-cols-2 gap-3 px-3 py-2 border-b" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    let __VLS_186;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_187 = __VLS_asFunctionalComponent(__VLS_186, new __VLS_186({
        for: "status",
        ...{ class: "text-xs" },
    }));
    const __VLS_188 = __VLS_187({
        for: "status",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_187));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_191 } = __VLS_189.slots;
    // @ts-ignore
    [];
    var __VLS_189;
    let __VLS_192;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
        ...{ 'onUpdate:modelValue': {} },
        id: "status",
        modelValue: (String(__VLS_ctx.status)),
        inputmode: "numeric",
        pattern: "[0-9]*",
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_194 = __VLS_193({
        ...{ 'onUpdate:modelValue': {} },
        id: "status",
        modelValue: (String(__VLS_ctx.status)),
        inputmode: "numeric",
        pattern: "[0-9]*",
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    let __VLS_197;
    const __VLS_198 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (__VLS_ctx.handleStatusCodeChange) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    var __VLS_195;
    var __VLS_196;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    let __VLS_199;
    /** @ts-ignore @type {typeof ___VLS_components.Label} */
    Label;
    // @ts-ignore
    const __VLS_200 = __VLS_asFunctionalComponent(__VLS_199, new __VLS_199({
        for: "statusText",
        ...{ class: "text-xs" },
    }));
    const __VLS_201 = __VLS_200({
        for: "statusText",
        ...{ class: "text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_200));
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_204 } = __VLS_202.slots;
    // @ts-ignore
    [status, handleStatusCodeChange,];
    var __VLS_202;
    let __VLS_205;
    /** @ts-ignore @type {typeof ___VLS_components.Input} */
    Input;
    // @ts-ignore
    const __VLS_206 = __VLS_asFunctionalComponent(__VLS_205, new __VLS_205({
        ...{ 'onUpdate:modelValue': {} },
        id: "statusText",
        modelValue: (__VLS_ctx.statusText),
        placeholder: (__VLS_ctx.statusTextPlaceholder),
        ...{ class: "h-8 text-sm font-mono" },
    }));
    const __VLS_207 = __VLS_206({
        ...{ 'onUpdate:modelValue': {} },
        id: "statusText",
        modelValue: (__VLS_ctx.statusText),
        placeholder: (__VLS_ctx.statusTextPlaceholder),
        ...{ class: "h-8 text-sm font-mono" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_206));
    let __VLS_210;
    const __VLS_211 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': (__VLS_ctx.handleStatusTextChange) });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    var __VLS_208;
    var __VLS_209;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1 min-h-0" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    const __VLS_212 = JsonEditor;
    // @ts-ignore
    const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
        modelValue: (__VLS_ctx.responseBody),
        editable: (true),
        showCopy: (true),
        mode: (__VLS_ctx.jsonMode),
        language: (__VLS_ctx.bodyLanguage),
        fullHeight: (true),
        ...{ class: "h-full" },
    }));
    const __VLS_214 = __VLS_213({
        modelValue: (__VLS_ctx.responseBody),
        editable: (true),
        showCopy: (true),
        mode: (__VLS_ctx.jsonMode),
        language: (__VLS_ctx.bodyLanguage),
        fullHeight: (true),
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_213));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 px-3 py-1 text-xs text-muted-foreground border-t" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
}
else if (__VLS_ctx.activeSection === 'headers') {
    let __VLS_217;
    /** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
    ScrollArea;
    // @ts-ignore
    const __VLS_218 = __VLS_asFunctionalComponent(__VLS_217, new __VLS_217({
        ...{ class: "h-full" },
    }));
    const __VLS_219 = __VLS_218({
        ...{ class: "h-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_218));
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    const { default: __VLS_222 } = __VLS_220.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_223;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_224 = __VLS_asFunctionalComponent(__VLS_223, new __VLS_223({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
        disabled: (__VLS_ctx.responseHeaders.length === 0),
    }));
    const __VLS_225 = __VLS_224({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "h-7 text-xs text-destructive_text hover:text-destructive_text" },
        disabled: (__VLS_ctx.responseHeaders.length === 0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_224));
    let __VLS_228;
    const __VLS_229 = ({ click: {} },
        { onClick: (__VLS_ctx.removeAllHeaders) });
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
    const { default: __VLS_230 } = __VLS_226.slots;
    // @ts-ignore
    [activeSection, statusText, statusTextPlaceholder, handleStatusTextChange, responseBody, jsonMode, bodyLanguage, responseHeaders, removeAllHeaders,];
    var __VLS_226;
    var __VLS_227;
    let __VLS_231;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_232 = __VLS_asFunctionalComponent(__VLS_231, new __VLS_231({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "h-7 text-xs" },
    }));
    const __VLS_233 = __VLS_232({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "h-7 text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_232));
    let __VLS_236;
    const __VLS_237 = ({ click: {} },
        { onClick: (__VLS_ctx.addHeader) });
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_238 } = __VLS_234.slots;
    // @ts-ignore
    [addHeader,];
    var __VLS_234;
    var __VLS_235;
    if (__VLS_ctx.responseHeaders.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm text-muted-foreground text-center py-8" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
    }
    else {
        let __VLS_239;
        /** @ts-ignore @type {typeof ___VLS_components.Table} */
        Table;
        // @ts-ignore
        const __VLS_240 = __VLS_asFunctionalComponent(__VLS_239, new __VLS_239({}));
        const __VLS_241 = __VLS_240({}, ...__VLS_functionalComponentArgsRest(__VLS_240));
        const { default: __VLS_244 } = __VLS_242.slots;
        let __VLS_245;
        /** @ts-ignore @type {typeof ___VLS_components.TableHeader} */
        TableHeader;
        // @ts-ignore
        const __VLS_246 = __VLS_asFunctionalComponent(__VLS_245, new __VLS_245({}));
        const __VLS_247 = __VLS_246({}, ...__VLS_functionalComponentArgsRest(__VLS_246));
        const { default: __VLS_250 } = __VLS_248.slots;
        let __VLS_251;
        /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
        TableRow;
        // @ts-ignore
        const __VLS_252 = __VLS_asFunctionalComponent(__VLS_251, new __VLS_251({}));
        const __VLS_253 = __VLS_252({}, ...__VLS_functionalComponentArgsRest(__VLS_252));
        const { default: __VLS_256 } = __VLS_254.slots;
        let __VLS_257;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_258 = __VLS_asFunctionalComponent(__VLS_257, new __VLS_257({
            ...{ class: "w-1/3" },
        }));
        const __VLS_259 = __VLS_258({
            ...{ class: "w-1/3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_258));
        /** @type {__VLS_StyleScopedClasses['w-1/3']} */ ;
        const { default: __VLS_262 } = __VLS_260.slots;
        // @ts-ignore
        [responseHeaders,];
        var __VLS_260;
        let __VLS_263;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_264 = __VLS_asFunctionalComponent(__VLS_263, new __VLS_263({}));
        const __VLS_265 = __VLS_264({}, ...__VLS_functionalComponentArgsRest(__VLS_264));
        const { default: __VLS_268 } = __VLS_266.slots;
        // @ts-ignore
        [];
        var __VLS_266;
        let __VLS_269;
        /** @ts-ignore @type {typeof ___VLS_components.TableHead} */
        TableHead;
        // @ts-ignore
        const __VLS_270 = __VLS_asFunctionalComponent(__VLS_269, new __VLS_269({
            ...{ class: "w-10" },
        }));
        const __VLS_271 = __VLS_270({
            ...{ class: "w-10" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_270));
        /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
        // @ts-ignore
        [];
        var __VLS_254;
        // @ts-ignore
        [];
        var __VLS_248;
        let __VLS_274;
        /** @ts-ignore @type {typeof ___VLS_components.TableBody} */
        TableBody;
        // @ts-ignore
        const __VLS_275 = __VLS_asFunctionalComponent(__VLS_274, new __VLS_274({}));
        const __VLS_276 = __VLS_275({}, ...__VLS_functionalComponentArgsRest(__VLS_275));
        const { default: __VLS_279 } = __VLS_277.slots;
        for (const [header, index] of __VLS_getVForSourceType((__VLS_ctx.responseHeaders))) {
            let __VLS_280;
            /** @ts-ignore @type {typeof ___VLS_components.TableRow} */
            TableRow;
            // @ts-ignore
            const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
                key: (index),
            }));
            const __VLS_282 = __VLS_281({
                key: (index),
            }, ...__VLS_functionalComponentArgsRest(__VLS_281));
            const { default: __VLS_285 } = __VLS_283.slots;
            let __VLS_286;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_287 = __VLS_asFunctionalComponent(__VLS_286, new __VLS_286({
                ...{ class: "py-2 align-top" },
            }));
            const __VLS_288 = __VLS_287({
                ...{ class: "py-2 align-top" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_287));
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
            const { default: __VLS_291 } = __VLS_289.slots;
            let __VLS_292;
            /** @ts-ignore @type {typeof ___VLS_components.Input} */
            Input;
            // @ts-ignore
            const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
                modelValue: (header.name),
                placeholder: "Header name",
                ...{ class: "h-7 text-xs font-mono" },
            }));
            const __VLS_294 = __VLS_293({
                modelValue: (header.name),
                placeholder: "Header name",
                ...{ class: "h-7 text-xs font-mono" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_293));
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            // @ts-ignore
            [responseHeaders,];
            var __VLS_289;
            let __VLS_297;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_298 = __VLS_asFunctionalComponent(__VLS_297, new __VLS_297({
                ...{ class: "py-2 align-top" },
            }));
            const __VLS_299 = __VLS_298({
                ...{ class: "py-2 align-top" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_298));
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
            const { default: __VLS_302 } = __VLS_300.slots;
            let __VLS_303;
            /** @ts-ignore @type {typeof ___VLS_components.Input} */
            Input;
            // @ts-ignore
            const __VLS_304 = __VLS_asFunctionalComponent(__VLS_303, new __VLS_303({
                modelValue: (header.value),
                placeholder: "Header value",
                ...{ class: "h-7 text-xs font-mono" },
            }));
            const __VLS_305 = __VLS_304({
                modelValue: (header.value),
                placeholder: "Header value",
                ...{ class: "h-7 text-xs font-mono" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_304));
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            // @ts-ignore
            [];
            var __VLS_300;
            let __VLS_308;
            /** @ts-ignore @type {typeof ___VLS_components.TableCell} */
            TableCell;
            // @ts-ignore
            const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
                ...{ class: "py-2 text-center align-top" },
            }));
            const __VLS_310 = __VLS_309({
                ...{ class: "py-2 text-center align-top" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_309));
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
            const { default: __VLS_313 } = __VLS_311.slots;
            let __VLS_314;
            /** @ts-ignore @type {typeof ___VLS_components.Button} */
            Button;
            // @ts-ignore
            const __VLS_315 = __VLS_asFunctionalComponent(__VLS_314, new __VLS_314({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "sm",
                ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
            }));
            const __VLS_316 = __VLS_315({
                ...{ 'onClick': {} },
                variant: "ghost",
                size: "sm",
                ...{ class: "h-6 w-6 p-0 text-destructive_text hover:text-destructive_text" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_315));
            let __VLS_319;
            const __VLS_320 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeSection === 'matching'))
                            return;
                        if (!!(__VLS_ctx.activeSection === 'response'))
                            return;
                        if (!(__VLS_ctx.activeSection === 'headers'))
                            return;
                        if (!!(__VLS_ctx.responseHeaders.length === 0))
                            return;
                        __VLS_ctx.removeHeader(index);
                        // @ts-ignore
                        [removeHeader,];
                    } });
            /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:text-destructive_text']} */ ;
            const { default: __VLS_321 } = __VLS_317.slots;
            // @ts-ignore
            [];
            var __VLS_317;
            var __VLS_318;
            // @ts-ignore
            [];
            var __VLS_311;
            // @ts-ignore
            [];
            var __VLS_283;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_277;
        // @ts-ignore
        [];
        var __VLS_242;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    // @ts-ignore
    [];
    var __VLS_220;
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
//# sourceMappingURL=MockForm.vue.js.map