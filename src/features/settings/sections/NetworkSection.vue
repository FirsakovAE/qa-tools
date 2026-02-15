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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { MoreHorizontal, Power, Trash } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'breakpoint' | 'mock'; id: string }): void
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

      <div class="flex flex-col border rounded-lg overflow-hidden">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table>
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">URL Pattern</TableHead>
                <TableHead class="text-xs font-semibold w-[80px] text-center">Trigger</TableHead>
                <TableHead class="text-xs font-semibold w-[70px] text-center">Status</TableHead>
                <TableHead class="w-[28px]" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <ScrollArea class="max-h-[200px]">
          <Table>
            <TableBody>
              <TableRow
                v-for="row in breakpointRows"
                :key="row.id"
                class="cursor-pointer transition-colors"
                :class="{ 'bg-muted': selectedItemId === row.id }"
                @click="emit('select', { type: 'breakpoint', id: row.id })"
              >
                <TableCell class="py-2">
                  <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm truncate" :title="formatBreakpointUrl(row)">
                    {{ formatBreakpointUrl(row) }}
                  </div>
                </TableCell>

                <TableCell class="w-[80px] text-center py-2">
                  <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                    {{ formatTrigger(row.trigger) }}
                  </div>
                </TableCell>

                <TableCell class="w-[70px] text-center py-2">
                  <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                    {{ row.active ? 'Active' : 'Off' }}
                  </div>
                </TableCell>

                <TableCell class="w-[28px] py-2 pr-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem @click.stop="toggleBreakpoint(row.id, row.active)">
                        <Power class="h-4 w-4 mr-2" />
                        {{ row.active ? 'Disable' : 'Enable' }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive" @click.stop="removeBreakpoint(row.id)">
                        <Trash class="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>

              <TableRow v-if="!breakpointRows.length">
                <TableCell colspan="4" class="text-center text-muted-foreground py-8">
                  No breakpoints configured. Set breakpoints from the Network tab.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>

    <!-- Mocks Responses -->
    <div id="mocks-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Mocks Responses</h4>
      <p class="text-xs text-muted-foreground">
        Matching requests will return fake responses without hitting the network.
      </p>

      <div class="flex flex-col border rounded-lg overflow-hidden">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table>
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">URL Pattern</TableHead>
                <TableHead class="text-xs font-semibold w-[60px] text-center">Code</TableHead>
                <TableHead class="text-xs font-semibold w-[60px] text-center">Delay</TableHead>
                <TableHead class="text-xs font-semibold w-[60px] text-center">Status</TableHead>
                <TableHead class="w-[28px]" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <ScrollArea class="max-h-[200px]">
          <Table>
            <TableBody>
              <TableRow
                v-for="row in mockRows"
                :key="row.id"
                class="cursor-pointer transition-colors"
                :class="{ 'bg-muted': selectedItemId === row.id }"
                @click="emit('select', { type: 'mock', id: row.id })"
              >
                <TableCell class="py-2">
                  <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm truncate" :title="formatMockUrl(row)">
                    {{ formatMockUrl(row) }}
                  </div>
                </TableCell>

                <TableCell class="w-[60px] text-center py-2">
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

                <TableCell class="w-[60px] text-center py-2">
                  <div :class="!row.active ? 'opacity-50' : ''" class="text-xs text-muted-foreground">
                    {{ row.delay ? `${row.delay}ms` : '-' }}
                  </div>
                </TableCell>

                <TableCell class="w-[60px] text-center py-2">
                  <div :class="!row.active ? 'opacity-50' : ''" class="text-xs">
                    {{ row.active ? 'Active' : 'Off' }}
                  </div>
                </TableCell>

                <TableCell class="w-[28px] py-2 pr-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem @click.stop="toggleMock(row.id, row.active)">
                        <Power class="h-4 w-4 mr-2" />
                        {{ row.active ? 'Disable' : 'Enable' }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive" @click.stop="removeMock(row.id)">
                        <Trash class="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>

              <TableRow v-if="!mockRows.length">
                <TableCell colspan="5" class="text-center text-muted-foreground py-8">
                  No mocks configured. Click "Mock Response" on any request in the Network tab.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>
