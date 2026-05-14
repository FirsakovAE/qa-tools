<script setup lang="ts">
import type {
  ContextMenuColumn,
  ContextMenuItem,
  MenuButton,
  MenuLabel,
} from 'vanilla-jsoneditor'
import {
  isContextMenuColumn,
  isContextMenuRow,
  isMenuButton,
  isMenuDropDownButton,
  isMenuLabel,
  isMenuSeparator,
  isMenuSpace,
} from 'vanilla-jsoneditor'

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

import { jsonTreeContextMenuIcon } from './jsonTreeContextMenuIcons'
import JsonTreeDropdownSub from './JsonTreeDropdownSub.vue'

defineProps<{
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  action: []
}>()

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
</script>

<template>
  <template v-for="(item, idx) in items" :key="idx">
    <template v-if="isMenuSeparator(item)" />

    <template v-else-if="isMenuSpace(item)" />

    <DropdownMenuItem
      v-else-if="isMenuButton(item)"
      :disabled="(item as MenuButton).disabled === true"
      :class="itemClass((item as MenuButton))"
      @click="forwardClick(item as MenuButton, $event)"
    >
      <component
        :is="jsonTreeContextMenuIcon((item as MenuButton).text)"
        class="h-4 w-4 shrink-0 opacity-90"
      />
      <span class="truncate">{{ (item as MenuButton).text }}</span>
    </DropdownMenuItem>

    <JsonTreeDropdownSub
      v-else-if="isMenuDropDownButton(item)"
      :item="item"
      @action="emit('action')"
    />

    <div
      v-else-if="isContextMenuRow(item)"
      class="max-w-[min(100vw-2rem,560px)] py-1"
    >
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(cell, ci) in (item as { items: unknown[] }).items"
          :key="ci"
          class="min-w-[7rem] flex-1"
        >
          <DropdownMenuGroup
            v-if="isContextMenuColumn(cell)"
            class="space-y-0.5"
          >
            <template
              v-for="(colItem, ri) in (cell as ContextMenuColumn).items"
              :key="ri"
            >
              <DropdownMenuLabel
                v-if="isMenuLabel(colItem)"
                class="px-2 py-1.5 text-xs font-normal text-muted-foreground"
              >
                {{ (colItem as MenuLabel).text }}
              </DropdownMenuLabel>
              <template v-else-if="isMenuSeparator(colItem)" />
              <DropdownMenuItem
                v-else-if="isMenuButton(colItem)"
                :disabled="(colItem as MenuButton).disabled === true"
                :class="[itemClass((colItem as MenuButton)), 'text-xs']"
                @click="forwardClick(colItem as MenuButton, $event)"
              >
                <component
                  :is="jsonTreeContextMenuIcon((colItem as MenuButton).text)"
                  class="h-4 w-4 shrink-0 opacity-90"
                />
                <span class="truncate">{{ (colItem as MenuButton).text }}</span>
              </DropdownMenuItem>
              <JsonTreeDropdownSub
                v-else-if="isMenuDropDownButton(colItem)"
                :item="colItem"
                @action="emit('action')"
              />
            </template>
          </DropdownMenuGroup>
          <DropdownMenuItem
            v-else-if="isMenuButton(cell)"
            :disabled="(cell as MenuButton).disabled === true"
            :class="itemClass((cell as MenuButton))"
            @click="forwardClick(cell as MenuButton, $event)"
          >
            <component
              :is="jsonTreeContextMenuIcon((cell as MenuButton).text)"
              class="h-4 w-4 shrink-0 opacity-90"
            />
            <span class="truncate">{{ (cell as MenuButton).text }}</span>
          </DropdownMenuItem>
          <JsonTreeDropdownSub
            v-else-if="isMenuDropDownButton(cell)"
            :item="cell"
            @action="emit('action')"
          />
        </div>
      </div>
    </div>
  </template>
</template>
