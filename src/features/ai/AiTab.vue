<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowUp, Brain, Square, MessageSquarePlus, UserRound, Sparkles, Loader2, ShieldAlert, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import AiAccountPanel from './AiAccountPanel.vue'
import AiThought from './AiThought.vue'
import { useAiChat } from './useAiChat'
import { saveAiCredentials } from './credentials'
import { renderMarkdown } from './markdown'
import { busyModels, PROVIDER_LABELS } from './providers'
import type { AiModel, AiProviderId, AiStep, AiUsage } from './types'
import '@/assets/markdown.css'

const {
  credentials,
  entries,
  busy,
  liveSteps,
  liveText,
  liveReasoning,
  models,
  modelsLoading,
  modelsError,
  provider,
  model,
  hasKey,
  ready,
  setProvider,
  setModel,
  reloadModels,
  send,
  stop,
  newChat,
} = useAiChat()

const LIMIT_HINTS: Record<AiProviderId, string> = {
  openrouter: 'Free OpenRouter models allow about 50 requests a day; each assistant step is one request.',
  gemini: 'Gemini free tier limits depend on your Google AI Studio project.',
  groq: 'Groq free tier allows about 1000 requests a day per model and a small context: the assistant sends a shorter logs digest.',
}

const EXAMPLES = [
  'Why did the last failed request fail?',
  'Explain the errors in the logs and where they come from in the code',
  'Which store changes happened after the last navigation?',
  'How do I set a breakpoint on a request in Vue Inspector?',
]

/** The input grows with the text up to this many lines, then scrolls */
const INPUT_MAX_LINES = 5

/** Horizontal padding of the input in the one-row layout (pl-3 + pr-1) and of the buttons (pr-1.5), px */
const ROW_INPUT_PADDING = 16
const ROW_ACTIONS_PADDING = 6
const ACTIONS_GAP = 6

const draft = ref('')
const conversation = ref<InstanceType<typeof ScrollArea> | null>(null)
const composer = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const actions = ref<HTMLElement | null>(null)
/** Text and buttons share one row while the text fits a single line next to the buttons */
const oneRow = ref(true)
let measureCtx: CanvasRenderingContext2D | null = null

function viewport(): HTMLElement | null {
  return conversation.value?.$el?.querySelector('[data-scroll-viewport]') ?? null
}

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
let composerObserver: ResizeObserver | null = null
let fitFrame = 0
watch(composer, el => {
  composerObserver?.disconnect()
  if (!el) return
  composerObserver = new ResizeObserver(() => {
    cancelAnimationFrame(fitFrame)
    fitFrame = requestAnimationFrame(fitInput)
  })
  composerObserver.observe(el)
})
onBeforeUnmount(() => {
  composerObserver?.disconnect()
  cancelAnimationFrame(fitFrame)
})

function toggleReasoning() {
  void saveAiCredentials({ reasoning: !credentials.reasoning })
}

const recommended = computed(() => models.value.filter(m => m.recommended))
const others = computed(() => models.value.filter(m => !m.recommended))
const modelName = computed(() => models.value.find(m => m.id === model.value)?.name ?? model.value)

/** Re-evaluated on each render: busy marks expire on their own */
function modelNote(m: AiModel): string {
  if ((busyModels[m.id] ?? 0) > Date.now()) return 'busy'
  return m.unstable ? 'unstable' : ''
}

function answeredBy(id: string): string {
  return models.value.find(m => m.id === id)?.name ?? id
}

function kilo(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
}

function usageLine(u: AiUsage): string {
  const parts = [`${u.requests} request${u.requests === 1 ? '' : 's'}`]
  if (u.prompt || u.completion) {
    parts.push(`${kilo(u.prompt)} tokens in${u.cached ? ` (${kilo(u.cached)} cached)` : ''}, ${kilo(u.completion)} out`)
  }
  parts.push(`${(u.ms / 1000).toFixed(1)} s`)
  return parts.join(' · ')
}

function usageTitle(u: AiUsage): string {
  const lines = [
    `Requests to the provider: ${u.requests}`,
    `Prompt tokens: ${u.prompt}${u.cached ? `, ${u.cached} of them cached` : ''}`,
    `Completion tokens: ${u.completion}`,
    `Time: ${(u.ms / 1000).toFixed(1)} s`,
  ]
  if (u.unreported) lines.push(`${u.unreported} of the requests came without token counts`)
  return lines.join('\n')
}

const rendered = computed(() => {
  const map = new Map<string, string>()
  for (const entry of entries.value) {
    if (entry.role === 'assistant' && !entry.error) map.set(entry.id, renderMarkdown(entry.text))
  }
  return map
})

const liveHtml = computed(() => (liveText.value ? renderMarkdown(liveText.value) : ''))
const liveStatus = computed(() => {
  if (liveText.value) return 'Answering...'
  if (liveReasoning.value) return 'Thinking...'
  return liveSteps.value.some(s => !s.thought) ? 'Investigating...' : 'Waiting for the model...'
})

