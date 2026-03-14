<script setup lang="ts">
import { computed } from 'vue'
import { Terminal, PauseCircle, Shuffle, Power, Trash } from 'lucide-vue-next'
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
import type { NetworkEntry } from '@/types/network'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import { matchesBreakpoint, matchesMock } from '@/features/network/composables/useBreakpointMatching'

type BreakpointWithStatus = BreakpointItem & { isActive: boolean }
type MockWithStatus = MockRule & { isActive: boolean }

const props = withDefaults(
  defineProps<{
    variant: 'context' | 'dropdown'
    entry: NetworkEntry
    breakpointMatchingIds?: Set<string>
    mockMatchingIds?: Set<string>
    allBreakpoints?: BreakpointWithStatus[]
    allMocks?: MockWithStatus[]
    contentClass?: string
  }>(),
  { contentClass: 'w-48' }
)

const emit = defineEmits<{
  (e: 'copyCurl', entry: NetworkEntry): void
  (e: 'setBreakpoint', entry: NetworkEntry): void
  (e: 'mockResponse', entry: NetworkEntry): void
  (e: 'toggleBreakpoint', entry: NetworkEntry): void
  (e: 'deleteBreakpoint', entry: NetworkEntry): void
  (e: 'toggleMock', entry: NetworkEntry): void
  (e: 'deleteMock', entry: NetworkEntry): void
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

function matchesBreakpointPattern(entryId: string): boolean {
  return props.breakpointMatchingIds?.has(entryId) ?? false
}

function matchesMockPattern(entryId: string): boolean {
  return props.mockMatchingIds?.has(entryId) ?? false
}

function getMatchingBreakpointActive(entry: NetworkEntry): boolean | null {
  if (!props.allBreakpoints?.length) return null
  for (const bp of props.allBreakpoints) {
    if (matchesBreakpoint(entry, { ...bp, enabled: true })) {
      return bp.isActive
    }
  }
  return null
}

function getMatchingMockActive(entry: NetworkEntry): boolean | null {
  if (!props.allMocks?.length) return null
  for (const mock of props.allMocks) {
    if (matchesMock(entry, { ...mock, enabled: true })) {
      return mock.isActive
    }
  }
  return null
}

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
      @click="handleClick($event, () => emit('copyCurl', entry))"
    >
      <Terminal class="h-4 w-4 mr-2" />
      Copy cURL
    </component>
    <component :is="Separator" />
    <component
      :is="Item"
      @click="handleClick($event, () => emit('setBreakpoint', entry))"
    >
      <PauseCircle class="h-4 w-4 mr-2" />
      {{ matchesBreakpointPattern(entry.id) ? 'Rewrite Breakpoint' : 'Breakpoint Request' }}
    </component>
    <component
      :is="Item"
      @click="handleClick($event, () => emit('mockResponse', entry))"
    >
      <Shuffle class="h-4 w-4 mr-2" />
      {{ matchesMockPattern(entry.id) ? 'Rewrite Mock' : 'Mock Response' }}
    </component>
    <template v-if="getMatchingBreakpointActive(entry) != null">
      <component :is="Separator" />
      <component
        :is="Item"
        @click="handleClick($event, () => emit('toggleBreakpoint', entry))"
      >
        <Power class="h-4 w-4 mr-2" />
        {{ getMatchingBreakpointActive(entry) ? 'Disable' : 'Enable' }} Breakpoint
      </component>
      <component
        :is="Item"
        class="text-destructive_text"
        @click="handleClick($event, () => emit('deleteBreakpoint', entry))"
      >
        <Trash class="h-4 w-4 mr-2" />
        Delete Breakpoint
      </component>
    </template>
    <template v-if="getMatchingMockActive(entry) != null">
      <component :is="Separator" />
      <component
        :is="Item"
        @click="handleClick($event, () => emit('toggleMock', entry))"
      >
        <Power class="h-4 w-4 mr-2" />
        {{ getMatchingMockActive(entry) ? 'Disable' : 'Enable' }} Mock
      </component>
      <component
        :is="Item"
        class="text-destructive_text"
        @click="handleClick($event, () => emit('deleteMock', entry))"
      >
        <Trash class="h-4 w-4 mr-2" />
        Delete Mock
      </component>
    </template>
  </component>
</template>
