<script setup lang="ts">
import { computed } from 'vue'
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
import { Star, StarOff, MoreHorizontal } from 'lucide-vue-next'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import type { PiniaFavoriteItem } from '@/types/inspector'
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
</script>

<template>
  <div class="h-full flex flex-col border rounded-lg overflow-hidden table-scroll-x">
    <div class="min-w-[360px] flex flex-col h-full">
      <div class="shrink-0 border-b bg-muted/30">
        <Table no-scroll>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="pinia-cell-star pl-4" />
              <TableHead class="text-xs font-semibold">Name</TableHead>
              <TableHead class="w-[120px] text-xs font-semibold">State</TableHead>
              <TableHead class="w-[80px] text-xs font-semibold text-center">Getters</TableHead>
              <TableHead class="pinia-cell-actions w-[48px] p-0" />
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      
      <ScrollArea class="flex-1 min-h-0">
        <Table no-scroll>
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
                
                <TableCell class="w-[120px] py-2">
                  <Badge 
                    v-if="hasStateKeys(store)"
                    variant="secondary" 
                    class="text-xs font-mono"
                  >
                    {{ store.stateKeys }}
                  </Badge>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>
                
                <TableCell class="w-[80px] py-2 text-center">
                  <Badge 
                    v-if="hasGetterKeys(store)"
                    variant="outline" 
                    class="text-xs font-mono"
                  >
                    {{ store.getterKeys }}
                  </Badge>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>

                <TableCell class="pinia-cell-actions w-[48px] py-2 px-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem @click.stop="handleToggleFavorite($event, store)">
                        <StarOff v-if="isFavorite(store)" class="h-4 w-4 mr-2" />
                        <Star v-else class="h-4 w-4 mr-2" />
                        {{ isFavorite(store) ? 'Remove favorite' : 'Add favorite' }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </ContextMenuTrigger>

            <ContextMenuContent class="w-44">
              <ContextMenuItem @click="handleToggleFavorite($event, store)">
                <StarOff v-if="isFavorite(store)" class="h-4 w-4 mr-2" />
                <Star v-else class="h-4 w-4 mr-2" />
                {{ isFavorite(store) ? 'Remove favorite' : 'Add favorite' }}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          
          <TableRow v-if="entries.length === 0">
            <TableCell colspan="5" class="h-32 text-center text-muted-foreground">
              No stores found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </ScrollArea>
    </div>
  </div>
</template>

<style scoped>
.table-scroll-x {
  overflow-x: auto;
  overflow-y: hidden;
}

/* Uikit-style scrollbar for horizontal scroll */
.table-scroll-x {
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

/* Star column - align like Props */
.pinia-cell-star {
  width: 40px;
  padding-left: 16px;
  padding-right: 4px;
}

.star-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.pinia-cell-actions {
  text-align: center;
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
