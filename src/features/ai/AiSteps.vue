<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import AiThought from './AiThought.vue'
import { isShownThought } from './format'
import type { AiStep } from './types'

const props = defineProps<{ steps: AiStep[] }>()

const open = ref(false)

/** Collapsed view follows the newest action; a later tool call replaces it */
const latest = computed(() => {
  for (let i = props.steps.length - 1; i >= 0; i--) {
    const step = props.steps[i]
    if (!step.thought) return step
  }
  return undefined
})
</script>

<template>
  <div v-if="latest" class="min-w-0 text-xs text-muted-foreground">
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-1 text-left hover:text-foreground"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronRight class="h-3 w-3 shrink-0 transition-transform" :class="{ 'rotate-90': open }" />
      <template v-if="!open">
        <span class="shrink-0 text-foreground/70">{{ latest.tool }}</span>
        <span class="min-w-0 truncate font-mono" :class="{ 'line-through opacity-60': latest.declined }" :title="latest.summary">
          {{ latest.summary }}<span v-if="latest.declined"> (not allowed)</span>
        </span>
      </template>
      <span v-else class="shrink-0 text-foreground/70">Actions</span>
    </button>
    <ul v-if="open" class="ai-scroll mt-1 ml-4 max-h-48 space-y-0.5 overflow-y-auto border-l-2 pl-2">
      <template v-for="(step, i) in steps" :key="i">
        <li v-if="isShownThought(step)"><AiThought :text="step.summary" /></li>
        <li v-else-if="!step.thought" class="font-mono truncate" :class="{ 'line-through opacity-60': step.declined }" :title="step.summary">
          <span class="text-foreground/70">{{ step.tool }}</span> {{ step.summary }}<span v-if="step.declined"> (not allowed)</span>
        </li>
      </template>
    </ul>
  </div>
</template>
