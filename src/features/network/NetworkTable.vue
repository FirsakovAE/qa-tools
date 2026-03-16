<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { defaultInspectorSettings } from '@/settings/inspectorSettings'
import type { NetworkEntry } from '@/types/network'
import type { NetworkTableColumnsSettings } from '@/types/inspector'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import { formatBytes, formatDuration } from '@/types/network'
import { getStatusClass } from './utils'

type BreakpointWithStatus = BreakpointItem & { isActive: boolean }
type MockWithStatus = MockRule & { isActive: boolean }

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
const settings = ref<Awaited<ReturnType<typeof useInspectorSettings>> | null>(null)
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

onMounted(async () => {
  settings.value = await useInspectorSettings()
})

const networkColumnDefs = [
  { key: 'status', label: 'Status' },
  { key: 'method', label: 'Method' },
  { key: 'name', label: 'Name' },
  { key: 'path', label: 'Path' },
  { key: 'time', label: 'Time' },
  { key: 'size', label: 'Size' },
] as const

// Sorted entries (newest first)
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

</script>

<template>
  <div class="h-full flex flex-col border rounded-lg overflow-hidden">
    <div v-if="entries.length === 0" class="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
      No network requests captured yet
    </div>

    <div v-else class="h-full flex flex-col overflow-hidden table-scroll-x">
      <div class="min-w-[460px] flex flex-col h-full min-h-0">
        <!-- Fixed header (outside scroll area) -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table no-scroll class="table-fixed">
            <TableHeader>
              <TableRow class="hover:bg-transparent [&_th]:h-10 [&_th]:border-b-0">
                <TableHead v-if="columns.status" class="w-[70px] text-xs font-semibold">Status</TableHead>
                <TableHead v-if="columns.method" class="w-[70px] text-xs font-semibold">Method</TableHead>
                <TableHead v-if="columns.name" :class="['min-w-0 text-xs font-semibold', columns.path ? 'w-[140px]' : '']">Name</TableHead>
                <TableHead v-if="columns.path" class="min-w-0 text-xs font-semibold">Path</TableHead>
                <TableHead v-if="columns.time" class="w-[80px] text-xs font-semibold text-center">Time</TableHead>
                <TableHead v-if="columns.size" class="w-[80px] text-xs font-semibold text-center">Size</TableHead>
                <TableHead class="w-[60px] py-2 p-0 text-center">
                  <div class="flex justify-center">
                    <TableColumnSelector
                      :columns="{ ...columns }"
                      :column-definitions="networkColumnDefs"
                      :disabled-columns="networkDisabledColumns"
                      @update:column="(k, v) => setColumn(k as keyof NetworkTableColumnsSettings, v)"
                    />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>
        <!-- Scrollable body only -->
        <ScrollArea class="flex-1 min-h-0">
          <Table no-scroll class="table-fixed">
            <TableBody>
          <ContextMenu v-for="entry in sortedEntries" :key="entry.id">
            <ContextMenuTrigger as-child>
              <TableRow
                class="cursor-pointer transition-colors group"
                :class="{
                  'bg-muted': selectedId === entry.id && !hasBreakpoint(entry.id) && !matchesMockPattern(entry.id),
                  'opacity-60': entry.pending,
                  'bg-amber-500/10 hover:bg-amber-500/20': hasBreakpoint(entry.id),
                  'border-l-2 border-l-amber-500/50': matchesBreakpointPattern(entry.id) && !hasBreakpoint(entry.id) && !matchesMockPattern(entry.id),
                  'bg-purple-500/10 hover:bg-purple-500/20': matchesMockPattern(entry.id) && selectedId === entry.id && !hasBreakpoint(entry.id),
                  'border-l-2 border-l-purple-500/50': matchesMockPattern(entry.id) && selectedId !== entry.id && !hasBreakpoint(entry.id)
                }"
                @click="emit('select', entry.id)"
              >
                <TableCell v-if="columns.status" class="w-[70px] py-2">
                  <Badge
                    variant="outline"
                    class="text-xs font-mono px-1.5 py-0"
                    :class="getStatusClass(entry.status, entry.pending)"
                  >
                    {{ formatStatus(entry) }}
                  </Badge>
                </TableCell>
                
                <TableCell v-if="columns.method" class="w-[70px] py-2">
                  <Badge
                    :variant="getMethodVariant(entry.method)"
                    class="text-xs font-mono px-1.5 py-0"
                  >
                    {{ entry.method }}
                  </Badge>
                </TableCell>
                
                <TableCell v-if="columns.name" :class="['py-2 max-w-0', columns.path ? 'w-[140px]' : '']">
                  <div class="truncate text-sm" :title="entry.url">
                    {{ entry.name }}
                  </div>
                </TableCell>
                
                <TableCell v-if="columns.path" class="py-2 max-w-0">
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
                </TableCell>
                
                <TableCell v-if="columns.time" class="w-[80px] py-2 text-center text-xs text-muted-foreground font-mono">
                  {{ entry.pending ? '...' : formatDuration(entry.duration) }}
                </TableCell>

                <TableCell v-if="columns.size" class="w-[80px] py-2 text-center text-xs text-muted-foreground font-mono">
                  {{ entry.pending ? '...' : formatBytes(entry.size) }}
                </TableCell>
                
                <TableCell class="w-[60px] py-2 px-0 text-center">
                  <div class="flex justify-center">
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
                </TableCell>
              </TableRow>
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
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-scroll-x {
  overflow-x: auto;
  overflow-y: hidden;
}

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
</style>
