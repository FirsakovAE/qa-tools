<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@/i18n'
import { useDebounceFn } from '@vueuse/core'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/Textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aiCredentials, CUSTOM_STYLE_MAX, loadAiCredentials, saveAiCredentials, type AiDetail, type AiRouting, type AiTone } from '../credentials'
import AiSettingsHead from './AiSettingsHead.vue'

const { t } = useI18n()

const TONES = computed((): Array<{ id: AiTone; label: string; hint: string }> => [
  { id: 'default', label: t('ai.toneDefault'), hint: t('ai.hintBalanced') },
  { id: 'professional', label: t('ai.toneProfessional'), hint: t('ai.hintPrecise') },
  { id: 'friendly', label: t('ai.toneFriendly'), hint: t('ai.hintFriendly') },
  { id: 'direct', label: t('ai.toneDirect'), hint: t('ai.hintDirect') },
  { id: 'mentor', label: t('ai.toneMentor'), hint: t('ai.hintMentor') },
])

const DETAILS = computed((): Array<{ id: AiDetail; label: string; hint: string }> => [
  { id: 'brief', label: t('ai.detailBrief'), hint: t('ai.hintBrief') },
  { id: 'normal', label: t('ai.detailNormal'), hint: t('ai.hintNormal') },
  { id: 'detailed', label: t('ai.detailDetailed'), hint: t('ai.hintDetailed') },
])

const ROUTINGS = computed((): Array<{ id: AiRouting; label: string; hint: string }> => [
  { id: 'full', label: t('ai.detailFull'), hint: t('ai.hintFull') },
  { id: 'lite', label: t('ai.detailLite'), hint: t('ai.hintLite') },
])

const toneHint = computed(() => TONES.value.find(option => option.id === aiCredentials.tone)?.hint ?? '')
const detailHint = computed(() => DETAILS.value.find(option => option.id === aiCredentials.detail)?.hint ?? '')
const routingHint = computed(() => ROUTINGS.value.find(option => option.id === aiCredentials.routing)?.hint ?? '')
const customStyle = ref('')
const saveStyle = useDebounceFn((text: string) => saveAiCredentials({ customStyle: text }), 400)
const isDefault = computed(() => aiCredentials.tone === 'default' && aiCredentials.detail === 'normal' && aiCredentials.routing === 'lite' && !customStyle.value)

function onStyle(value: string | number | undefined) {
  customStyle.value = String(value ?? '').slice(0, CUSTOM_STYLE_MAX)
  void saveStyle(customStyle.value)
}

function reset() {
  customStyle.value = ''
  void saveAiCredentials({ tone: 'default', detail: 'normal', routing: 'lite', customStyle: '' })
}

onMounted(async () => {
  await loadAiCredentials()
  customStyle.value = aiCredentials.customStyle
})
</script>

<template>
  <div id="ai-personalization-section" class="space-y-4 border-t pt-4">
    <AiSettingsHead :title="t('ai.personalization')" :reset-label="t('common.defaults')" :reset-disabled="isDefault" @reset="reset" />

    <div class="space-y-2">
      <Label class="text-xs font-medium text-muted-foreground">{{ t('ai.tone') }}</Label>
      <div class="flex items-center gap-3">
        <div class="shrink-0">
          <Select :model-value="aiCredentials.tone" @update:model-value="saveAiCredentials({ tone: $event as AiTone })">
            <SelectTrigger class="h-8 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="tone in TONES" :key="tone.id" :value="tone.id">{{ tone.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span class="min-w-0 flex-1 text-xs text-muted-foreground">{{ toneHint }}</span>
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-xs font-medium text-muted-foreground">{{ t('ai.detail') }}</Label>
      <div class="flex items-center gap-3">
        <div class="shrink-0">
          <Select :model-value="aiCredentials.detail" @update:model-value="saveAiCredentials({ detail: $event as AiDetail })">
            <SelectTrigger class="h-8 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="detail in DETAILS" :key="detail.id" :value="detail.id">{{ detail.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span class="min-w-0 flex-1 text-xs text-muted-foreground">{{ detailHint }}</span>
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-xs font-medium text-muted-foreground">{{ t('ai.routing') }}</Label>
      <div class="flex items-center gap-3">
        <div class="shrink-0">
          <Select :model-value="aiCredentials.routing" @update:model-value="saveAiCredentials({ routing: $event as AiRouting })">
            <SelectTrigger class="h-8 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="routing in ROUTINGS" :key="routing.id" :value="routing.id">{{ routing.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span class="min-w-0 flex-1 text-xs text-muted-foreground">{{ routingHint }}</span>
      </div>
    </div>

    <div class="space-y-2">
      <Label for="ai-custom-style" class="text-xs font-medium text-muted-foreground">{{ t('ai.style') }}</Label>
      <Textarea
        id="ai-custom-style"
        :model-value="customStyle"
        :maxlength="CUSTOM_STYLE_MAX"
        rows="4"
        :placeholder="t('ai.stylePh')"
        @update:model-value="onStyle"
      />
      <p class="text-xs text-muted-foreground">
        <span class="float-right tabular-nums">{{ customStyle.length }} / {{ CUSTOM_STYLE_MAX }}</span>
      </p>
    </div>
  </div>
</template>
