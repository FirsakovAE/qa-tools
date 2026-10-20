<script setup lang="ts">
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

defineProps<{
  id: string
  label: string
  hint?: string
  modelValue: boolean
}>()

defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
</script>

<template>
  <div class="flex items-start gap-3">
    <Checkbox
      :id="id"
      class="mt-0.5"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', !!$event)"
    />
    <Label :for="id" class="text-sm font-normal cursor-pointer">
      {{ label }}
      <span v-if="hint" class="block text-xs text-muted-foreground">{{ hint }}</span>
    </Label>
  </div>
</template>
