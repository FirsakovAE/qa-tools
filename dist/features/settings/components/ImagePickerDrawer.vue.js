import { ref, computed } from 'vue';
import { GlobeIcon, PlusIcon, Trash2Icon, LoaderCircleIcon } from 'lucide-vue-next';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, } from '@/components/ui/Drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, } from '@/components/ui/ContextMenu';
import { mediaUrls } from '@/settings/mediaStore';
import { wallpapers, defaultWallpaperId } from '@/assets/wallpapers';
const props = defineProps();
const emit = defineEmits();
const urlInput = ref('');
const fileInput = ref(null);
const mediaFiles = computed(() => props.savedFiles.filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')));
function isVideoFile(mime) {
    return mime.startsWith('video/');
}
const urlImagesList = computed(() => props.urlImages ?? []);
function isWallpaperSelected(wpId) {
    if (wpId === props.selectedSavedFileId)
        return true;
    if (!props.selectedSavedFileId && !props.selectedUrl && wpId === defaultWallpaperId)
        return true;
    return false;
}
function isUrlSelected(url) {
    return props.selectedUrl === url;
}
function handleAddUrl() {
    const url = urlInput.value.trim();
    if (!url)
        return;
    emit('add-url', url);
    urlInput.value = '';
}
function getUrlDisplayName(url) {
    try {
        const u = new URL(url);
        const path = u.pathname;
        const name = path.split('/').filter(Boolean).pop() || u.hostname;
        return decodeURIComponent(name);
    }
    catch (error) {
        console.error('[settings/ImagePickerDrawer] getUrlDisplayName failed:', url, error);
        return url.slice(0, 40) + (url.length > 40 ? '…' : '');
    }
}
function handleBrowseFiles(event) {
    const input = event.target;
    const files = input?.files;
    if (!files)
        return;
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            emit('add-file', file);
        }
    });
    input.value = '';
}
function isVideoUrl(url) {
    return /\.(mp4|webm|ogv|mov)(\?|$)/i.test(url);
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024)
        return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
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
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Drawer} */
Drawer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onUpdate:open': {} },
    open: (__VLS_ctx.open),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onUpdate:open': {} },
    open: (__VLS_ctx.open),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ 'update:open': {} },
    { 'onUpdate:open': (...[$event]) => {
            __VLS_ctx.emit('update:open', $event);
            // @ts-ignore
            [open, emit,];
        } });
