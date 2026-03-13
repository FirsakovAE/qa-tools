<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { PiniaFavoriteItem } from '@/types/inspector'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { MoreHorizontal, Trash, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'pinia-favorite'; id: string }): void
  (e: 'edit', item: { type: 'pinia-favorite'; id: string }): void
}>()

// -------------------- ADD BY NAME --------------------
const newStoreName = ref('')
const addStoreError = ref<string | null>(null)

function addToFavoritesByName() {
  const value = newStoreName.value.trim()
  addStoreError.value = null

  if (!value) {
    addStoreError.value = 'Name cannot be empty'
    return
  }

  const exists = props.settings.piniaFavorites.some(f => f.id === value || f.name === value)
  if (exists) {
    addStoreError.value = 'This store is already in favorites'
    return
  }

  props.settings.piniaFavorites.push({
    id: value,
    name: value,
    timestamp: new Date().toISOString()
  })
  newStoreName.value = ''
}

type SearchKey = 'byName' | 'byKey' | 'byValue'

const searchItems: Array<{ key: SearchKey; label: string }> = [
  { key: 'byName', label: 'Search by store name' },
  { key: 'byKey', label: 'Search by key' },
  { key: 'byValue', label: 'Search by value' },
]

function toggleSearch(key: SearchKey) {
  props.settings.piniaSearch[key] = !props.settings.piniaSearch[key]
}

// -------------------- FAVORITES --------------------
const piniaFavoritesList = computed<PiniaFavoriteItem[]>(() => props.settings.piniaFavorites || [])

function removeFromFavorites(id: string) {
  props.settings.piniaFavorites = props.settings.piniaFavorites.filter(f => f.id !== id)
}

const favoritesTableHeight = computed(() => {
  const rowCount = Math.max(piniaFavoritesList.value.length, 1)
  return Math.min(rowCount * 41, 205)
})
const favoritesNeedsScroll = computed(() => piniaFavoritesList.value.length > 4)
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

    <!-- Favorite Stores -->
    <div id="pinia-favorites-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Favorite Stores</h4>

      <div class="flex gap-2">
        <Input
          v-model="newStoreName"
          placeholder="Store name (supports wildcards: *Store*)"
          @keydown.enter.prevent="addToFavoritesByName"
          :aria-invalid="!!addStoreError"
          class="flex-1 h-8"
        />
        <Button size="sm" @click="addToFavoritesByName" class="h-8">Add</Button>
      </div>

      <p v-if="addStoreError" class="text-sm text-destructive_text">{{ addStoreError }}</p>

      <div class="flex flex-col border rounded-lg overflow-hidden">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Store Name</TableHead>
                <TableHead class="text-xs font-semibold w-[80px] text-center">Added</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <div class="min-h-0 max-h-[205px] overflow-hidden">
          <template v-if="favoritesNeedsScroll">
            <ScrollArea :style="{ height: `${favoritesTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="fav in piniaFavoritesList" :key="fav.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="{ 'bg-muted': selectedItemId === fav.id }"
                        @click="emit('select', { type: 'pinia-favorite', id: fav.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div class="font-mono text-sm truncate">{{ fav.name }}</div>
                        </TableCell>
                        <TableCell class="w-[80px] text-center !py-2">
                          <div class="text-xs text-muted-foreground">
                            {{ new Date(fav.timestamp).toLocaleDateString() }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[48px] text-center p-0">
                          <div class="flex justify-center items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" class="w-44">
                                <DropdownMenuItem @click.stop="emit('edit', { type: 'pinia-favorite', id: fav.id })">
                                  <Pencil class="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem class="text-destructive_text" @click.stop="removeFromFavorites(fav.id)">
                                  <Trash class="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent class="w-44">
                      <ContextMenuItem @click="emit('edit', { type: 'pinia-favorite', id: fav.id })">
                        <Pencil class="h-4 w-4 mr-2" />
                        Edit
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem class="text-destructive_text" @click="removeFromFavorites(fav.id)">
                        <Trash class="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <TableRow v-if="!piniaFavoritesList.length">
                    <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                      No favorite stores
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </template>
          <template v-else>
            <Table class="table-fixed">
              <TableBody>
                <ContextMenu v-for="fav in piniaFavoritesList" :key="fav.id">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="{ 'bg-muted': selectedItemId === fav.id }"
                      @click="emit('select', { type: 'pinia-favorite', id: fav.id })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div class="font-mono text-sm truncate">{{ fav.name }}</div>
                      </TableCell>
                      <TableCell class="w-[80px] text-center !py-2">
                        <div class="text-xs text-muted-foreground">
                          {{ new Date(fav.timestamp).toLocaleDateString() }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[48px] text-center p-0">
                        <div class="flex justify-center items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                <MoreHorizontal class="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-44">
                              <DropdownMenuItem @click.stop="emit('edit', { type: 'pinia-favorite', id: fav.id })">
                                <Pencil class="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem class="text-destructive_text" @click.stop="removeFromFavorites(fav.id)">
                                <Trash class="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent class="w-44">
                    <ContextMenuItem @click="emit('edit', { type: 'pinia-favorite', id: fav.id })">
                      <Pencil class="h-4 w-4 mr-2" />
                      Edit
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem class="text-destructive_text" @click="removeFromFavorites(fav.id)">
                      <Trash class="h-4 w-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <TableRow v-if="!piniaFavoritesList.length">
                  <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                    No favorite stores
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
