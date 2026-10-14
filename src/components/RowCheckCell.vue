<script setup lang="ts">
import { CheckIcon, MinusIcon } from 'lucide-vue-next'
import { Checkbox } from '@/components/ui/checkbox'
import type { RowCheckState } from '@/composables/useRowSelection'

defineProps<{
  state: RowCheckState
  title?: string
  /** Header control uses the header text color; row checkboxes stay primary */
  header?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', event: MouseEvent): void
}>()

function onMousedown(event: MouseEvent) {
  // Shift+click would otherwise select the text between rows
  if (event.shiftKey) event.preventDefault()
}
</script>

<template>
  <!-- The whole cell is the hit area; the checkbox only reflects the state -->
  <div
    class="virtual-table__cell-check row-check-cell"
    :class="{ 'row-check-cell--header': header }"
    :title="title"
    @mousedown="onMousedown"
    @click.stop="emit('toggle', $event)"
  >
    <Checkbox :model-value="state" class="pointer-events-none">
      <MinusIcon v-if="state === 'indeterminate'" class="h-3.5 w-3.5" />
      <CheckIcon v-else class="h-3.5 w-3.5" />
    </Checkbox>
  </div>
</template>

<style scoped>
.row-check-cell :deep(button[data-state='indeterminate']) {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
.row-check-cell--header :deep(button) {
  border-color: hsl(var(--muted-foreground));
}
.row-check-cell--header :deep(button[data-state='checked']),
.row-check-cell--header :deep(button[data-state='indeterminate']) {
  background: hsl(var(--muted-foreground));
  color: hsl(var(--background));
}
</style>
