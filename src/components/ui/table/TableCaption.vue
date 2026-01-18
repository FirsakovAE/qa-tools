<script setup lang="ts">
import { cn } from '@/components/ui/utils';

</script>

<template>
  <caption :class="cn('mt-4 text-sm text-muted-foreground', $attrs.class ?? '')">
    <slot />
  </caption>
</template>
