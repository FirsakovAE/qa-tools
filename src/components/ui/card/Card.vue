<script setup lang="ts">
import { cn } from '@/components/ui/utils'

const props = withDefaults(defineProps<{
  class?: string
}>(), {
  class: ''
})
</script>

<template>
  <div :class="cn('rounded-lg border bg-card text-card-foreground shadow-sm', props.class)">
    <slot />
  </div>
</template>
