<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from '@/i18n'
import { Check, Copy, ExternalLink } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import usdtQr from '@/assets/usdt.jpg'

const BOOSTY_URL = 'https://boosty.to/adambarmy'
const USDT_ADDRESS = 'TPStwFujav3ZZATYb43iwHrrpMCZaoud84'

const { t } = useI18n()
const donateOpen = ref(false)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

function markCopied(): void {
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
    copiedTimer = null
  }, 2000)
}

async function copyAddress(): Promise<void> {
  try {
    await navigator.clipboard.writeText(USDT_ADDRESS)
    markCopied()
  } catch (error) {
    console.error('[settings/SupportMenu] copy address failed:', error)
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="mt-2 w-full">
    <div class="border border-transparent px-2">
      <h4 class="text-sm font-semibold leading-tight">{{ t('support.title') }}</h4>
      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
        {{ t('support.fund') }}
      </p>
    </div>

    <div class="mt-2 flex flex-col gap-1.5">
      <a
        :href="BOOSTY_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-md border px-2 py-1.5 text-left hover:bg-accent"
      >
        <span class="flex items-center gap-1 text-sm font-medium leading-tight">
          {{ t('support.monthly') }}
          <ExternalLink class="h-3 w-3 shrink-0 opacity-60" />
        </span>
        <span class="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {{ t('support.boosty') }}
        </span>
      </a>

      <button
        type="button"
        class="rounded-md border px-2 py-1.5 text-left hover:bg-accent"
        @click="donateOpen = true"
      >
        <span class="block text-sm font-medium leading-tight">{{ t('support.usdt') }}</span>
        <span class="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {{ t('support.usdtShort') }}
        </span>
      </button>
    </div>

    <Dialog v-model:open="donateOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t('support.usdt') }}</DialogTitle>
          <DialogDescription>
            {{ t('support.usdtLong') }}
          </DialogDescription>
        </DialogHeader>
        <img
          :src="usdtQr"
          :alt="t('about.qrAlt')"
          class="mx-auto w-full max-w-[280px] rounded-md bg-white"
        />
        <p class="select-all break-all text-center font-mono text-xs leading-relaxed">
          {{ USDT_ADDRESS }}
        </p>
        <Button variant="outline" size="sm" class="w-full gap-1.5" @click="copyAddress">
          <component :is="copied ? Check : Copy" class="h-3.5 w-3.5" />
          {{ copied ? t('support.copied') : t('about.copyAddress') }}
        </Button>
      </DialogContent>
    </Dialog>
  </div>
</template>
