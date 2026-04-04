<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useElementSize } from '@vueuse/core'
import VirtualTable from '@/components/VirtualTable.vue'
import { Badge } from '@/components/ui/badge'
import { Star, StarOff, MoreHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { PropsTableActionsMenuContent } from '@/components/PropsTableActionsMenu'
import { TableColumnSelector } from '@/components/ui/TableColumnSelector'
import { Skeleton } from '@/components/ui/Skeleton'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { defaultInspectorSettings } from '@/settings/inspectorSettings'
import type { PropsTableColumnsSettings } from '@/types/inspector'
import type { PropsRow } from './types'
import { useRuntime } from '@/runtime'
import { isExpectedExtensionError } from '@/utils/expectedErrors'

const runtime = useRuntime()

const props = defineProps<{
  rows: PropsRow[]
  selectedId: string | null
  isLoading?: boolean
}>()

// Column visibility from settings
const settings = useInspectorSettingsSync()
const columns = computed(() => {
  const cols = settings.value?.propsTableColumns ?? defaultInspectorSettings.propsTableColumns
  return cols ?? { name: true, rootElement: true, propsReceived: true, propsDeclared: true }
})

function setColumn(key: keyof PropsTableColumnsSettings, value: boolean) {
  if (!settings.value) return
  if (!settings.value.propsTableColumns) {
    settings.value.propsTableColumns = { ...defaultInspectorSettings.propsTableColumns! }
  }
  settings.value.propsTableColumns[key] = value
}


const propsColumnDefs = [
  { key: 'rootElement', label: 'Root Element' },
  { key: 'propsReceived', label: 'Received' },
  { key: 'propsDeclared', label: 'Declared' },
] as const

const ROW_HEIGHT = 40
const HEADER_HEIGHT = 40
const MAX_SKELETON_ROWS = 15

const tableContainerRef = ref<HTMLElement | null>(null)
const { height: containerHeight } = useElementSize(tableContainerRef)
const skeletonRowCount = computed(() => {
  const h = containerHeight.value - HEADER_HEIGHT
  if (h <= 0) return 1
  const count = Math.floor(h / ROW_HEIGHT)
  return Math.min(MAX_SKELETON_ROWS, Math.max(1, count))
})

const emit = defineEmits<{
  (e: 'select', row: PropsRow): void
  (e: 'toggleFavorite', row: PropsRow): void
  (e: 'ignoreByName', row: PropsRow): void
}>()

// ============================================================================
// Hover Pipeline (rAF-throttle, non-reactive state)
// ============================================================================

// NON-REACTIVE hover state (prevents Vue reactivity overhead)
let hoveredUid: number | null = null
let pendingHighlightUid: number | null = null
let highlightScheduled = false
let hoveredEl: HTMLElement | null = null

/**
 * rAF-throttled highlight sender
 * Guarantees max 60 events/sec, no bridge spam
 */
function scheduleHighlight(uid: number | null) {
  pendingHighlightUid = uid

  if (highlightScheduled) return
  highlightScheduled = true

  requestAnimationFrame(() => {
    highlightScheduled = false

    if (pendingHighlightUid === null) {
      sendUnhighlight()
    } else {
      sendHighlight(pendingHighlightUid)
    }
  })
}

async function sendHighlight(uid: number) {
  try {
    await runtime.sendMessage({
      type: 'HIGHLIGHT_BY_UID',
      uid
    })
  } catch (error) {
    if (!isExpectedExtensionError(error)) {
      console.error('[props/PropsTable] sendHighlight failed:', error)
    }
  }
}

async function sendUnhighlight() {
  try {
    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT'
    })
  } catch (error) {
    if (!isExpectedExtensionError(error)) {
      console.error('[props/PropsTable] sendUnhighlight failed:', error)
    }
  }
}

/**
 * Handle row hover - only mouseenter, NO mousemove
 * Uses pre-calculated flags from PropsRow
 */
function onRowHover(row: PropsRow, event: Event) {
  // Use pre-calculated uid and hasDomElement
  const canHighlight = row.uid !== null && row.hasDomElement
  const effectiveUid = canHighlight ? row.uid : null

  // Skip if same effective UID
  if (effectiveUid === hoveredUid) return

  // Remove hover class from previous row
  if (hoveredEl) {
    hoveredEl.classList.remove('props-row-hovered')
  }

  // Add hover class to current row (NEVER for favorites)
  const target = (event.target as HTMLElement).closest('.props-row') as HTMLElement | null
  if (target && !row.isFavoriteFlag) {
    target.classList.add('props-row-hovered')
    hoveredEl = target
  } else {
    hoveredEl = null
  }

  hoveredUid = effectiveUid

  // Send highlight for elements with DOM, or unhighlight for "Logic only"
  scheduleHighlight(effectiveUid)
}

