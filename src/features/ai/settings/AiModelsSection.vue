<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  activeKey,
  aiCredentials,
  isModelBlocked,
  loadAiCredentials,
  saveAiCredentials,
  setModelBlocked,
} from '../credentials'
import { loadModels, providerModels } from '../models'
import { clearProviderStatus, modelStatus, requestsToday, statusLabel } from '../modelStatus'
import { PROVIDER_LABELS } from '../providers'
import type { AiModel, AiProviderId } from '../types'
import AiSettingsHead from './AiSettingsHead.vue'

const modelsProvider = ref<AiProviderId>('openrouter')
const { all, loading, error, reload } = providerModels(() => modelsProvider.value)

const hasKey = computed(() => !!activeKey(modelsProvider.value))
const blockedCount = computed(() => all.value.filter(m => isModelBlocked(m.id, modelsProvider.value)).length)
const markedCount = computed(() => all.value.filter(m => modelStatus(modelsProvider.value, m.id)).length)
const sorted = computed(() =>
  [...all.value].sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended) || a.name.localeCompare(b.name)),
)

function setAllowed(model: AiModel, allowed: boolean) {
  const provider = modelsProvider.value
  if (!allowed && all.value.every(m => m.id === model.id || isModelBlocked(m.id, provider))) return
  void setModelBlocked(provider, model.id, !allowed)
}

function isLastAllowed(model: AiModel): boolean {
  const provider = modelsProvider.value
  return !isModelBlocked(model.id, provider) && all.value.every(m => m.id === model.id || isModelBlocked(m.id, provider))
}

watch(modelsProvider, id => { if (activeKey(id)) void loadModels(id) })

onMounted(async () => {
  await loadAiCredentials()
  modelsProvider.value = aiCredentials.provider
  if (activeKey(modelsProvider.value)) void loadModels(modelsProvider.value)
})
</script>

<template>
  <div id="ai-models-section" class="space-y-4 border-t pt-4">
    <AiSettingsHead
      title="Models"
      description="Unchecked models are hidden on the AI tab and never used by Auto. Auto also skips models that ran out of quota or are unavailable for the key until their limit resets; a hand-picked model is always used as chosen."
      reset-label="Allow all"
      :reset-disabled="blockedCount === 0"
      @reset="saveAiCredentials({ blockedModels: { ...aiCredentials.blockedModels, [modelsProvider]: [] } })"
    >
      <template #actions>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 text-xs gap-1.5"
          :disabled="markedCount === 0"
          title="Forget quota and availability errors: Auto tries these models again"
          @click="clearProviderStatus(modelsProvider)"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          Reset limits
        </Button>
      </template>
    </AiSettingsHead>

    <div class="flex items-center gap-2">
      <Select v-model="modelsProvider">
        <SelectTrigger class="h-8 w-[140px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="(label, id) in PROVIDER_LABELS" :key="id" :value="id">{{ label }}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        v-if="hasKey"
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        title="Reload the model list"
        :disabled="loading"
        @click="reload(true)"
      >
        <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
      </Button>
      <span v-if="all.length" class="text-xs text-muted-foreground ml-auto tabular-nums">
        {{ all.length - blockedCount }} of {{ all.length }} available
      </span>
    </div>

    <p v-if="!hasKey" class="text-xs text-muted-foreground">
      Connect {{ PROVIDER_LABELS[modelsProvider] }} above to see its models.
    </p>
    <p v-else-if="loading && !all.length" class="text-xs text-muted-foreground">Loading models...</p>
    <p v-else-if="error" class="text-sm text-destructive_text">{{ error }}</p>
    <div v-else class="space-y-1">
      <div v-for="m in sorted" :key="m.id" class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
        <Checkbox
          :id="`ai-model-${m.id}`"
          :model-value="!isModelBlocked(m.id, modelsProvider)"
          :disabled="isLastAllowed(m)"
          @update:model-value="setAllowed(m, !!$event)"
        />
        <Label
          :for="`ai-model-${m.id}`"
          class="flex-1 min-w-0 text-sm font-normal cursor-pointer"
          :class="{ 'text-muted-foreground line-through': isModelBlocked(m.id, modelsProvider) }"
        >
          <span class="block truncate" :title="m.id">{{ m.name }}</span>
          <span
            v-if="statusLabel(modelsProvider, m.id)"
            class="block truncate text-[11px] text-orange-500"
            :title="modelStatus(modelsProvider, m.id)?.message"
          >{{ statusLabel(modelsProvider, m.id) }}</span>
        </Label>
        <span v-if="requestsToday(modelsProvider, m.id)" class="text-[10px] text-muted-foreground shrink-0 tabular-nums">
          {{ requestsToday(modelsProvider, m.id) }} today
        </span>
        <span v-if="m.recommended" class="text-[10px] text-muted-foreground shrink-0">recommended</span>
        <span v-if="m.unstable" class="text-[10px] text-orange-500 shrink-0">unstable</span>
      </div>
    </div>
  </div>
</template>
