<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/i18n'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { FavoriteItem, PropOverrideRule } from '@/types/inspector'
import { propOverridePathLabel } from '@/utils/propOverrides'
import { TableCell } from '@/components/ui/table'
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue'
import SettingsTableSection from '../components/SettingsTableSection.vue'
import type { TableColumn } from '../components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Power, Trash, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'blacklist' | 'favorite' | 'prop-override'; id: string }): void
  (e: 'edit', item: { type: 'prop-override'; id: string }): void
}>()

const { t } = useI18n()

// -------------------- SEARCH SETTINGS --------------------
type SearchKey = 'byName' | 'byRootElement' | 'byKey' | 'byValue'

const searchItems = computed(() => [
  { key: 'byName' as const, label: t('search.byComponent') },
  { key: 'byRootElement' as const, label: t('search.byRoot') },
  { key: 'byKey' as const, label: t('search.byKey') },
  { key: 'byValue' as const, label: t('search.byValue') },
])

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

const blacklistColumns = computed<TableColumn[]>(() => [
  { header: t('props.componentName') },
  { header: t('common.status'), width: '70px', class: 'text-center' },
])

function addToBlacklist() {
  const value = newBlockedName.value.trim()
  blacklistError.value = null

  if (!value) {
    blacklistError.value = t('props.nameEmpty')
    return
  }

  if (props.settings.blacklist.active.includes(value) || props.settings.blacklist.inactive.includes(value)) {
    blacklistError.value = t('props.nameExists')
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
    { label: row.active ? t('ai.allow') : t('props.block'), icon: Power, onClick: () => toggleBlacklist(row.name, row.active) },
    { label: t('general.delete'), icon: Trash, onClick: () => removeFromBlacklist(row.name), destructiveText: true },
  ]
}

// -------------------- FAVORITES --------------------
const favoritesList = computed<FavoriteItem[]>(() => props.settings.favorites || [])

const favoritesColumns = computed<TableColumn[]>(() => [
  { header: t('common.component') },
  { header: t('general.added'), width: '80px', class: 'text-center' },
])

function removeFromFavorites(id: string) {
  props.settings.favorites = props.settings.favorites.filter(f => f.id !== id)
}

function getFavoritesActions(fav: FavoriteItem): MenuAction[] {
  return [
    { label: t('general.delete'), icon: Trash, onClick: () => removeFromFavorites(fav.id), destructiveText: true },
  ]
}

// -------------------- PROP OVERRIDE RULES --------------------
const overrideRows = computed<PropOverrideRule[]>(() => props.settings.propOverrides || [])

const overrideColumns = computed<TableColumn[]>(() => [
  { header: t('common.component') },
  { header: t('props.overrideValues') },
  { header: t('common.status'), width: '70px', class: 'text-center' },
])

function overrideScopeLabel(rule: PropOverrideRule): string {
  const where = rule.scope === 'all' ? t('props.scopeAll', { name: rule.component }) : propOverridePathLabel(rule)
  const mode = rule.mode === 'part' ? t('props.savePart') : t('props.saveFull')
  return `${where} · ${mode}`
}

function toggleOverride(id: string) {
  const rule = props.settings.propOverrides.find(r => r.id === id)
  if (rule) rule.enabled = !rule.enabled
}

function removeOverride(id: string) {
  props.settings.propOverrides = props.settings.propOverrides.filter(r => r.id !== id)
}

function getOverrideActions(rule: PropOverrideRule): MenuAction[] {
  return [
    { label: t('general.edit'), icon: Pencil, onClick: () => emit('edit', { type: 'prop-override', id: rule.id }) },
    { label: rule.enabled ? t('common.disable') : t('common.enable'), icon: Power, onClick: () => toggleOverride(rule.id) },
    { label: t('general.delete'), icon: Trash, onClick: () => removeOverride(rule.id), destructiveText: true },
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
      <h4 class="text-sm font-semibold">{{ t('props.inspectMode') }}</h4>
      <div class="flex items-center space-x-3">
        <Checkbox
          id="props-collapse-overlay-inspect"
          :model-value="settings.collapseOverlayOnPropsInspect"
          :aria-label="t('props.hideOverlay')"
          @update:model-value="settings.collapseOverlayOnPropsInspect = $event as boolean"
        />
        <Label for="props-collapse-overlay-inspect" class="text-sm leading-snug cursor-pointer">
          {{ t('props.hideOverlay') }}
        </Label>
      </div>
    </div>

    <SettingsTableSection
      :title="t('props.blacklist')"
      :columns="blacklistColumns"
      :rows="blacklistRows"
      :row-key="(r) => (r as BlacklistRow).name"
      :get-actions="(row) => getBlacklistActions(row as BlacklistRow)"
      :empty-message="t('props.noBlacklist')"
      :selected-item-id="selectedItemId"
      show-add
      :add-placeholder="t('props.blacklistPh')"
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
            {{ (row as BlacklistRow).active ? t('props.blocked') : t('props.allowed') }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>

    <SettingsTableSection
      section-id="favorites-section"
      :title="t('props.favorites')"
      :columns="favoritesColumns"
      :rows="favoritesList"
      :row-key="(r) => (r as FavoriteItem).id"
      :get-actions="(row) => getFavoritesActions(row as FavoriteItem)"
      :empty-message="t('props.noFavorites')"
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

    <SettingsTableSection
      section-id="props-overrides-section"
      :title="t('props.overrides')"
      :description="t('props.overridesDesc')"
      :columns="overrideColumns"
      :rows="overrideRows"
      :row-key="(r) => (r as PropOverrideRule).id"
      :get-actions="(row) => getOverrideActions(row as PropOverrideRule)"
      :empty-message="t('props.noOverrides')"
      :selected-item-id="selectedItemId"
      @select="(row) => emit('select', { type: 'prop-override', id: (row as PropOverrideRule).id })"
    >
      <template #after-title>
        <div class="flex items-center gap-2">
          <Checkbox
            id="props-overrides-enabled"
            :aria-label="t('props.applyOverrides')"
            :model-value="settings.propOverridesEnabled !== false"
            @update:model-value="settings.propOverridesEnabled = !!$event"
          />
          <Label for="props-overrides-enabled" class="text-sm font-normal cursor-pointer">
            {{ t('props.applyOverrides') }}
          </Label>
        </div>
      </template>
      <template #row="{ row }">
        <TableCell class="overflow-hidden !py-2">
          <div :class="!(row as PropOverrideRule).enabled ? 'opacity-50' : ''">
            <div class="font-mono text-sm truncate">{{ (row as PropOverrideRule).component }}</div>
            <div class="text-xs text-muted-foreground mt-0.5 truncate" :title="overrideScopeLabel(row as PropOverrideRule)">
              {{ (row as PropOverrideRule).host }} · {{ overrideScopeLabel(row as PropOverrideRule) }}
            </div>
          </div>
        </TableCell>
        <TableCell class="overflow-hidden !py-2">
          <div
            :class="!(row as PropOverrideRule).enabled ? 'opacity-50' : ''"
            class="font-mono text-xs truncate"
            :title="Object.keys((row as PropOverrideRule).props).join(', ')"
          >
            {{ Object.keys((row as PropOverrideRule).props).join(', ') }}
          </div>
        </TableCell>
        <TableCell class="w-[70px] text-center !py-2">
          <div :class="!(row as PropOverrideRule).enabled ? 'opacity-50' : ''" class="text-xs">
            {{ (row as PropOverrideRule).enabled ? t('common.active') : t('details.disabled') }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>
  </div>
</template>
