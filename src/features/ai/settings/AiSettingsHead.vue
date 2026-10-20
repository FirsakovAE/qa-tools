<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  description?: string
  resetLabel?: string
  resetDisabled?: boolean
}>()

defineEmits<{ (e: 'reset'): void }>()
</script>

<template>
  <div class="flex items-start justify-between gap-2">
    <div>
      <h4 class="text-sm font-semibold">{{ title }}</h4>
      <p v-if="description" class="text-xs text-muted-foreground mt-1">{{ description }}</p>
    </div>
    <div class="flex flex-col items-end gap-1 shrink-0">
      <slot name="actions" />
      <Button
        v-if="resetLabel || $slots.reset"
        variant="ghost"
        size="sm"
        class="h-7 text-xs gap-1.5"
        :disabled="resetDisabled"
        @click="$emit('reset')"
      >
        <slot name="reset">
          <RotateCcw class="h-3.5 w-3.5" />
          {{ resetLabel }}
        </slot>
      </Button>
    </div>
  </div>
</template>
