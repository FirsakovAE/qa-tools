<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { Star, StarOff, EyeOff, Sparkles, PinOff } from 'lucide-vue-next'
import { askAiAboutProps } from '@/features/ai/attachments'
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
  { contentClass: 'min-w-[200px] w-max whitespace-nowrap' }
)

const emit = defineEmits<{
  (e: 'toggleFavorite', row: PropsRow): void
  (e: 'ignoreByName', row: PropsRow): void
  (e: 'deleteRule', row: PropsRow): void
}>()

const { t } = useI18n()

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
      :disabled="!row.hasPropsFlag"
      @click="handleClick($event, () => void askAiAboutProps(row))"
    >
      <Sparkles class="h-4 w-4 mr-2" />
      {{ t('network.askAi') }}
    </component>
    <component :is="Separator" />
    <component
      :is="Item"
      @click="handleClick($event, () => emit('toggleFavorite', row))"
    >
      <StarOff v-if="row.isFavoriteFlag" class="h-4 w-4 mr-2" />
      <Star v-else class="h-4 w-4 mr-2" />
      {{ row.isFavoriteFlag ? t('stores.removeFavorite') : t('stores.addFavorite') }}
    </component>
    <component
      :is="Item"
      v-if="row.overrideRuleIds?.length"
      @click="handleClick($event, () => emit('deleteRule', row))"
    >
      <PinOff class="h-4 w-4 mr-2" />
      {{ t('props.deleteRule') }}
    </component>
    <component :is="Separator" />
    <component
      :is="Item"
      class="text-destructive_text"
      @click="handleClick($event, () => emit('ignoreByName', row))"
    >
      <EyeOff class="h-4 w-4 mr-2" />
      {{ t('props.ignore') }}
    </component>
  </component>
</template>
