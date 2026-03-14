<script setup lang="ts">
import { Columns3Cog } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Checkbox } from '@/components/ui/checkbox'

export interface ColumnDefinition {
  key: string
  label: string
}

const props = defineProps<{
  /** Column visibility state - object with column keys and boolean values */
  columns: { [key: string]: boolean }
  columnDefinitions: readonly ColumnDefinition[]
}>()

const emit = defineEmits<{
  (e: 'update:column', key: string, value: boolean): void
}>()

function toggleColumn(key: string) {
  const current = props.columns[key] ?? true
  emit('update:column', key, !current)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 p-0"
        title="Column visibility"
      >
        <Columns3Cog class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuItem
        v-for="def in columnDefinitions"
        :key="def.key"
        class="cursor-pointer"
        @select="(e: Event) => { e.preventDefault(); toggleColumn(def.key) }"
      >
        <Checkbox
          :model-value="columns[def.key] ?? true"
          class="pointer-events-none mr-2 shrink-0"
        />
        {{ def.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
