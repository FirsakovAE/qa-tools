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
import type { NetworkEntry } from '@/types/network'
import { formatBytes, formatDuration } from '@/types/network'
import NetworkRowActions from './NetworkRowActions.vue'
import { getStatusClass } from './utils'

const props = defineProps<{
  entries: NetworkEntry[]
  selectedId: string | null
  breakpointEntryIds?: Set<string>
  breakpointMatchingIds?: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'setBreakpoint', entry: NetworkEntry): void
  (e: 'copyCurl', entry: NetworkEntry): void
  (e: 'mockResponse', entry: NetworkEntry): void
}>()

// Method badge variant based on HTTP method
function getMethodVariant(method: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (method.toUpperCase()) {
    case 'GET': return 'secondary'
    case 'POST': return 'default'
    case 'PUT':
    case 'PATCH': return 'outline'
    case 'DELETE': return 'destructive'
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
            <TableHead class="w-[28px]"></TableHead>
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
            
            <TableCell class="w-[28px] py-2 pr-2">
              <NetworkRowActions
                :entry="entry"
                @set-breakpoint="emit('setBreakpoint', entry)"
                @copy-curl="emit('copyCurl', entry)"
                @mock-response="emit('mockResponse', entry)"
              />
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
