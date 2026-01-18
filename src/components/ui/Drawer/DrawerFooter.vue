<script lang="ts" setup>
import { cn } from '@/components/ui/utils';
</script>

<template>
  <div :class="cn('mt-auto flex flex-col gap-2 p-4', $attrs.class ?? '')">
    <slot />
  </div>
</template>
