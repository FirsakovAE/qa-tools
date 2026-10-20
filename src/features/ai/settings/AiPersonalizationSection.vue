<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/Textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aiCredentials, CUSTOM_STYLE_MAX, loadAiCredentials, saveAiCredentials, type AiDetail, type AiTone } from '../credentials'
import AiSettingsHead from './AiSettingsHead.vue'

const TONES: Array<{ id: AiTone; label: string; hint: string }> = [
  { id: 'default', label: 'Default', hint: 'Balanced answers' },
  { id: 'professional', label: 'Professional', hint: 'Precise, neutral wording' },
  { id: 'friendly', label: 'Friendly', hint: 'Supportive, plain words' },
  { id: 'direct', label: 'Direct', hint: 'Conclusion first, no filler' },
  { id: 'mentor', label: 'Mentor', hint: 'Explains the concepts behind the cause' },
]

const DETAILS: Array<{ id: AiDetail; label: string; hint: string }> = [
  { id: 'brief', label: 'Brief', hint: 'Cause, key evidence and the fix in a few lines' },
  { id: 'normal', label: 'Normal', hint: 'What went wrong, the cause, the evidence and the fix' },
  { id: 'detailed', label: 'Detailed', hint: 'The whole chain of events, ruled-out causes, steps to reproduce' },
]

const toneHint = computed(() => TONES.find(t => t.id === aiCredentials.tone)?.hint ?? '')
const customStyle = ref('')
const saveStyle = useDebounceFn((text: string) => saveAiCredentials({ customStyle: text }), 400)
const isDefault = computed(() => aiCredentials.tone === 'default' && aiCredentials.detail === 'normal' && !customStyle.value)

function onStyle(value: string | number | undefined) {
  customStyle.value = String(value ?? '').slice(0, CUSTOM_STYLE_MAX)
  void saveStyle(customStyle.value)
}

function reset() {
  customStyle.value = ''
  void saveAiCredentials({ tone: 'default', detail: 'normal', customStyle: '' })
}

onMounted(async () => {
  await loadAiCredentials()
  customStyle.value = aiCredentials.customStyle
})
</script>

<template>
  <div id="ai-personalization-section" class="space-y-4 border-t pt-4">
    <AiSettingsHead title="Personalization" reset-label="Defaults" :reset-disabled="isDefault" @reset="reset" />

    <div class="space-y-2">
      <Label class="text-xs font-medium text-muted-foreground">Base style and tone</Label>
      <div class="flex flex-wrap items-center gap-3">
        <Select :model-value="aiCredentials.tone" @update:model-value="saveAiCredentials({ tone: $event as AiTone })">
          <SelectTrigger class="h-8 w-[180px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tone in TONES" :key="tone.id" :value="tone.id">{{ tone.label }}</SelectItem>
          </SelectContent>
        </Select>
        <span class="text-xs text-muted-foreground">{{ toneHint }}</span>
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-xs font-medium text-muted-foreground">Answer detail</Label>
      <RadioGroup :model-value="aiCredentials.detail" class="gap-3" @update:model-value="saveAiCredentials({ detail: $event as AiDetail })">
        <div v-for="detail in DETAILS" :key="detail.id" class="flex items-start space-x-2">
          <RadioGroupItem :id="`ai-detail-${detail.id}`" :value="detail.id" class="mt-0.5" />
          <Label :for="`ai-detail-${detail.id}`" class="text-sm font-normal cursor-pointer">
            {{ detail.label }}
            <span class="block text-xs text-muted-foreground">{{ detail.hint }}</span>
          </Label>
        </div>
      </RadioGroup>
    </div>

    <div class="space-y-2">
      <Label for="ai-custom-style" class="text-xs font-medium text-muted-foreground">Your style instructions</Label>
      <Textarea
        id="ai-custom-style"
        :model-value="customStyle"
        :maxlength="CUSTOM_STYLE_MAX"
        rows="4"
        placeholder="For example: answer in Russian, end with a short checklist for the bug report"
        @update:model-value="onStyle"
      />
      <p class="text-xs text-muted-foreground">
        Added to every question. The rules of the assistant (evidence from the logs and the code) stay in force.
        <span class="float-right tabular-nums">{{ customStyle.length }} / {{ CUSTOM_STYLE_MAX }}</span>
      </p>
    </div>
  </div>
</template>
