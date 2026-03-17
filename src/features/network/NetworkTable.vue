<script setup lang="ts">
import { computed } from 'vue'
import VirtualTable from '@/components/VirtualTable.vue'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { NetworkActionsMenuContent } from '@/components/NetworkActionsMenu'
import { MoreHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { TableColumnSelector } from '@/components/ui/TableColumnSelector'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { defaultInspectorSettings } from '@/settings/inspectorSettings'
import type { NetworkEntry } from '@/types/network'
import type { NetworkTableColumnsSettings } from '@/types/inspector'
import type { BreakpointWithStatus, MockWithStatus } from '@/types/inspector'
import { formatBytes, formatDuration } from '@/types/network'
import { getStatusClass } from './utils'

const props = defineProps<{
  entries: NetworkEntry[]
  selectedId: string | null
  breakpointEntryIds?: Set<string>
  breakpointMatchingIds?: Set<string>
  mockMatchingIds?: Set<string>
  allBreakpoints?: BreakpointWithStatus[]
  allMocks?: MockWithStatus[]
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'setBreakpoint', entry: NetworkEntry): void
  (e: 'copyCurl', entry: NetworkEntry): void
  (e: 'mockResponse', entry: NetworkEntry): void
  (e: 'toggleBreakpoint', entry: NetworkEntry): void
  (e: 'deleteBreakpoint', entry: NetworkEntry): void
  (e: 'toggleMock', entry: NetworkEntry): void
  (e: 'deleteMock', entry: NetworkEntry): void
}>()

// Method badge variant based on HTTP method
function getMethodVariant(method: string): 'default' | 'secondary' | 'destructive_text' | 'outline' {
  switch (method.toUpperCase()) {
    case 'GET': return 'secondary'
    case 'POST': return 'default'
    case 'PUT':
    case 'PATCH': return 'outline'
    case 'DELETE': return 'destructive_text'
    default: return 'secondary'
  }
}

// Format status display
function formatStatus(entry: NetworkEntry): string {
  if (entry.pending) return '⏳'
  if (entry.error) return '✗'
  return String(entry.status)
}

// Column visibility from settings
const settings = useInspectorSettingsSync()
const columns = computed(() => {
  const cols = settings.value?.networkTableColumns ?? defaultInspectorSettings.networkTableColumns
  return cols ?? {
    status: true,
    method: true,
    name: false,
    path: true,
    time: true,
    size: true,
  }
})

function setColumn(key: keyof NetworkTableColumnsSettings, value: boolean) {
  if (!settings.value) return
  if (!settings.value.networkTableColumns) {
    settings.value.networkTableColumns = { ...defaultInspectorSettings.networkTableColumns! }
  }
  // AnyOf: cannot disable both name and path — at least one must stay enabled
  if ((key === 'name' || key === 'path') && value === false) {
    const other = key === 'name' ? 'path' : 'name'
    const otherVal = settings.value.networkTableColumns[other]
    if (!otherVal) return // would leave both disabled — reject
  }
  settings.value.networkTableColumns[key] = value
}

// Columns that cannot be toggled off (AnyOf: name | path must stay enabled)
const networkDisabledColumns = computed(() => {
  const name = columns.value.name
  const path = columns.value.path
  if (name && !path) return ['name'] // only name on — can't disable it
  if (!name && path) return ['path'] // only path on — can't disable it
  return []
})


const networkColumnDefs = [
  { key: 'status', label: 'Status' },
  { key: 'method', label: 'Method' },
  { key: 'name', label: 'Name' },
  { key: 'path', label: 'Path' },
  { key: 'time', label: 'Time' },
  { key: 'size', label: 'Size' },
] as const

// Sorted entries (newest first) — virtualization requires array for scroll height
const sortedEntries = computed(() => [...props.entries].reverse())

// Check if entry has an active breakpoint
function hasBreakpoint(entryId: string): boolean {
  return props.breakpointEntryIds?.has(entryId) ?? false
}

function matchesBreakpointPattern(entryId: string): boolean {
  return props.breakpointMatchingIds?.has(entryId) ?? false
}

function matchesMockPattern(entryId: string): boolean {
  return props.mockMatchingIds?.has(entryId) ?? false
}

const ROW_HEIGHT = 40
</script>

