<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { ArrowUp, Square } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { aiAttachments, askAiRequest, attachFiles, attachPastedText, isLongPaste, removeAttachment } from './attachments'
import { attachedLog, clearAttachedLog } from './logFile'
import AiAttachmentChip from './AiAttachmentChip.vue'
import AiAttachButton from './AiAttachButton.vue'

const props = defineProps<{
  ready: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', text: string): void
  (e: 'stop'): void
}>()

const { t } = useI18n()

/** The input grows with the text up to this many lines, then scrolls */
const INPUT_MAX_LINES = 5

/** Horizontal padding of the input in the one-row layout (pl-2 + pr-1) and of the buttons (pr-1.5), px */
const ROW_INPUT_PADDING = 12
const ROW_ACTIONS_PADDING = 6
const ACTIONS_GAP = 6

const draft = ref('')
const composer = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const actions = ref<HTMLElement | null>(null)
const attach = ref<HTMLElement | null>(null)
/** Text and buttons share one row while the text fits a single line next to the buttons */
const oneRow = ref(true)
let measureCtx: CanvasRenderingContext2D | null = null

/** Attached items can be sent without a question */
const canSend = computed(() => props.ready && !props.busy && (!!draft.value.trim() || aiAttachments.value.length > 0))

function textFitsRow(): boolean {
  const text = draft.value
  if (!text) return true
  if (text.includes('\n')) return false
  const box = composer.value
  const el = input.value
  if (!box || !el || !actions.value) return true
  const buttons = Array.from(actions.value.children) as HTMLElement[]
  const buttonsWidth = buttons.reduce((sum, b) => sum + b.offsetWidth, 0) + ACTIONS_GAP * Math.max(0, buttons.length - 1)
  const attachWidth = attach.value ? attach.value.offsetWidth : 0
  const room = box.clientWidth - buttonsWidth - attachWidth - ROW_ACTIONS_PADDING - ROW_INPUT_PADDING
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return true
  measureCtx.font = getComputedStyle(el).font
  // A few px for the caret
  return measureCtx.measureText(text).width + 4 <= room
}

function fitInput() {
  oneRow.value = textFitsRow()
  void nextTick(() => {
    const el = input.value
    if (!el) return
    const style = getComputedStyle(el)
    const max = parseFloat(style.lineHeight) * INPUT_MAX_LINES + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  })
}

watch(draft, () => nextTick(fitInput))

// Layout changes wait for the next frame: changing it inside the observer callback would loop
let observer: ResizeObserver | null = null
let fitFrame = 0
watch(composer, el => {
  observer?.disconnect()
  if (!el) return
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(fitFrame)
    fitFrame = requestAnimationFrame(fitInput)
  })
  observer.observe(el)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(fitFrame)
})

function focusInput() {
  void nextTick(() => input.value?.focus())
}

onMounted(() => {
  if (aiAttachments.value.length) focusInput()
})
watch(askAiRequest, focusInput)

function submit() {
  if (!canSend.value) return
  emit('submit', draft.value)
  draft.value = ''
}

/** Pasted files and long texts become attachments; a short text is pasted as usual */
function onPaste(event: ClipboardEvent) {
  const data = event.clipboardData
  if (!data || !props.ready) return
  const files = Array.from(data.files)
  if (files.length) {
    event.preventDefault()
    void attachFiles(files)
    return
  }
  const text = data.getData('text/plain')
  if (!isLongPaste(text)) return
  event.preventDefault()
  attachPastedText(text)
}

const dragging = ref(false)

function hasFiles(event: DragEvent): boolean {
  return !!event.dataTransfer?.types.includes('Files')
}

function onDragOver(event: DragEvent) {
  if (!props.ready || !hasFiles(event)) return
  event.preventDefault()
  dragging.value = true
}

function onDragLeave(event: DragEvent) {
  const box = event.currentTarget as HTMLElement
  if (!box.contains(event.relatedTarget as Node | null)) dragging.value = false
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (!props.ready || !hasFiles(event)) return
  event.preventDefault()
  void attachFiles(Array.from(event.dataTransfer?.files ?? []))
  focusInput()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

</script>

<template>
  <div
    class="rounded-xl border border-border bg-input"
    :class="{ 'opacity-50': !ready, 'ring-2 ring-primary/60': dragging }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div v-if="attachedLog || aiAttachments.length" class="flex flex-wrap gap-1 px-2 pt-2" data-testid="ai-attachments">
      <AiAttachmentChip
        v-if="attachedLog"
        :item="{ kind: 'logfile', label: attachedLog.name }"
        :title="t('ai.logTip')"
        removable
        @remove="clearAttachedLog()"
      />
      <AiAttachmentChip
        v-for="item in aiAttachments"
        :key="item.key"
        :item="item"
        removable
        @remove="removeAttachment(item.key)"
      />
    </div>
    <div
      ref="composer"
      class="flex"
      :class="oneRow ? 'items-center' : 'flex-col'"
      @click.self="input?.focus()"
    >
      <div v-if="oneRow" ref="attach" class="shrink-0 pl-1.5">
        <AiAttachButton />
      </div>
      <textarea
        ref="input"
        v-model="draft"
        rows="1"
        autocomplete="off"
        class="ai-scroll block resize-none overflow-hidden bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        :class="oneRow ? 'min-w-0 flex-1 py-2.5 pl-2 pr-1' : 'w-full px-3 pt-2.5 pb-1'"
        :disabled="!ready"
        :placeholder="!ready ? t('ai.placeholderOff') : aiAttachments.length ? t('ai.placeholderAttach') : attachedLog ? t('ai.placeholderLog') : t('ai.placeholderOn')"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <div
        ref="actions"
        class="flex shrink-0 items-center gap-1.5"
        :class="oneRow ? 'justify-end pr-1.5' : 'w-full justify-between px-1.5 pb-2'"
        @click.self="input?.focus()"
      >
        <AiAttachButton v-if="!oneRow" />
        <Button v-if="!busy" size="icon" class="h-8 w-8 rounded-full" :disabled="!canSend" :title="t('ai.send')" @click="submit">
          <ArrowUp class="h-4 w-4" />
        </Button>
        <Button v-else size="icon" variant="outline" class="h-8 w-8 rounded-full" :title="t('ai.stop')" @click="emit('stop')">
          <Square class="h-3.5 w-3.5 fill-current" />
        </Button>
      </div>
    </div>
  </div>
</template>
