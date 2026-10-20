<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowUp, Brain, Square } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { aiCredentials, saveAiCredentials } from './credentials'

const props = defineProps<{
  ready: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', text: string): void
  (e: 'stop'): void
}>()

/** The input grows with the text up to this many lines, then scrolls */
const INPUT_MAX_LINES = 5

/** Horizontal padding of the input in the one-row layout (pl-3 + pr-1) and of the buttons (pr-1.5), px */
const ROW_INPUT_PADDING = 16
const ROW_ACTIONS_PADDING = 6
const ACTIONS_GAP = 6

const draft = ref('')
const composer = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const actions = ref<HTMLElement | null>(null)
/** Text and buttons share one row while the text fits a single line next to the buttons */
const oneRow = ref(true)
let measureCtx: CanvasRenderingContext2D | null = null

function textFitsRow(): boolean {
  const text = draft.value
  if (!text) return true
  if (text.includes('\n')) return false
  const box = composer.value
  const el = input.value
  if (!box || !el || !actions.value) return true
  const buttons = Array.from(actions.value.children) as HTMLElement[]
  const buttonsWidth = buttons.reduce((sum, b) => sum + b.offsetWidth, 0) + ACTIONS_GAP * Math.max(0, buttons.length - 1)
  const room = box.clientWidth - buttonsWidth - ROW_ACTIONS_PADDING - ROW_INPUT_PADDING
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

function submit() {
  if (!draft.value.trim() || props.busy || !props.ready) return
  emit('submit', draft.value)
  draft.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

function toggleReasoning() {
  void saveAiCredentials({ reasoning: !aiCredentials.reasoning })
}
</script>

<template>
  <div
    ref="composer"
    class="flex rounded-xl border border-border bg-input"
    :class="[oneRow ? 'items-center' : 'flex-col', { 'opacity-50': !ready }]"
    @click.self="input?.focus()"
  >
    <textarea
      ref="input"
      v-model="draft"
      rows="1"
      autocomplete="off"
      class="ai-scroll block resize-none overflow-hidden bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      :class="oneRow ? 'min-w-0 flex-1 py-2.5 pl-3 pr-1' : 'w-full px-3 pt-2.5 pb-1'"
      :disabled="!ready"
      :placeholder="ready ? 'Ask AI' : 'Connect a provider to ask questions'"
      @keydown="onKeydown"
    />
    <div
      ref="actions"
      class="flex shrink-0 items-center justify-end gap-1.5"
      :class="oneRow ? 'pr-1.5' : 'px-2 pb-2'"
      @click.self="input?.focus()"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1.5 rounded-full border px-2.5 text-xs"
              :class="aiCredentials.reasoning ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : 'border-transparent text-muted-foreground'"
              :aria-pressed="aiCredentials.reasoning"
              :disabled="!ready"
              @click="toggleReasoning"
            >
              <Brain class="h-3.5 w-3.5" />
              Reasoning
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" class="max-w-64">
            {{ aiCredentials.reasoning
              ? 'On: thinking models reason before answering. Deeper analysis, but more tokens and time.'
              : 'Off: models answer without reasoning where the model allows it. Saves tokens and time.' }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button v-if="!busy" size="icon" class="h-8 w-8 rounded-full" :disabled="!ready || !draft.trim()" title="Send (Enter; Shift+Enter for a new line)" @click="submit">
        <ArrowUp class="h-4 w-4" />
      </Button>
      <Button v-else size="icon" variant="outline" class="h-8 w-8 rounded-full" title="Stop" @click="emit('stop')">
        <Square class="h-3.5 w-3.5 fill-current" />
      </Button>
    </div>
  </div>
</template>
