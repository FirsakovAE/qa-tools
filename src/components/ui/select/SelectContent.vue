<script setup lang="ts">
import { computed } from 'vue';
import {
  SelectContent,
  type SelectContentEmits,
  type SelectContentProps,
  SelectPortal,
  SelectViewport,
  useForwardPropsEmits,
} from 'reka-ui';
import { SelectScrollDownButton, SelectScrollUpButton } from '.';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/ui/utils';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<SelectContentProps & {
    /** Scroll the list with the kit scrollbar instead of the up/down arrows */
    scrollbar?: boolean
  }>(),
  {
    position: 'popper',
    scrollbar: false,
  },
);
const emits = defineEmits<SelectContentEmits>();

const forwarded = useForwardPropsEmits(computed(() => {
  const { scrollbar: _scrollbar, ...rest } = props;
  return rest;
}), emits);
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(
        'relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover backdrop-blur-(--backdrop-filter-blur) text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper'
          && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        scrollbar && '!max-h-none',
        $attrs.class ?? '',
      )
      "
    >
      <SelectScrollUpButton v-if="!scrollbar" />
      <SelectViewport :class="cn(
        'p-1',
        position === 'popper' && 'h-(--reka-select-trigger-height) w-full min-w-(--reka-select-trigger-width)',
        scrollbar && 'select-content-scroll !p-0',
      )">
        <ScrollArea v-if="scrollbar" :horizontal="false" type="auto" class="select-content-scroll-area w-full">
          <div class="p-1">
            <slot />
          </div>
        </ScrollArea>
        <slot v-else />
      </SelectViewport>
      <SelectScrollDownButton v-if="!scrollbar" />
    </SelectContent>
  </SelectPortal>
</template>

<style scoped>
/* The select viewport scrolls itself and hides its bar. Let the kit scrollbar own the overflow. */
.select-content-scroll {
  height: auto !important;
  flex: none !important;
  overflow: hidden !important;
}
.select-content-scroll-area,
.select-content-scroll-area :deep([data-reka-scroll-area-viewport]) {
  max-height: min(24rem, var(--reka-select-content-available-height, 24rem));
}
.select-content-scroll-area :deep([data-reka-scroll-area-viewport] > div) {
  display: block !important;
  width: 100%;
  min-width: 0 !important;
}
</style>
