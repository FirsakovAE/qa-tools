<script setup lang="ts">
import { computed } from 'vue'
import { Copy, Link2, ExternalLink, Pencil, Trash2, Pin, PinOff } from 'lucide-vue-next'
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

const props = withDefaults(
  defineProps<{
    variant: 'context' | 'dropdown'
    /** Existing rule id when link exists */
    linkRuleId: string | null
    isPinned: boolean
    canOpenLink: boolean
    contentClass?: string
  }>(),
  { contentClass: 'w-48' }
)

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'create-link'): void
  (e: 'open-link'): void
  (e: 'edit-link'): void
  (e: 'delete-link'): void
  (e: 'toggle-pin'): void
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
</script>

<template>
  <component :is="Content" :class="contentClass" align="start">
    <component :is="Item" @click="emit('copy')">
      <Copy class="mr-2 h-4 w-4" />
      Copy
    </component>

    <component :is="Item" @click="emit('toggle-pin')">
      <component :is="isPinned ? PinOff : Pin" class="mr-2 h-4 w-4" />
      {{ isPinned ? 'Unpin' : 'Pin' }}
    </component>

    <component :is="Separator" />

    <template v-if="!linkRuleId">
      <component :is="Item" @click="emit('create-link')">
        <Link2 class="mr-2 h-4 w-4" />
        Create link
      </component>
    </template>
    <template v-else>
      <component :is="Item" :disabled="!canOpenLink" @click="emit('open-link')">
        <ExternalLink class="mr-2 h-4 w-4" />
        Open link
      </component>
      <component :is="Item" @click="emit('edit-link')">
        <Pencil class="mr-2 h-4 w-4" />
        Edit link
      </component>
      <component :is="Item" class="text-destructive_text focus:text-destructive_text" @click="emit('delete-link')">
        <Trash2 class="mr-2 h-4 w-4" />
        Delete link
      </component>
    </template>
  </component>
</template>
