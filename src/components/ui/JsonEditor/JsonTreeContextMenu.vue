<script setup lang="ts">
import { computed } from 'vue'
import type { ReferenceElement } from '@floating-ui/vue'
import type { ContextMenuItem } from 'vanilla-jsoneditor'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import JsonTreeContextMenuItems from './JsonTreeContextMenuItems.vue'

const props = defineProps<{
  open: boolean
  anchor: { x: number, y: number }
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

/**
 * Floating UI positions against this rect (viewport coords), so the menu
 * follows the context‑menu click even when a CSS `transform` on an ancestor
 * would break a plain `position:fixed` trigger in the Vue tree.
 */
const popperReference = computed((): ReferenceElement => {
  return {
    getBoundingClientRect: () =>
      DOMRect.fromRect({
        x: props.anchor.x,
        y: props.anchor.y,
        width: 1,
        height: 1,
      }),
    getClientRects: () =>
      [
        DOMRect.fromRect({
          x: props.anchor.x,
          y: props.anchor.y,
          width: 1,
          height: 1,
        }),
      ] as unknown as DOMRectList,
  }
})

const triggerStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${props.anchor.x}px`,
  top: `${props.anchor.y}px`,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '0',
  border: 'none',
  opacity: '0',
  pointerEvents: 'none' as const,
}))
</script>

<template>
  <Teleport to="body">
    <DropdownMenu :open="open" :modal="false" @update:open="emit('update:open', $event)">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          aria-hidden="true"
          tabindex="-1"
          :style="triggerStyle"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        class="json-tree-ctx-menu max-h-[min(24rem,70vh)] w-56 overflow-y-auto"
        side="bottom"
        align="start"
        position-strategy="fixed"
        :side-offset="4"
        :avoid-collisions="true"
        :collision-padding="12"
        :reference="popperReference"
        @close-auto-focus.prevent
      >
        <JsonTreeContextMenuItems :items="items" @action="emit('update:open', false)" />
      </DropdownMenuContent>
    </DropdownMenu>
  </Teleport>
</template>
