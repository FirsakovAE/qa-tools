<script setup lang="ts">
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  settings: InspectorSettings
}>()

type SearchKey = 'byName' | 'byKey' | 'byValue'

const searchItems: Array<{ key: SearchKey; label: string }> = [
  { key: 'byName', label: 'Search by store name' },
  { key: 'byKey', label: 'Search by key' },
  { key: 'byValue', label: 'Search by value' },
]

function toggleSearch(key: SearchKey) {
  props.settings.piniaSearch[key] = !props.settings.piniaSearch[key]
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">Search Settings</h4>
      <div class="grid grid-cols-1 gap-2">
        <div v-for="item in searchItems" :key="item.key" class="flex items-center space-x-3">
          <Checkbox
            :id="`pinia-search-${item.key}`"
            :model-value="settings.piniaSearch[item.key]"
            @update:model-value="toggleSearch(item.key)"
          />
          <Label :for="`pinia-search-${item.key}`" class="text-sm">
            {{ item.label }}
          </Label>
        </div>
      </div>
    </div>
  </div>
</template>
