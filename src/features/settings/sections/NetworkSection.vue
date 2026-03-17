<script setup lang="ts">
import { computed } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import { TableCell } from '@/components/ui/table'
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue'
import SettingsTableSection from '../components/SettingsTableSection.vue'
import type { TableColumn } from '../components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { Power, Trash, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'breakpoint' | 'mock'; id: string }): void
  (e: 'edit-breakpoint', id: string): void
  (e: 'edit-mock', id: string): void
}>()

// -------------------- SEARCH SETTINGS --------------------
type SearchKey = 'byPath' | 'byMethod' | 'byStatus' | 'byKey' | 'byValue'

const searchItems: Array<{ key: SearchKey; label: string }> = [
  { key: 'byPath', label: 'Search by path' },
  { key: 'byMethod', label: 'Search by method' },
  { key: 'byStatus', label: 'Search by status code' },
  { key: 'byKey', label: 'Search by key' },
  { key: 'byValue', label: 'Search by value' },
]

function toggleSearch(key: SearchKey) {
  props.settings.networkSearch[key] = !props.settings.networkSearch[key]
}

// -------------------- BREAKPOINTS --------------------
type BreakpointRow = BreakpointItem & { active: boolean }

const breakpointRows = computed<BreakpointRow[]>(() => {
  if (!props.settings.breakpoints) return []
  return [
    ...props.settings.breakpoints.active.map(bp => ({ ...bp, active: true })),
    ...props.settings.breakpoints.inactive.map(bp => ({ ...bp, active: false })),
  ]
})

const breakpointColumns: TableColumn[] = [
  { header: 'Description' },
  { header: 'Status', width: '70px', class: 'text-center' },
]

function toggleBreakpoint(breakpointId: string, currentlyActive: boolean) {
  const bps = props.settings.breakpoints
  const from = currentlyActive ? bps.active : bps.inactive
  const to = currentlyActive ? bps.inactive : bps.active
  const index = from.findIndex(bp => bp.id === breakpointId)
  if (index !== -1) {
    const [bp] = from.splice(index, 1)
    to.push(bp)
  }
}

function removeBreakpoint(breakpointId: string) {
  props.settings.breakpoints.active = props.settings.breakpoints.active.filter(bp => bp.id !== breakpointId)
  props.settings.breakpoints.inactive = props.settings.breakpoints.inactive.filter(bp => bp.id !== breakpointId)
}

function formatBreakpointUrl(bp: BreakpointItem): string {
  let url = `${bp.scheme}://${bp.host}`
  if (bp.port) url += `:${bp.port}`
  url += bp.path
  if (bp.query) url += `?${bp.query}`
  return url
}

function getBreakpointActions(row: BreakpointRow): MenuAction[] {
  return [
    { label: 'Edit', icon: Pencil, onClick: () => emit('edit-breakpoint', row.id) },
    { label: row.active ? 'Disable' : 'Enable', icon: Power, onClick: () => toggleBreakpoint(row.id, row.active) },
    { label: 'Delete', icon: Trash, onClick: () => removeBreakpoint(row.id), destructive: true },
  ]
}

// -------------------- MOCKS --------------------
type MockRow = MockRule & { active: boolean }

const mockRows = computed<MockRow[]>(() => {
  if (!props.settings.mocks) return []
  return [
    ...props.settings.mocks.active.map(m => ({ ...m, active: true })),
    ...props.settings.mocks.inactive.map(m => ({ ...m, active: false })),
  ]
})

const mockColumns: TableColumn[] = [
  { header: 'Description' },
  { header: 'Code', width: '60px', class: 'text-center' },
  { header: 'Delay', width: '60px', class: 'text-center' },
  { header: 'Status', width: '60px', class: 'text-center' },
]

function toggleMock(mockId: string, currentlyActive: boolean) {
  const mocks = props.settings.mocks
  const from = currentlyActive ? mocks.active : mocks.inactive
  const to = currentlyActive ? mocks.inactive : mocks.active
  const index = from.findIndex(m => m.id === mockId)
  if (index !== -1) {
    const [mock] = from.splice(index, 1)
    to.push(mock)
  }
}

function removeMock(mockId: string) {
  props.settings.mocks.active = props.settings.mocks.active.filter(m => m.id !== mockId)
  props.settings.mocks.inactive = props.settings.mocks.inactive.filter(m => m.id !== mockId)
}

