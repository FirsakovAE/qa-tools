<script setup lang="ts">
import { computed } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { BreakpointItem, MockRule, SavedFile } from '@/types/inspector'
import { Plus } from 'lucide-vue-next'
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { MoreHorizontal, Power, Trash, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'breakpoint' | 'mock' | 'saved-file'; id: string }): void
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

// -------------------- SAVED FILES --------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function removeSavedFile(fileId: string) {
  if (!props.settings.savedFiles) return
  props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== fileId)
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function handleAddNewFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input?.files
  if (!files || !props.settings.savedFiles) return
  Array.from(files).forEach(file => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUri = reader.result as string
      const alreadySaved = props.settings.savedFiles.some(
        sf => sf.name === file.name && sf.size === file.size,
      )
      if (!alreadySaved) {
        props.settings.savedFiles.push({
          id: generateId(),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUri,
        })
      }
    }
    reader.readAsDataURL(file)
  })
  input.value = ''
}

function handleEditFileChange(event: Event, fileId: string) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const dataUri = reader.result as string
    const sf = props.settings.savedFiles?.find(f => f.id === fileId)
    if (sf) {
      sf.name = file.name
      sf.size = file.size
      sf.mimeType = file.type || 'application/octet-stream'
      sf.dataUri = dataUri
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
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
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Description</TableHead>
                <TableHead class="text-xs font-semibold w-[70px] text-center">Status</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <ScrollArea class="max-h-[200px]">
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
                          <DropdownMenuContent align="end" class="w-44">
                            <DropdownMenuItem @click.stop="emit('edit-breakpoint', row.id)">
                              <Pencil class="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
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
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent class="w-44">
                  <ContextMenuItem @click="emit('edit-breakpoint', row.id)">
                    <Pencil class="h-4 w-4 mr-2" />
                    Edit
                  </ContextMenuItem>
                  <ContextMenuItem @click="toggleBreakpoint(row.id, row.active)">
                    <Power class="h-4 w-4 mr-2" />
                    {{ row.active ? 'Disable' : 'Enable' }}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem class="text-destructive" @click="removeBreakpoint(row.id)">
                    <Trash class="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <TableRow v-if="!breakpointRows.length">
                <TableCell colspan="3" class="text-center text-muted-foreground py-8">
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

      <div class="flex flex-col border rounded-lg">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader>
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
        <ScrollArea class="max-h-[200px]">
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
                          <DropdownMenuContent align="end" class="w-44">
                            <DropdownMenuItem @click.stop="emit('edit-mock', row.id)">
                              <Pencil class="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
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
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent class="w-44">
                  <ContextMenuItem @click="emit('edit-mock', row.id)">
                    <Pencil class="h-4 w-4 mr-2" />
                    Edit
                  </ContextMenuItem>
                  <ContextMenuItem @click="toggleMock(row.id, row.active)">
                    <Power class="h-4 w-4 mr-2" />
                    {{ row.active ? 'Disable' : 'Enable' }}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem class="text-destructive" @click="removeMock(row.id)">
                    <Trash class="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

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

    <!-- Saved Files -->
    <div id="saved-files-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Saved Files</h4>
      <p class="text-xs text-muted-foreground">
        Files saved from breakpoint form-data editing for quick reuse.
      </p>

      <div class="flex items-center space-x-3 mb-3">
        <Checkbox
          id="auto-save-files"
          :model-value="settings.autoSaveFiles"
          @update:model-value="settings.autoSaveFiles = $event as boolean"
        />
        <Label for="auto-save-files" class="text-sm">
          Auto-save new files selected via Browse
        </Label>
      </div>

      <div class="flex flex-col border rounded-lg">
        <!-- Fixed Header -->
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Name</TableHead>
                <TableHead class="text-xs font-semibold w-[80px] text-center">Size</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Scrollable Body -->
        <ScrollArea class="max-h-[200px]">
          <Table class="table-fixed">
            <TableBody>
              <ContextMenu v-for="file in (settings.savedFiles || [])" :key="file.id">
                <ContextMenuTrigger as-child>
                  <TableRow
                    class="h-[41px] cursor-pointer transition-colors"
                    :class="{ 'bg-muted': selectedItemId === file.id }"
                    @click="emit('select', { type: 'saved-file', id: file.id })"
                  >
                    <TableCell class="overflow-hidden !py-2">
                      <div class="text-sm truncate" :title="file.name">
                        {{ file.name }}
                      </div>
                    </TableCell>

                    <TableCell class="w-[80px] text-center !py-2">
                      <div class="text-xs text-muted-foreground">
                        {{ formatFileSize(file.size) }}
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
                          <DropdownMenuContent align="end" class="w-44">
                            <DropdownMenuItem as-child>
                              <label class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full">
                                <Pencil class="h-4 w-4 mr-2" />
                                Edit
                                <input
                                  type="file"
                                  class="sr-only"
                                  @change="handleEditFileChange($event, file.id)"
                                />
                              </label>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem class="text-destructive" @click.stop="removeSavedFile(file.id)">
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
                  <ContextMenuItem as-child>
                    <label class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-secondary hover:text-secondary-foreground w-full">
                      <Pencil class="h-4 w-4 mr-2" />
                      Edit
                      <input
                        type="file"
                        class="sr-only"
                        @change="handleEditFileChange($event, file.id)"
                      />
                    </label>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem class="text-destructive" @click="removeSavedFile(file.id)">
                    <Trash class="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <!-- + Add new file row -->
              <TableRow class="h-[41px] hover:bg-muted/50 transition-colors">
                <TableCell colspan="3" class="!p-0">
                  <label class="flex items-center justify-center gap-1.5 cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors w-full h-[41px]">
                    <Plus class="h-3.5 w-3.5" />
                    Add new file
                    <input
                      type="file"
                      multiple
                      class="sr-only"
                      @change="handleAddNewFile"
                    />
                  </label>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>