/**
 * Handle mouse leave from scroller area
 */
function onScrollerLeave() {
  if (hoveredEl) {
    hoveredEl.classList.remove('props-row-hovered')
    hoveredEl = null
  }

  hoveredUid = null
  scheduleHighlight(null)
}

// Cleanup on unmount
onUnmounted(() => {
  if (hoveredEl) {
    hoveredEl.classList.remove('props-row-hovered')
    hoveredEl = null
  }
  if (hoveredUid !== null) {
    sendUnhighlight()
  }
})

// ============================================================================
// Data helpers (use pre-calculated fields)
// ============================================================================

function truncateElementInfo(info: string): string {
  return info.length > 25 ? info.substring(0, 25) + '...' : info
}

function getPropsPassed(row: PropsRow): number {
  if (row.props && Object.keys(row.props).length > 0) {
    return Object.keys(row.props).length
  }
  return row.propsCountPassed ?? row.propsCount ?? 0
}

function getPropsDeclared(row: PropsRow): number {
  return row.propsCount ?? 0
}

function handleRowClick(row: PropsRow) {
  if (row.hasPropsFlag) {
    emit('select', row)
  }
}

function handleToggleFavorite(event: Event, row: PropsRow) {
  event.stopPropagation()
  emit('toggleFavorite', row)
}
</script>

<template>
  <div ref="tableContainerRef" class="h-full">
    <VirtualTable
      :items="rows"
      key-field="id"
      :item-size="40"
      min-width="360px"
      empty-message="No components found"
      :is-loading="isLoading"
      @mouseleave="onScrollerLeave"
    >
      <template #header>
        <div class="props-cell props-cell-star"></div>
        <div class="props-cell props-cell-name text-xs font-semibold">Name</div>
        <div v-if="columns.rootElement" class="props-cell props-cell-element text-xs font-semibold">Root Element</div>
        <div v-if="columns.propsReceived" class="props-cell props-cell-props text-xs font-semibold">Received</div>
        <div v-if="columns.propsDeclared" class="props-cell props-cell-props text-xs font-semibold">Declared</div>
              <div class="props-cell props-cell-actions virtual-table__cell-actions">
                <TableColumnSelector
            :columns="{ ...columns }"
            :column-definitions="propsColumnDefs"
            @update:column="(k, v) => setColumn(k as keyof PropsTableColumnsSettings, v)"
          />
        </div>
      </template>

      <template #default="{ item: row }">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div
              class="props-row virtual-table__row"
              :class="{
                'props-row-selected': selectedId === row.id,
                'props-row-clickable': row.hasPropsFlag,
                'props-row-disabled': !row.hasPropsFlag,
                'props-row-favorite': row.isFavoriteFlag
              }"
              @click="handleRowClick(row)"
              @mouseenter="onRowHover(row, $event)"
            >
              <div class="props-cell props-cell-star">
                <button
                  class="star-btn"
                  :class="{ 
                    'star-visible': row.isFavoriteFlag,
                    'star-favorite': row.isFavoriteFlag
                  }"
                  :title="row.isFavoriteFlag ? 'Remove from favorites' : 'Add to favorites'"
                  @click="(e) => handleToggleFavorite(e, row)"
                >
                  <Star 
                    class="h-3.5 w-3.5"
                    :class="row.isFavoriteFlag 
                      ? 'text-yellow-500 fill-yellow-500' 
                      : 'text-muted-foreground'"
                  />
                </button>
              </div>
              <div class="props-cell props-cell-name">
                <div class="truncate text-sm font-medium" :title="row.name">
                  {{ row.name }}
                </div>
              </div>
              <div v-if="columns.rootElement" class="props-cell props-cell-element">
                <Badge 
                  :variant="row.elementInfo === 'Logic only' ? 'destructive_text' : 'secondary'"
                  class="text-xs truncate max-w-full"
                  :title="row.elementInfo"
                >
                  {{ truncateElementInfo(row.elementInfo) }}
                </Badge>
              </div>
              <div v-if="columns.propsReceived" class="props-cell props-cell-props">
                <Badge 
                  v-if="row.hasPropsFlag"
                  variant="outline" 
                  class="text-xs font-mono"
                >
                  {{ getPropsPassed(row) }}
                </Badge>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </div>
              <div v-if="columns.propsDeclared" class="props-cell props-cell-props">
                <Badge 
                  v-if="row.hasPropsFlag"
                  variant="secondary" 
                  class="text-xs font-mono"
                >
                  {{ getPropsDeclared(row) }}
                </Badge>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </div>
              <div class="props-cell props-cell-actions virtual-table__cell-actions">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                      <MoreHorizontal class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <PropsTableActionsMenuContent
                    variant="dropdown"
                    :row="row"
                    @toggle-favorite="emit('toggleFavorite', $event)"
                    @ignore-by-name="emit('ignoreByName', $event)"
                  />
                </DropdownMenu>
              </div>
            </div>
          </ContextMenuTrigger>
          <PropsTableActionsMenuContent
            variant="context"
            :row="row"
            @toggle-favorite="emit('toggleFavorite', $event)"
            @ignore-by-name="emit('ignoreByName', $event)"
          />
        </ContextMenu>
      </template>

      <template #after>
        <div v-if="isLoading && rows.length === 0" class="flex flex-col gap-0">
          <div v-for="i in skeletonRowCount" :key="i" class="props-row virtual-table__row flex items-center h-10 px-2 border-b border-border/50">
            <div class="props-cell props-cell-star w-10 flex justify-center">
              <Skeleton class="h-3.5 w-3.5 rounded" />
            </div>
            <div class="props-cell props-cell-name flex-1 min-w-0">
              <Skeleton class="h-4 w-32" />
            </div>
            <div v-if="columns.rootElement" class="props-cell props-cell-element">
              <Skeleton class="h-5 w-24" />
            </div>
            <div v-if="columns.propsReceived" class="props-cell props-cell-props">
              <Skeleton class="h-5 w-8 mx-auto" />
            </div>
            <div v-if="columns.propsDeclared" class="props-cell props-cell-props">
              <Skeleton class="h-5 w-8 mx-auto" />
            </div>
            <div class="props-cell props-cell-actions virtual-table__cell-actions">
              <Skeleton class="h-6 w-6 rounded mx-auto" />
            </div>
          </div>
        </div>
      </template>
    </VirtualTable>
  </div>
