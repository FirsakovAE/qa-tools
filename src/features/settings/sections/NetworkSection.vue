<script setup lang="ts">
import { computed } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import { Checkbox } from '@/components/ui/checkbox'
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
import { MoreHorizontal, Power, Trash, Pencil } from 'lucide-vue-next'

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

function formatTrigger(trigger: string): string {
  if (trigger === 'both') return 'Req & Res'
  return trigger.charAt(0).toUpperCase() + trigger.slice(1)
}

function formatBreakpointUrl(bp: BreakpointItem): string {
  let url = `${bp.scheme}://${bp.host}`
  if (bp.port) url += `:${bp.port}`
  url += bp.path
  if (bp.query) url += `?${bp.query}`
  return url
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

const breakpointTableHeight = computed(() => {
  const rowCount = Math.max(breakpointRows.value.length, 1)
  return Math.min(rowCount * 41, 205)
})
const breakpointNeedsScroll = computed(() => breakpointRows.value.length > 4)

const mockTableHeight = computed(() => {
  const rowCount = Math.max(mockRows.value.length, 1)
  return Math.min(rowCount * 41, 205)
})
const mockNeedsScroll = computed(() => mockRows.value.length > 4)

function getBreakpointActions(row: BreakpointRow): MenuAction[] {
  return [
    { label: 'Edit', icon: Pencil, onClick: () => emit('edit-breakpoint', row.id) },
    { label: row.active ? 'Disable' : 'Enable', icon: Power, onClick: () => toggleBreakpoint(row.id, row.active) },
    { label: 'Delete', icon: Trash, onClick: () => removeBreakpoint(row.id), destructive: true },
  ]
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
    <!-- Search Settings -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">Search Settings</h4>
      <div class="grid grid-cols-1 gap-2">
        <div v-for="item in searchItems" :key="item.key" class="flex items-center space-x-3">
          <Checkbox
            :id="`network-search-${item.key}`"
            :model-value="settings.networkSearch[item.key]"
            @update:model-value="toggleSearch(item.key)"
          />
          <Label :for="`network-search-${item.key}`" class="text-sm">
            {{ item.label }}
          </Label>
        </div>
      </div>
    </div>

    <!-- Breakpoints Requests -->
    <div id="breakpoints-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Breakpoints Requests</h4>
      <p class="text-xs text-muted-foreground">
        Network requests matching these patterns will be paused for inspection.
      </p>

      <div class="flex flex-col border rounded-lg">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader class="[&_th]:h-10">
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Description</TableHead>
                <TableHead class="text-xs font-semibold w-[70px] text-center">Status</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <div class="min-h-0 max-h-[205px] overflow-hidden">
          <template v-if="breakpointNeedsScroll">
            <ScrollArea :style="{ height: `${breakpointTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="row in breakpointRows" :key="row.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="{ 'bg-muted': selectedItemId === row.id }"
                        @click="emit('select', { type: 'breakpoint', id: row.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="text-sm truncate" :title="row.description || formatBreakpointUrl(row)">
                            {{ row.description || formatBreakpointUrl(row) }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[70px] text-center !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                            {{ row.active ? 'Active' : 'Off' }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[48px] text-center p-0">
                          <div class="flex justify-center items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button variant="ghost" class="h-6 w-6 p-0" @click.stop>
                                  <MoreHorizontal class="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getBreakpointActions(row)"
                            />
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getBreakpointActions(row)"
                    />
                  </ContextMenu>

                  <TableRow v-if="!breakpointRows.length">
                    <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                      No breakpoints configured. Set breakpoints from the Network tab.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </template>
          <template v-else>
            <Table class="table-fixed">
              <TableBody>
                <ContextMenu v-for="row in breakpointRows" :key="row.id">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="{ 'bg-muted': selectedItemId === row.id }"
                      @click="emit('select', { type: 'breakpoint', id: row.id })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="text-sm truncate" :title="row.description || formatBreakpointUrl(row)">
                          {{ row.description || formatBreakpointUrl(row) }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[70px] text-center !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                          {{ row.active ? 'Active' : 'Off' }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[48px] text-center p-0">
                        <div class="flex justify-center items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" class="h-6 w-6 p-0" @click.stop>
                                <MoreHorizontal class="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getBreakpointActions(row)"
                            />
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <OptionsItemActionsMenuContent
                    variant="context"
                    :actions="getBreakpointActions(row)"
                  />
                </ContextMenu>
                <TableRow v-if="!breakpointRows.length">
                  <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                    No breakpoints configured. Set breakpoints from the Network tab.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>
        </div>
      </div>
    </div>

    <!-- Mocks Responses -->
    <div id="mocks-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Mocks Responses</h4>
      <p class="text-xs text-muted-foreground">
        Matching requests will return fake responses without hitting the network.
      </p>

      <div class="flex flex-col border rounded-lg">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader class="[&_th]:h-10">
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Description</TableHead>
                <TableHead class="text-xs font-semibold w-[60px] text-center">Code</TableHead>
                <TableHead class="text-xs font-semibold w-[60px] text-center">Delay</TableHead>
                <TableHead class="text-xs font-semibold w-[60px] text-center">Status</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <div class="min-h-0 max-h-[205px] overflow-hidden">
          <template v-if="mockNeedsScroll">
            <ScrollArea :style="{ height: `${mockTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="row in mockRows" :key="row.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="{ 'bg-muted': selectedItemId === row.id }"
                        @click="emit('select', { type: 'mock', id: row.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="text-sm truncate" :title="row.description || formatMockUrl(row)">
                            {{ row.description || formatMockUrl(row) }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[60px] text-center !py-2">
                          <div
                            :class="[
                              !row.active ? 'opacity-50' : '',
                              'text-xs font-mono',
                              row.status >= 200 && row.status < 300 ? 'text-green-500' : '',
                              row.status >= 400 && row.status < 500 ? 'text-orange-500' : '',
                              row.status >= 500 ? 'text-red-500' : ''
                            ]"
                          >
                            {{ row.status }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[60px] text-center !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="text-xs text-muted-foreground">
                            {{ row.delay ? `${row.delay}ms` : '-' }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[60px] text-center !py-2">
                          <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                            {{ row.active ? 'Active' : 'Off' }}
                          </div>
                        </TableCell>
                        <TableCell class="w-[48px] text-center p-0">
                          <div class="flex justify-center items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button variant="ghost" class="h-6 w-6 p-0" @click.stop>
                                  <MoreHorizontal class="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <OptionsItemActionsMenuContent
                                variant="dropdown"
                                :actions="getMockActions(row)"
                              />
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getMockActions(row)"
                    />
                  </ContextMenu>

                  <TableRow v-if="!mockRows.length">
                    <TableCell colspan="5" class="text-center text-muted-foreground py-8">
                      No mocks configured. Click "Mock Response" on any request in the Network tab.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </template>
          <template v-else>
            <Table class="table-fixed">
              <TableBody>
                <ContextMenu v-for="row in mockRows" :key="row.id">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="{ 'bg-muted': selectedItemId === row.id }"
                      @click="emit('select', { type: 'mock', id: row.id })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="text-sm truncate" :title="row.description || formatMockUrl(row)">
                          {{ row.description || formatMockUrl(row) }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[60px] text-center !py-2">
                        <div
                          :class="[
                            !row.active ? 'opacity-50' : '',
                            'text-xs font-mono',
                            row.status >= 200 && row.status < 300 ? 'text-green-500' : '',
                            row.status >= 400 && row.status < 500 ? 'text-orange-500' : '',
                            row.status >= 500 ? 'text-red-500' : ''
                          ]"
                        >
                          {{ row.status }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[60px] text-center !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="text-xs text-muted-foreground">
                          {{ row.delay ? `${row.delay}ms` : '-' }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[60px] text-center !py-2">
                        <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                          {{ row.active ? 'Active' : 'Off' }}
                        </div>
                      </TableCell>
                      <TableCell class="w-[48px] text-center p-0">
                        <div class="flex justify-center items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" class="h-6 w-6 p-0" @click.stop>
                                <MoreHorizontal class="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getMockActions(row)"
                            />
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <OptionsItemActionsMenuContent
                    variant="context"
                    :actions="getMockActions(row)"
                  />
                </ContextMenu>
                <TableRow v-if="!mockRows.length">
                  <TableCell colspan="5" class="text-center text-muted-foreground py-8">
                    No mocks configured. Click "Mock Response" on any request in the Network tab.
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

