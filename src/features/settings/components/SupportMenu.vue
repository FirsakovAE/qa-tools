<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
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
    <h4 class="text-sm font-semibold leading-tight">Support Vue Inspector</h4>
    <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
      Fund features and experiments.
    </p>

    <div class="mt-2 flex flex-col gap-1.5">
      <a
        :href="BOOSTY_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-md border px-2 py-1.5 text-left hover:bg-accent"
      >
        <span class="flex items-center gap-1 text-sm font-medium leading-tight">
          Monthly support
          <ExternalLink class="h-3 w-3 shrink-0 opacity-60" />
        </span>
        <span class="mt-0.5 block text-xs leading-snug text-muted-foreground">
          Boosty support levels.
        </span>
      </a>

      <button
        type="button"
        class="rounded-md border px-2 py-1.5 text-left hover:bg-accent"
        @click="donateOpen = true"
      >
        <span class="block text-sm font-medium leading-tight">Donate with USDT</span>
        <span class="mt-0.5 block text-xs leading-snug text-muted-foreground">
          One-time, direct to the author.
        </span>
      </button>
    </div>

    <Dialog v-model:open="donateOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Donate with USDT</DialogTitle>
          <DialogDescription>
            A one-time transfer directly to the author. USDT on Tron (TRC-20).
          </DialogDescription>
        </DialogHeader>
        <img
          :src="usdtQr"
          alt="USDT TRC-20 QR code"
          class="mx-auto w-full max-w-[280px] rounded-md bg-white"
        />
        <p class="select-all break-all text-center font-mono text-xs leading-relaxed">
          {{ USDT_ADDRESS }}
        </p>
        <Button variant="outline" size="sm" class="w-full gap-1.5" @click="copyAddress">
          <component :is="copied ? Check : Copy" class="h-3.5 w-3.5" />
          {{ copied ? 'Copied' : 'Copy address' }}
        </Button>
      </DialogContent>
    </Dialog>
  </div>
</template>
