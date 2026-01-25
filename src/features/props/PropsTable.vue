<script setup lang="ts">
import { onUnmounted } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-vue-next'
import type { PropsRow } from './types'
import { useRuntime } from '@/runtime'

const runtime = useRuntime()

const props = defineProps<{
  rows: PropsRow[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', row: PropsRow): void
  (e: 'toggleFavorite', row: PropsRow): void
}>()

// ============================================================================
// Hover Pipeline (rAF-throttle, non-reactive state)
// ============================================================================

// NON-REACTIVE hover state (prevents Vue reactivity overhead)
let hoveredUid: number | null = null
let pendingHighlightUid: number | null = null
let highlightScheduled = false
let pendingUnhighlight = false

/**
 * rAF-throttled highlight sender
 * Guarantees max 60 events/sec, no bridge spam
 */
function scheduleHighlight(uid: number | null) {
  pendingHighlightUid = uid
  pendingUnhighlight = uid === null

  if (highlightScheduled) return
  highlightScheduled = true

  requestAnimationFrame(() => {
    highlightScheduled = false
    
    if (pendingUnhighlight) {
      sendUnhighlight()
    } else if (pendingHighlightUid !== null) {
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
  } catch {
    // Silently ignore
  }
}

async function sendUnhighlight() {
  try {
    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT'
    })
  } catch {
    // Silently ignore
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
  const prevHovered = document.querySelector('.props-row-hovered')
  if (prevHovered) {
    prevHovered.classList.remove('props-row-hovered')
  }
  
  // Add hover class to current row (NEVER for favorites)
  const target = (event.target as HTMLElement).closest('.props-row')
  if (target && !row.isFavoriteFlag) {
    target.classList.add('props-row-hovered')
  }
  
  hoveredUid = effectiveUid
  
  // Send highlight for elements with DOM, or unhighlight for "Logic only"
  scheduleHighlight(effectiveUid)
}

/**
 * Handle mouse leave from scroller area
 */
function onScrollerLeave() {
  const prevHovered = document.querySelector('.props-row-hovered')
  if (prevHovered) {
    prevHovered.classList.remove('props-row-hovered')
  }
  
  hoveredUid = null
  scheduleHighlight(null)
}

// Cleanup on unmount
onUnmounted(() => {
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

function getPropsCount(row: PropsRow): number {
  return row.props ? Object.keys(row.props).length : 0
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
  <div class="h-full flex flex-col border rounded-lg overflow-hidden">
    <!-- Fixed Header -->
    <div class="shrink-0 border-b bg-muted/30">
      <div class="props-header">
        <div class="props-cell props-cell-star"></div>
        <div class="props-cell props-cell-name text-xs font-semibold">Name</div>
        <div class="props-cell props-cell-element text-xs font-semibold">Root Element</div>
        <div class="props-cell props-cell-props text-xs font-semibold">Props</div>
      </div>
    </div>
    
    <!-- Virtualized Body -->
    <RecycleScroller
      class="flex-1 min-h-0"
      :items="rows"
      :item-size="40"
      key-field="id"
      @mouseleave="onScrollerLeave"
    >
      <template #default="{ item: row }">
        <div
          class="props-row"
          :class="{
            'props-row-selected': selectedId === row.id,
            'props-row-clickable': row.hasPropsFlag,
            'props-row-disabled': !row.hasPropsFlag,
            'props-row-favorite': row.isFavoriteFlag
          }"
          @click="handleRowClick(row)"
          @mouseenter="onRowHover(row, $event)"
        >
          <!-- Star Column -->
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
          
          <!-- Name Column -->
          <div class="props-cell props-cell-name">
            <div class="truncate text-sm font-medium" :title="row.name">
              {{ row.name }}
            </div>
          </div>
          
          <!-- Element Column (use pre-calculated elementInfo) -->
          <div class="props-cell props-cell-element">
            <Badge 
              :variant="row.elementInfo === 'Logic only' ? 'destructive' : 'secondary'"
              class="text-xs truncate max-w-full"
              :title="row.elementInfo"
            >
              {{ truncateElementInfo(row.elementInfo) }}
            </Badge>
          </div>
          
          <!-- Props Column -->
          <div class="props-cell props-cell-props">
            <Badge 
              v-if="row.hasPropsFlag"
              variant="outline" 
              class="text-xs font-mono"
            >
              {{ getPropsCount(row) }}
            </Badge>
            <span v-else class="text-xs text-muted-foreground">—</span>
          </div>
        </div>
      </template>
      
      <!-- Empty state -->
      <template #after>
        <div v-if="rows.length === 0" class="h-32 flex items-center justify-center text-muted-foreground">
          No components found
        </div>
      </template>
    </RecycleScroller>
  </div>
</template>

<style scoped>
/* Row layout */
.props-header,
.props-row {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
}

.props-header {
  background: hsl(var(--muted) / 0.3);
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

.props-cell-name {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.props-cell-element {
  width: 140px;
  text-align: left;
}

.props-cell-props {
  width: 80px;
  text-align: left;
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

/* Favorite - ALWAYS priority */
.props-row-favorite {
  background: hsl(48 100% 95% / 0.5);
}

/* Fallback: favorite + hovered = still favorite background */
.props-row-favorite.props-row-hovered {
  background: hsl(48 100% 95% / 0.5);
}

:deep(.dark) .props-row-favorite {
  background: hsl(48 100% 10% / 0.3);
}

:deep(.dark) .props-row-favorite.props-row-hovered {
  background: hsl(48 100% 10% / 0.3);
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

/* Show star on row hover - uses DOM class */
.props-row-hovered .star-btn,
.props-row:hover:not(.props-row-favorite) .star-btn {
    opacity: 1;
}

.star-btn.star-favorite .h-3\.5 {
  color: hsl(48 100% 50%);
  fill: hsl(48 100% 50%);
}

/* Custom scrollbar styling to match ui-kit ScrollArea */
:deep(.vue-recycle-scroller) {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
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
</style>
