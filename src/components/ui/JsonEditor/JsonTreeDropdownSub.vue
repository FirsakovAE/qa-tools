<script setup lang="ts">
/**
 * shadcn-style nested menu: Sub → SubTrigger → Portal → SubContent (see UI kit DropdownMenu example).
 */
import { ref } from 'vue'
import type { MenuButton, MenuDropDownButton } from 'vanilla-jsoneditor'

import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'

import { jsonTreeContextMenuIcon } from './jsonTreeContextMenuIcons'

const props = defineProps<{
  item: MenuDropDownButton
}>()

const emit = defineEmits<{
  action: []
}>()

const subOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

function cancelClose() {
  if (closeTimer != null) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function openSub() {
  cancelClose()
  subOpen.value = true
}

function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => {
    subOpen.value = false
    closeTimer = null
  }, 200)
}

function forwardClick(btn: MenuButton, e: Event) {
  if (btn.disabled) {
    e.preventDefault()
    return
  }
  emit('action')
  btn.onClick(e as MouseEvent)
}

function itemClass(btn: MenuButton): string {
  return [btn.className, 'gap-2'].filter(Boolean).join(' ')
}

const hasSubitems = () => (props.item.items?.length ?? 0) > 0

/** Root row click: same as Copy formatted / Cut formatted (not Sort — only nested ASC/DESC). */
const SUBMENU_MAIN_ROW_CLICK = new Set(['Edit', 'Copy', 'Cut'])

function onSubmenuMainRowClick(e: MouseEvent) {
  if (!SUBMENU_MAIN_ROW_CLICK.has(props.item.main.text ?? '')) return
  e.preventDefault()
  e.stopPropagation()
  props.item.main.onClick(e)
  emit('action')
}
</script>

<template>
  <DropdownMenuSub v-if="hasSubitems()" v-model:open="subOpen">
    <DropdownMenuSubTrigger
      :disabled="item.main.disabled === true"
      :class="[itemClass(item.main), 'min-h-8 w-full']"
      @click="onSubmenuMainRowClick"
      @pointerenter="openSub"
      @pointerleave="scheduleClose"
    >
      <component
        :is="jsonTreeContextMenuIcon(item.main.text)"
        class="h-4 w-4 shrink-0 opacity-90"
      />
      <span class="truncate">{{ item.main.text }}</span>
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent
        side="right"
        align="start"
        :side-offset="2"
        :avoid-collisions="true"
        :collision-padding="12"
        class="min-w-40"
        :style="item.width ? { width: item.width } : undefined"
        @pointerenter="openSub"
        @pointerleave="scheduleClose"
      >
        <DropdownMenuItem
          v-for="(sub, si) in item.items"
          :key="si"
          :disabled="(sub as MenuButton).disabled === true"
          :class="itemClass(sub as MenuButton)"
          @click="forwardClick(sub as MenuButton, $event)"
        >
          <component
            :is="jsonTreeContextMenuIcon((sub as MenuButton).text)"
            class="h-4 w-4 shrink-0 opacity-90"
          />
          <span class="truncate">{{ (sub as MenuButton).text }}</span>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
  <DropdownMenuItem
    v-else
    :disabled="item.main.disabled === true"
    :class="itemClass(item.main)"
    @click="forwardClick(item.main, $event)"
  >
    <component
      :is="jsonTreeContextMenuIcon(item.main.text)"
      class="h-4 w-4 shrink-0 opacity-90"
    />
    <span class="truncate">{{ item.main.text }}</span>
  </DropdownMenuItem>
</template>
