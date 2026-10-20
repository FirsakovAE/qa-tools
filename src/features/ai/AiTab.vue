<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/Toaster'
import { useAiChat } from './useAiChat'
import { copyToClipboard } from '@/utils/networkUtils'
import { useLogs } from '@/features/logs/useLogs'
import { openLogsEvent } from '@/features/logs/logsNavigation'
import { quotaLine } from './format'
import AiToolbar from './AiToolbar.vue'
import AiWelcome from './AiWelcome.vue'
import AiEntry from './AiEntry.vue'
import AiBusy from './AiBusy.vue'
import AiComposer from './AiComposer.vue'
import '@/assets/markdown.css'
import './ai.css'

const emit = defineEmits<{
  (e: 'navigate-to-options', anchor: string): void
}>()

const { credentials, entries, busy, liveSteps, liveText, liveReasoning, models, provider, model, pendingApproval, ready, send, stop } = useAiChat()
const { getEvent } = useLogs()

function openSettings(anchor = 'ai-connection-section') {
  emit('navigate-to-options', anchor)
}

function submit(text: string) {
  if (text.trim() && !busy.value && ready.value) void send(text)
}

const COPIED_MS = 1500
const copiedId = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copiedTimer))

async function copyText(text: string): Promise<boolean> {
  const ok = await copyToClipboard(text)
  if (!ok) toast.error('Could not copy to the clipboard')
  return ok
}

async function copyEntry(id: string, text: string) {
  if (!(await copyText(text))) return
  copiedId.value = id
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copiedId.value = null }, COPIED_MS)
}

async function onAnswerClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const link = target?.closest<HTMLElement>('[data-event]')
  if (link) {
    event.preventDefault()
    const id = link.dataset.event!
    if (getEvent(id)) openLogsEvent(id)
    else toast.error('The event is no longer in the logs')
    return
  }
  const button = target?.closest<HTMLElement>('[data-copy-code]')
  const code = button?.parentElement?.querySelector('pre')?.textContent
  if (!button || code == null) return
  if (!(await copyText(code))) return
  button.classList.add('copied')
  setTimeout(() => button.classList.remove('copied'), COPIED_MS)
}

const conversation = ref<InstanceType<typeof ScrollArea> | null>(null)

function viewport(): HTMLElement | null {
  return conversation.value?.$el?.querySelector('[data-scroll-viewport]') ?? null
}

function scrollToEnd() {
  const el = viewport()
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => [entries.value.length, liveSteps.value.length, busy.value, pendingApproval.value], () => nextTick(scrollToEnd))

onMounted(() => {
  void nextTick(() => {
    scrollToEnd()
    requestAnimationFrame(() => {
      scrollToEnd()
      requestAnimationFrame(scrollToEnd)
    })
  })
})

watch([liveText, liveReasoning], () => {
  const el = viewport()
  if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) void nextTick(scrollToEnd)
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <AiToolbar @open-settings="openSettings()" />

    <ScrollArea ref="conversation" :horizontal="false" class="flex-1 min-h-0">
      <div class="p-3 space-y-3">
        <AiWelcome @open-settings="openSettings" @submit="submit" />
        <template v-if="credentials.consent">
          <AiEntry
            v-for="entry in entries"
            :key="entry.id"
            :entry="entry"
            :copied="copiedId === entry.id"
            @copy="copyEntry(entry.id, entry.text)"
            @click="onAnswerClick"
          />
          <AiBusy v-if="busy" @click="onAnswerClick" />
        </template>
      </div>
    </ScrollArea>

    <div class="shrink-0 border-t p-2 space-y-1">
      <AiComposer :ready="ready" :busy="busy" @submit="submit" @stop="stop" />
      <p v-if="ready" class="text-[10px] text-muted-foreground">{{ quotaLine(provider, model, models) }}</p>
    </div>
  </div>
</template>
