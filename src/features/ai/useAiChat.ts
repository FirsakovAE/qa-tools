/**
 * Chat state (module level: the conversation survives tab switches) and the model list
 * of the selected provider.
 */

import { computed, effectScope, markRaw, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast, CustomUpdateNotification } from '@/components/ui/Toaster'
import { activeTabId } from '@/features/activeTab'
import {
  activeKey,
  aiCredentials,
  AUTO_MODEL,
  connectionSignature,
  customProvider,
  hasConsent,
  isConnected,
  loadAiCredentials,
  saveAiCredentials,
  selectedModel,
  type AiAccess,
  type AiToolGroup,
} from './credentials'
import { AiProviderError, providerBudget, providerLabel, providerOptions, toolSupport, type ChatLive } from './providers'
import { baseUrlHost } from './customProviders'
import { clearProviderStatus, loadModelStatus } from './modelStatus'
import { loadModels, providerModels } from './models'
import { clearAnswerCache } from './markdown'
import { runAgent } from './agent'
import { NO_TOOLS_NOTE, styleNote, systemPrompt } from './prompt'
import { maskText } from './privacy'
import { hasVisibleText } from './format'
import { allowedTools, TOOL_GROUPS } from './tools'
import { digestUpdate, takeLogsSnapshot, type LogsSnapshot, type SentLogs } from './logsContext'
import { attachmentsText, fileDelivery } from './attachmentContext'
import { aiAttachments, type AiAttachment } from './attachments'
import { attachedLog, clearAttachedLog } from './logFile'
import { dropChatFiles, hasChatFiles, markFilesSent } from './textFiles'
import { FILES_NO_TOOLS_NOTE, FILES_NOTE } from './fileTools'
import type { AiChatEntry, AiProviderId, AiStep, AiUsage, ChatMessage } from './types'

/** Sent to the model when the user attached items without typing a question */
const ATTACHMENT_QUESTION = 'Explain the attached data and point out anything wrong in it.'

const entries = ref<AiChatEntry[]>([])
const busy = ref(false)
const liveSteps = ref<AiStep[]>([])
const liveText = ref('')
const liveReasoning = ref('')
/** A tool call waiting for the user's permission */
const pendingApproval = ref<{ step: AiStep; group: AiToolGroup } | null>(null)
let resolveApproval: ((allowed: boolean) => void) | null = null
/** Tool groups the user allowed for the rest of this chat */
const chatAllowed = new Set<AiToolGroup>()
const { models, loading: modelsLoading, error: modelsError, reload: reloadModels } = providerModels(() => aiCredentials.provider)

let history: ChatMessage[] = []
/** Logs snapshot whose digest the model already has */
let sentSignature = ''
let sentLogs: SentLogs | null = null
/** State before the last question, so its answer can be asked again */
let lastTurn: { history: ChatMessage[]; sentSignature: string; sentLogs: SentLogs | null } | null = null
let controller: AbortController | null = null
let entryCounter = 0
let initialized = false

function nextId(): string {
  return `ai-${Date.now()}-${++entryCounter}`
}

/** Toast shown when a run ends while the user is on another tab. Dismissed on return. */
let agentDoneToast: string | number | null = null

function notifyAgentDone(): void {
  if (activeTabId.value === 'ai') return
  if (agentDoneToast != null) toast.dismiss(agentDoneToast)
  agentDoneToast = toast.custom(markRaw(CustomUpdateNotification), {
    duration: 10000,
    componentProps: {
      data: {
        id: '',
        title: t('ai.doneTitle'),
        description: t('ai.doneBody'),
      },
    },
  })
}

effectScope().run(() => {
  watch(activeTabId, id => {
    if (id !== 'ai' || agentDoneToast == null) return
    toast.dismiss(agentDoneToast)
    agentDoneToast = null
  })
})

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

