/**
 * Chat state (module level: the conversation survives tab switches) and the model list
 * of the selected provider.
 */

import { computed, ref, shallowRef, watch } from 'vue'
import { activeKey, aiCredentials, loadAiCredentials, saveAiCredentials } from './credentials'
import { listModels, PROVIDER_BUDGET, type ChatLive } from './providers'
import { runAgent } from './agent'
import { resetLogsSnapshot, takeLogsSnapshot } from './logsContext'
import type { AiChatEntry, AiModel, AiProviderId, AiStep, AiUsage, ChatMessage } from './types'

const entries = ref<AiChatEntry[]>([])
const busy = ref(false)
const liveSteps = ref<AiStep[]>([])
const liveText = ref('')
const liveReasoning = ref('')
const models = shallowRef<AiModel[]>([])
const modelsLoading = ref(false)
const modelsError = ref<string | null>(null)

let history: ChatMessage[] = []
/** Logs snapshot whose digest the model already has */
let sentSignature = ''
let controller: AbortController | null = null
let entryCounter = 0
let initialized = false
let modelsRequest = 0

function nextId(): string {
  return `ai-${Date.now()}-${++entryCounter}`
}

/** Streamed text re-renders Markdown, so updates are batched; clearing is immediate */
const LIVE_FLUSH_MS = 60
let pendingLive: ChatLive | null = null
let liveTimer: ReturnType<typeof setTimeout> | undefined

function flushLive(): void {
  liveTimer = undefined
  if (!pendingLive) return
  liveText.value = pendingLive.content
  liveReasoning.value = pendingLive.reasoning
  pendingLive = null
}

function setLive(live: ChatLive): void {
  if (live.content || live.reasoning) {
    pendingLive = live
    liveTimer ??= setTimeout(flushLive, LIVE_FLUSH_MS)
    return
  }
  clearTimeout(liveTimer)
  liveTimer = undefined
  pendingLive = null
  liveText.value = ''
  liveReasoning.value = ''
}

async function loadModels(): Promise<void> {
  const provider = aiCredentials.provider
  const key = activeKey(provider)
  const request = ++modelsRequest
  modelsLoading.value = true
  modelsError.value = null
  try {
    const list = await listModels(provider, key)
    if (request !== modelsRequest) return
    models.value = list
    const current = aiCredentials.models[provider]
    if (list.length && (!current || !list.some(m => m.id === current))) {
      const fallback = list.find(m => m.recommended) ?? list[0]
      await saveAiCredentials({ models: { ...aiCredentials.models, [provider]: fallback.id } })
    }
  } catch (e) {
    if (request !== modelsRequest) return
    models.value = []
    modelsError.value = String((e as Error)?.message || e)
  } finally {
    if (request === modelsRequest) modelsLoading.value = false
  }
}

function init(): void {
  if (initialized) return
  initialized = true
  void loadAiCredentials().then(() => {
    watch(() => [aiCredentials.provider, activeKey()] as const, () => void loadModels(), { immediate: true })
  })
}

export function useAiChat() {
  init()

  const provider = computed(() => aiCredentials.provider)
  const model = computed(() => aiCredentials.models[aiCredentials.provider] ?? '')
  const hasKey = computed(() => !!activeKey())
  const ready = computed(() => hasKey.value && !!model.value && aiCredentials.consent)

  function setProvider(id: AiProviderId) {
    void saveAiCredentials({ provider: id })
  }

  function setModel(id: string) {
    void saveAiCredentials({ models: { ...aiCredentials.models, [aiCredentials.provider]: id } })
  }

  async function send(question: string): Promise<void> {
    const text = question.trim()
    if (!text || busy.value || !ready.value) return
    const modelId = model.value
    entries.value = [...entries.value, { id: nextId(), role: 'user', text }]
    busy.value = true
    liveSteps.value = []
    controller = new AbortController()

    resetLogsSnapshot()
    const budget = PROVIDER_BUDGET[aiCredentials.provider]
    const snapshot = takeLogsSnapshot({ maxTimeline: budget.digestTimeline, maxChars: budget.digestChars, bodyChars: budget.digestBodyChars })
    const digest = snapshot.signature !== sentSignature ? snapshot.digest : undefined
    const usage: AiUsage = { requests: 0, prompt: 0, completion: 0, cached: 0, unreported: 0, ms: 0 }
    const started = Date.now()
    try {
      const result = await runAgent({
        question: text,
        digest,
        digestCount: snapshot.count,
        history,
        request: { provider: aiCredentials.provider, key: activeKey(), model: modelId, reasoning: aiCredentials.reasoning, signal: controller.signal },
        models: models.value,
        onStep: step => { liveSteps.value = [...liveSteps.value, step] },
        onLive: setLive,
        usage,
      })
      usage.ms = Date.now() - started
      history = result.history
      sentSignature = snapshot.signature
      entries.value = [...entries.value, { id: nextId(), role: 'assistant', text: result.answer, steps: liveSteps.value, model: result.model, usage }]
    } catch (e) {
      usage.ms = Date.now() - started
      const aborted = controller?.signal.aborted
      const partial = (pendingLive?.content ?? liveText.value).trim()
      entries.value = [...entries.value, {
        id: nextId(),
        role: 'assistant',
        text: aborted ? (partial ? `${partial}\n\n*Stopped.*` : 'Stopped.') : String((e as Error)?.message || e),
        steps: liveSteps.value,
        error: !aborted,
        usage: usage.requests ? usage : undefined,
      }]
    } finally {
      setLive({ content: '', reasoning: '' })
      busy.value = false
      liveSteps.value = []
      controller = null
    }
  }

  function stop() {
    controller?.abort()
  }

  function newChat() {
    stop()
    entries.value = []
    history = []
    sentSignature = ''
  }

  return {
    credentials: aiCredentials,
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
    reloadModels: loadModels,
    send,
    stop,
    newChat,
  }
}