var __VLS_7 = {};
const { default: __VLS_8 } = __VLS_3.slots;
let __VLS_9;
/** @ts-ignore @type {typeof ___VLS_components.DrawerContent} */
DrawerContent;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    ...{ class: "image-picker-drawer" },
}));
const __VLS_11 = __VLS_10({
    ...{ class: "image-picker-drawer" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
/** @type {__VLS_StyleScopedClasses['image-picker-drawer']} */ ;
const { default: __VLS_14 } = __VLS_12.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onContextmenu: () => { } },
    ...{ class: "flex flex-col flex-1 min-h-0" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
let __VLS_15;
/** @ts-ignore @type {typeof ___VLS_components.DrawerHeader} */
DrawerHeader;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const { default: __VLS_20 } = __VLS_18.slots;
let __VLS_21;
/** @ts-ignore @type {typeof ___VLS_components.DrawerTitle} */
DrawerTitle;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({}));
const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
const { default: __VLS_26 } = __VLS_24.slots;
// @ts-ignore
[];
var __VLS_24;
// @ts-ignore
[];
var __VLS_18;
let __VLS_27;
/** @ts-ignore @type {typeof ___VLS_components.ScrollArea} */
ScrollArea;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
    ...{ class: "image-picker__scroll-area" },
}));
const __VLS_29 = __VLS_28({
    ...{ class: "image-picker__scroll-area" },
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
/** @type {__VLS_StyleScopedClasses['image-picker__scroll-area']} */ ;
const { default: __VLS_32 } = __VLS_30.slots;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "image-picker__body" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__body']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "image-picker__section" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__section']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "image-picker__section-title" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__section-title']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "image-picker__url-input-row" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__url-input-row']} */ ;
let __VLS_33;
/** @ts-ignore @type {typeof ___VLS_components.GlobeIcon} */
GlobeIcon;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    size: (16),
    ...{ class: "image-picker__url-input-icon" },
}));
const __VLS_35 = __VLS_34({
    size: (16),
    ...{ class: "image-picker__url-input-icon" },
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
/** @type {__VLS_StyleScopedClasses['image-picker__url-input-icon']} */ ;
let __VLS_38;
/** @ts-ignore @type {typeof ___VLS_components.Input} */
Input;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.urlInput),
    ...{ class: "image-picker__url-input" },
    placeholder: "Paste image or video URL and press Enter",
}));
const __VLS_40 = __VLS_39({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.urlInput),
    ...{ class: "image-picker__url-input" },
    placeholder: "Paste image or video URL and press Enter",
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
let __VLS_43;
const __VLS_44 = ({ keydown: {} },
    { onKeydown: (__VLS_ctx.handleAddUrl) });
/** @type {__VLS_StyleScopedClasses['image-picker__url-input']} */ ;
var __VLS_41;
var __VLS_42;
let __VLS_45;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
    ...{ 'onClick': {} },
    variant: "secondary",
    size: "sm",
    disabled: (!__VLS_ctx.urlInput.trim()),
}));
const __VLS_47 = __VLS_46({
    ...{ 'onClick': {} },
    variant: "secondary",
    size: "sm",
    disabled: (!__VLS_ctx.urlInput.trim()),
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
let __VLS_50;
const __VLS_51 = ({ click: {} },
    { onClick: (__VLS_ctx.handleAddUrl) });
const { default: __VLS_52 } = __VLS_48.slots;
// @ts-ignore
[urlInput, urlInput, handleAddUrl, handleAddUrl,];
var __VLS_48;
var __VLS_49;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "image-picker__grid" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__grid']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.fileInput?.click();
            // @ts-ignore
            [fileInput,];
        } },
    type: "button",
    ...{ class: "image-picker__drop-zone" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__drop-zone']} */ ;
let __VLS_53;
/** @ts-ignore @type {typeof ___VLS_components.PlusIcon} */
PlusIcon;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    size: (32),
    ...{ class: "image-picker__drop-zone-icon" },
}));
const __VLS_55 = __VLS_54({
    size: (32),
    ...{ class: "image-picker__drop-zone-icon" },
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
/** @type {__VLS_StyleScopedClasses['image-picker__drop-zone-icon']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "image-picker__drop-zone-title" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__drop-zone-title']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "image-picker__drop-zone-hint" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__drop-zone-hint']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.handleBrowseFiles) },
    ref: "fileInput",
    type: "file",
    accept: "image/*,video/*",
    multiple: true,
    ...{ class: "sr-only" },
});
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
for (const [url] of __VLS_getVForSourceType((__VLS_ctx.urlImagesList))) {
    let __VLS_58;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
    ContextMenu;
    // @ts-ignore
    const __VLS_59 = __VLS_asFunctionalComponent(__VLS_58, new __VLS_58({
        key: (url),
    }));
    const __VLS_60 = __VLS_59({
        key: (url),
    }, ...__VLS_functionalComponentArgsRest(__VLS_59));
    const { default: __VLS_63 } = __VLS_61.slots;
    let __VLS_64;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
    ContextMenuTrigger;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        asChild: true,
    }));
    const __VLS_66 = __VLS_65({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const { default: __VLS_69 } = __VLS_67.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('select-url', url);
                // @ts-ignore
                [emit, handleBrowseFiles, urlImagesList,];
            } },
        ...{ class: "image-picker__item" },
        ...{ class: ({ 'image-picker__item--selected': __VLS_ctx.isUrlSelected(url) }) },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item']} */ ;
    /** @type {__VLS_StyleScopedClasses['image-picker__item--selected']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-thumb" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-thumb']} */ ;
    if (__VLS_ctx.isVideoUrl(url)) {
        __VLS_asFunctionalElement(__VLS_intrinsics.video)({
            ...{ onError: (...[$event]) => {
                    if (!(__VLS_ctx.isVideoUrl(url)))
                        return;
                    $event.target.style.display = 'none';
                    // @ts-ignore
                    [isUrlSelected, isVideoUrl,];
                } },
            src: (url),
            ...{ class: "image-picker__item-media" },
            muted: true,
            loop: true,
            playsinline: true,
            preload: "metadata",
        });
        /** @type {__VLS_StyleScopedClasses['image-picker__item-media']} */ ;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsics.img)({
            ...{ onError: (...[$event]) => {
                    if (!!(__VLS_ctx.isVideoUrl(url)))
                        return;
                    $event.target.style.display = 'none';
                    // @ts-ignore
                    [];
                } },
            src: (url),
            alt: (__VLS_ctx.getUrlDisplayName(url)),
            ...{ class: "image-picker__item-media" },
            loading: "lazy",
        });
        /** @type {__VLS_StyleScopedClasses['image-picker__item-media']} */ ;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-placeholder image-picker__item-placeholder--url-fallback" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-placeholder']} */ ;
    /** @type {__VLS_StyleScopedClasses['image-picker__item-placeholder--url-fallback']} */ ;
    let __VLS_70;
    /** @ts-ignore @type {typeof ___VLS_components.LoaderCircleIcon} */
    LoaderCircleIcon;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
        size: (20),
        ...{ class: "image-picker__loader-icon" },
    }));
    const __VLS_72 = __VLS_71({
        size: (20),
        ...{ class: "image-picker__loader-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    /** @type {__VLS_StyleScopedClasses['image-picker__loader-icon']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-overlay']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-overlay-text" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-overlay-text']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "image-picker__item-name" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-name']} */ ;
    (__VLS_ctx.getUrlDisplayName(url));
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "image-picker__item-type" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-type']} */ ;
    (__VLS_ctx.isVideoUrl(url) ? 'Video URL' : 'URL');
    // @ts-ignore
    [isVideoUrl, getUrlDisplayName, getUrlDisplayName,];
    var __VLS_67;
    let __VLS_75;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuContent} */
    ContextMenuContent;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
        ...{ class: "w-44" },
    }));
    const __VLS_77 = __VLS_76({
        ...{ class: "w-44" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    /** @type {__VLS_StyleScopedClasses['w-44']} */ ;
    const { default: __VLS_80 } = __VLS_78.slots;
    let __VLS_81;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuItem} */
    ContextMenuItem;
    // @ts-ignore
    const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }));
    const __VLS_83 = __VLS_82({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_82));
    let __VLS_86;
    const __VLS_87 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.emit('remove-url', url);
                // @ts-ignore
                [emit,];
            } });
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    const { default: __VLS_88 } = __VLS_84.slots;
    let __VLS_89;
    /** @ts-ignore @type {typeof ___VLS_components.Trash2Icon} */
    Trash2Icon;
    // @ts-ignore
    const __VLS_90 = __VLS_asFunctionalComponent(__VLS_89, new __VLS_89({
        ...{ class: "h-4 w-4 mr-2" },
    }));
    const __VLS_91 = __VLS_90({
        ...{ class: "h-4 w-4 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_90));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    // @ts-ignore
    [];
    var __VLS_84;
    var __VLS_85;
    // @ts-ignore
    [];
    var __VLS_78;
    // @ts-ignore
    [];
    var __VLS_61;
    // @ts-ignore
    [];
}
for (const [file] of __VLS_getVForSourceType((__VLS_ctx.mediaFiles))) {
    let __VLS_94;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenu} */
    ContextMenu;
    // @ts-ignore
    const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
        key: (file.id),
    }));
    const __VLS_96 = __VLS_95({
        key: (file.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_95));
    const { default: __VLS_99 } = __VLS_97.slots;
    let __VLS_100;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuTrigger} */
    ContextMenuTrigger;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        asChild: true,
    }));
    const __VLS_102 = __VLS_101({
        asChild: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    const { default: __VLS_105 } = __VLS_103.slots;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('select-file', file.id, file.name);
                // @ts-ignore
                [emit, mediaFiles,];
            } },
        ...{ class: "image-picker__item" },
        ...{ class: ({ 'image-picker__item--selected': file.id === __VLS_ctx.selectedSavedFileId }) },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item']} */ ;
    /** @type {__VLS_StyleScopedClasses['image-picker__item--selected']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-thumb" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-thumb']} */ ;
    if (__VLS_ctx.isVideoFile(file.mimeType) && __VLS_ctx.mediaUrls[file.id]) {
        __VLS_asFunctionalElement(__VLS_intrinsics.video)({
            src: (__VLS_ctx.mediaUrls[file.id]),
            ...{ class: "image-picker__item-media" },
            muted: true,
            loop: true,
            playsinline: true,
            preload: "metadata",
        });
        /** @type {__VLS_StyleScopedClasses['image-picker__item-media']} */ ;
    }
    else if (!__VLS_ctx.isVideoFile(file.mimeType) && __VLS_ctx.mediaUrls[file.id]) {
        __VLS_asFunctionalElement(__VLS_intrinsics.img)({
            src: (__VLS_ctx.mediaUrls[file.id]),
            alt: (file.name),
            ...{ class: "image-picker__item-media" },
            loading: "lazy",
        });
        /** @type {__VLS_StyleScopedClasses['image-picker__item-media']} */ ;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "image-picker__item-placeholder" },
        });
        /** @type {__VLS_StyleScopedClasses['image-picker__item-placeholder']} */ ;
        let __VLS_106;
        /** @ts-ignore @type {typeof ___VLS_components.LoaderCircleIcon} */
        LoaderCircleIcon;
        // @ts-ignore
        const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
            size: (20),
            ...{ class: "image-picker__loader-icon" },
        }));
        const __VLS_108 = __VLS_107({
            size: (20),
            ...{ class: "image-picker__loader-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_107));
        /** @type {__VLS_StyleScopedClasses['image-picker__loader-icon']} */ ;
    }
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-overlay']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-overlay-text" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-overlay-text']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "image-picker__item-name" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-name']} */ ;
    (file.name);
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "image-picker__item-type" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-type']} */ ;
    (__VLS_ctx.formatFileSize(file.size));
    (__VLS_ctx.isVideoFile(file.mimeType) ? 'Video' : 'Image');
    // @ts-ignore
    [selectedSavedFileId, isVideoFile, isVideoFile, isVideoFile, mediaUrls, mediaUrls, mediaUrls, mediaUrls, formatFileSize,];
    var __VLS_103;
    let __VLS_111;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuContent} */
    ContextMenuContent;
    // @ts-ignore
    const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
        ...{ class: "w-44" },
    }));
    const __VLS_113 = __VLS_112({
        ...{ class: "w-44" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_112));
    /** @type {__VLS_StyleScopedClasses['w-44']} */ ;
    const { default: __VLS_116 } = __VLS_114.slots;
    let __VLS_117;
    /** @ts-ignore @type {typeof ___VLS_components.ContextMenuItem} */
    ContextMenuItem;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }));
    const __VLS_119 = __VLS_118({
        ...{ 'onClick': {} },
        ...{ class: "text-destructive_text" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
    let __VLS_122;
    const __VLS_123 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.emit('remove-file', file.id);
                // @ts-ignore
                [emit,];
            } });
    /** @type {__VLS_StyleScopedClasses['text-destructive_text']} */ ;
    const { default: __VLS_124 } = __VLS_120.slots;
    let __VLS_125;
    /** @ts-ignore @type {typeof ___VLS_components.Trash2Icon} */
    Trash2Icon;
    // @ts-ignore
    const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({
        ...{ class: "h-4 w-4 mr-2" },
    }));
    const __VLS_127 = __VLS_126({
        ...{ class: "h-4 w-4 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_126));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
    // @ts-ignore
    [];
    var __VLS_120;
    var __VLS_121;
    // @ts-ignore
    [];
    var __VLS_114;
    // @ts-ignore
    [];
    var __VLS_97;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "image-picker__section" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__section']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "image-picker__section-title" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__section-title']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "image-picker__grid" },
});
/** @type {__VLS_StyleScopedClasses['image-picker__grid']} */ ;
for (const [wp] of __VLS_getVForSourceType((__VLS_ctx.wallpapers))) {
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('select-file', wp.id, wp.name);
                // @ts-ignore
                [emit, wallpapers,];
            } },
        key: (wp.id),
        ...{ class: "image-picker__item" },
        ...{ class: ({ 'image-picker__item--selected': __VLS_ctx.isWallpaperSelected(wp.id) }) },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item']} */ ;
    /** @type {__VLS_StyleScopedClasses['image-picker__item--selected']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-thumb" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-thumb']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.img)({
        src: (wp.url),
        alt: (wp.name),
        ...{ class: "image-picker__item-media" },
        loading: "lazy",
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-media']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-overlay']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker__item-overlay-text" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-overlay-text']} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "image-picker__item-name" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-name']} */ ;
    (wp.name);
    __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "image-picker__item-type" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker__item-type']} */ ;
    // @ts-ignore
    [isWallpaperSelected,];
}
// @ts-ignore
[];
var __VLS_30;
// @ts-ignore
[];
var __VLS_12;
// @ts-ignore
[];
var __VLS_3;
var __VLS_4;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=ImagePickerDrawer.vue.js.map