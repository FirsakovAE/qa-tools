<script setup lang="ts">
import {
  ContextMenuSeparator,
  type ContextMenuSeparatorProps,
} from 'reka-ui';
import { cn } from '@/components/ui/utils';

const props = defineProps<ContextMenuSeparatorProps>();
</script>

<template>
  <ContextMenuSeparator
    v-bind="props"
    :class="cn('-mx-1 my-1 h-px bg-border', $attrs.class ?? '')"
  />
</template>
