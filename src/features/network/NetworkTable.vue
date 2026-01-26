<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { Button } from '@/components/ui/button'
import type { NetworkEntry } from '@/types/network'
import { getStatusCategory, formatBytes, formatDuration } from '@/types/network'
import NetworkRowActions from './NetworkRowActions.vue'
import { buildCurlCommand, copyToClipboard } from '@/utils/networkUtils'

const props = defineProps<{
  entries: NetworkEntry[]
  selectedId: string | null
  breakpointEntryIds?: Set<string>
  /** IDs of entries that match an active breakpoint pattern (for highlighting) */
  breakpointMatchingIds?: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'setBreakpoint', entry: NetworkEntry): void
  (e: 'copyCurl', entry: NetworkEntry): void
}>()

// cURL copy functionality


// Method badge variant based on HTTP method
function getMethodVariant(method: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'secondary'
    case 'POST':
      return 'default'
    case 'PUT':
    case 'PATCH':
      return 'outline'
    case 'DELETE':
      return 'destructive'
    default:
      return 'secondary'
  }
}

// Status badge class based on status code
function getStatusClass(status: number, pending: boolean): string {
  if (pending) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
  
  const category = getStatusCategory(status)
  switch (category) {
    case 'success':
      return 'bg-green-500/20 text-green-500 border-green-500/30'
    case 'redirect':
      return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    case 'client-error':
      return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
    case 'server-error':
      return 'bg-red-500/20 text-red-500 border-red-500/30'
    case 'failed':
      return 'bg-red-500/20 text-red-500 border-red-500/30'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// Format status display
function formatStatus(entry: NetworkEntry): string {
  if (entry.pending) return '⏳'
  if (entry.error) return '✗'
  return String(entry.status)
}

// Sorted entries (newest first for display, but FIFO for storage)
const sortedEntries = computed(() => {
  return [...props.entries].reverse()
})

const handleRowClick = (id: string) => {
  emit('select', id)
}

const handleBreakpointClick = (entry: NetworkEntry, event: Event) => {
  event.stopPropagation()
  emit('setBreakpoint', entry)
}

const handleCopyCurl = async (entry: NetworkEntry) => {
  const curl = buildCurlCommand(entry)
  const ok = await copyToClipboard(curl)
  if (ok) {
    emit('copyCurl', entry)
  }
}

// Check if entry has an active breakpoint (hit/pending)
const hasBreakpoint = (entryId: string): boolean => {
  return props.breakpointEntryIds?.has(entryId) ?? false
}

// Check if entry matches a breakpoint pattern (for highlighting)
const matchesBreakpointPattern = (entryId: string): boolean => {
  return props.breakpointMatchingIds?.has(entryId) ?? false
}
</script>

<template>
  <div class="h-full flex flex-col border rounded-lg overflow-hidden">
      <div class="shrink-0 border-b bg-muted/30">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-[70px] text-xs font-semibold">Status</TableHead>
              <TableHead class="w-[70px] text-xs font-semibold">Method</TableHead>
              <TableHead class="text-xs font-semibold">Name</TableHead>
              <TableHead class="w-[80px] text-xs font-semibold text-right">Time</TableHead>
              <TableHead class="w-[80px] text-xs font-semibold text-right">Size</TableHead>
              <TableHead class="w-[28px] text-xs font-semibold text-right"></TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      
      <ScrollArea class="flex-1 min-h-0">
        <Table>
          <TableBody>
            <TableRow
              v-for="entry in sortedEntries"
              :key="entry.id"
              class="cursor-pointer transition-colors group"
              :class="{
                'bg-muted': selectedId === entry.id,
                'opacity-60': entry.pending,
                'bg-amber-500/10 hover:bg-amber-500/20': hasBreakpoint(entry.id),
                'border-l-2 border-l-amber-500/50': matchesBreakpointPattern(entry.id) && !hasBreakpoint(entry.id)
              }"
              @click="handleRowClick(entry.id)"
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
                  {{ entry.name }}
                </div>
                <div
                  v-if="entry.error"
                  class="text-xs text-destructive truncate"
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
              
              <TableCell class="w-[28px] py-2 pr-2 text-right">
                <div class="flex justify-center items-center h-full">
                  <NetworkRowActions
                    :entry="entry"
                    @set-breakpoint="emit('setBreakpoint', entry)"
                    @copy-curl="handleCopyCurl(entry)"
                  />
                </div>
              </TableCell>
            </TableRow>
            
            <TableRow v-if="entries.length === 0">
              <TableCell colspan="6" class="h-32 text-center text-muted-foreground">
                No network requests captured yet
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
</template>
