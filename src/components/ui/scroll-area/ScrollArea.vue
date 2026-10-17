<script setup lang="ts">
import { computed } from 'vue';
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  type ScrollAreaRootProps,
  ScrollAreaViewport,
} from 'reka-ui';
import ScrollBar from './ScrollBar.vue';
import { cn } from '@/components/ui/utils';

const props = withDefaults(defineProps<ScrollAreaRootProps & {
  /** Without the horizontal bar the content keeps the area width instead of growing to its widest child */
  horizontal?: boolean
}>(), { horizontal: true });

const rootProps = computed(() => {
  const { horizontal: _, ...rest } = props;
  return rest;
});

const emit = defineEmits<{
  (e: 'scroll', event: Event): void
}>();
</script>

<template>
  <ScrollAreaRoot
    v-bind="rootProps"
    :class="cn('relative overflow-hidden', $attrs.class ?? '')"
  >
    <ScrollAreaViewport data-scroll-viewport class="h-full w-full rounded-[inherit]" @scroll="emit('scroll', $event)">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar v-if="horizontal" orientation="horizontal" />
    <ScrollBar orientation="vertical" />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
