<script setup lang="ts" generic="T extends { id: string; baseId?: string }">
import { computed } from 'vue'
import { Star, StarOff, Sparkles } from 'lucide-vue-next'
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
import { askAiAboutStore } from '@/features/ai/attachments'

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
const Separator = computed(() =>
  props.variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator
)

function stopInDropdown(e: Event) {
  if (props.variant === 'dropdown') {
    ;(e as MouseEvent).stopPropagation()
  }
}

function handleClick(e: Event) {
  stopInDropdown(e)
  emit('toggleFavorite', e, props.store)
}

function handleAskAi(e: Event) {
  stopInDropdown(e)
  void askAiAboutStore(props.store.id, props.store.baseId || props.store.id)
}
</script>

<template>
  <component
    :is="Content"
    :class="contentClass"
    v-bind="variant === 'dropdown' ? { align: 'end' } : {}"
  >
    <component :is="Item" @click="handleAskAi">
      <Sparkles class="h-4 w-4 mr-2" />
      Ask AI
    </component>
    <component :is="Separator" />
    <component :is="Item" @click="handleClick">
      <StarOff v-if="isFavorite" class="h-4 w-4 mr-2" />
      <Star v-else class="h-4 w-4 mr-2" />
      {{ isFavorite ? 'Remove favorite' : 'Add favorite' }}
    </component>
  </component>
</template>
