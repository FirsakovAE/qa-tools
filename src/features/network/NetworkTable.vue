<script setup lang="ts">
import { computed } from 'vue'
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
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { MoreHorizontal, Terminal, PauseCircle, Shuffle, Power, Trash } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import type { NetworkEntry } from '@/types/network'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import { formatBytes, formatDuration } from '@/types/network'
import { getStatusClass } from './utils'
import { matchesBreakpoint, matchesMock } from './composables/useBreakpointMatching'

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

// Sorted entries (newest first)
const sortedEntries = computed(() => [...props.entries].reverse())

// Check if entry has an active breakpoint
function hasBreakpoint(entryId: string): boolean {
  return props.breakpointEntryIds?.has(entryId) ?? false
}

// Check if entry matches a breakpoint pattern
function matchesBreakpointPattern(entryId: string): boolean {
  return props.breakpointMatchingIds?.has(entryId) ?? false
}

// Check if entry matches a mock pattern
function matchesMockPattern(entryId: string): boolean {
  return props.mockMatchingIds?.has(entryId) ?? false
}

/**
 * Find matching breakpoint active status for an entry (checks both active and inactive).
 * Returns true if active, false if inactive, null if no match.
 */
function getMatchingBreakpointActive(entry: NetworkEntry): boolean | null {
  if (!props.allBreakpoints?.length) return null
  for (const bp of props.allBreakpoints) {
    if (matchesBreakpoint(entry, { ...bp, enabled: true })) {
      return bp.isActive
    }
  }
  return null
}

/**
 * Find matching mock active status for an entry (checks both active and inactive).
 * Returns true if active, false if inactive, null if no match.
 */
function getMatchingMockActive(entry: NetworkEntry): boolean | null {
  if (!props.allMocks?.length) return null
  for (const mock of props.allMocks) {
    if (matchesMock(entry, { ...mock, enabled: true })) {
      return mock.isActive
    }
  }
  return null
}

</script>