function setLive(raw: ChatLive): void {
  const live = hasVisibleText(raw.reasoning) ? raw : { ...raw, reasoning: '' }
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

/** The hand-picked model is gone from the list or was blocked: back to Auto */
async function pickUsableModel(): Promise<void> {
  const provider = aiCredentials.provider
  const list = models.value
  const current = selectedModel(provider)
  if (list.length && current !== AUTO_MODEL && !list.some(m => m.id === current)) {
    await saveAiCredentials({ models: { ...aiCredentials.models, [provider]: AUTO_MODEL } })
  }
}

function init(): void {
  if (initialized) return
  initialized = true
  void Promise.all([loadAiCredentials(), loadModelStatus()]).then(() => {
    watch(
      () => [aiCredentials.provider, connectionSignature(aiCredentials.provider)] as const,
      () => { if (isConnected()) void loadModels(aiCredentials.provider).then(pickUsableModel) },
      { immediate: true },
    )
    // What failed with the old key or address says nothing about a new one
    const signatures = () => Object.fromEntries(providerOptions().map(p => [p.id, connectionSignature(p.id)])) as Record<AiProviderId, string>
    watch(signatures, (next, prev) => {
      for (const id of Object.keys(prev) as AiProviderId[]) {
        if (next[id] !== prev[id]) clearProviderStatus(id)
      }
    })
    watch(() => [aiCredentials.blockedModels, aiCredentials.addedModels], () => void pickUsableModel(), { deep: true })
  })
}

function accessLabel(access: AiAccess, group: AiToolGroup): string {
  return { allow: 'allowed', ask: 'on approval', deny: 'off' }[access.tools[group]]
}

/** What goes to the provider with this question, shown as the first step of the answer */
function contextStep(snapshot: LogsSnapshot, digest: string | undefined, from: number | undefined, access: AiAccess, attachments: AiAttachment[]): AiStep {
  const size = digest ? `${Math.max(1, Math.round(digest.length / 1024))} KB` : ''
  const file = attachedLog.value
  const source = file ? `attached log "${file.name}"` : 'logs'
  const logs = !access.digest ? (file ? `${source} (digest turned off)` : 'no logs digest (turned off)')
    : !digest ? (snapshot.count ? (file ? `${source}, no new events since the last digest` : 'no new logs events since the last digest') : '')
    : from ? `${source} digest of new events (${snapshot.count - from} of ${snapshot.count}, ${size})`
    : `${source} digest (${snapshot.count} events, ${size})`
  const budget = providerBudget(aiCredentials.provider)
  const tools = toolSupport(aiCredentials.provider) !== 'none'
  const deliveryNotes = { whole: '', overview: ' (overview; content read with file tools)', cut: ' (cut to fit)' }
  const labels = attachments.map(a => {
    const delivery = fileDelivery(a, budget.toolResultChars, tools)
    return `${a.label}${delivery ? deliveryNotes[delivery] : ''}`
  })
  const attached = attachments.length ? `attached ${labels.join(', ')}` : ''
  const shared = ['question', attached, logs].filter(Boolean)
  const hidden = [!access.headers && 'headers', !access.bodies && 'bodies and messages', !access.appData && 'app data values'].filter(Boolean)
  const custom = customProvider()
  const target = custom ? `${custom.label} (${baseUrlHost(custom.baseUrl)})` : providerLabel(aiCredentials.provider)
  const parts = [
    `Sent to ${target}: ${shared.join(', ')}`,
    toolSupport(aiCredentials.provider) === 'none'
      ? 'no tools with this connection'
      : `logs tools ${accessLabel(access, 'logs')}, page code ${accessLabel(access, 'sources')}, live page ${accessLabel(access, 'page')}`,
    hidden.length ? `hidden: ${hidden.join(', ')}` : '',
    snapshot.masked ? `${snapshot.masked} values masked` : '',
  ].filter(Boolean)
  return { tool: 'Context', summary: parts.join('; ') }
}

/** Resolves at once for allowed tools; asks the user for tools set to "ask" */
function approveTool(name: string, step: AiStep, signal: AbortSignal): Promise<boolean> {
  const group = TOOL_GROUPS[name]
  if (!group) return Promise.resolve(true)
  const mode = aiCredentials.access.tools[group]
  if (mode === 'deny') return Promise.resolve(false)
  if (mode === 'allow' || chatAllowed.has(group)) return Promise.resolve(true)
  return new Promise(resolve => {
    const finish = (allowed: boolean) => {
      signal.removeEventListener('abort', onAbort)
      pendingApproval.value = null
      resolveApproval = null
      resolve(allowed)
    }
    const onAbort = () => finish(false)
    signal.addEventListener('abort', onAbort, { once: true })
    pendingApproval.value = { step, group }
    resolveApproval = finish
  })
}

/** Event ids the answer names (`#N`), resolved while the snapshot of its question is current */
function eventRefs(text: string, snapshot: LogsSnapshot): Record<number, string> | undefined {
  const refs: Record<number, string> = {}
  for (const m of text.matchAll(/#(\d{1,6})\b/g)) {
    const row = snapshot.rows[Number(m[1])]
    if (row) refs[row.index] = row.event.id
  }
  return Object.keys(refs).length ? refs : undefined
}

export function useAiChat() {
  init()

  const provider = computed(() => aiCredentials.provider)
  const model = computed(() => selectedModel())
  const auto = computed(() => model.value === AUTO_MODEL)
  /** The provider can take requests: a key, or an own connection (local ones need no key) */
  const hasKey = computed(() => isConnected())
  const consent = computed(() => hasConsent())
  const ready = computed(() => hasKey.value && consent.value && (auto.value ? models.value.some(m => !m.paid) : !!model.value))

  function setProvider(id: AiProviderId) {
    void saveAiCredentials({ provider: id })
  }

  function setModel(id: string) {
    void saveAiCredentials({ models: { ...aiCredentials.models, [aiCredentials.provider]: id } })
  }

  async function send(question: string, attachments: AiAttachment[] = []): Promise<void> {
    const text = question.trim()
    if ((!text && !attachments.length) || busy.value || !ready.value) return
    const modelId = model.value
    lastTurn = { history, sentSignature, sentLogs }
    entries.value = [...entries.value, { id: nextId(), role: 'user', text, attachments: attachments.length ? attachments : undefined }]
    busy.value = true
    controller = new AbortController()

    const budget = providerBudget(aiCredentials.provider)
    const noTools = toolSupport(aiCredentials.provider) === 'none'
    const access = aiCredentials.access
    const snapshot = takeLogsSnapshot({ maxTimeline: budget.digestTimeline, maxChars: budget.digestChars, bodyChars: budget.digestBodyChars })
    // A small context may drop the earlier questions with their digests, so it always gets a full one
    const update = access.digest && snapshot.signature !== sentSignature
      ? digestUpdate(snapshot, sentLogs, !Number.isFinite(budget.contextChars))
      : null
    const digest = update?.digest
    liveSteps.value = [contextStep(snapshot, digest, update?.from, access, attachments)]
    const usage: AiUsage = { requests: 0, prompt: 0, completion: 0, cached: 0, unreported: 0, ms: 0 }
    const started = Date.now()
    const signal = controller.signal
    const isAuto = modelId === AUTO_MODEL
    markFilesSent(attachments.flatMap(a => (a.kind === 'file' ? [a.fileId] : [])))
    const files = hasChatFiles()
    const prompt = [
      systemPrompt(access, aiCredentials.routing),
      files ? (noTools ? FILES_NO_TOOLS_NOTE : FILES_NOTE) : '',
      noTools ? NO_TOOLS_NOTE : '',
    ].filter(Boolean).join('\n\n')
    try {
      const attached = attachments.length ? await attachmentsText(attachments, snapshot, budget.toolResultChars, !noTools) : null
      const result = await runAgent({
        question: text || ATTACHMENT_QUESTION,
        attachments: attached ?? undefined,
        digest,
        digestCount: snapshot.count,
        digestFrom: update?.from,
        logFile: attachedLog.value?.name,
        history,
        systemPrompt: prompt,
        styleNote: styleNote(aiCredentials),
        request: { provider: aiCredentials.provider, key: activeKey(), model: modelId, signal },
        auto: isAuto,
        models: models.value,
        tools: noTools ? [] : allowedTools(access, aiCredentials.routing, files),
        approve: (name, step) => approveTool(name, step, signal),
        protect: output => maskText(output, aiCredentials.masking),
        onStep: step => { liveSteps.value = [...liveSteps.value, step] },
        onLive: setLive,
        usage,
      })
      usage.ms = Date.now() - started
      history = result.history
      if (update) {
        sentSignature = snapshot.signature
        sentLogs = update.sent
      }
      entries.value = [...entries.value, {
        id: nextId(),
        role: 'assistant',
        text: result.answer,
        steps: liveSteps.value,
        model: result.model,
        usage,
        events: eventRefs(result.answer, snapshot),
      }]
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
        errorDetails: !aborted && e instanceof AiProviderError ? e.details : undefined,
        suggestAuto: !aborted && !isAuto && e instanceof AiProviderError && e.modelSpecific,
        events: aborted && partial ? eventRefs(partial, snapshot) : undefined,
        usage: usage.requests ? usage : undefined,
      }]
    } finally {
      const stopped = controller?.signal.aborted
      setLive({ content: '', reasoning: '' })
      busy.value = false
      liveSteps.value = []
      controller = null
      if (!stopped) notifyAgentDone()
    }
  }

  function stop() {
    controller?.abort()
  }

  /** Asks the last question again in place of its answer */
  function retry(): void {
    if (busy.value || !lastTurn) return
    const list = entries.value
    const userIndex = list.length - 2
    if (list[userIndex]?.role !== 'user' || list[userIndex + 1]?.role !== 'assistant') return
    const { text: question, attachments } = list[userIndex]
    entries.value = list.slice(0, userIndex)
    history = lastTurn.history
    sentSignature = lastTurn.sentSignature
    sentLogs = lastTurn.sentLogs
    void send(question, attachments)
  }

  function newChat() {
    stop()
    entries.value = []
    history = []
    sentSignature = ''
    sentLogs = null
    lastTurn = null
    chatAllowed.clear()
    clearAnswerCache()
    clearAttachedLog()
    dropChatFiles(aiAttachments.value.flatMap(a => (a.kind === 'file' ? [a.fileId] : [])))
  }

  /** once: this call; chat: every call of the group until a new chat */
  function answerApproval(choice: 'once' | 'chat' | 'deny'): void {
    const pending = pendingApproval.value
    if (!pending) return
    if (choice === 'chat') chatAllowed.add(pending.group)
    resolveApproval?.(choice !== 'deny')
  }

  /** The hand-picked model failed: answer the same question in Auto mode */
  function retryWithAuto(): void {
    if (busy.value) return
    setModel(AUTO_MODEL)
    retry()
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
    auto,
    pendingApproval,
    answerApproval,
    retryWithAuto,
    hasKey,
    consent,
    ready,
    setProvider,
    setModel,
    reloadModels: () => reloadModels(true),
    send,
    retry,
    stop,
    newChat,
  }
}
