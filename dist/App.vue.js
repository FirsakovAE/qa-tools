import { computed, watch, onMounted, onUnmounted } from 'vue';
import { Infusion } from '@/components/ui/infusion';
import { useAutoUnhighlight } from '@/composables/useAutoUnhighlight';
import { useUpdateChecker } from '@/composables/useUpdateChecker';
import { inspectorState, useInspectorSettings } from '@/settings/useInspectorSettings';
import { mediaUrls } from '@/settings/mediaStore';
import { wallpapers, defaultWallpaperUrl } from '@/assets/wallpapers';
import Navigation from '@/features/Navigation.vue';
import { Toaster } from '@/components/ui/Toaster';
useAutoUnhighlight();
useUpdateChecker();
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    }
    else {
        document.documentElement.classList.remove('dark');
    }
}
watch(() => inspectorState.theme, (theme) => {
    if (theme)
        applyTheme(theme);
}, { immediate: true });
onMounted(() => useInspectorSettings());
const customize = computed(() => inspectorState.customize);
const infusionSrc = computed(() => {
    const img = customize.value?.image;
    if (!img)
        return defaultWallpaperUrl;
    if (img.sourceType === 'link' && img.url)
        return img.url;
    if (img.sourceType === 'file' && img.savedFileId) {
        if (img.savedFileId.startsWith('wallpaper:')) {
            return wallpapers.find(w => w.id === img.savedFileId)?.url || defaultWallpaperUrl;
        }
        return mediaUrls[img.savedFileId] || defaultWallpaperUrl;
    }
    return defaultWallpaperUrl;
});
const infusionType = computed(() => {
    const img = customize.value?.image;
    if (!img)
        return 'image';
    if (img.sourceType === 'link' && img.url) {
        return /\.(mp4|webm|ogv|mov)(\?|$)/i.test(img.url) ? 'video' : 'image';
    }
    if (img.sourceType === 'file' && img.savedFileId && !img.savedFileId.startsWith('wallpaper:')) {
        const wp = img.wallpapers?.find(w => w.id === img.savedFileId);
        if (wp)
            return wp.mimeType.startsWith('video/') ? 'video' : 'image';
        const file = inspectorState.savedFiles?.find(f => f.id === img.savedFileId);
        return file?.mimeType.startsWith('video/') ? 'video' : 'image';
    }
    return 'image';
});
function selectNodeContents(node) {
    const sel = window.getSelection();
    if (!sel)
        return;
    const range = document.createRange();
    range.selectNodeContents(node);
    sel.removeAllRanges();
    sel.addRange(range);
}
function handleSelectAll(e) {
    if (!(e.ctrlKey || e.metaKey) || e.code !== 'KeyA')
        return;
    const target = e.target;
    if (!target)
        return;
    // input / textarea handle their own Ctrl+A natively (scoped to the field)
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
        return;
    e.preventDefault();
    // contenteditable — select only within this element
    if (target.isContentEditable) {
        selectNodeContents(target);
        return;
    }
    // pre / code (readonly JSON viewer) — select only that code block
    const pre = target.closest('pre');
    if (pre) {
        selectNodeContents(pre);
        return;
    }
    // Injected iframe / DevTools — select .app-content to avoid blue frame outline
    if (document.documentElement.hasAttribute('data-injected')) {
        const content = document.querySelector('.app-content') || document.getElementById('app');
        if (content)
            selectNodeContents(content);
        return;
    }
    // Everything else — no selection
    window.getSelection()?.removeAllRanges();
}
onMounted(() => document.addEventListener('keydown', handleSelectAll, true));
onUnmounted(() => document.removeEventListener('keydown', handleSelectAll, true));
const __VLS_ctx = {
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onContextmenu: () => { } },
    ...{ class: "relative h-screen overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Infusion} */
Infusion;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    src: (__VLS_ctx.infusionSrc),
    opacity: (__VLS_ctx.customize.imageOpacity),
    opacityDark: (__VLS_ctx.customize.imageOpacity),
    zIndex: (100),
    blur: (__VLS_ctx.customize.blur),
    positionX: (__VLS_ctx.customize.positionX),
    positionY: (__VLS_ctx.customize.positionY),
    scale: (__VLS_ctx.customize.scale),
    blendMode: "normal",
    relative: (true),
    type: (__VLS_ctx.infusionType),
}));
const __VLS_2 = __VLS_1({
    src: (__VLS_ctx.infusionSrc),
    opacity: (__VLS_ctx.customize.imageOpacity),
    opacityDark: (__VLS_ctx.customize.imageOpacity),
    zIndex: (100),
    blur: (__VLS_ctx.customize.blur),
    positionX: (__VLS_ctx.customize.positionX),
    positionY: (__VLS_ctx.customize.positionY),
    scale: (__VLS_ctx.customize.scale),
    blendMode: "normal",
    relative: (true),
    type: (__VLS_ctx.infusionType),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative z-10 h-full" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell h-full" },
});
/** @type {__VLS_StyleScopedClasses['app-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full h-full flex flex-col bg-background relative overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative z-10 flex-1 min-h-0 overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-content h-full" },
});
/** @type {__VLS_StyleScopedClasses['app-content']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
const __VLS_5 = Navigation;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type {typeof ___VLS_components.Toaster} */
Toaster;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    toastOptions: ({ duration: 5000 }),
}));
const __VLS_12 = __VLS_11({
    toastOptions: ({ duration: 5000 }),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
// @ts-ignore
[infusionSrc, customize, customize, customize, customize, customize, customize, infusionType,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
//# sourceMappingURL=App.vue.js.map