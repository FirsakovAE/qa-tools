<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { Loader2, ShieldQuestion } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import AiThought from './AiThought.vue'
import AiSteps from './AiSteps.vue'
import { useAiChat } from './useAiChat'
import { renderMarkdown } from './markdown'
import { isToolStep } from './format'

defineEmits<{ (e: 'click', event: MouseEvent): void }>()

const { t } = useI18n()
const { liveSteps, liveText, liveReasoning, pendingApproval, answerApproval } = useAiChat()

const html = computed(() => (liveText.value ? renderMarkdown(liveText.value) : ''))
const status = computed(() => {
  if (pendingApproval.value) return t('ai.waitPermission')
  if (liveText.value) return t('ai.answering')
  if (liveReasoning.value) return t('ai.thinking')
  return liveSteps.value.some(isToolStep) ? t('ai.investigating') : t('ai.waitingModel')
})

function permissionPrompt(group: 'logs' | 'sources' | 'page') {
  if (group === 'logs') return t('ai.allowLogs')
  if (group === 'sources') return t('ai.allowCode')
  return t('ai.allowPage')
}
</script>

<template>
  <div class="flex justify-start">
    <div class="max-w-[95%] min-w-0 rounded-lg border px-3 py-2 bg-background text-xs text-muted-foreground space-y-1">
      <div class="flex items-center gap-2">
        <Loader2 class="h-3.5 w-3.5 animate-spin" />
        {{ status }}
      </div>
      <AiSteps v-if="liveSteps.length" :steps="liveSteps" live />
      <div v-if="pendingApproval" class="rounded-md border border-foreground/40 bg-foreground/5 p-2 space-y-2 text-foreground">
        <div class="flex items-center gap-1.5 font-medium">
          <ShieldQuestion class="h-3.5 w-3.5" />
          {{ permissionPrompt(pendingApproval.group) }}
        </div>
        <div class="font-mono break-all text-muted-foreground">
          <span class="text-foreground/70">{{ pendingApproval.step.tool }}</span> {{ pendingApproval.step.summary }}
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Button size="sm" class="h-7 text-xs" @click="answerApproval('once')">{{ t('ai.allow') }}</Button>
          <Button size="sm" variant="outline" class="h-7 text-xs" @click="answerApproval('chat')">{{ t('ai.allowChat') }}</Button>
          <Button size="sm" variant="outline" class="h-7 text-xs" @click="answerApproval('deny')">{{ t('ai.deny') }}</Button>
        </div>
      </div>
      <AiThought v-if="liveReasoning" :text="liveReasoning" />
      <div v-if="html" class="ai-answer markdown-body text-sm text-foreground break-words leading-relaxed" @click="$emit('click', $event)" v-html="html" />
    </div>
  </div>
</template>
