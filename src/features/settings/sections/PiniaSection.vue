<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { PiniaFavoriteItem } from '@/types/inspector'
import { TableCell } from '@/components/ui/table'
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue'
import SettingsTableSection from '../components/SettingsTableSection.vue'
import type { TableColumn } from '../components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { Pencil, Trash } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'pinia-favorite'; id: string }): void
  (e: 'edit', item: { type: 'pinia-favorite'; id: string }): void
}>()

// -------------------- SEARCH SETTINGS --------------------
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
const newStoreName = ref('')
const addStoreError = ref<string | null>(null)

const piniaFavoritesList = computed<PiniaFavoriteItem[]>(() => props.settings.piniaFavorites || [])

const favoritesColumns: TableColumn[] = [
  { header: 'Store Name' },
  { header: 'Added', width: '80px', class: 'text-center' },
]

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

function removeFromFavorites(id: string) {
  props.settings.piniaFavorites = props.settings.piniaFavorites.filter(f => f.id !== id)
}

function getPiniaFavoriteActions(fav: PiniaFavoriteItem): MenuAction[] {
  return [
    { label: 'Edit', icon: Pencil, onClick: () => emit('edit', { type: 'pinia-favorite', id: fav.id }) },
    { label: 'Delete', icon: Trash, onClick: () => removeFromFavorites(fav.id), destructiveText: true },
  ]
}
</script>

<template>
  <div class="space-y-6">
    <SearchSettingsBlock
      :search-settings="settings.piniaSearch as unknown as Record<string, boolean>"
      :search-items="searchItems"
      id-prefix="pinia-search"
      @toggle="(k) => toggleSearch(k as SearchKey)"
    />

    <SettingsTableSection
      section-id="pinia-favorites-section"
      title="Favorite Stores"
      :columns="favoritesColumns"
      :rows="piniaFavoritesList"
      :row-key="(r) => (r as PiniaFavoriteItem).id"
      :get-actions="(row) => getPiniaFavoriteActions(row as PiniaFavoriteItem)"
      empty-message="No favorite stores"
      :selected-item-id="selectedItemId"
      show-add
      add-placeholder="Store name (supports wildcards: *Store*)"
      v-model:add-model-value="newStoreName"
      :add-error="addStoreError"
      @add="addToFavoritesByName"
      @select="(row) => emit('select', { type: 'pinia-favorite', id: (row as PiniaFavoriteItem).id })"
    >
      <template #row="{ row }">
        <TableCell class="overflow-hidden !py-2">
          <div class="font-mono text-sm truncate">{{ (row as PiniaFavoriteItem).name }}</div>
        </TableCell>
        <TableCell class="w-[80px] text-center !py-2">
          <div class="text-xs text-muted-foreground">
            {{ new Date((row as PiniaFavoriteItem).timestamp).toLocaleDateString() }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>
  </div>
</template>
