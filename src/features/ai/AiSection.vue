<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from '@/i18n'
import { loadAiCredentials } from './credentials'
import { loadModelStatus } from './modelStatus'
import AiAccountPanel from './AiAccountPanel.vue'
import AiAccessSection from './settings/AiAccessSection.vue'
import AiMaskingSection from './settings/AiMaskingSection.vue'
import AiPersonalizationSection from './settings/AiPersonalizationSection.vue'
import AiModelsSection from './settings/AiModelsSection.vue'

const { t } = useI18n()

onMounted(() => { void Promise.all([loadAiCredentials(), loadModelStatus()]) })
</script>

<template>
  <div class="space-y-6">
    <div id="ai-connection-section" class="space-y-4">
      <h4 class="text-sm font-semibold">{{ t('ai.connection') }}</h4>
      <AiAccountPanel />
    </div>
    <AiModelsSection />
    <AiPersonalizationSection />
    <AiAccessSection />
    <AiMaskingSection />
  </div>
</template>
