<script setup lang="ts">
import { reactive, ref } from 'vue'
import { LogIn, LogOut, KeyRound, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/Toaster'
import {
  aiCredentials,
  canSignInWithOpenRouter,
  saveAiCredentials,
  signInWithOpenRouter,
  signOutOfOpenRouter,
} from './credentials'

type KeyProvider = 'gemini' | 'groq'

const KEY_PROVIDERS: { id: KeyProvider; field: 'geminiKey' | 'groqKey'; label: string; consoleName: string; consoleUrl: string }[] = [
  { id: 'gemini', field: 'geminiKey', label: 'Gemini', consoleName: 'Google AI Studio', consoleUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', field: 'groqKey', label: 'Groq', consoleName: 'GroqCloud', consoleUrl: 'https://console.groq.com/keys' },
]

const signingIn = ref(false)
const drafts = reactive<Record<KeyProvider, string>>({ gemini: '', groq: '' })
const canSignIn = canSignInWithOpenRouter()

function masked(key: string): string {
  return `${'•'.repeat(8)}${key.slice(-4)}`
}

async function signIn() {
  signingIn.value = true
  try {
    await signInWithOpenRouter()
    toast.success('Signed in to OpenRouter')
  } catch (e) {
    toast.error(String((e as Error)?.message || e))
  } finally {
    signingIn.value = false
  }
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
    <div class="space-y-2">
      <div class="font-medium">OpenRouter <span class="text-xs font-normal text-muted-foreground">free models, sign in with your account</span></div>
      <div v-if="aiCredentials.openRouterKey" class="flex items-center gap-2">
        <Check class="h-4 w-4 text-green-600" />
        <span class="flex-1">Signed in</span>
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5" @click="signOutOfOpenRouter">
          <LogOut class="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
      <template v-else>
        <Button size="sm" class="h-8 gap-1.5" :disabled="!canSignIn || signingIn" @click="signIn">
          <LogIn class="h-3.5 w-3.5" />
          {{ signingIn ? 'Waiting for OpenRouter...' : 'Sign in with OpenRouter' }}
        </Button>
        <p v-if="!canSignIn" class="text-xs text-muted-foreground">
          Sign-in needs the browser extension. In the bookmarklet use a Gemini or Groq API key.
        </p>
      </template>
      <p class="text-xs text-muted-foreground">
        Create a free account and manage keys and limits in
        <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" class="underline">OpenRouter</a>.
      </p>
    </div>

    <div v-for="p in KEY_PROVIDERS" :key="p.id" class="space-y-2 border-t pt-3">
      <div class="font-medium">{{ p.label }} <span class="text-xs font-normal text-muted-foreground">your own API key</span></div>
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
