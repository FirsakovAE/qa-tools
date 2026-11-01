<script setup lang="ts">
import { computed } from 'vue'
import { Box, Database, FileText, Globe, X } from 'lucide-vue-next'
import type { AiAttachment } from './attachments'

const props = defineProps<{
  item: AiAttachment
  removable?: boolean
}>()

const emit = defineEmits<{
  (e: 'remove'): void
}>()

const ICONS = { log: FileText, network: Globe, props: Box, store: Database }
const icon = computed(() => ICONS[props.item.kind])
</script>

<template>
  <span
    class="ai-attachment inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs text-foreground"
    :title="item.label"
  >
    <component :is="icon" class="h-3 w-3 shrink-0 text-muted-foreground" />
    <span class="truncate">{{ item.label }}</span>
    <button
      v-if="removable"
      type="button"
      class="-mr-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      :aria-label="`Remove ${item.label}`"
      title="Remove from the question"
      @click.stop="emit('remove')"
    >
      <X class="h-3 w-3" />
    </button>
  </span>
</template>
