<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{
  tooltip: string
  disabled?: boolean
}>()

defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon" class="h-8 w-8" :disabled="disabled" :aria-label="tooltip" @click="$emit('click')">
          <slot />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
