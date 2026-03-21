<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { FavoriteItem } from '@/types/inspector'
import { TableCell } from '@/components/ui/table'
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue'
import SettingsTableSection from '../components/SettingsTableSection.vue'
import type { TableColumn } from '../components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Power, Trash } from 'lucide-vue-next'

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

const blacklistColumns: TableColumn[] = [
  { header: 'Component Name' },
  { header: 'Status', width: '70px', class: 'text-center' },
]

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

const favoritesColumns: TableColumn[] = [
  { header: 'Component' },
  { header: 'Added', width: '80px', class: 'text-center' },
]

function removeFromFavorites(id: string) {
  props.settings.favorites = props.settings.favorites.filter(f => f.id !== id)
}

function getFavoritesActions(fav: FavoriteItem): MenuAction[] {
  return [
    { label: 'Delete', icon: Trash, onClick: () => removeFromFavorites(fav.id), destructive: true },
  ]
}
</script>

<template>
  <div class="space-y-6">
    <SearchSettingsBlock
      :search-settings="settings.propsSearch as unknown as Record<string, boolean>"
      :search-items="searchItems"
      id-prefix="props-search"
      @toggle="(k) => toggleSearch(k as SearchKey)"
    />

    <div class="space-y-4 border-t border-border pt-4">
      <h4 class="text-sm font-semibold">Inspect Mode</h4>
      <div class="flex items-center space-x-3">
        <Checkbox
          id="props-collapse-overlay-inspect"
          :model-value="settings.collapseOverlayOnPropsInspect"
          @update:model-value="settings.collapseOverlayOnPropsInspect = $event as boolean"
        />
        <Label for="props-collapse-overlay-inspect" class="text-sm leading-snug cursor-pointer">
          Hide overlay while inspecting
        </Label>
      </div>
    </div>

    <SettingsTableSection
      title="Component Blacklist"
      :columns="blacklistColumns"
      :rows="blacklistRows"
      :row-key="(r) => (r as BlacklistRow).name"
      :get-actions="(row) => getBlacklistActions(row as BlacklistRow)"
      empty-message="No components in blacklist"
      :selected-item-id="selectedItemId"
      show-add
      add-placeholder="Component name (supports wildcards: *Comp*)"
      v-model:add-model-value="newBlockedName"
      :add-error="blacklistError"
      @add="addToBlacklist"
      @select="(row) => emit('select', { type: 'blacklist', id: (row as BlacklistRow).name })"
    >
      <template #row="{ row }">
        <TableCell class="overflow-hidden !py-2">
          <div :class="!(row as BlacklistRow).active ? 'opacity-50' : ''" class="font-mono text-sm truncate">
            {{ (row as BlacklistRow).name }}
          </div>
        </TableCell>
        <TableCell class="w-[70px] text-center !py-2">
          <div :class="!(row as BlacklistRow).active ? 'opacity-50' : ''" class="text-xs">
            {{ (row as BlacklistRow).active ? 'Blocked' : 'Allowed' }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>

    <SettingsTableSection
      section-id="favorites-section"
      title="Favorite Components"
      :columns="favoritesColumns"
      :rows="favoritesList"
      :row-key="(r) => (r as FavoriteItem).id"
      :get-actions="(row) => getFavoritesActions(row as FavoriteItem)"
      empty-message="No favorite components"
      :selected-item-id="selectedItemId"
      @select="(row) => emit('select', { type: 'favorite', id: (row as FavoriteItem).id })"
    >
      <template #row="{ row }">
        <TableCell class="overflow-hidden !py-2">
          <div class="font-mono text-sm truncate">{{ (row as FavoriteItem).name }}</div>
          <div class="text-xs text-muted-foreground mt-0.5 font-mono truncate">
            {{ (row as FavoriteItem).tagName }}{{ (row as FavoriteItem).className ? '.' + (row as FavoriteItem).className : '' }}
          </div>
        </TableCell>
        <TableCell class="w-[80px] text-center !py-2">
          <div class="text-xs text-muted-foreground">
            {{ new Date((row as FavoriteItem).timestamp).toLocaleDateString() }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>
  </div>
</template>