<template>
  <VirtualTable
    :items="sortedEntries"
    key-field="id"
    :item-size="ROW_HEIGHT"
    min-width="460px"
    empty-message="No network requests captured yet"
  >
    <template #header>
      <div v-if="columns.status" class="network-cell network-cell-status">Status</div>
      <div v-if="columns.method" class="network-cell network-cell-method">Method</div>
      <div v-if="columns.name" :class="['network-cell network-cell-name', columns.path ? 'network-cell-name-with-path' : '']">Name</div>
      <div v-if="columns.path" class="network-cell network-cell-path">Path</div>
      <div v-if="columns.time" class="network-cell network-cell-time">Time</div>
      <div v-if="columns.size" class="network-cell network-cell-size">Size</div>
      <div class="network-cell network-cell-actions virtual-table__cell-actions">
        <TableColumnSelector
          :columns="{ ...columns }"
          :column-definitions="networkColumnDefs"
          :disabled-columns="networkDisabledColumns"
          @update:column="(k, v) => setColumn(k as keyof NetworkTableColumnsSettings, v)"
        />
      </div>
    </template>

    <template #default="{ item: entry }">
            <ContextMenu>
              <ContextMenuTrigger as-child>
                <div
                  class="network-row virtual-table__row"
                  :class="{
                    'network-row-selected': selectedId === entry.id && !hasBreakpoint(entry.id) && !matchesMockPattern(entry.id),
                    'network-row-pending': entry.pending,
                    'network-row-breakpoint': hasBreakpoint(entry.id),
                    'network-row-breakpoint-match': matchesBreakpointPattern(entry.id) && !hasBreakpoint(entry.id) && !matchesMockPattern(entry.id),
                    'network-row-mock-selected': matchesMockPattern(entry.id) && selectedId === entry.id && !hasBreakpoint(entry.id),
                    'network-row-mock-match': matchesMockPattern(entry.id) && selectedId !== entry.id && !hasBreakpoint(entry.id)
                  }"
                  @click="emit('select', entry.id)"
                >
                  <div v-if="columns.status" class="network-cell network-cell-status">
                    <Badge
                      variant="outline"
                      class="text-xs font-mono px-1.5 py-0"
                      :class="getStatusClass(entry.status, entry.pending)"
                    >
                      {{ formatStatus(entry) }}
                    </Badge>
                  </div>

                  <div v-if="columns.method" class="network-cell network-cell-method">
                    <Badge
                      :variant="getMethodVariant(entry.method)"
                      class="text-xs font-mono px-1.5 py-0"
                    >
                      {{ entry.method }}
                    </Badge>
                  </div>

                  <div v-if="columns.name" :class="['network-cell network-cell-name', columns.path ? 'network-cell-name-with-path' : '']">
                    <div class="truncate text-sm" :title="entry.url">
                      {{ entry.name }}
                    </div>
                  </div>

                  <div v-if="columns.path" class="network-cell network-cell-path">
                    <div class="truncate text-sm" :title="entry.url">
                      {{ entry.path }}
                    </div>
                    <div
                      v-if="entry.error"
                      class="text-xs text-destructive_text truncate"
                      :title="entry.error"
                    >
                      {{ entry.error }}
                    </div>
                  </div>

                  <div v-if="columns.time" class="network-cell network-cell-time">
                    {{ entry.pending ? '...' : formatDuration(entry.duration) }}
                  </div>

                  <div v-if="columns.size" class="network-cell network-cell-size">
                    {{ entry.pending ? '...' : formatBytes(entry.size) }}
                  </div>

                  <div class="network-cell network-cell-actions virtual-table__cell-actions">
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <NetworkActionsMenuContent
                        variant="dropdown"
                        :entry="entry"
                        :breakpoint-matching-ids="breakpointMatchingIds"
                        :mock-matching-ids="mockMatchingIds"
                        :all-breakpoints="allBreakpoints"
                        :all-mocks="allMocks"
                        @copy-curl="emit('copyCurl', $event)"
                        @set-breakpoint="emit('setBreakpoint', $event)"
                        @mock-response="emit('mockResponse', $event)"
                        @toggle-breakpoint="emit('toggleBreakpoint', $event)"
                        @delete-breakpoint="emit('deleteBreakpoint', $event)"
                        @toggle-mock="emit('toggleMock', $event)"
                        @delete-mock="emit('deleteMock', $event)"
                      />
                    </DropdownMenu>
                  </div>
                </div>
              </ContextMenuTrigger>

              <NetworkActionsMenuContent
                variant="context"
                :entry="entry"
                :breakpoint-matching-ids="breakpointMatchingIds"
                :mock-matching-ids="mockMatchingIds"
                :all-breakpoints="allBreakpoints"
                :all-mocks="allMocks"
                @copy-curl="emit('copyCurl', $event)"
                @set-breakpoint="emit('setBreakpoint', $event)"
                @mock-response="emit('mockResponse', $event)"
                @toggle-breakpoint="emit('toggleBreakpoint', $event)"
                @delete-breakpoint="emit('deleteBreakpoint', $event)"
                @toggle-mock="emit('toggleMock', $event)"
                @delete-mock="emit('deleteMock', $event)"
              />
            </ContextMenu>
          </template>
  </VirtualTable>
</template>

<style scoped>
.network-row {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  padding-right: 0; /* Align with header (scrollbar-gutter in RecycleScroller) */
  cursor: pointer;
  transition: background-color 0.1s, opacity 0.1s;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
}

.network-cell {
  flex-shrink: 0;
  padding: 0 4px;
}

.network-cell-status {
  width: 70px;
}

.network-cell-method {
  width: 70px;
}

.network-cell-name {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.network-cell-name-with-path {
  width: 140px;
  flex: none;
}

.network-cell-path {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.network-cell-time {
  width: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, monospace;
}

.network-cell-size {
  width: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, monospace;
}


.network-row-pending {
  opacity: 0.6;
}

.network-row-selected {
  background: hsl(var(--muted));
}

.network-row-breakpoint {
  background: hsl(48 97% 47% / 0.1);
}

.network-row-breakpoint:hover {
  background: hsl(48 97% 47% / 0.2);
}

.network-row-breakpoint-match {
  border-left: 2px solid hsl(48 97% 47% / 0.5);
}

.network-row-mock-selected {
  background: hsl(262 83% 58% / 0.1);
}

.network-row-mock-selected:hover {
  background: hsl(262 83% 58% / 0.2);
}

.network-row-mock-match {
  border-left: 2px solid hsl(262 83% 58% / 0.5);
}

.network-row:hover:not(.network-row-selected):not(.network-row-breakpoint):not(.network-row-mock-selected) {
  background: hsl(var(--accent));
}
</style>
