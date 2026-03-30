import { computed, ref, watch, onUnmounted } from 'vue';
import { useResizeInProgress } from '@/composables/useResizeInProgress';
const props = withDefaults(defineProps(), {
    src: '',
    opacity: 0.2,
    opacityDark: 0.3,
    zIndex: 100,
    blur: 64,
    positionX: 50,
    positionY: 50,
    scale: 100,
    blendMode: 'normal',
    relative: false,
    type: 'image',
});
const imageStyle = computed(() => ({
    '--infusion-opacity': props.opacity,
    '--infusion-opacity-dark': props.opacityDark,
    '--infusion-z-index': props.zIndex,
    '--infusion-blur': `${props.blur}px`,
    '--infusion-position-x': `${props.positionX}%`,
    '--infusion-position-y': `${props.positionY}%`,
    '--infusion-scale': (props.scale / 100) * 1.1,
    'mixBlendMode': props.blendMode,
}));
const containerClass = computed(() => [
    'top-0 left-0 overflow-hidden pointer-events-none z-(--infusion-z-index)',
    props.relative
        ? 'absolute w-full h-full'
        : 'fixed w-screen h-screen',
]);
const mediaClass = 'w-full h-full object-cover opacity-(--infusion-opacity) dark:opacity-(--infusion-opacity-dark)';
const mediaStyle = computed(() => ({
    objectPosition: `var(--infusion-position-x) var(--infusion-position-y)`,
    transformOrigin: `var(--infusion-position-x) var(--infusion-position-y)`,
    transform: `scale(var(--infusion-scale))`,
}));
// Page Visibility API + resize detection — pause video when tab hidden or resizing to reduce CPU/GPU load
const videoRef = ref(null);
const { isResizing } = useResizeInProgress();
function shouldPauseVideo() {
    return document.hidden || isResizing.value;
}
function updateVideoPlayback() {
    const video = videoRef.value;
    if (shouldPauseVideo()) {
        video?.pause();
    }
    else {
        video?.play().catch(() => { });
    }
}
watch(() => props.type, (type) => {
    if (type === 'video') {
        document.addEventListener('visibilitychange', updateVideoPlayback);
        updateVideoPlayback(); // sync initial state
    }
    else {
        document.removeEventListener('visibilitychange', updateVideoPlayback);
    }
}, { immediate: true });
watch(isResizing, () => {
    if (props.type === 'video')
        updateVideoPlayback();
});
onUnmounted(() => {
    document.removeEventListener('visibilitychange', updateVideoPlayback);
});
const __VLS_defaults = {
    src: '',
    opacity: 0.2,
    opacityDark: 0.3,
    zIndex: 100,
    blur: 64,
    positionX: 50,
    positionY: 50,
    scale: 100,
    blendMode: 'normal',
    relative: false,
    type: 'image',
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (__VLS_ctx.containerClass) },
    ...{ style: (__VLS_ctx.imageStyle) },
});
if (props.type === 'image') {
    __VLS_asFunctionalElement(__VLS_intrinsics.img)({
        ...{ class: (__VLS_ctx.mediaClass) },
        src: (props.src),
        ...{ style: ({
                ...__VLS_ctx.mediaStyle,
                filter: `blur(var(--infusion-blur))`,
            }) },
        alt: "",
    });
}
if (props.type === 'video') {
    __VLS_asFunctionalElement(__VLS_intrinsics.video)({
        ref: "videoRef",
        ...{ class: (__VLS_ctx.mediaClass) },
        src: (props.src),
        ...{ style: ({
                ...__VLS_ctx.mediaStyle,
                filter: `blur(var(--infusion-blur))`,
            }) },
        preload: "metadata",
        autoplay: true,
        loop: true,
        muted: true,
        playsinline: true,
        alt: "",
    });
}
// @ts-ignore
[containerClass, imageStyle, mediaClass, mediaClass, mediaStyle, mediaStyle,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
export default {};
//# sourceMappingURL=Infusion.vue.js.map