function stepsLabel(steps: AiStep[]): string {
  const tools = steps.filter(s => !s.thought).length
  if (!tools) return 'Reasoning'
  return `${tools} step${tools === 1 ? '' : 's'}${steps.length > tools ? ' and reasoning' : ''}`
}

function submit(text = draft.value) {
  if (!text.trim() || busy.value || !ready.value) return
  draft.value = ''
  void send(text)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

function scrollToEnd() {
  const el = viewport()
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => [entries.value.length, liveSteps.value.length, busy.value], () => nextTick(scrollToEnd))

// Streamed text follows the end only while the user has not scrolled up to read
watch([liveText, liveReasoning], () => {
  const el = viewport()
  if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) void nextTick(scrollToEnd)
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="shrink-0 flex flex-wrap items-center gap-2 p-2 border-b">
      <h3 class="text-lg font-semibold shrink-0">AI</h3>

      <Select :model-value="provider" @update:model-value="setProvider($event as AiProviderId)">
        <SelectTrigger class="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="(label, id) in PROVIDER_LABELS" :key="id" :value="id">{{ label }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-if="hasKey && models.length" :model-value="model" @update:model-value="setModel(String($event))">
        <SelectTrigger class="h-8 w-[230px] text-xs" :title="model">
          <SelectValue placeholder="Model">{{ modelName }}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup v-if="recommended.length">
            <SelectLabel class="text-xs">Recommended</SelectLabel>
            <SelectItem v-for="m in recommended" :key="m.id" :value="m.id" class="text-xs">
              {{ m.name }}<span v-if="modelNote(m)" class="ml-1 text-muted-foreground">· {{ modelNote(m) }}</span>
            </SelectItem>
          </SelectGroup>
          <SelectSeparator v-if="recommended.length && others.length" />
          <SelectGroup v-if="others.length">
            <SelectLabel class="text-xs">Other free models</SelectLabel>
            <SelectItem v-for="m in others" :key="m.id" :value="m.id" class="text-xs">
              {{ m.name }}<span v-if="modelNote(m)" class="ml-1 text-muted-foreground">· {{ modelNote(m) }}</span>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <span v-if="modelsLoading" class="text-xs text-muted-foreground">Checking models...</span>
      <button v-else-if="modelsError" type="button" class="text-xs text-destructive underline" :title="modelsError" @click="reloadModels()">
        Models failed to load, retry
      </button>
      <TooltipProvider v-else-if="hasKey && models.length">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" @click="reloadModels()">
              <RefreshCw class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Check which models are available</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div class="ml-auto flex items-center gap-1">
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="ghost" size="sm" class="h-8 gap-1.5 text-xs">
              <UserRound class="h-4 w-4" />
              Account
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80" align="end">
            <AiAccountPanel />
          </PopoverContent>
        </Popover>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-8 w-8" :disabled="entries.length === 0 && !busy" @click="newChat">
                <MessageSquarePlus class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- Conversation -->
    <ScrollArea ref="conversation" :horizontal="false" class="flex-1 min-h-0">
    <div class="p-3 space-y-3">
      <div v-if="!hasKey" class="max-w-md mx-auto mt-6 border rounded-lg p-4 space-y-3 bg-background">
        <div class="flex items-center gap-2 font-semibold">
          <Sparkles class="h-4 w-4" />
          Connect an AI provider
        </div>
        <p class="text-sm text-muted-foreground">
          The assistant reads the captured logs and the page code to explain what went wrong.
          Sign in with OpenRouter to use its free models, or add a Gemini or Groq API key.
        </p>
        <AiAccountPanel />
      </div>

      <div v-else-if="!credentials.consent" class="max-w-md mx-auto mt-6 border rounded-lg p-4 space-y-3 bg-background">
        <div class="flex items-center gap-2 font-semibold">
          <ShieldAlert class="h-4 w-4 text-orange-500" />
          Data sent to {{ PROVIDER_LABELS[provider] }}
        </div>
        <ul class="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Your questions, a digest of the captured logs, the event data and the page code the assistant asks for.</li>
          <li>Values covered by Options → Logs → Data masking are hidden at capture and never sent.</li>
          <li>Free models may store prompts and use them for training. Do not use the assistant on pages with data that must not leave your company.</li>
        </ul>
        <Button size="sm" class="h-8" @click="saveAiCredentials({ consent: true })">I understand</Button>
      </div>

      <template v-else>
        <div v-if="entries.length === 0 && !busy" class="max-w-lg mx-auto mt-6 space-y-3 text-center">
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
              @click="submit(example)"
            >
              {{ example }}
            </Button>
          </div>
        </div>

        <div
          v-for="entry in entries"
          :key="entry.id"
          class="flex"
          :class="entry.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="entry.role === 'user'"
            class="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground whitespace-pre-wrap break-words"
          >{{ entry.text }}</div>
          <div v-else class="max-w-[95%] min-w-0 rounded-lg border px-3 py-2 bg-background">
            <details v-if="entry.steps?.length" class="mb-2 text-xs text-muted-foreground">
              <summary class="cursor-pointer select-none">{{ stepsLabel(entry.steps) }}</summary>
              <ul class="mt-1 space-y-0.5">
                <template v-for="(step, i) in entry.steps" :key="i">
                  <li v-if="step.thought"><AiThought :text="step.summary" /></li>
                  <li v-else class="font-mono truncate">
                    <span class="text-foreground/70">{{ step.tool }}</span> {{ step.summary }}
                  </li>
                </template>
              </ul>
            </details>
            <div v-if="entry.error" class="text-sm text-destructive whitespace-pre-wrap break-words">{{ entry.text }}</div>
            <div v-else class="ai-answer markdown-body text-sm break-words leading-relaxed" v-html="rendered.get(entry.id)" />
            <div v-if="entry.model || entry.usage" class="mt-1 flex flex-wrap gap-x-1 text-[10px] text-muted-foreground">
              <span v-if="entry.model" :title="entry.model">{{ answeredBy(entry.model) }}</span>
              <span v-if="entry.model && entry.usage">·</span>
              <span v-if="entry.usage" :title="usageTitle(entry.usage)">{{ usageLine(entry.usage) }}</span>
            </div>
          </div>
        </div>

        <div v-if="busy" class="flex justify-start">
          <div class="max-w-[95%] min-w-0 rounded-lg border px-3 py-2 bg-background text-xs text-muted-foreground space-y-1">
            <div class="flex items-center gap-2">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {{ liveStatus }}
            </div>
            <ul v-if="liveSteps.length" class="space-y-0.5">
              <template v-for="(step, i) in liveSteps" :key="i">
                <li v-if="step.thought"><AiThought :text="step.summary" /></li>
                <li v-else class="font-mono truncate">
                  <span class="text-foreground/70">{{ step.tool }}</span> {{ step.summary }}
                </li>
              </template>
            </ul>
            <AiThought v-if="liveReasoning" :text="liveReasoning" active />
            <div v-if="liveHtml" class="ai-answer markdown-body text-sm text-foreground break-words leading-relaxed" v-html="liveHtml" />
          </div>
        </div>
      </template>
    </div>
    </ScrollArea>

    <!-- Composer -->
    <div class="shrink-0 border-t p-2 space-y-1">
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
          class="ai-input-scroll block resize-none overflow-hidden bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
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
                  :class="credentials.reasoning ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : 'border-transparent text-muted-foreground'"
                  :aria-pressed="credentials.reasoning"
                  :disabled="!ready"
                  @click="toggleReasoning"
                >
                  <Brain class="h-3.5 w-3.5" />
                  Reasoning
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" class="max-w-64">
                {{ credentials.reasoning
                  ? 'On: thinking models reason before answering. Deeper analysis, but more tokens and time.'
                  : 'Off: models answer without reasoning where the model allows it. Saves tokens and time.' }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button v-if="!busy" size="icon" class="h-8 w-8 rounded-full" :disabled="!ready || !draft.trim()" title="Send (Enter; Shift+Enter for a new line)" @click="submit()">
            <ArrowUp class="h-4 w-4" />
          </Button>
          <Button v-else size="icon" variant="outline" class="h-8 w-8 rounded-full" title="Stop" @click="stop">
            <Square class="h-3.5 w-3.5 fill-current" />
          </Button>
        </div>
      </div>
      <p v-if="ready" class="text-[10px] text-muted-foreground">{{ LIMIT_HINTS[provider] }}</p>
    </div>
  </div>
</template>

<style scoped>
.ai-answer :deep(ul) { list-style: disc; }
.ai-answer :deep(ol) { list-style: decimal; }
.ai-answer :deep(table) { border-collapse: collapse; margin: 0.5rem 0; font-size: 0.8125rem; display: block; overflow-x: auto; }
.ai-answer :deep(th),
.ai-answer :deep(td) { border: 1px solid hsl(var(--border)); padding: 0.25rem 0.5rem; text-align: left; }
.ai-answer :deep(pre) { white-space: pre; overflow-x: auto; }

/* Nested scrolls (code, tables, the input) use the thin themed bar of the UI kit tables */
.ai-input-scroll,
.ai-answer :deep(pre),
.ai-answer :deep(table) {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}
.ai-input-scroll::-webkit-scrollbar,
.ai-answer :deep(pre)::-webkit-scrollbar,
.ai-answer :deep(table)::-webkit-scrollbar { width: 8px; height: 8px; }
.ai-input-scroll::-webkit-scrollbar-track,
.ai-answer :deep(pre)::-webkit-scrollbar-track,
.ai-answer :deep(table)::-webkit-scrollbar-track { background: transparent; }
.ai-input-scroll::-webkit-scrollbar-thumb,
.ai-answer :deep(pre)::-webkit-scrollbar-thumb,
.ai-answer :deep(table)::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
</style>
