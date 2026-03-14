<script setup lang="ts" generic="T extends { id: string; baseId?: string }">
import { computed } from 'vue'
import { Star, StarOff } from 'lucide-vue-next'
import {
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/ContextMenu'
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'

const props = withDefaults(
  defineProps<{
    variant: 'context' | 'dropdown'
    store: T
    isFavorite: boolean
    contentClass?: string
  }>(),
  { contentClass: 'w-44' }
)

const emit = defineEmits<{
  (e: 'toggleFavorite', event: Event, store: T): void
}>()

const Content = computed(() =>
  props.variant === 'context' ? ContextMenuContent : DropdownMenuContent
)
const Item = computed(() =>
  props.variant === 'context' ? ContextMenuItem : DropdownMenuItem
)

function handleClick(e: Event) {
  if (props.variant === 'dropdown') {
    ;(e as MouseEvent).stopPropagation()
  }
  emit('toggleFavorite', e, props.store)
}
</script>

<template>
  <component
    :is="Content"
    :class="contentClass"
    v-bind="variant === 'dropdown' ? { align: 'end' } : {}"
  >
    <component :is="Item" @click="handleClick">
      <StarOff v-if="isFavorite" class="h-4 w-4 mr-2" />
      <Star v-else class="h-4 w-4 mr-2" />
      {{ isFavorite ? 'Remove favorite' : 'Add favorite' }}
    </component>
  </component>
</template>
