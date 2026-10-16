<script setup lang="ts">
import { computed } from 'vue'
import { Upload, Terminal, EyeOff, ArrowRightLeft } from 'lucide-vue-next'
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
import type { LogEvent } from '@/types/logs'

const props = defineProps<{
  variant: 'context' | 'dropdown'
  event: LogEvent
  /** Label of the paired request/response event, when it exists */
  relatedLabel?: string
}>()

const emit = defineEmits<{
  (e: 'export', event: LogEvent): void
  (e: 'copyCurl', event: LogEvent): void
  (e: 'ignore', event: LogEvent): void
  (e: 'openRelated', event: LogEvent): void
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

const isNetwork = computed(() => props.event.kind === 'request' || props.event.kind === 'response')
const isWebSocket = computed(() =>
  props.event.kind === 'ws' || props.event.kind === 'ws-sent' || props.event.kind === 'ws-received' || props.event.kind === 'ws-closed',
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
    class="w-52"
    v-bind="variant === 'dropdown' ? { align: 'end' } : {}"
  >
    <component :is="Item" @click="handleClick($event, () => emit('export', event))">
      <Upload class="h-4 w-4 mr-2" />
      {{ isNetwork ? 'Export request & response' : 'Export event' }}
    </component>
    <component
      :is="Item"
      v-if="isNetwork && !isWebSocket"
      @click="handleClick($event, () => emit('copyCurl', event))"
    >
      <Terminal class="h-4 w-4 mr-2" />
      Copy cURL
    </component>
    <component
      :is="Item"
      v-if="relatedLabel"
      @click="handleClick($event, () => emit('openRelated', event))"
    >
      <ArrowRightLeft class="h-4 w-4 mr-2" />
      {{ relatedLabel }}
    </component>
    <component :is="Separator" />
    <component :is="Item" @click="handleClick($event, () => emit('ignore', event))">
      <EyeOff class="h-4 w-4 mr-2" />
      Ignore
    </component>
  </component>
</template>
