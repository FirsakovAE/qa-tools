<script setup lang="ts">
import { cn } from '@/components/ui/utils';

const props = withDefaults(
  defineProps<{
    /** When true, disables native overflow scroll (use parent ScrollArea instead) */
    noScroll?: boolean;
  }>(),
  { noScroll: false }
);
</script>

<template>
  <div
    :class="cn(
      'relative w-full',
      noScroll ? 'overflow-visible' : 'overflow-auto'
    )"
  >
    <table :class="cn('w-full caption-bottom text-sm', $attrs.class ?? '')">
      <slot />
    </table>
  </div>
</template>
