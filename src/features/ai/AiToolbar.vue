<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { MessageSquarePlus, Settings, RefreshCw } from 'lucide-vue-next'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAiChat } from './useAiChat'
import { AUTO_MODEL } from './credentials'
import { modelName, modelNote } from './format'
import { modelStatus } from './modelStatus'
import { providerOptions } from './providers'
import { isCustomProvider } from './customProviders'
import type { AiProviderId } from './types'
import AiIconButton from './AiIconButton.vue'

const emit = defineEmits<{
  (e: 'open-settings', anchor?: string): void
}>()

const { t } = useI18n()

const {
  entries, busy, models, modelsLoading, modelsError, provider, model, auto,
  hasKey, setProvider, setModel, reloadModels, newChat,
} = useAiChat()

const recommended = computed(() => models.value.filter(m => m.recommended))
const others = computed(() => models.value.filter(m => !m.recommended))
const groups = computed(() => [
  { label: 'Recommended', list: recommended.value },
  { label: 'Added', list: others.value },
].filter(g => g.list.length))
</script>

<template>
  <div class="shrink-0 flex flex-wrap items-center gap-2 p-2 border-b">
    <h3 class="text-lg font-semibold shrink-0">AI</h3>

    <Select :model-value="provider" @update:model-value="setProvider($event as AiProviderId)">
      <SelectTrigger class="h-8 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="p in providerOptions()" :key="p.id" :value="p.id">{{ p.label }}</SelectItem>
      </SelectContent>
    </Select>

    <Select v-if="hasKey && models.length" :model-value="model" @update:model-value="setModel(String($event))">
      <SelectTrigger class="h-8 w-[230px] text-xs" :title="auto ? t('ai.autoTip') : model">
        <SelectValue :placeholder="t('ai.model')">{{ auto ? t('ai.auto') : modelName(models, model) }}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="AUTO_MODEL" class="text-xs">
          {{ t('ai.auto') }}<span class="ml-1 text-muted-foreground">· {{ isCustomProvider(provider) ? t('ai.listedSwitches') : t('ai.freeSwitches') }}</span>
        </SelectItem>
        <template v-for="group in groups" :key="group.label">
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel class="text-xs">{{ group.label }}</SelectLabel>
            <SelectItem v-for="m in group.list" :key="m.id" :value="m.id" class="text-xs" :title="modelStatus(provider, m.id)?.message ?? m.id">
              {{ m.name }}<span v-if="modelNote(provider, m)" class="ml-1 text-muted-foreground">· {{ modelNote(provider, m) }}</span>
            </SelectItem>
          </SelectGroup>
        </template>
      </SelectContent>
    </Select>
    <span v-if="modelsLoading" class="text-xs text-muted-foreground">{{ t('ai.checkingModels') }}</span>
    <button v-else-if="modelsError" type="button" class="text-xs text-destructive_text underline" :title="modelsError" @click="reloadModels()">
      {{ t('ai.modelsFailed') }}, {{ t('common.retry') }}
    </button>
    <AiIconButton v-else-if="hasKey && models.length" :tooltip="t('ai.checkModels')" @click="reloadModels()">
      <RefreshCw class="h-3.5 w-3.5" />
    </AiIconButton>

    <div class="ml-auto flex items-center gap-1">
      <AiIconButton :tooltip="t('ai.settingsTip')" @click="emit('open-settings')">
        <Settings class="h-4 w-4" />
      </AiIconButton>
      <AiIconButton :tooltip="t('ai.newChat')" :disabled="entries.length === 0 && !busy" @click="newChat">
        <MessageSquarePlus class="h-4 w-4" />
      </AiIconButton>
    </div>
  </div>
</template>
