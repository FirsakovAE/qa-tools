<script setup lang="ts">
import { reactive, ref } from 'vue'
import { KeyRound, Pencil, Plus, Server, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { aiCredentials, removeCustomProvider, saveAiCredentials } from './credentials'
import { CUSTOM_PRESETS, TOOL_SUPPORTS, baseUrlHost, isLocalUrl } from './customProviders'
import type { BuiltinProviderId, CustomProvider } from './types'
import CustomProviderDialog from './settings/CustomProviderDialog.vue'

const KEY_PROVIDERS: {
  id: BuiltinProviderId
  field: 'geminiKey' | 'openRouterKey'
  label: string
  consoleName: string
  consoleUrl: string
}[] = [
  { id: 'openrouter', field: 'openRouterKey', label: 'OpenRouter', consoleName: 'OpenRouter', consoleUrl: 'https://openrouter.ai/settings/keys' },
  { id: 'gemini', field: 'geminiKey', label: 'Gemini', consoleName: 'Google AI Studio', consoleUrl: 'https://aistudio.google.com/apikey' },
]

const drafts = reactive<Record<BuiltinProviderId, string>>({ gemini: '', openrouter: '' })
const dialogOpen = ref(false)
const editing = ref<CustomProvider | null>(null)

function masked(key: string): string {
  return `${'•'.repeat(8)}${key.slice(-4)}`
}

async function saveKey(provider: (typeof KEY_PROVIDERS)[number]) {
  const key = drafts[provider.id].trim()
  if (!key) return
  await saveAiCredentials({ [provider.field]: key, provider: provider.id })
  drafts[provider.id] = ''
}

function openDialog(provider: CustomProvider | null) {
  editing.value = provider
  dialogOpen.value = true
}

function summary(p: CustomProvider): string {
  const tools = TOOL_SUPPORTS.find(t => t.id === p.tools)?.label.toLowerCase()
  return [
    baseUrlHost(p.baseUrl),
    CUSTOM_PRESETS[p.preset].local || isLocalUrl(p.baseUrl) ? 'local' : '',
    p.apiKey ? `key ${masked(p.apiKey)}` : 'no key',
    tools,
  ].filter(Boolean).join(' · ')
}

/** Connection whose Remove waits for the second click */
const removing = ref<string | null>(null)

function remove(p: CustomProvider) {
  if (removing.value !== p.id) {
    removing.value = p.id
    return
  }
  removing.value = null
  void removeCustomProvider(p.id)
}
</script>

<template>
  <div class="space-y-4 text-sm">
    <div v-for="(p, i) in KEY_PROVIDERS" :key="p.id" class="space-y-2" :class="{ 'border-t pt-3': i > 0 }">
      <div class="flex items-center gap-2 font-medium">
        {{ p.label }}
        <span class="text-xs font-normal text-muted-foreground">your own API key</span>
      </div>
      <div v-if="aiCredentials[p.field]" class="flex items-center gap-2">
        <KeyRound class="h-4 w-4 text-muted-foreground" />
        <span class="flex-1 font-mono text-xs">{{ masked(aiCredentials[p.field]) }}</span>
        <Button variant="ghost" size="sm" class="h-7 text-xs" @click="saveAiCredentials({ [p.field]: '' })">Remove</Button>
      </div>
      <form v-else class="flex items-center gap-2" @submit.prevent="saveKey(p)">
        <Input v-model="drafts[p.id]" type="password" :placeholder="`${p.label} API key`" class="h-8 flex-1" autocomplete="off" />
        <Button type="submit" size="sm" variant="outline" class="h-8" :disabled="!drafts[p.id].trim()">Save</Button>
      </form>
      <p class="text-xs text-muted-foreground">
        Get a free key in
        <a :href="p.consoleUrl" target="_blank" rel="noopener noreferrer" class="underline">{{ p.consoleName }}</a>.
      </p>
    </div>

    <div class="space-y-2 border-t pt-3">
      <div class="flex items-center gap-2 font-medium">
        Your own providers
        <span class="text-xs font-normal text-muted-foreground">OpenAI, DeepSeek, local models, OpenAI-compatible agents</span>
      </div>
      <div
        v-for="p in aiCredentials.customProviders"
        :key="p.id"
        class="flex items-center gap-2 rounded-md border px-2 py-1.5"
      >
        <Server class="h-4 w-4 shrink-0 text-muted-foreground" />
        <div class="flex-1 min-w-0">
          <div class="truncate">{{ p.label }}</div>
          <div class="truncate text-[11px] text-muted-foreground" :title="p.baseUrl">{{ summary(p) }}</div>
        </div>
        <Button variant="ghost" size="icon" class="h-7 w-7" title="Edit the connection" @click="openDialog(p)">
          <Pencil class="h-3.5 w-3.5" />
        </Button>
        <template v-if="removing === p.id">
          <Button variant="ghost" size="sm" class="h-7 text-xs text-destructive_text" @click="remove(p)">Remove</Button>
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="removing = null">Keep</Button>
        </template>
        <Button v-else variant="ghost" size="icon" class="h-7 w-7" title="Remove the connection with its key and model choices" @click="remove(p)">
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
      <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="openDialog(null)">
        <Plus class="h-3.5 w-3.5" />
        Add provider
      </Button>
    </div>

    <p class="text-xs text-muted-foreground border-t pt-3">Keys stay in this browser and are not included in settings export.</p>

    <CustomProviderDialog v-model:open="dialogOpen" :provider="editing" />
  </div>
</template>
