<script setup lang="ts">
/**
 * Reusable virtualized table component.
 * Uses vue-virtual-scroller RecycleScroller for efficient rendering of large lists.
 *
 * Slots:
 *   - header: Fixed header row content
 *   - default: Row content, receives { item } from RecycleScroller
 *   - after: Optional content after items (e.g. skeleton, empty state)
 */
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    items: unknown[]
    keyField?: string
    itemSize?: number
    minWidth?: string
    emptyMessage?: string
    showEmpty?: boolean
    /** When true and empty, shows #after slot (e.g. skeleton) instead of emptyMessage */
    isLoading?: boolean
  }>(),
  {
    keyField: 'id',
    itemSize: 40,
    minWidth: '360px',
    emptyMessage: '',
    showEmpty: true,
    isLoading: false,
  }
)

const emit = defineEmits<{
  (e: 'mouseleave', event: MouseEvent): void
}>()
</script>

<template>
  <div class="virtual-table h-full flex flex-col border rounded-lg overflow-hidden table-scroll-x">
    <div class="flex flex-col h-full min-h-0" :style="{ minWidth }">
      <!-- Fixed header -->
      <div v-if="$slots.header" class="shrink-0 border-b bg-muted/30">
        <div class="virtual-table__header">
          <slot name="header" />
        </div>
      </div>

      <!-- Virtualized body (or after-slot content when empty) -->
      <div
        v-if="items.length > 0"
        class="flex-1 min-h-0 flex flex-col"
        @mouseleave="emit('mouseleave', $event)"
      >
        <RecycleScroller
          class="flex-1 min-h-0"
          :items="items"
          :item-size="itemSize"
          :key-field="keyField"
        >
        <template #default="scope">
          <slot v-bind="scope" />
        </template>

        <template v-if="$slots.after" #after>
          <slot name="after" />
        </template>
        </RecycleScroller>
      </div>

      <!-- When empty: show after slot (skeleton) if loading, else empty state with alignment -->
      <div v-else class="flex-1 min-h-0 overflow-auto">
        <slot v-if="isLoading && $slots.after" name="after" />
        <div
          v-else-if="showEmpty && emptyMessage"
          class="virtual-table__empty"
        >
          {{ emptyMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-table__header {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  padding-right: 8px; /* Reserve space for scrollbar (scrollbar-gutter: stable) */
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
}

/* Empty state: centered placeholder when no items */
.virtual-table__empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
}

/* Shared: actions column (TableColumnSelector) */
:deep(.virtual-table__cell-actions) {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 0;
}

/* Rows must use padding-right: 0 to align with header */
:deep(.virtual-table__row) {
  padding-right: 0;
}

/* RecycleScroller scrollbar styling */
:deep(.vue-recycle-scroller) {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
  scrollbar-gutter: stable;
}

:deep(.vue-recycle-scroller::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.vue-recycle-scroller::-webkit-scrollbar-track) {
  background: transparent;
  border-radius: 4px;
}

:deep(.vue-recycle-scroller::-webkit-scrollbar-thumb) {
  background: hsl(var(--border));
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

:deep(.vue-recycle-scroller::-webkit-scrollbar-thumb:hover) {
  background: hsl(var(--border) / 0.8);
  background-clip: padding-box;
}

:deep(.vue-recycle-scroller::-webkit-scrollbar-corner) {
  background: transparent;
}

/* Horizontal scroll for container */
.table-scroll-x {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}

.table-scroll-x::-webkit-scrollbar {
  height: 8px;
}

.table-scroll-x::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.table-scroll-x::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.table-scroll-x::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--border) / 0.8);
  background-clip: padding-box;
}
</style>
