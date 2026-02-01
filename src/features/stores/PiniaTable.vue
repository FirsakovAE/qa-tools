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

interface StoreEntry {
  id: string
  baseId: string
  stateKeys: number
  getterKeys: number
  lastUpdated?: number
  lastUpdatedFormatted?: string
}

const props = defineProps<{
  entries: StoreEntry[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', store: StoreEntry): void
}>()

// Has state
function hasStateKeys(store: StoreEntry): boolean {
  return store.stateKeys > 0
}

// Has getters
function hasGetterKeys(store: StoreEntry): boolean {
  return store.getterKeys > 0
}

const handleRowClick = (store: StoreEntry) => {
  emit('select', store)
}
</script>

<template>
  <div class="h-full flex flex-col border rounded-lg overflow-hidden">
    <div class="shrink-0 border-b bg-muted/30">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="text-xs font-semibold">Name</TableHead>
            <TableHead class="w-[120px] text-xs font-semibold">State</TableHead>
            <TableHead class="w-[80px] text-xs font-semibold text-center">Getters</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>
    
    <ScrollArea class="flex-1 min-h-0">
      <Table>
        <TableBody>
          <TableRow
            v-for="store in entries"
            :key="store.id"
            class="cursor-pointer transition-colors"
            :class="{
              'bg-muted': selectedId === store.id,
              'hover:bg-accent': selectedId !== store.id
            }"
            @click="handleRowClick(store)"
          >
            <TableCell class="py-2 max-w-0">
              <div class="truncate text-sm font-medium" :title="store.baseId">
                {{ store.baseId || 'Unknown Store' }}
              </div>
            </TableCell>
            
            <TableCell class="w-[120px] py-2">
              <Badge 
                v-if="hasStateKeys(store)"
                variant="secondary" 
                class="text-xs font-mono"
              >
                {{ store.stateKeys }}
              </Badge>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </TableCell>
            
            <TableCell class="w-[80px] py-2 text-center">
              <Badge 
                v-if="hasGetterKeys(store)"
                variant="outline" 
                class="text-xs font-mono"
              >
                {{ store.getterKeys }}
              </Badge>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </TableCell>
          </TableRow>
          
          <TableRow v-if="entries.length === 0">
            <TableCell colspan="3" class="h-32 text-center text-muted-foreground">
              No stores found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ScrollArea>
  </div>
</template>
