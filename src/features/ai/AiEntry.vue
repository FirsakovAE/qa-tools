<script setup lang="ts">
import { computed } from 'vue'
import { Copy, Check, RotateCcw, Wand2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import AiSteps from './AiSteps.vue'
import { useAiChat } from './useAiChat'
import { renderAnswer } from './markdown'
import { modelName, stepsLabel, usageLine, usageTitle } from './format'
import type { AiChatEntry } from './types'

const props = defineProps<{
  entry: AiChatEntry
  copied: boolean
}>()

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'click', event: MouseEvent): void
}>()

const { busy, ready, models, entries, retry, retryWithAuto } = useAiChat()

const lastAnswer = computed(() => {
  const list = entries.value
  const last = list[list.length - 1]
  return last?.role === 'assistant' && list[list.length - 2]?.role === 'user' && last.id === props.entry.id
})
</script>

<template>
  <div class="ai-entry flex flex-col" :class="entry.role === 'user' ? 'items-end' : 'items-start'">
    <div
      v-if="entry.role === 'user'"
      class="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground whitespace-pre-wrap break-words"
    >{{ entry.text }}</div>
    <div v-else class="max-w-[95%] min-w-0 rounded-lg border px-3 py-2 bg-background" @click="emit('click', $event)">
      <details v-if="entry.steps?.length" class="mb-2 text-xs text-muted-foreground">
        <summary class="cursor-pointer select-none">{{ stepsLabel(entry.steps) }}</summary>
        <AiSteps :steps="entry.steps" class="mt-1" />
      </details>
      <template v-if="entry.error">
        <div class="text-sm text-destructive_text whitespace-pre-wrap break-words">{{ entry.text }}</div>
        <details v-if="entry.errorDetails" class="mt-1 text-xs text-muted-foreground">
          <summary class="cursor-pointer select-none">Provider message</summary>
          <div class="mt-1 whitespace-pre-wrap break-words font-mono">{{ entry.errorDetails }}</div>
        </details>
        <Button
          v-if="entry.suggestAuto && lastAnswer"
          size="sm"
          variant="outline"
          class="mt-2 h-7 gap-1.5 text-xs"
          :disabled="busy"
          @click="retryWithAuto"
        >
          <Wand2 class="h-3.5 w-3.5" />
          Switch to Auto and try again
        </Button>
      </template>
      <div v-else class="ai-answer markdown-body text-sm break-words leading-relaxed" v-html="renderAnswer(entry.id, entry.text, entry.events)" />
      <div v-if="entry.model || entry.usage" class="mt-1 flex flex-wrap gap-x-1 text-[10px] text-muted-foreground">
        <span v-if="entry.model" :title="entry.model">{{ modelName(models, entry.model) }}</span>
        <span v-if="entry.model && entry.usage">·</span>
        <span v-if="entry.usage" :title="usageTitle(entry.usage)">{{ usageLine(entry.usage) }}</span>
      </div>
    </div>
    <div class="ai-entry-actions mt-0.5 flex items-center gap-0.5">
      <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground" :title="copied ? 'Copied' : 'Copy'" @click="emit('copy')">
        <Check v-if="copied" class="h-3.5 w-3.5" />
        <Copy v-else class="h-3.5 w-3.5" />
      </Button>
      <Button
        v-if="lastAnswer"
        variant="ghost"
        size="icon"
        class="h-6 w-6 text-muted-foreground"
        title="Try again"
        :disabled="busy || !ready"
        @click="retry"
      >
        <RotateCcw class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
