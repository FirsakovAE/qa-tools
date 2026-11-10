<script setup lang="ts">
import { ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

defineProps<{ text: string }>()

const open = ref(false)
</script>

<template>
  <div class="min-w-0 text-xs text-muted-foreground">
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-1 text-left hover:text-foreground"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronRight class="h-3 w-3 shrink-0 transition-transform" :class="{ 'rotate-90': open }" />
      <span class="shrink-0 text-foreground/70">Thinking</span>
    </button>
    <!-- column-reverse keeps the scroll at the newest text while it streams -->
    <div
      v-if="open"
      class="ai-scroll mt-1 ml-4 flex max-h-48 flex-col-reverse overflow-y-auto border-l-2 pl-2 italic whitespace-pre-wrap break-words"
    >
      <div>{{ text }}</div>
    </div>
  </div>
</template>