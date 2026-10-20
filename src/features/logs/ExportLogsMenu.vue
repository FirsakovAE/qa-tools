<script setup lang="ts">
import { computed } from 'vue'
import { Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  /** Events passing the filters */
  count: number
  /** Ticked rows; when > 0 only they are exported */
  selected?: number
}>()

const emit = defineEmits<{
  (e: 'export'): void
}>()

const selectedCount = computed(() => props.selected ?? 0)
const buttonLabel = computed(() => (selectedCount.value ? `Export Logs (${selectedCount.value})` : 'Export Logs'))
</script>

<template>
  <div class="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      class="h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
      :disabled="count === 0"
      @click="emit('export')"
    >
      <Upload class="h-3.5 w-3.5" />
      <span class="text-xs font-medium">{{ buttonLabel }}</span>
    </Button>
  </div>
</template>
