<script setup lang="ts">
import { reactive } from 'vue'
import { KeyRound } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { aiCredentials, saveAiCredentials } from './credentials'
import type { AiProviderId } from './types'

const KEY_PROVIDERS: {
  id: AiProviderId
  field: 'geminiKey' | 'openRouterKey' | 'groqKey'
  label: string
  recommended?: boolean
  consoleName: string
  consoleUrl: string
}[] = [
  { id: 'gemini', field: 'geminiKey', label: 'Gemini', recommended: true, consoleName: 'Google AI Studio', consoleUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openrouter', field: 'openRouterKey', label: 'OpenRouter', consoleName: 'OpenRouter', consoleUrl: 'https://openrouter.ai/settings/keys' },
  { id: 'groq', field: 'groqKey', label: 'Groq', consoleName: 'GroqCloud', consoleUrl: 'https://console.groq.com/keys' },
]

const drafts = reactive<Record<AiProviderId, string>>({ gemini: '', openrouter: '', groq: '' })

function masked(key: string): string {
  return `${'•'.repeat(8)}${key.slice(-4)}`
}

async function saveKey(provider: (typeof KEY_PROVIDERS)[number]) {
  const key = drafts[provider.id].trim()
  if (!key) return
  await saveAiCredentials({ [provider.field]: key, provider: provider.id })
  drafts[provider.id] = ''
}
</script>

<template>
  <div class="space-y-4 text-sm">
    <div v-for="(p, i) in KEY_PROVIDERS" :key="p.id" class="space-y-2" :class="{ 'border-t pt-3': i > 0 }">
      <div class="flex items-center gap-2 font-medium">
        {{ p.label }}
        <span class="text-xs font-normal text-muted-foreground">your own API key</span>
        <span v-if="p.recommended" class="ml-auto rounded border px-1.5 py-px text-[10px] font-normal leading-4 text-muted-foreground">recommended</span>
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

    <p class="text-xs text-muted-foreground border-t pt-3">Keys stay in this browser and are not included in settings export.</p>
  </div>
</template>
