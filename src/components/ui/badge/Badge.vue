<script setup lang="ts">
import { type BadgeVariants, badgeVariants } from '.';
import { cn } from '@/components/ui/utils';

const props = defineProps<{
  variant?: BadgeVariants['variant'];

}>();
</script>

<template>
  <div :class="cn(badgeVariants({ variant }), $attrs.class ?? '')">
    <slot />
  </div>
</template>
