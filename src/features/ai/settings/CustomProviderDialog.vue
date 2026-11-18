<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { ChevronDown, ChevronRight, Loader2, PlugZap } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/Dialog'
import { aiCredentials, saveCustomProvider, setModelAdded } from '../credentials'
import {
  CUSTOM_PRESETS,
  CUSTOM_PRESET_IDS,
  formatHeaders,
  isInsecureRemote,
  isValidBaseUrl,
  newCustomProviderId,
  normalizeBaseUrl,
  parseHeaders,
} from '../customProviders'
import { AiProviderError, testConnection, type ConnectionTest } from '../providers'
import type { ContextSize, CustomPreset, CustomProvider, ToolSupport } from '../types'
import AiSelectRow from './AiSelectRow.vue'
import AiFlag from './AiFlag.vue'

const props = defineProps<{
  /** The connection to edit; a new one when missing */
  provider?: CustomProvider | null
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const PRESET_OPTIONS = CUSTOM_PRESET_IDS.map(id => ({ id, label: CUSTOM_PRESETS[id].label }))
const toolOptions = computed(() => [
  { id: 'native' as const, label: t('ai.nativeTools') },
  { id: 'text' as const, label: t('ai.textTools') },
  { id: 'none' as const, label: t('ai.noTools') },
])
const contextOptions = computed(() => [
  { id: 'small' as const, label: t('ai.sizeSmall') },
  { id: 'medium' as const, label: t('ai.sizeMedium') },
  { id: 'large' as const, label: t('ai.sizeLarge') },
])

const form = reactive({
  preset: 'openai' as CustomPreset,
  label: '',
  baseUrl: '',
  apiKey: '',
  headers: '',
  tools: 'native' as ToolSupport,
  context: 'large' as ContextSize,
  stream: true,
  testModel: '',
})
const draftId = ref(newCustomProviderId())
const advanced = ref(false)
const testing = ref(false)
const saving = ref(false)
const test = ref<ConnectionTest | null>(null)
const testError = ref<{ message: string; details?: string } | null>(null)

const preset = computed(() => CUSTOM_PRESETS[form.preset])
const editing = computed(() => !!props.provider)
const baseUrl = computed(() => normalizeBaseUrl(form.baseUrl))
const urlValid = computed(() => isValidBaseUrl(form.baseUrl))
const keyMissing = computed(() => preset.value.needsKey && !form.apiKey.trim())
const canSave = computed(() => urlValid.value && !keyMissing.value && !saving.value)

function reset() {
  const p = props.provider
  const info = CUSTOM_PRESETS[p?.preset ?? 'openai']
  draftId.value = p?.id ?? newCustomProviderId()
  Object.assign(form, {
    preset: p?.preset ?? 'openai',
    label: p?.label ?? info.label,
    baseUrl: p?.baseUrl ?? info.baseUrl,
    apiKey: p?.apiKey ?? '',
    headers: formatHeaders(p?.headers ?? {}),
    tools: p?.tools ?? info.tools,
    context: p?.context ?? info.context,
    stream: p?.stream ?? true,
    testModel: '',
  })
  advanced.value = !!p && (Object.keys(p.headers).length > 0 || p.tools !== info.tools)
  test.value = null
  testError.value = null
}

watch(open, value => { if (value) reset() }, { immediate: true })

/** A preset replaces only the fields the user has not changed from the previous preset */
watch(() => form.preset, (next, prev) => {
  const was = CUSTOM_PRESETS[prev]
  const now = CUSTOM_PRESETS[next]
  if (!form.label.trim() || form.label === was.label) form.label = now.label
  if (!form.baseUrl.trim() || normalizeBaseUrl(form.baseUrl) === was.baseUrl) form.baseUrl = now.baseUrl
  if (form.context === was.context) form.context = now.context
  if (form.tools === was.tools) form.tools = now.tools
  test.value = null
  testError.value = null
})

function draft(): CustomProvider {
  return {
    id: draftId.value,
    preset: form.preset,
    label: form.label.trim().slice(0, 40) || preset.value.label,
    baseUrl: baseUrl.value,
    apiKey: form.apiKey.trim(),
    headers: parseHeaders(form.headers),
    tools: form.tools,
    stream: form.stream,
    context: form.context,
    consent: props.provider?.consent ?? false,
  }
}

async function runTest() {
  if (!urlValid.value || testing.value) return
  testing.value = true
  test.value = null
  testError.value = null
  try {
    const result = await testConnection(draft(), form.testModel.trim())
    test.value = result
    form.tools = result.tools
  } catch (e) {
    testError.value = {
      message: String((e as Error)?.message || e),
      details: e instanceof AiProviderError ? e.details : undefined,
    }
  } finally {
    testing.value = false
  }
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const provider = draft()
    await saveCustomProvider(provider)
    const typed = form.testModel.trim()
    if (typed && !test.value?.models.some(m => m.id === typed) && !aiCredentials.addedModels[provider.id]?.some(m => m.id === typed)) {
      await setModelAdded(provider.id, { id: typed, name: typed }, true)
    }
    open.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogScrollContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editing ? t('ai.editConnection') : t('ai.addProvider') }}</DialogTitle>
        <DialogDescription>
          {{ t('ai.providerIntro') }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-3 text-sm" @submit.prevent="save">
        <AiSelectRow id="ai-custom-preset" v-model="form.preset" :label="t('common.type')" :options="PRESET_OPTIONS" />
        <p class="text-xs text-muted-foreground">{{ preset.hint }}</p>

        <div class="space-y-1.5">
          <Label for="ai-custom-label" class="block text-sm font-normal">{{ t('general.name') }}</Label>
          <Input id="ai-custom-label" v-model="form.label" class="h-8 text-sm" maxlength="40" :placeholder="preset.label" />
        </div>

        <div class="space-y-1.5">
          <Label for="ai-custom-url" class="block text-sm font-normal">{{ t('ai.baseUrl') }}</Label>
          <Input id="ai-custom-url" v-model="form.baseUrl" class="h-8 text-sm" placeholder="https://host/v1" autocomplete="off" />
          <p v-if="form.baseUrl && !urlValid" class="text-xs text-destructive_text">{{ t('ai.baseUrlHint') }}</p>
          <p v-else-if="isInsecureRemote(baseUrl)" class="text-xs text-orange-500">{{ t('ai.httpRemote') }}</p>
          <p v-else class="text-xs text-muted-foreground break-all">{{ t('ai.requestsGo', { url: baseUrl || '…' }) }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="ai-custom-key" class="block text-sm font-normal">
            {{ t('ai.apiKey') }} <span v-if="!preset.needsKey" class="text-xs text-muted-foreground">{{ t('common.optional') }}</span>
          </Label>
          <Input id="ai-custom-key" v-model="form.apiKey" type="password" class="h-8 text-sm" autocomplete="off" :placeholder="preset.needsKey ? t('common.required') : t('ai.keyOptional')" />
          <p v-if="preset.keyUrl" class="text-xs text-muted-foreground">
            {{ t('ai.createKey') }}
            <a :href="preset.keyUrl" target="_blank" rel="noopener noreferrer" class="underline">{{ preset.keyConsole }}</a>.
          </p>
        </div>

        <button type="button" class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" @click="advanced = !advanced">
          <component :is="advanced ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
          {{ t('ai.advanced') }}
        </button>
        <div v-if="advanced" class="space-y-3 rounded-md border p-3">
          <AiSelectRow
            id="ai-custom-tools"
            v-model="form.tools"
            :label="t('ai.tools')"
            :hint="t('ai.testPicks')"
            :options="toolOptions"
          />
          <AiSelectRow
            id="ai-custom-context"
            v-model="form.context"
            :label="t('ai.contextSize')"
            :hint="t('ai.contextSmaller')"
            :options="contextOptions"
          />
          <AiFlag id="ai-custom-stream" v-model="form.stream" :label="t('ai.stream')" :hint="t('ai.streamOff')" />
          <div class="space-y-1.5">
            <Label for="ai-custom-headers" class="block text-sm font-normal">
              {{ t('ai.extraHeaders') }}
              <span class="block mt-1 text-xs text-muted-foreground">{{ t('ai.headersHint') }}</span>
            </Label>
            <Textarea id="ai-custom-headers" v-model="form.headers" class="min-h-16 text-sm" placeholder="api-key: ..." />
          </div>
        </div>

        <div class="space-y-2 rounded-md border p-3">
          <Label for="ai-custom-test-model" class="block text-sm font-normal">
            {{ t('ai.testModel') }} <span class="text-xs text-muted-foreground">{{ t('common.optional') }}</span>
          </Label>
          <div class="flex items-center gap-2">
            <Input id="ai-custom-test-model" v-model="form.testModel" class="h-8 flex-1 text-sm" :placeholder="t('ai.firstModel')" autocomplete="off" />
            <Button type="button" variant="outline" size="sm" class="h-8 gap-1.5 font-normal" :disabled="!urlValid || testing" @click="runTest">
              <Loader2 v-if="testing" class="h-3.5 w-3.5 animate-spin" />
              <PlugZap v-else class="h-3.5 w-3.5" />
              {{ t('ai.test') }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('ai.testHint') }}</p>
          <p v-if="test" class="text-xs text-green-600">{{ test.note }}</p>
          <div v-if="testError" class="text-xs text-destructive_text space-y-1">
            <p>{{ testError.message }}</p>
            <details v-if="testError.details" class="text-muted-foreground">
              <summary class="cursor-pointer">{{ t('ai.serverResponse') }}</summary>
              <pre class="whitespace-pre-wrap break-all font-sans">{{ testError.details }}</pre>
            </details>
          </div>
        </div>

        <DialogFooter class="flex-row justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" @click="open = false">{{ t('common.cancel') }}</Button>
          <Button type="submit" size="sm" :disabled="!canSave">{{ editing ? t('ai.save') : t('general.add') }}</Button>
        </DialogFooter>
      </form>
    </DialogScrollContent>
  </Dialog>
</template>