<template>
  <div class="h-full flex flex-col border rounded-lg overflow-hidden">
    <div v-if="entries.length === 0" class="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
      No network requests captured yet
    </div>

    <div v-else class="h-full flex flex-col overflow-hidden table-scroll-x">
      <div class="min-w-[460px] flex flex-col h-full">
        <div class="shrink-0 border-b bg-muted/30">
          <Table no-scroll>
            <TableHeader class="[&_th]:h-10">
              <TableRow class="hover:bg-transparent">
                <TableHead class="w-[70px] text-xs font-semibold">Status</TableHead>
                <TableHead class="w-[70px] text-xs font-semibold">Method</TableHead>
                <TableHead class="text-xs font-semibold">Path</TableHead>
                <TableHead class="w-[80px] text-xs font-semibold text-right">Time</TableHead>
                <TableHead class="w-[80px] text-xs font-semibold text-right">Size</TableHead>
                <TableHead class="w-[28px]" style="width: 60px;"></TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>
        
        <ScrollArea class="flex-1 min-h-0">
          <Table no-scroll>
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
                <TableCell class="w-[70px] py-2">
                  <Badge
                    variant="outline"
                    class="text-xs font-mono px-1.5 py-0"
                    :class="getStatusClass(entry.status, entry.pending)"
                  >
                    {{ formatStatus(entry) }}
                  </Badge>
                </TableCell>
                
                <TableCell class="w-[70px] py-2">
                  <Badge
                    :variant="getMethodVariant(entry.method)"
                    class="text-xs font-mono px-1.5 py-0"
                  >
                    {{ entry.method }}
                  </Badge>
                </TableCell>
                
                <TableCell class="py-2 max-w-0">
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
                
                <TableCell class="w-[80px] py-2 text-right text-xs text-muted-foreground font-mono">
                  {{ entry.pending ? '...' : formatDuration(entry.duration) }}
                </TableCell>

                <TableCell class="w-[80px] py-2 text-right text-xs text-muted-foreground font-mono">
                  {{ entry.pending ? '...' : formatBytes(entry.size) }}
                </TableCell>
                
                <TableCell class="w-[28px] py-2 pr-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                      <DropdownMenuItem @click.stop="emit('copyCurl', entry)">
                        <Terminal class="h-4 w-4 mr-2" />
                        Copy cURL
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem @click.stop="emit('setBreakpoint', entry)">
                        <PauseCircle class="h-4 w-4 mr-2" />
                        {{ matchesBreakpointPattern(entry.id) ? 'Rewrite Breakpoint' : 'Breakpoint Request' }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click.stop="emit('mockResponse', entry)">
                        <Shuffle class="h-4 w-4 mr-2" />
                        {{ matchesMockPattern(entry.id) ? 'Rewrite Mock' : 'Mock Response' }}
                      </DropdownMenuItem>
                      <template v-if="getMatchingBreakpointActive(entry) != null">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem @click.stop="emit('toggleBreakpoint', entry)">
                          <Power class="h-4 w-4 mr-2" />
                          {{ getMatchingBreakpointActive(entry) ? 'Disable' : 'Enable' }} Breakpoint
                        </DropdownMenuItem>
                        <DropdownMenuItem class="text-destructive_text" @click.stop="emit('deleteBreakpoint', entry)">
                          <Trash class="h-4 w-4 mr-2" />
                          Delete Breakpoint
                        </DropdownMenuItem>
                      </template>
                      <template v-if="getMatchingMockActive(entry) != null">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem @click.stop="emit('toggleMock', entry)">
                          <Power class="h-4 w-4 mr-2" />
                          {{ getMatchingMockActive(entry) ? 'Disable' : 'Enable' }} Mock
                        </DropdownMenuItem>
                        <DropdownMenuItem class="text-destructive_text" @click.stop="emit('deleteMock', entry)">
                          <Trash class="h-4 w-4 mr-2" />
                          Delete Mock
                        </DropdownMenuItem>
                      </template>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </ContextMenuTrigger>

            <!-- Right-click context menu -->
            <ContextMenuContent class="w-48">
              <ContextMenuItem @click="emit('copyCurl', entry)">
                <Terminal class="h-4 w-4 mr-2" />
                Copy cURL
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem @click="emit('setBreakpoint', entry)">
                <PauseCircle class="h-4 w-4 mr-2" />
                {{ matchesBreakpointPattern(entry.id) ? 'Rewrite Breakpoint' : 'Breakpoint Request' }}
              </ContextMenuItem>
              <ContextMenuItem @click="emit('mockResponse', entry)">
                <Shuffle class="h-4 w-4 mr-2" />
                {{ matchesMockPattern(entry.id) ? 'Rewrite Mock' : 'Mock Response' }}
              </ContextMenuItem>
              <template v-if="getMatchingBreakpointActive(entry) != null">
                <ContextMenuSeparator />
                <ContextMenuItem @click="emit('toggleBreakpoint', entry)">
                  <Power class="h-4 w-4 mr-2" />
                  {{ getMatchingBreakpointActive(entry) ? 'Disable' : 'Enable' }} Breakpoint
                </ContextMenuItem>
                <ContextMenuItem class="text-destructive_text" @click="emit('deleteBreakpoint', entry)">
                  <Trash class="h-4 w-4 mr-2" />
                  Delete Breakpoint
                </ContextMenuItem>
              </template>
              <template v-if="getMatchingMockActive(entry) != null">
                <ContextMenuSeparator />
                <ContextMenuItem @click="emit('toggleMock', entry)">
                  <Power class="h-4 w-4 mr-2" />
                  {{ getMatchingMockActive(entry) ? 'Disable' : 'Enable' }} Mock
                </ContextMenuItem>
                <ContextMenuItem class="text-destructive_text" @click="emit('deleteMock', entry)">
                  <Trash class="h-4 w-4 mr-2" />
                  Delete Mock
                </ContextMenuItem>
              </template>
            </ContextMenuContent>
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
