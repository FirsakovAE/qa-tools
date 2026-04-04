<script setup lang="ts">
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

defineProps<{
  /** Search settings object to toggle (e.g. settings.propsSearch) */
  searchSettings: Record<string, boolean>
  /** Items: { key: settings key, label: display label } */
  searchItems: Array<{ key: string; label: string }>
  /** Prefix for checkbox ids, e.g. 'props-search' */
  idPrefix: string
}>()

const emit = defineEmits<{
  (e: 'toggle', key: string): void
}>()

function toggle(key: string) {
  emit('toggle', key)
}
</script>

<template>
  <div class="space-y-3">
    <h4 class="text-sm font-semibold">Search Settings</h4>
    <div class="grid grid-cols-1 gap-2">
      <div v-for="item in searchItems" :key="item.key" class="flex items-center space-x-3">
        <Checkbox
          :id="`${idPrefix}-${item.key}`"
          :model-value="searchSettings[item.key]"
          @update:model-value="toggle(item.key)"
        />
        <Label :for="`${idPrefix}-${item.key}`" class="text-sm">
          {{ item.label }}
        </Label>
      </div>
    </div>
  </div>
</template>
