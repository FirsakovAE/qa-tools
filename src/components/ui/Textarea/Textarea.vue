<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useAttrs, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/ui/utils';

defineOptions({ inheritAttrs: false });

const model = defineModel<string | number>();
const attrs = useAttrs();
const fieldAttrs = computed(() => {
  const { class: _, ...rest } = attrs;
  return rest;
});

// The textarea grows with its text; the scroll area caps the height and scrolls
const field = ref<HTMLTextAreaElement>();
let width = 0;

function fit() {
  const el = field.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

watch(model, () => nextTick(fit));
onMounted(fit);
useResizeObserver(field, entries => {
  const next = entries[0]?.contentRect.width ?? 0;
  if (next === width) return;
  width = next;
  requestAnimationFrame(fit);
});
</script>

<template>
  <ScrollArea
    :horizontal="false"
    :class="cn(
      'w-full rounded-md border border-border bg-input text-sm focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2 [&>[data-scroll-viewport]]:max-h-60',
      attrs.disabled != null && attrs.disabled !== false && 'cursor-not-allowed opacity-50',
      attrs.class as string,
    )"
  >
    <textarea
      ref="field"
      v-model="model"
      v-bind="fieldAttrs"
      class="block w-full resize-none overflow-hidden bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      autocomplete="off"
    />
  </ScrollArea>
</template>
