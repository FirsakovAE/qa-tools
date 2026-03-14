<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { FavoriteItem } from '@/types/inspector'
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
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { OptionsItemActionsMenuContent, type MenuAction } from '@/components/OptionsItemActionsMenu'
import { MoreHorizontal, Power, Trash } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'blacklist' | 'favorite'; id: string }): void
}>()

// -------------------- SEARCH SETTINGS --------------------
type SearchKey = 'byName' | 'byLabel' | 'byRootElement' | 'byKey' | 'byValue'

const searchItems: Array<{ key: SearchKey; label: string }> = [
  { key: 'byName', label: 'Search by component name' },
  { key: 'byLabel', label: 'Search by component label' },
  { key: 'byRootElement', label: 'Search by root element' },
  { key: 'byKey', label: 'Search by key' },
  { key: 'byValue', label: 'Search by value' },
]

function toggleSearch(key: SearchKey) {
  props.settings.propsSearch[key] = !props.settings.propsSearch[key]
}

// -------------------- BLACKLIST --------------------
type BlacklistRow = { name: string; active: boolean }
const newBlockedName = ref('')
const blacklistError = ref<string | null>(null)

const blacklistRows = computed<BlacklistRow[]>(() => {
  return [
    ...props.settings.blacklist.active.map(name => ({ name, active: true })),
    ...props.settings.blacklist.inactive.map(name => ({ name, active: false })),
  ]
})

function addToBlacklist() {
  const value = newBlockedName.value.trim()
  blacklistError.value = null

  if (!value) {
    blacklistError.value = 'Name cannot be empty'
    return
  }

  if (props.settings.blacklist.active.includes(value) || props.settings.blacklist.inactive.includes(value)) {
    blacklistError.value = 'This name is already in the blacklist'
    return
  }

  props.settings.blacklist.active.push(value)
  newBlockedName.value = ''
}

function toggleBlacklist(name: string, active: boolean) {
  const from = active ? props.settings.blacklist.active : props.settings.blacklist.inactive
  const to = active ? props.settings.blacklist.inactive : props.settings.blacklist.active
  const index = from.indexOf(name)
  if (index !== -1) { from.splice(index, 1); to.push(name) }
}

function removeFromBlacklist(name: string) {
  props.settings.blacklist.active = props.settings.blacklist.active.filter(n => n !== name)
  props.settings.blacklist.inactive = props.settings.blacklist.inactive.filter(n => n !== name)
}

function getBlacklistActions(row: BlacklistRow): MenuAction[] {
  return [
    { label: row.active ? 'Allow' : 'Block', icon: Power, onClick: () => toggleBlacklist(row.name, row.active) },
    { label: 'Delete', icon: Trash, onClick: () => removeFromBlacklist(row.name), destructive: true },
  ]
}

// -------------------- FAVORITES --------------------
const favoritesList = computed<FavoriteItem[]>(() => props.settings.favorites || [])

function removeFromFavorites(id: string) {
  props.settings.favorites = props.settings.favorites.filter(f => f.id !== id)
}

function getFavoritesActions(fav: FavoriteItem): MenuAction[] {
  return [
    { label: 'Delete', icon: Trash, onClick: () => removeFromFavorites(fav.id), destructive: true },
  ]
}

const blacklistTableHeight = computed(() => {
  const rowCount = Math.max(blacklistRows.value.length, 1)
  return Math.min(rowCount * 41, 205)
})
const blacklistNeedsScroll = computed(() => blacklistRows.value.length > 4)

const favoritesTableHeight = computed(() => {
  const rowCount = Math.max(favoritesList.value.length, 1)
  return Math.min(rowCount * 41, 205)
})
const favoritesNeedsScroll = computed(() => favoritesList.value.length > 4)
</script>