</template>

<style scoped>
/* Row layout - padding matches header (padding-right: 0 when scrollbar-gutter reserves space) */
.props-row {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  padding-right: 0;
}

/* Cell sizes */
.props-cell {
  flex-shrink: 0;
  padding: 0 4px;
}

.props-cell-star {
  width: 40px;
  display: flex;
  justify-content: center;
}

/* Name: shrinks first (high flex-shrink), min 130px; Root Element shrinks only after Name hits min */
.props-cell-name {
  flex: 1 10 0;
  min-width: 130px;
  text-align: left;
  padding-left: 8px;
  overflow: hidden;
}

/* Root Element: default 180px, min 100px, shrinks when Name already at min */
.props-cell-element {
  flex: 0 1 180px;
  min-width: 100px;
  text-align: left;
  padding: 0;
  overflow: hidden;
}

/* Props columns (Received / Declared) */
.props-cell-props {
  width: 56px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding-left: 4px;
  padding-right: 4px;
}

/* Row states */
.props-row {
  transition: background-color 0.1s;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
}

.props-row-clickable {
  cursor: pointer;
}

/* Hover - ONLY if NOT favorite */
  .props-row-clickable:hover:not(.props-row-favorite):not(.props-row-selected),
  .props-row-clickable.props-row-hovered:not(.props-row-favorite):not(.props-row-selected) {
  background: hsl(var(--accent));
}

.props-row-disabled {
  opacity: 0.5;
  cursor: default;
}

.props-row-selected {
  background: hsl(var(--muted));
}

/* Star button */
.star-btn {
  padding: 2px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.1s, background-color 0.1s;
}

.star-btn:hover {
  background: hsl(var(--accent));
}

.star-btn.star-visible,
.star-btn.star-favorite {
  opacity: 1;
}

.star-btn.star-favorite .h-3\.5 {
  color: hsl(48 100% 50%);
  fill: hsl(48 100% 50%);
}

</style>
