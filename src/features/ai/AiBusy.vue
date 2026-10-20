<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, ShieldQuestion } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import AiThought from './AiThought.vue'
import AiSteps from './AiSteps.vue'
import { useAiChat } from './useAiChat'
import { renderMarkdown } from './markdown'
import { isToolStep } from './format'

const GROUP_LABELS = { logs: 'logs', sources: 'page code' } as const

defineEmits<{ (e: 'click', event: MouseEvent): void }>()

const { liveSteps, liveText, liveReasoning, pendingApproval, answerApproval } = useAiChat()

const html = computed(() => (liveText.value ? renderMarkdown(liveText.value) : ''))
const status = computed(() => {
  if (pendingApproval.value) return 'Waiting for your permission...'
  if (liveText.value) return 'Answering...'
  if (liveReasoning.value) return 'Thinking...'
  return liveSteps.value.some(isToolStep) ? 'Investigating...' : 'Waiting for the model...'
})
</script>

<template>
  <div class="flex justify-start">
    <div class="max-w-[95%] min-w-0 rounded-lg border px-3 py-2 bg-background text-xs text-muted-foreground space-y-1">
      <div class="flex items-center gap-2">
        <Loader2 class="h-3.5 w-3.5 animate-spin" />
        {{ status }}
      </div>
      <AiSteps v-if="liveSteps.length" :steps="liveSteps" />
      <div v-if="pendingApproval" class="rounded-md border border-orange-500/40 bg-orange-500/5 p-2 space-y-2 text-foreground">
        <div class="flex items-center gap-1.5 font-medium">
          <ShieldQuestion class="h-3.5 w-3.5 text-orange-500" />
          Allow the assistant to read {{ GROUP_LABELS[pendingApproval.group] }}?
        </div>
        <div class="font-mono break-all text-muted-foreground">
          <span class="text-foreground/70">{{ pendingApproval.step.tool }}</span> {{ pendingApproval.step.summary }}
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Button size="sm" class="h-7 text-xs" @click="answerApproval('once')">Allow</Button>
          <Button size="sm" variant="outline" class="h-7 text-xs" @click="answerApproval('chat')">Allow in this chat</Button>
          <Button size="sm" variant="ghost" class="h-7 text-xs" @click="answerApproval('deny')">Deny</Button>
        </div>
      </div>
      <AiThought v-if="liveReasoning" :text="liveReasoning" active />
      <div v-if="html" class="ai-answer markdown-body text-sm text-foreground break-words leading-relaxed" @click="$emit('click', $event)" v-html="html" />
    </div>
  </div>
</template>
