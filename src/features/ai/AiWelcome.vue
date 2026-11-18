<script setup lang="ts">
import { Sparkles, Settings, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { useAiChat } from './useAiChat'
import { customProvider, giveConsent } from './credentials'
import { providerLabel } from './providers'
import { baseUrlHost, isInsecureRemote, isLocalUrl } from './customProviders'

const emit = defineEmits<{
  (e: 'open-settings', anchor?: string): void
  (e: 'submit', text: string): void
}>()

const { t } = useI18n()
const examples = computed(() => [
  t('ai.exampleFail'),
  t('ai.exampleErrors'),
  t('ai.exampleStore'),
  t('ai.exampleBreakpoint'),
])
const { provider, hasKey, consent, busy, entries } = useAiChat()

const custom = computed(() => customProvider(provider.value))
const target = computed(() => custom.value ? `${custom.value.label} (${baseUrlHost(custom.value.baseUrl)})` : providerLabel(provider.value))
</script>

<template>
  <div v-if="!hasKey" class="max-w-md mx-auto mt-6 border rounded-lg p-4 space-y-3 bg-background">
    <div class="flex items-center gap-2 font-semibold">
      <Sparkles class="h-4 w-4" />
      {{ t('ai.connect') }}
    </div>
    <p class="text-sm text-muted-foreground">
      {{ t('ai.connectBody') }}
    </p>
    <Button size="sm" class="h-8 gap-1.5" @click="emit('open-settings')">
      <Settings class="h-3.5 w-3.5" />
      {{ t('ai.connectLink') }}
    </Button>
  </div>

  <div v-else-if="!consent" class="max-w-md mx-auto mt-6 border rounded-lg p-4 space-y-3 bg-background">
    <div class="flex items-center gap-2 font-semibold">
      <ShieldAlert class="h-4 w-4 text-orange-500" />
      {{ t('ai.dataSent', { provider: target }) }}
    </div>
    <ul class="text-sm text-muted-foreground list-disc pl-5 space-y-1">
      <li>{{ t('ai.sentBody') }}</li>
      <li>{{ t('ai.maskBody') }}</li>
      <li v-if="!custom">{{ t('ai.freeWarn') }}</li>
      <li v-else-if="isLocalUrl(custom.baseUrl)">{{ t('ai.localNote') }}</li>
      <li v-else>{{ t('ai.terms', { host: baseUrlHost(custom.baseUrl) }) }}</li>
      <li v-if="custom && isInsecureRemote(custom.baseUrl)" class="text-orange-500">{{ t('ai.httpWarn') }}</li>
    </ul>
    <div class="flex flex-wrap gap-2">
      <Button size="sm" class="h-8" @click="giveConsent(provider)">{{ t('ai.understand') }}</Button>
      <Button size="sm" variant="outline" class="h-8" @click="emit('open-settings', 'ai-access-section')">{{ t('ai.reviewAccess') }}</Button>
    </div>
  </div>

  <div v-else-if="entries.length === 0 && !busy" class="max-w-lg mx-auto mt-6 space-y-3 text-center">
    <Sparkles class="h-6 w-6 mx-auto text-muted-foreground" />
    <p class="text-sm text-muted-foreground">
      {{ t('ai.welcomeHint') }}
    </p>
    <div class="flex flex-wrap justify-center gap-2">
      <Button
        v-for="example in examples"
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
