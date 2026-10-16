<script setup lang="ts">
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  type ScrollAreaRootProps,
  ScrollAreaViewport,
} from 'reka-ui';
import ScrollBar from './ScrollBar.vue';
import { cn } from '@/components/ui/utils';

const props = defineProps<ScrollAreaRootProps>();

const emit = defineEmits<{
  (e: 'scroll', event: Event): void
}>();
</script>

<template>
  <ScrollAreaRoot
    v-bind="props"
    :class="cn('relative overflow-hidden', $attrs.class ?? '')"
  >
    <ScrollAreaViewport data-scroll-viewport class="h-full w-full rounded-[inherit]" @scroll="emit('scroll', $event)">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar orientation="horizontal" />
    <ScrollBar orientation="vertical" />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
