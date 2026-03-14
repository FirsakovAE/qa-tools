<script setup lang="ts">
import { computed } from 'vue'
import { Star, StarOff, EyeOff } from 'lucide-vue-next'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/ContextMenu'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import type { PropsRow } from '@/features/props/types'

const props = withDefaults(
  defineProps<{
    variant: 'context' | 'dropdown'
    row: PropsRow
    contentClass?: string
  }>(),
  { contentClass: 'w-48' }
)

const emit = defineEmits<{
  (e: 'toggleFavorite', row: PropsRow): void
  (e: 'ignoreByName', row: PropsRow): void
}>()

const Content = computed(() =>
  props.variant === 'context' ? ContextMenuContent : DropdownMenuContent
)
const Item = computed(() =>
  props.variant === 'context' ? ContextMenuItem : DropdownMenuItem
)
const Separator = computed(() =>
  props.variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator
)

function handleClick(e: Event, action: () => void) {
  if (props.variant === 'dropdown') {
    ;(e as MouseEvent).stopPropagation()
  }
  action()
}
</script>

<template>
  <component
    :is="Content"
    :class="contentClass"
    v-bind="variant === 'dropdown' ? { align: 'end' } : {}"
  >
    <component
      :is="Item"
      @click="handleClick($event, () => emit('toggleFavorite', row))"
    >
      <StarOff v-if="row.isFavoriteFlag" class="h-4 w-4 mr-2" />
      <Star v-else class="h-4 w-4 mr-2" />
      {{ row.isFavoriteFlag ? 'Remove favorite' : 'Add favorite' }}
    </component>
    <component :is="Separator" />
    <component
      :is="Item"
      class="text-destructive_text"
      @click="handleClick($event, () => emit('ignoreByName', row))"
    >
      <EyeOff class="h-4 w-4 mr-2" />
      Ignore by name
    </component>
  </component>
</template>
