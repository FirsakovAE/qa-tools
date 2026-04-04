<script setup lang="ts">
import { computed, ref, watch, onUnmounted, type CSSProperties } from 'vue';
import { useResizeInProgress } from '@/composables/useResizeInProgress';

interface Props {
  src: string;
  opacity?: number;
  opacityDark?: number;
  zIndex?: number;
  blur?: number;
  positionX?: number;
  positionY?: number;
  scale?: number;
  blendMode?: CSSProperties['mixBlendMode'];
  relative?: boolean;
  type?: 'image' | 'video';
}

const props = withDefaults(defineProps<Props>(), {
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
const videoRef = ref<HTMLVideoElement | null>(null)
const { isResizing } = useResizeInProgress()

function shouldPauseVideo() {
  return document.hidden || isResizing.value
}

function updateVideoPlayback() {
  const video = videoRef.value
  if (shouldPauseVideo()) {
    video?.pause()
  } else {
    video?.play().catch(() => {})
  }
}

watch(() => props.type, (type) => {
  if (type === 'video') {
    document.addEventListener('visibilitychange', updateVideoPlayback)
    updateVideoPlayback() // sync initial state
  } else {
    document.removeEventListener('visibilitychange', updateVideoPlayback)
  }
}, { immediate: true })

watch(isResizing, () => {
  if (props.type === 'video') updateVideoPlayback()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', updateVideoPlayback)
})
</script>

<template>
  <div
    :class="containerClass"
    :style="imageStyle"
  >
    <img
      v-if="props.type === 'image'"
      :class="mediaClass"
      :src="props.src"
      :style="{
        ...mediaStyle,
        filter: `blur(var(--infusion-blur))`,
      }"
      alt=""
    >
    <video
      v-if="props.type === 'video'"
      ref="videoRef"
      :class="mediaClass"
      :src="props.src"
      :style="{
        ...mediaStyle,
        filter: `blur(var(--infusion-blur))`,
      }"
      preload="metadata"
      autoplay
      loop
      muted
      playsinline
      alt=""
    />
  </div>
</template>
