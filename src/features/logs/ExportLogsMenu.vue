<script setup lang="ts">
import { computed } from 'vue'
import { Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LogsExportFormat } from '@/types/logs'
import { LOGS_EXPORT_FORMATS } from '@/types/logs'

const props = defineProps<{
  /** Events passing the filters */
  count: number
  /** Ticked rows; when > 0 only they are exported */
  selected?: number
  format: LogsExportFormat
}>()

const emit = defineEmits<{
  (e: 'export', format: LogsExportFormat): void
}>()

const formatLabel = computed(() => LOGS_EXPORT_FORMATS.find(f => f.value === props.format)?.label)

const selectedCount = computed(() => props.selected ?? 0)
const buttonLabel = computed(() => (selectedCount.value ? `Export Logs (${selectedCount.value})` : 'Export Logs'))
const scopeLabel = computed(() =>
  selectedCount.value ? `${selectedCount.value} selected events` : `${props.count} filtered events`,
)
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 border-orange-500/40 bg-transparent text-orange-600 hover:bg-transparent hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
          :disabled="count === 0"
          @click="emit('export', format)"
        >
          <Upload class="h-3.5 w-3.5" />
          <span class="text-xs font-medium">{{ buttonLabel }}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Export {{ scopeLabel }} as {{ formatLabel }} (format: Options › Logs › Export)
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
