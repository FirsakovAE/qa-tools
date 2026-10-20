<script setup lang="ts">
import { Sparkles, Settings, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useAiChat } from './useAiChat'
import { saveAiCredentials } from './credentials'
import { PROVIDER_LABELS } from './providers'

const EXAMPLES = [
  'Why did the last failed request fail?',
  'Explain the errors in the logs and where they come from in the code',
  'Which store changes happened after the last navigation?',
  'How do I set a breakpoint on a request in Vue Inspector?',
]

const emit = defineEmits<{
  (e: 'open-settings', anchor?: string): void
  (e: 'submit', text: string): void
}>()

const { credentials, provider, hasKey, busy, entries } = useAiChat()
</script>

<template>
  <div v-if="!hasKey" class="max-w-md mx-auto mt-6 border rounded-lg p-4 space-y-3 bg-background">
    <div class="flex items-center gap-2 font-semibold">
      <Sparkles class="h-4 w-4" />
      Connect an AI provider
    </div>
    <p class="text-sm text-muted-foreground">
      The assistant reads the captured logs and the page code to explain what went wrong.
      Sign in with OpenRouter to use its free models, or add a Gemini or Groq API key.
    </p>
    <Button size="sm" class="h-8 gap-1.5" @click="emit('open-settings')">
      <Settings class="h-3.5 w-3.5" />
      Connect in Options → AI
    </Button>
  </div>

  <div v-else-if="!credentials.consent" class="max-w-md mx-auto mt-6 border rounded-lg p-4 space-y-3 bg-background">
    <div class="flex items-center gap-2 font-semibold">
      <ShieldAlert class="h-4 w-4 text-orange-500" />
      Data sent to {{ PROVIDER_LABELS[provider] }}
    </div>
    <ul class="text-sm text-muted-foreground list-disc pl-5 space-y-1">
      <li>Your questions, a digest of the captured logs, the event data and the page code the assistant asks for.</li>
      <li>Tokens, passwords, API keys and other values from the AI masking list are replaced with [MASKED] before sending. What the assistant may read is set in Options → AI → Agent access.</li>
      <li>Free models may store prompts and use them for training. Do not use the assistant on pages with data that must not leave your company.</li>
    </ul>
    <div class="flex flex-wrap gap-2">
      <Button size="sm" class="h-8" @click="saveAiCredentials({ consent: true })">I understand</Button>
      <Button size="sm" variant="outline" class="h-8" @click="emit('open-settings', 'ai-access-section')">Review access</Button>
    </div>
  </div>

  <div v-else-if="entries.length === 0 && !busy" class="max-w-lg mx-auto mt-6 space-y-3 text-center">
    <Sparkles class="h-6 w-6 mx-auto text-muted-foreground" />
    <p class="text-sm text-muted-foreground">
      Describe what goes wrong on the site. The assistant starts from the logs digest, reads full events
      when needed and then the page code.
    </p>
    <div class="flex flex-wrap justify-center gap-2">
      <Button
        v-for="example in EXAMPLES"
        :key="example"
        variant="outline"
        size="sm"
        class="h-auto py-1.5 text-xs whitespace-normal text-left"
        @click="emit('submit', example)"
      >
        {{ example }}
      </Button>
    </div>
  </div>
</template>
