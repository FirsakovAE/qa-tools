<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Star, MoreHorizontal } from 'lucide-vue-next'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { PiniaTableActionsMenuContent } from '@/components/PiniaTableActionsMenu'
import { TableColumnSelector } from '@/components/ui/TableColumnSelector'
import { Skeleton } from '@/components/ui/Skeleton'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { defaultInspectorSettings } from '@/settings/inspectorSettings'
import type { PiniaFavoriteItem, PiniaTableColumnsSettings } from '@/types/inspector'
import { isStoreInFavorites } from '@/utils/piniaFavoritesMatcher'

interface StoreEntry {
  id: string
  baseId: string
  stateKeys: number
  getterKeys: number
  lastUpdated?: number
  lastUpdatedFormatted?: string
}

const props = defineProps<{
  entries: StoreEntry[]
  selectedId: string | null
  piniaFavorites?: PiniaFavoriteItem[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', store: StoreEntry): void
  (e: 'toggleFavorite', store: StoreEntry): void
}>()

function isFavorite(store: StoreEntry): boolean {
  if (!props.piniaFavorites?.length) return false
  const name = store.baseId || ''
  return isStoreInFavorites(name, props.piniaFavorites)
}

function handleToggleFavorite(event: Event, store: StoreEntry) {
  event.stopPropagation()
  emit('toggleFavorite', store)
}

// Has state
function hasStateKeys(store: StoreEntry): boolean {
  return store.stateKeys > 0
}

// Has getters
function hasGetterKeys(store: StoreEntry): boolean {
  return store.getterKeys > 0
}

const handleRowClick = (store: StoreEntry) => {
  emit('select', store)
}

// Column visibility from settings
const settings = useInspectorSettingsSync()
const columns = computed(() => {
  const cols = settings.value?.piniaTableColumns ?? defaultInspectorSettings.piniaTableColumns
  return cols ?? { name: true, state: true, getters: true }
})

function setColumn(key: keyof PiniaTableColumnsSettings, value: boolean) {
  if (!settings.value) return
  if (!settings.value.piniaTableColumns) {
    settings.value.piniaTableColumns = { ...defaultInspectorSettings.piniaTableColumns! }
  }
  settings.value.piniaTableColumns[key] = value
}


const piniaColumnDefs = [
  { key: 'state', label: 'State' },
  { key: 'getters', label: 'Getters' },
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
</script>

<template>
  <div ref="tableContainerRef" class="h-full flex flex-col border rounded-lg overflow-hidden table-scroll-x">
    <div class="min-w-[360px] flex flex-col h-full">
      <div class="shrink-0 border-b bg-muted/30">
        <Table no-scroll class="pinia-table">
          <TableHeader class="[&_th]:h-10 [&_th]:px-2">
            <TableRow class="hover:bg-transparent">
              <TableHead class="pinia-cell-star" />
              <TableHead class="text-xs font-semibold">Name</TableHead>
              <TableHead v-if="columns.state" class="pinia-cell-state text-xs font-semibold text-center">State</TableHead>
              <TableHead v-if="columns.getters" class="pinia-cell-getters text-xs font-semibold text-center">Getters</TableHead>
              <TableHead class="pinia-cell-actions">
                <div class="flex justify-center">
                  <TableColumnSelector
                    :columns="{ ...columns }"
                    :column-definitions="piniaColumnDefs"
                    @update:column="(k, v) => setColumn(k as keyof PiniaTableColumnsSettings, v)"
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      
      <ScrollArea class="flex-1 min-h-0 pinia-scroll-area">
        <div class="pinia-scroll-content">
        <div v-if="entries.length === 0 && !isLoading" class="pinia-empty-container">
          No stores found
        </div>
        <Table v-else no-scroll class="pinia-table">
        <TableBody>
          <ContextMenu v-for="store in entries" :key="store.id">
            <ContextMenuTrigger as-child>
              <TableRow
                class="cursor-pointer transition-colors"
                :class="{
                  'bg-muted': selectedId === store.id,
                  'hover:bg-accent': selectedId !== store.id
                }"
                @click="handleRowClick(store)"
              >
                <TableCell class="pinia-cell-star py-2">
                  <div class="star-cell">
                    <button
                      class="star-btn"
                      :class="{ 'star-visible': isFavorite(store), 'star-favorite': isFavorite(store) }"
                      :title="isFavorite(store) ? 'Remove from favorites' : 'Add to favorites'"
                      @click="handleToggleFavorite($event, store)"
                    >
                      <Star
                        class="h-3.5 w-3.5"
                        :class="isFavorite(store) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'"
                      />
                    </button>
                  </div>
                </TableCell>
                <TableCell class="py-2 max-w-0">
                  <div class="truncate text-sm font-medium" :title="store.baseId">
                    {{ store.baseId || 'Unknown Store' }}
                  </div>
                </TableCell>
                
                <TableCell v-if="columns.state" class="pinia-cell-state py-2 text-center">
                  <Badge 
                    v-if="hasStateKeys(store)"
                    variant="outline" 
                    class="text-xs font-mono"
                  >
                    {{ store.stateKeys }}
                  </Badge>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>
                
                <TableCell v-if="columns.getters" class="pinia-cell-getters py-2 text-center">
                  <Badge 
                    v-if="hasGetterKeys(store)"
                    variant="secondary" 
                    class="text-xs font-mono"
                  >
                    {{ store.getterKeys }}
                  </Badge>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>

                <TableCell class="pinia-cell-actions py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <PiniaTableActionsMenuContent
                      variant="dropdown"
                      :store="store"
                      :is-favorite="isFavorite(store)"
                      @toggle-favorite="handleToggleFavorite"
                    />
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </ContextMenuTrigger>

            <PiniaTableActionsMenuContent
              variant="context"
              :store="store"
              :is-favorite="isFavorite(store)"
              @toggle-favorite="handleToggleFavorite"
            />
          </ContextMenu>
          
          <template v-if="isLoading && entries.length === 0">
            <TableRow v-for="i in skeletonRowCount" :key="`skeleton-${i}`">
              <TableCell class="pinia-cell-star py-2">
                <Skeleton class="h-3.5 w-3.5 rounded mx-auto" />
              </TableCell>
              <TableCell class="py-2">
                <Skeleton class="h-4 w-32" />
              </TableCell>
              <TableCell v-if="columns.state" class="pinia-cell-state py-2 text-center">
                <Skeleton class="h-5 w-8 mx-auto" />
              </TableCell>
              <TableCell v-if="columns.getters" class="pinia-cell-getters py-2 text-center">
                <Skeleton class="h-5 w-8 mx-auto" />
              </TableCell>
              <TableCell class="pinia-cell-actions py-2">
                <Skeleton class="h-6 w-6 rounded mx-auto" />
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>

<style scoped>
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

/* Star column - align like Props (8px padding to match header/row) */
.pinia-cell-star {
  width: 40px;
  padding-left: 8px !important;
  padding-right: 4px !important;
}

.star-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* State / Getters - align with Props Passed/Declared (56px) */
.pinia-cell-state,
.pinia-cell-getters {
  width: 56px;
  min-width: 56px;
  text-align: center;
}

.pinia-cell-actions {
  width: 44px;
  min-width: 44px;
  text-align: center;
}

/* Ensure header and body tables have same column widths - reserve scrollbar space */
.pinia-scroll-area :deep([data-reka-scroll-area-viewport]) {
  scrollbar-gutter: stable;
}

.pinia-scroll-area :deep([data-reka-scroll-area-viewport]),
.pinia-scroll-area :deep([data-reka-scroll-area-viewport] > *) {
  height: 100%;
}

/* Override TableCell default p-4 - use 8px to match header [&_th]:px-2 for alignment */
.pinia-table :deep(th),
.pinia-table :deep(td) {
  padding-left: 8px;
  padding-right: 8px;
}

.pinia-table :deep(.pinia-cell-star),
.pinia-table :deep(.pinia-cell-actions) {
  padding-right: 18px;
}

/* Scroll content wrapper - fills viewport for empty state centering */
.pinia-scroll-content {
  position: relative;
  min-height: 100%;
}

/* Empty state: fills container, centered in the middle */
.pinia-empty-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
}

/* Star button - hidden for non-favorites, visible for favorites */
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

.star-btn.star-favorite :deep(svg) {
  color: hsl(48 100% 50%);
  fill: hsl(48 100% 50%);
}
</style>
