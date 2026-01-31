<script setup lang="ts">
import { MoreHorizontal, Terminal, PauseCircle, Shuffle } from 'lucide-vue-next'
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
}>()

const emit = defineEmits<{
  (e: 'set-breakpoint', entry: NetworkEntry): void
  (e: 'copy-curl', entry: NetworkEntry): void
  (e: 'mock-response', entry: NetworkEntry): void
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

    <DropdownMenuContent align="end" class="w-44">

      <DropdownMenuItem @click.stop="emit('copy-curl', entry)">
        <Terminal class="h-4 w-4 mr-2" />
        Copy cURL
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem @click.stop="emit('set-breakpoint', entry)">
        <PauseCircle class="h-4 w-4 mr-2" />
        Breakpoint Request
      </DropdownMenuItem>    
      
      <DropdownMenuItem @click.stop="emit('mock-response', entry)">
        <Shuffle class="h-4 w-4 mr-2" />
        Mock Response
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>