<script setup lang="ts">
import { cn } from '@/components/ui/utils'

const props = withDefaults(defineProps<{
  class?: string
}>(), {
  class: ''
})
</script>

<template>
  <div :class="cn('p-6 pt-0', props.class)">
    <slot />
  </div>
</template>
