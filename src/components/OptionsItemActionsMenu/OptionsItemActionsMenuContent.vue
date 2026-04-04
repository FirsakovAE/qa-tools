<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
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

export interface MenuAction {
  label: string
  icon: Component
  onClick?: () => void
  /** Red text + separator before this action; same styling as `class="text-destructive_text"` elsewhere */
  destructiveText?: boolean
  /** When set, render slot with this name instead of default (for custom content like file input) */
  slot?: string
}

const props = withDefaults(
  defineProps<{
    variant: 'context' | 'dropdown'
    /** Actions to display. Before the first destructiveText action (if not first), a separator is auto-inserted. */
    actions: MenuAction[]
    /** Current item (passed to slots) */
    item?: unknown
    contentClass?: string
  }>(),
  { contentClass: 'w-44' }
)

const Content = computed(() =>
  props.variant === 'context' ? ContextMenuContent : DropdownMenuContent
)
const Item = computed(() =>
  props.variant === 'context' ? ContextMenuItem : DropdownMenuItem
)
const Separator = computed(() =>
  props.variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator
)

function handleClick(e: Event, action: MenuAction) {
  if (props.variant === 'dropdown') {
    ;(e as MouseEvent).stopPropagation()
  }
  action.onClick?.()
}
</script>

<template>
  <component
    :is="Content"
    :class="contentClass"
    v-bind="variant === 'dropdown' ? { align: 'end' } : {}"
  >
    <template v-for="(action, idx) in actions" :key="idx">
      <!-- Separator before first destructiveText action (if not first) -->
      <component
        v-if="action.destructiveText && idx > 0 && !actions.slice(0, idx).some(a => a.destructiveText)"
        :is="Separator"
      />
      <component
        v-if="action.slot"
        :is="Item"
        as-child
        :class="action.destructiveText ? 'text-destructive_text' : undefined"
      >
        <slot :name="action.slot" :item="item" :variant="variant">
          <span class="flex items-center">
            <component :is="action.icon" class="h-4 w-4 mr-2" />
            {{ action.label }}
          </span>
        </slot>
      </component>
      <component
        v-else
        :is="Item"
        :class="action.destructiveText ? 'text-destructive_text' : undefined"
        @click="handleClick($event, action)"
      >
        <component :is="action.icon" class="h-4 w-4 mr-2" />
        {{ action.label }}
      </component>
    </template>
  </component>
</template>