function formatMockUrl(mock: MockRule): string {
  let url = ''
  if (mock.method) url += `${mock.method} `
  url += `${mock.scheme || '*'}://${mock.host || '*'}`
  if (mock.port) url += `:${mock.port}`
  url += mock.path || '/*'
  if (mock.query) url += `?${mock.query}`
  return url
}

function getMockActions(row: MockRow): MenuAction[] {
  return [
    { label: 'Edit', icon: Pencil, onClick: () => emit('edit-mock', row.id) },
    { label: row.active ? 'Disable' : 'Enable', icon: Power, onClick: () => toggleMock(row.id, row.active) },
    { label: 'Delete', icon: Trash, onClick: () => removeMock(row.id), destructive: true },
  ]
}
</script>

<template>
  <div class="space-y-6">
    <SearchSettingsBlock
      :search-settings="settings.networkSearch as unknown as Record<string, boolean>"
      :search-items="searchItems"
      id-prefix="network-search"
      @toggle="(k) => toggleSearch(k as SearchKey)"
    />

    <SettingsTableSection
      section-id="breakpoints-section"
      title="Breakpoints Requests"
      description="Network requests matching these patterns will be paused for inspection."
      :columns="breakpointColumns"
      :rows="breakpointRows"
      :row-key="(r) => (r as BreakpointRow).id"
      :get-actions="(row) => getBreakpointActions(row as BreakpointRow)"
      empty-message="No breakpoints configured. Set breakpoints from the Network tab."
      :selected-item-id="selectedItemId"
      @select="(row) => emit('select', { type: 'breakpoint', id: (row as BreakpointRow).id })"
    >
      <template #row="{ row }">
        <TableCell class="overflow-hidden !py-2">
          <div
            :class="!(row as BreakpointRow).active ? 'opacity-50' : ''"
            class="text-sm truncate"
            :title="(row as BreakpointRow).description || formatBreakpointUrl(row as BreakpointItem)"
          >
            {{ (row as BreakpointRow).description || formatBreakpointUrl(row as BreakpointItem) }}
          </div>
        </TableCell>
        <TableCell class="w-[70px] text-center !py-2">
          <div :class="!(row as BreakpointRow).active ? 'opacity-50' : ''" class="text-xs">
            {{ (row as BreakpointRow).active ? 'Active' : 'Off' }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>

    <SettingsTableSection
      section-id="mocks-section"
      title="Mocks Responses"
      description="Matching requests will return fake responses without hitting the network."
      :columns="mockColumns"
      :rows="mockRows"
      :row-key="(r) => (r as MockRow).id"
      :get-actions="(row) => getMockActions(row as MockRow)"
      empty-message="No mocks configured. Click &quot;Mock Response&quot; on any request in the Network tab."
      :selected-item-id="selectedItemId"
      @select="(row) => emit('select', { type: 'mock', id: (row as MockRow).id })"
    >
      <template #row="{ row }">
        <TableCell class="overflow-hidden !py-2">
          <div
            :class="!(row as MockRow).active ? 'opacity-50' : ''"
            class="text-sm truncate"
            :title="(row as MockRow).description || formatMockUrl(row as MockRule)"
          >
            {{ (row as MockRow).description || formatMockUrl(row as MockRule) }}
          </div>
        </TableCell>
        <TableCell class="w-[60px] text-center !py-2">
          <div
            :class="[
              !(row as MockRow).active ? 'opacity-50' : '',
              'text-xs font-mono',
              (row as MockRow).status >= 200 && (row as MockRow).status < 300 ? 'text-green-500' : '',
              (row as MockRow).status >= 400 && (row as MockRow).status < 500 ? 'text-orange-500' : '',
              (row as MockRow).status >= 500 ? 'text-red-500' : ''
            ]"
          >
            {{ (row as MockRow).status }}
          </div>
        </TableCell>
        <TableCell class="w-[60px] text-center !py-2">
          <div :class="!(row as MockRow).active ? 'opacity-50' : ''" class="text-xs text-muted-foreground">
            {{ (row as MockRow).delay ? `${(row as MockRow).delay}ms` : '-' }}
          </div>
        </TableCell>
        <TableCell class="w-[60px] text-center !py-2">
          <div :class="!(row as MockRow).active ? 'opacity-50' : ''" class="text-xs">
            {{ (row as MockRow).active ? 'Active' : 'Off' }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>
  </div>
</template>