<template>
  <div class="space-y-6">
    <!-- Search Settings -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">Search Settings</h4>
      <div class="grid grid-cols-1 gap-2">
        <div v-for="item in searchItems" :key="item.key" class="flex items-center space-x-3">
          <Checkbox
            :id="`props-search-${item.key}`"
            :model-value="settings.propsSearch[item.key]"
            @update:model-value="toggleSearch(item.key)"
          />
          <Label :for="`props-search-${item.key}`" class="text-sm">
            {{ item.label }}
          </Label>
        </div>
      </div>
    </div>

    <!-- Component Blacklist -->
    <div class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Component Blacklist</h4>

      <div class="flex gap-2">
        <Input
          v-model="newBlockedName"
          placeholder="Component name (supports wildcards: *Comp*)"
          @keydown.enter.prevent="addToBlacklist"
          :aria-invalid="!!blacklistError"
          class="flex-1 h-8"
        />
        <Button size="sm" @click="addToBlacklist" class="h-8">Add</Button>
      </div>

      <p v-if="blacklistError" class="text-sm text-destructive_text">{{ blacklistError }}</p>

      <div class="flex flex-col border rounded-lg overflow-hidden">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader class="[&_th]:h-10">
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Component Name</TableHead>
                <TableHead class="text-xs font-semibold w-[70px] text-center">Status</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <div class="min-h-0 max-h-[205px] overflow-hidden">
          <template v-if="blacklistNeedsScroll">
            <ScrollArea :style="{ height: `${blacklistTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="row in blacklistRows" :key="row.name">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="{ 'bg-muted': selectedItemId === row.name }"
                        @click="emit('select', { type: 'blacklist', id: row.name })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm truncate">
                            {{ row.name }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[70px] text-center !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                            {{ row.active ? 'Blocked' : 'Allowed' }}
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
                              <OptionsItemActionsMenuContent
                                variant="dropdown"
                                :actions="getBlacklistActions(row)"
                              />
                          </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getBlacklistActions(row)"
                    />
                  </ContextMenu>

                  <TableRow v-if="!blacklistRows.length">
                    <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                      No components in blacklist
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </template>
          <template v-else>
            <Table class="table-fixed">
              <TableBody>
                <ContextMenu v-for="row in blacklistRows" :key="row.name">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="{ 'bg-muted': selectedItemId === row.name }"
                      @click="emit('select', { type: 'blacklist', id: row.name })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm truncate">
                          {{ row.name }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[70px] text-center !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                          {{ row.active ? 'Blocked' : 'Allowed' }}
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
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getBlacklistActions(row)"
                            />
                        </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <OptionsItemActionsMenuContent
                    variant="context"
                    :actions="getBlacklistActions(row)"
                  />
                </ContextMenu>
                <TableRow v-if="!blacklistRows.length">
                  <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                    No components in blacklist
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>
        </div>
      </div>
    </div>

    <!-- Favorite Components -->
    <div id="favorites-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Favorite Components</h4>

      <div class="flex flex-col border rounded-lg overflow-hidden">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader class="[&_th]:h-10">
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Component</TableHead>
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
                  <ContextMenu v-for="fav in favoritesList" :key="fav.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="{ 'bg-muted': selectedItemId === fav.id }"
                        @click="emit('select', { type: 'favorite', id: fav.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div class="font-mono text-sm truncate">{{ fav.name }}</div>
                          <div class="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                            {{ fav.tagName }}{{ fav.className ? '.' + fav.className : '' }}
                          </div>
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
                              <OptionsItemActionsMenuContent
                                variant="dropdown"
                                :actions="getFavoritesActions(fav)"
                              />
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getFavoritesActions(fav)"
                    />
                  </ContextMenu>

                  <TableRow v-if="!favoritesList.length">
                    <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                      No favorite components
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </template>
          <template v-else>
            <Table class="table-fixed">
              <TableBody>
                <ContextMenu v-for="fav in favoritesList" :key="fav.id">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="{ 'bg-muted': selectedItemId === fav.id }"
                      @click="emit('select', { type: 'favorite', id: fav.id })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div class="font-mono text-sm truncate">{{ fav.name }}</div>
                        <div class="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                          {{ fav.tagName }}{{ fav.className ? '.' + fav.className : '' }}
                        </div>
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
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getFavoritesActions(fav)"
                            />
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getFavoritesActions(fav)"
                    />
                  </ContextMenu>
                  <TableRow v-if="!favoritesList.length">
                  <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                    No favorite components
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
