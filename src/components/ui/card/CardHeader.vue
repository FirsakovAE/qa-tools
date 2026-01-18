<script setup lang="ts">
import { cn } from '@/components/ui/utils'

const props = withDefaults(defineProps<{
  class?: string
}>(), {
  class: ''
})
</script>

<template>
  <div :class="cn('flex flex-col space-y-1.5 p-6', props.class)">
    <slot />
  </div>
</template>
