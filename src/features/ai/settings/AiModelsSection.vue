<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { RefreshCw, RotateCcw, Search, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  activeKey,
  aiCredentials,
  isModelAdded,
  isModelBlocked,
  loadAiCredentials,
  saveAiCredentials,
  setModelAdded,
  setModelBlocked,
} from '../credentials'
import { loadCatalog, loadModels, providerModels } from '../models'
import { clearProviderStatus, modelStatus, requestsToday, statusLabel } from '../modelStatus'
import { PROVIDER_LABELS } from '../providers'
import type { AiModel, AiProviderId } from '../types'
import AiSettingsHead from './AiSettingsHead.vue'

/** Search results shown at once; the OpenRouter catalog has hundreds of models */
const SEARCH_LIMIT = 60

const modelsProvider = ref<AiProviderId>('openrouter')
const { all, free, loading, error, reload, catalog, catalogLoading, catalogError } = providerModels(() => modelsProvider.value)

const hasKey = computed(() => !!activeKey(modelsProvider.value))
const blockedCount = computed(() => all.value.filter(m => isModelBlocked(m.id, modelsProvider.value)).length)
const markedCount = computed(() => all.value.filter(m => modelStatus(modelsProvider.value, m.id)).length)
const recommendedIds = computed(() => new Set(free.value.filter(m => m.recommended).map(m => m.id)))

function setAllowed(model: AiModel, allowed: boolean) {
  const provider = modelsProvider.value
  if (!allowed && all.value.every(m => m.id === model.id || isModelBlocked(m.id, provider))) return
  void setModelBlocked(provider, model.id, !allowed)
}

function isLastAllowed(model: AiModel): boolean {
  const provider = modelsProvider.value
  return !isModelBlocked(model.id, provider) && all.value.every(m => m.id === model.id || isModelBlocked(m.id, provider))
}

// -------------------- Add or search --------------------
const query = ref('')
const open = ref(false)
const picker = useTemplateRef<HTMLElement>('picker')
onClickOutside(picker, () => { open.value = false })

/** Free models without a query; with one, the whole catalog (free and paid) */
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q
    ? catalog.value.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    : catalog.value.filter(m => !m.paid)
  return list
    .slice()
    .sort((a, b) => Number(!!a.paid) - Number(!!b.paid) || a.name.localeCompare(b.name))
})
const shown = computed(() => results.value.slice(0, SEARCH_LIMIT))

function openPicker() {
  if (!hasKey.value) return
  open.value = true
  void loadCatalog(modelsProvider.value)
}

function inList(model: AiModel): boolean {
  return recommendedIds.value.has(model.id) || isModelAdded(modelsProvider.value, model.id)
}

function toggleAdded(model: AiModel, added: boolean) {
  if (recommendedIds.value.has(model.id)) return
  void setModelAdded(modelsProvider.value, model, added)
}

watch(modelsProvider, id => {
  query.value = ''
  open.value = false
  if (activeKey(id)) void loadModels(id)
})

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
      description="The recommended free models and the ones you add. Unchecked models are hidden on the AI tab. Auto uses only free models and skips those out of quota or unavailable until their limit resets; a hand-picked model is always used as chosen."
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

    <div ref="picker" class="relative">
      <Search class="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        v-model="query"
        class="h-8 pl-8 text-sm"
        placeholder="Add or search model"
        :disabled="!hasKey"
        @focus="openPicker"
        @click="openPicker"
        @keydown.esc="open = false"
      />
      <div
        v-if="open"
        class="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <ScrollArea class="[&>[data-scroll-viewport]]:max-h-72" :horizontal="false">
          <div class="py-1">
            <p v-if="catalogLoading && !catalog.length" class="px-3 py-2 text-xs text-muted-foreground">Loading models...</p>
            <p v-else-if="catalogError" class="px-3 py-2 text-xs text-destructive_text">{{ catalogError }}</p>
            <p v-else-if="!shown.length" class="px-3 py-2 text-xs text-muted-foreground">No models found</p>
            <template v-else>
              <p class="px-3 pt-1 pb-1.5 text-[11px] text-muted-foreground">
                {{ query.trim() ? 'All models of the provider, free and paid' : 'Free models. Type to search paid ones too.' }}
              </p>
              <label
                v-for="m in shown"
                :key="m.id"
                class="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/50"
                :class="recommendedIds.has(m.id) ? 'cursor-default' : 'cursor-pointer'"
              >
                <Checkbox
                  :model-value="inList(m)"
                  :disabled="recommendedIds.has(m.id)"
                  @update:model-value="toggleAdded(m, !!$event)"
                />
                <span class="flex-1 min-w-0">
                  <span class="block truncate">{{ m.name }}</span>
                  <span class="block truncate text-[11px] text-muted-foreground">{{ m.id }}</span>
                </span>
                <span v-if="recommendedIds.has(m.id)" class="text-[10px] text-muted-foreground shrink-0">recommended</span>
                <span
                  class="text-[10px] shrink-0 rounded px-1.5"
                  :class="m.paid ? 'bg-orange-500/15 text-orange-500' : 'bg-muted text-muted-foreground'"
                >{{ m.paid ? 'paid' : 'free' }}</span>
              </label>
              <p v-if="results.length > shown.length" class="px-3 py-1.5 text-[11px] text-muted-foreground">
                {{ results.length - shown.length }} more, refine the search
              </p>
            </template>
          </div>
        </ScrollArea>
      </div>
    </div>

    <p v-if="!hasKey" class="text-xs text-muted-foreground">
      Connect {{ PROVIDER_LABELS[modelsProvider] }} above to see its models.
    </p>
    <p v-else-if="loading && !all.length" class="text-xs text-muted-foreground">Loading models...</p>
    <p v-else-if="error" class="text-sm text-destructive_text">{{ error }}</p>
    <div v-else class="space-y-1">
      <div v-for="m in all" :key="m.id" class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
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
        <span v-if="m.paid" class="text-[10px] shrink-0 rounded px-1.5 bg-orange-500/15 text-orange-500">paid</span>
        <Button
          v-if="!m.recommended"
          variant="ghost"
          size="icon"
          class="h-6 w-6 shrink-0"
          title="Remove from the list"
          :disabled="isLastAllowed(m)"
          @click="setModelAdded(modelsProvider, m, false)"
        >
          <X class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
