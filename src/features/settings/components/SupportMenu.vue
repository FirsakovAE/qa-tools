<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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
const root = ref<HTMLElement | null>(null)
const compact = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
let descriptionHeight = 0
let resizeObserver: ResizeObserver | null = null
let observedViewport: HTMLElement | null = null
let frame = 0

function navViewport(): HTMLElement | null {
  return root.value?.parentElement?.querySelector<HTMLElement>('[data-reka-scroll-area-viewport]') ?? null
}

function measureDescriptions(): number {
  if (!root.value) return 0
  let height = 0
  root.value.querySelectorAll<HTMLElement>('.support-detail').forEach(node => {
    const style = getComputedStyle(node)
    height += node.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
  })
  return height
}

function scheduleUpdate(): void {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => updateCompact())
}

function updateCompact(): void {
  const viewport = navViewport()
  if (!viewport || viewport.clientHeight < 40) return
  if (resizeObserver && viewport !== observedViewport) {
    resizeObserver.observe(viewport)
    observedViewport = viewport
  }

  const contentHeight = viewport.firstElementChild?.getBoundingClientRect().height ?? 0
  const spare = viewport.clientHeight - contentHeight
  if (!compact.value) {
    if (spare < -1) {
      const saved = measureDescriptions()
      if (saved <= 0) return
      descriptionHeight = saved
      compact.value = true
    }
    return
  }
  if (spare > descriptionHeight + 8) compact.value = false
}

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

onMounted(() => {
  window.addEventListener('resize', scheduleUpdate)
  nextTick(() => {
    scheduleUpdate()
    const parent = root.value?.parentElement
    if (!parent) return
    resizeObserver = new ResizeObserver(() => scheduleUpdate())
    resizeObserver.observe(parent)
    if (root.value) resizeObserver.observe(root.value)
    const viewport = navViewport()
    if (viewport) {
      resizeObserver.observe(viewport)
      observedViewport = viewport
    }
  })
})

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', scheduleUpdate)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="root" class="mt-2 w-full">
    <div class="border border-transparent px-2">
      <h4 class="text-sm font-semibold leading-tight">{{ t('support.title') }}</h4>
      <p v-if="!compact" class="support-detail mt-1 text-xs leading-relaxed text-muted-foreground">
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
        <span v-if="!compact" class="support-detail mt-0.5 block text-xs leading-snug text-muted-foreground">
          {{ t('support.boosty') }}
        </span>
      </a>

      <button
        type="button"
        class="rounded-md border px-2 py-1.5 text-left hover:bg-accent"
        @click="donateOpen = true"
      >
        <span class="block text-sm font-medium leading-tight">{{ t('support.usdt') }}</span>
        <span v-if="!compact" class="support-detail mt-0.5 block text-xs leading-snug text-muted-foreground">
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
