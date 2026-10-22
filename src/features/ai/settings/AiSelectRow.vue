<script setup lang="ts" generic="T extends string">
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

defineProps<{
  id: string
  label: string
  hint?: string
  options: ReadonlyArray<{ id: T; label: string }>
  modelValue: T
}>()

defineEmits<{ (e: 'update:modelValue', value: T): void }>()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <Label :for="id" class="text-sm font-normal">
      {{ label }}
      <span v-if="hint" class="block text-xs text-muted-foreground">{{ hint }}</span>
    </Label>
    <Select :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event as T)">
      <SelectTrigger :id="id" class="h-8 w-[150px] shrink-0 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="option in options" :key="option.id" :value="option.id">{{ option.label }}</SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
