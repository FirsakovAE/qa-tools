<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import type { NetworkEntry } from '@/types/network'

const props = defineProps<{
  entry: NetworkEntry
}>()

const emit = defineEmits<{
  (e: 'set-breakpoint', entry: NetworkEntry): void
  (e: 'copy-curl', entry: NetworkEntry): void
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

    <DropdownMenuContent align="end" class="w-40">
      <DropdownMenuItem @click.stop="emit('set-breakpoint', entry)">
        Breakpoint
      </DropdownMenuItem>

      <DropdownMenuItem @click.stop="emit('copy-curl', entry)">
        Copy cURL
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>