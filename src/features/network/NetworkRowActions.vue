<script setup lang="ts">
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

const props = defineProps<{
  entry: NetworkEntry
  matchesBreakpoint?: boolean
  matchesMock?: boolean
  /** null/undefined = no matching breakpoint, true = active, false = inactive */
  matchingBreakpointActive?: boolean | null
  /** null/undefined = no matching mock, true = active, false = inactive */
  matchingMockActive?: boolean | null
}>()

const emit = defineEmits<{
  (e: 'set-breakpoint', entry: NetworkEntry): void
  (e: 'copy-curl', entry: NetworkEntry): void
  (e: 'mock-response', entry: NetworkEntry): void
  (e: 'toggle-breakpoint', entry: NetworkEntry): void
  (e: 'delete-breakpoint', entry: NetworkEntry): void
  (e: 'toggle-mock', entry: NetworkEntry): void
  (e: 'delete-mock', entry: NetworkEntry): void
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 p-0"
        @click.stop
      >
        <MoreHorizontal class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-48">

      <DropdownMenuItem @click.stop="emit('copy-curl', entry)">
        <Terminal class="h-4 w-4 mr-2" />
        Copy cURL
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem @click.stop="emit('set-breakpoint', entry)">
        <PauseCircle class="h-4 w-4 mr-2" />
        {{ matchesBreakpoint ? 'Rewrite Breakpoint' : 'Breakpoint Request' }}
      </DropdownMenuItem>    
      
      <DropdownMenuItem @click.stop="emit('mock-response', entry)">
        <Shuffle class="h-4 w-4 mr-2" />
        {{ matchesMock ? 'Rewrite Mock' : 'Mock Response' }}
      </DropdownMenuItem>

      <!-- Breakpoint management -->
      <template v-if="matchingBreakpointActive != null">
        <DropdownMenuSeparator />
        <DropdownMenuItem @click.stop="emit('toggle-breakpoint', entry)">
          <Power class="h-4 w-4 mr-2" />
          {{ matchingBreakpointActive ? 'Disable' : 'Enable' }} Breakpoint
        </DropdownMenuItem>
        <DropdownMenuItem class="text-destructive" @click.stop="emit('delete-breakpoint', entry)">
          <Trash class="h-4 w-4 mr-2" />
          Delete Breakpoint
        </DropdownMenuItem>
      </template>

      <!-- Mock management -->
      <template v-if="matchingMockActive != null">
        <DropdownMenuSeparator />
        <DropdownMenuItem @click.stop="emit('toggle-mock', entry)">
          <Power class="h-4 w-4 mr-2" />
          {{ matchingMockActive ? 'Disable' : 'Enable' }} Mock
        </DropdownMenuItem>
        <DropdownMenuItem class="text-destructive" @click.stop="emit('delete-mock', entry)">
          <Trash class="h-4 w-4 mr-2" />
          Delete Mock
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>