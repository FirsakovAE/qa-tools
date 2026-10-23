/**
 * The assistant loop: the question goes out with the short logs digest; the model calls tools
 * (full logs, page sources) until it can answer.
 */

import {
  AiProviderError,
  CHAIN_SIZE,
  chatCompletion,
  PROVIDER_BUDGET,
  PROVIDER_LABELS,
  type ChatLive,
  type ChatRequest,
  type ChatResult,
} from './providers'
import { clearModel, markModel, modelStatus, statusLabel, recordRequest, setReportedLimit, type ModelState } from './modelStatus'
import { DETAILED_CHECK_NOTE, FINAL_ROUND_NOTE, SYSTEM_PROMPT } from './prompt'
import { AI_TOOLS, describeToolCall, runTool } from './tools'
import { extractTextToolCalls } from './textToolCalls'
import { hasVisibleText } from './format'
import type { AiModel, AiProviderId, AiStep, AiUsage, ChatMessage, ChatToolCall, ToolDefinition } from './types'

/** Requests per completion in Auto mode (OpenRouter tries up to CHAIN_SIZE models in each) */
const AUTO_ATTEMPTS = { openrouter: 3, gemini: 4, groq: 4 } as const
/** Waits for a per-minute limit within one completion */
const MAX_RATE_WAITS = 2
/** An overloaded model is skipped this long when the provider gave no time */
const BUSY_MS = 10 * 60_000
/** A model the key cannot use is skipped this long (cleared when the key changes) */
const GONE_MS = 7 * 24 * 3_600_000
const MANUAL_RETRY_MS = 1500
const DECLINED = 'The user declined this call. Do not call it again in this answer; answer from the data you have and say what is missing.'
/** Tool results of earlier questions are shortened to this size in the history */
const OLD_TOOL_RESULT_CHARS = 1500
/** Tool results shortened to fit a small context */
const FIT_TOOL_RESULT_CHARS = 400
const DIGEST_TAG = /<logs_digest[^>]*>[\s\S]*?<\/logs_digest>/g
const NO_LIVE: ChatLive = { content: '', reasoning: '' }
/** The model is told how many tool rounds are left from this many on */
const ROUNDS_LEFT_NOTE = 3

export interface AgentRun {
  question: string
  /** Attached when the logs changed since the last question */
  digest?: string
  digestCount?: number
  /** The digest lists only events from this id on: the earlier digests of the chat stay valid */
  digestFrom?: number
  history: ChatMessage[]
  /** SYSTEM_PROMPT with the answer style of the user */
  systemPrompt?: string
  /** The answer style again, on the newest user message of every request */
  styleNote?: string
  /** Detailed answers: one without any tool call is sent back to gather the data */
  detailed?: boolean
  request: Omit<ChatRequest, 'messages' | 'tools' | 'toolChoice' | 'fallbacks' | 'onDelta'>
  /** Auto mode picks models from `models` and switches on errors; manual mode uses only `request.model` */
  auto: boolean
  /** Models of the provider the user did not block */
  models: AiModel[]
  /** Tools the model gets; AI_TOOLS by default */
  tools?: ToolDefinition[]
  /** Called before every tool call; false declines it */
  approve?: (name: string, step: AiStep) => Promise<boolean>
  /** Applied to every tool result before it goes to the model */
  protect?: (text: string) => string
  onStep: (step: AiStep) => void
  /** Text and reasoning of the completion in progress; empty when it ended or is retried */
  onLive?: (live: ChatLive) => void
  /** Filled as completions arrive, so it is complete also when the run fails or is stopped */
  usage: AiUsage
}

export interface AgentResult {
  answer: string
  /** History to keep for the next question */
  history: ChatMessage[]
  /** Model that gave the answer */
  model: string
}

/** `google/x-20260402:free` and `google/x:free` are the same model */
function sameModel(a: string, b: string): boolean {
  const norm = (id: string) => id.replace(/:free$/, '').replace(/-\d{8}$/, '')
  return norm(a) === norm(b)
}

/**
 * One completion with fallbacks: OpenRouter switches models itself inside a request; when every
 * model of the request failed, the next models are tried. Failed models are skipped for a while.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function modelName(run: AgentRun, id: string): string {
  return run.models.find(m => m.id === id)?.name ?? id
}

/** Auto mode order: free models without a known problem (stable and recommended first); only busy ones when none is left */
function autoModels(provider: AiProviderId, models: AiModel[], tried: Set<string>): string[] {
  const left = models.filter(m => !m.paid && !tried.has(m.id))
  const usable = left.filter(m => !modelStatus(provider, m.id))
  const list = usable.length ? usable : left.filter(m => modelStatus(provider, m.id)?.state === 'busy')
  return list
    .slice()
    .sort((a, b) => Number(!!a.unstable) - Number(!!b.unstable) || Number(!!b.recommended) - Number(!!a.recommended))
    .map(m => m.id)
}

function stateOf(e: AiProviderError): ModelState {
  return e.kind === 'quota' ? 'quota' : e.kind === 'gone' ? 'gone' : 'busy'
}

function skipUntil(e: AiProviderError, state: ModelState): number {
  return Date.now() + (state === 'gone' ? GONE_MS : e.retryAfterMs ?? BUSY_MS)
}

function noModelsError(run: AgentRun, failures: string[], last: AiProviderError | null): AiProviderError {
  const { provider } = run.request
  const known = failures.length
    ? failures
    : run.models.filter(m => !m.paid).map(m => `${m.name}: ${statusLabel(provider, m.id)}`)
  const list = known.length ? `\n\n${known.map(line => `- ${line}`).join('\n')}` : ''
  return new AiProviderError(
    `No ${PROVIDER_LABELS[provider]} model could answer.${list}\n\nTry again later, switch the provider, or pick a model by hand.`,
    last?.status,
    last?.kind ?? 'other',
    undefined,
    last?.details,
  )
}

/**
 * One completion. Auto mode moves to the next available model on any model error (quota,
 * removed model, overload) and remembers the problem; manual mode uses only the chosen model.
 * A short per-minute limit is waited out in both modes.
 */
async function complete(run: AgentRun, messages: ChatMessage[], toolChoice: 'auto' | 'none'): Promise<ChatResult> {
  const { provider } = run.request
  const tried = new Set<string>()
  const failures: string[] = []
  let lastError: AiProviderError | null = null
  let waits = 0
  let manualRetried = false
  const attempts = run.auto ? AUTO_ATTEMPTS[provider] : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    const chain = run.auto ? autoModels(provider, run.models, tried) : [run.request.model]
    if (!chain.length) break
    const batch = provider === 'openrouter' ? chain.slice(0, CHAIN_SIZE) : chain.slice(0, 1)
    run.onLive?.(NO_LIVE)
    try {
      const result = await chatCompletion({
        ...run.request,
        model: batch[0],
        fallbacks: batch.slice(1),
        messages,
        tools: run.tools ?? AI_TOOLS,
        toolChoice,
        onDelta: run.onLive,
      })
      const answered = batch.find(id => sameModel(id, result.model)) ?? batch[0]
      recordRequest(provider, answered)
      clearModel(provider, answered)
      if (result.dailyRequests) setReportedLimit(provider, answered, result.dailyRequests.limit, result.dailyRequests.remaining)
      return result
    } catch (e) {
      if (!(e instanceof AiProviderError) || run.request.signal?.aborted) throw e
      if (e.kind === 'rate' && e.retryAfterMs && waits < MAX_RATE_WAITS) {
        waits++
        attempt--
        run.onStep({ tool: 'Wait', summary: `Rate limit, retrying in ${Math.ceil(e.retryAfterMs / 1000)} s` })
        await sleep(e.retryAfterMs + 250, run.request.signal)
        continue
      }
      if (!e.modelSpecific) throw e
      lastError = e
      const state = stateOf(e)
      // OpenRouter tried the whole batch; the error names only the last of them
      const batchState: ModelState = batch.length > 1 ? 'busy' : state
      for (const id of batch) {
        tried.add(id)
        markModel(provider, id, batchState, skipUntil(e, batchState), e.message)
      }
      const names = batch.map(id => modelName(run, id)).join(', ')
      failures.push(`${names}: ${e.message}`)
      if (!run.auto) {
        if ((e.kind === 'busy' || e.kind === 'empty') && !manualRetried) {
          manualRetried = true
          attempt--
          run.onStep({ tool: 'Wait', summary: `${names} did not answer, trying once more` })
          await sleep(MANUAL_RETRY_MS, run.request.signal)
          continue
        }
        throw new AiProviderError(`${names}: ${e.message}\n\nPick another model or switch to Auto: it skips models that are out of quota or unavailable.`, e.status, e.kind, e.retryAfterMs, e.details)
      }
      run.onStep({ tool: 'Model', summary: `${names}: ${e.message} Switching to another model.` })
    }
  }
  throw noModelsError(run, failures, lastError)
}

function userMessage(run: AgentRun): ChatMessage {
  if (!run.digest) return { role: 'user', content: run.question }
  return {
    role: 'user',
    content: `${run.question}\n\n<logs_digest events="${run.digestCount ?? 0}"${run.digestFrom ? ` new_from="${run.digestFrom}"` : ''}>\n${run.digest}\n</logs_digest>`,
  }
}

/** Models follow the latest user turn more than the end of a long system prompt; not kept in the history */
function withStyle(messages: ChatMessage[], note: string | undefined): ChatMessage[] {
  const index = messages.findLastIndex(m => m.role === 'user')
  if (!note || index === -1) return messages
  const target = messages[index] as Extract<ChatMessage, { role: 'user' }>
  const copy = messages.slice()
  copy[index] = { ...target, content: `${target.content}\n\n<answer_style>\n${note}\n</answer_style>` }
  return copy
}

/** Older digests and tool results are shortened: the newest digest and tools can bring them back */
function compactHistory(history: ChatMessage[], replacingDigest: boolean): ChatMessage[] {
  return history.map(m => {
    if (m.role === 'user' && replacingDigest && m.content.includes('<logs_digest')) {
      return { ...m, content: m.content.replace(DIGEST_TAG, '[older logs digest removed; ids now refer to the newest digest]') }
    }
    if (m.role === 'tool' && m.content.length > OLD_TOOL_RESULT_CHARS) {
      return { ...m, content: `${m.content.slice(0, OLD_TOOL_RESULT_CHARS)}\n... [shortened; call the tool again for the full result]` }
    }
    return m
  })
}

function messageSize(m: ChatMessage): number {
  return (m.content?.length ?? 0) + (m.role === 'assistant' && m.tool_calls ? JSON.stringify(m.tool_calls).length : 0)
}

/**
 * Messages for a provider with a small context: earlier questions are dropped first (the newest
 * logs digest moves to the oldest kept question), then older tool results are shortened.
 */
function fitContext(history: ChatMessage[], maxChars: number): ChatMessage[] {
  let messages = history
  let total = messages.reduce((sum, m) => sum + messageSize(m), 0)
  if (total <= maxChars) return messages

  let current = messages.findLastIndex(m => m.role === 'user')
  let movedDigest = ''
  while (total > maxChars && current > 0) {
    const next = messages.findIndex((m, i) => i > 0 && m.role === 'user')
    for (const m of messages.slice(0, next)) {
      if (m.role === 'user') movedDigest = m.content.match(DIGEST_TAG)?.pop() ?? movedDigest
      total -= messageSize(m)
    }
    messages = messages.slice(next)
    current -= next
  }
  const question = messages[0]
  if (movedDigest && question?.role === 'user' && !question.content.includes('<logs_digest')) {
    messages = [{ ...question, content: `${question.content}\n\n${movedDigest}` }, ...messages.slice(1)]
    total += movedDigest.length + 2
  }

  // The newest tool result stays whole: the model asked for it right now
  const lastTool = messages.findLastIndex(m => m.role === 'tool')
  return messages.map((m, i) => {
    if (total <= maxChars || m.role !== 'tool' || i === lastTool || m.content.length <= FIT_TOOL_RESULT_CHARS) return m
    total -= m.content.length - FIT_TOOL_RESULT_CHARS
    return { ...m, content: `${m.content.slice(0, FIT_TOOL_RESULT_CHARS)}\n... [shortened to fit the model limit; call the tool again if needed]` }
  })
}

function parseArgs(call: ChatToolCall): Record<string, any> {
  try {
    const parsed = JSON.parse(call.function?.arguments || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const HEDGE = /\b(probably|likely|perhaps|not (captured|logged|in the logs)|was not recorded)\b|скорее всего|вероятно|возможно|не (попал|попало|зафиксирован|залогирован|видно)|нет в лог|отсутству/i
const QUOTED = /[«"“]([^»"”\n]{6,120})[»"”]/g

const CHECK_NOTE = 'You answered without calling any tool, so nothing above was checked in this question. Verify before answering: search_logs and search_source for the text the user quoted, the button label or the error message, and get_events on the requests and store state around the user\'s action. Then answer with the event ids and code you actually saw.'

/** Questions about when a control is enabled / shown or a message appears: answered from the live page and the code */
const UI_CONDITION = /\b(disabled|enabled|available|unavailable|blocked|greyed|hidden|visible|shown|missing|absent|appears?|toast)\b|услови|доступн|блокир|неактивн|активн|скрыт|отображ|показыва|появля|отсутств|пропал|не видн|нет кнопк|тост/i

const UI_CHECK_NOTE = 'You answered a question about UI conditions without calling any tool. Check now: inspect_ui on the element or the message, then read its component code (the bindings and the handler), and the current values of the data it depends on (read_stores, search_logs). Then answer with the conditions, the code locations and the current values you actually saw.'
function hasLogs(history: ChatMessage[]): boolean {
  return history.some(m => m.role === 'user' && m.content.includes('<logs_digest'))
}

/** A diagnostic answer from memory: it hedges, or the user quotes something the model never looked up */
function unchecked(question: string, answer: string, history: ChatMessage[]): boolean {
  if (question.trim().length < 25) return false
  if (HEDGE.test(answer)) return true
  const seen = history
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .join('\n')
    .toLowerCase()
    .split(question.trim().toLowerCase())
    .join('')
  for (const m of question.matchAll(QUOTED)) if (!seen.includes(m[1].trim().toLowerCase())) return true
  return false
}

function callKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(Object.keys(args).sort().map(k => [k, args[k]]))}`
}

export async function runAgent(run: AgentRun): Promise<AgentResult> {
  const budget = PROVIDER_BUDGET[run.request.provider]
  const history = [...compactHistory(run.history, !!run.digest && !run.digestFrom), userMessage(run)]
  // A repeated call can point to the earlier result only while results stay whole in the context
  const done = Number.isFinite(budget.contextChars) ? null : new Set<string>()
  let callCounter = 0
  /** Answers sent back for checking, with the note after each; dropped from the kept history */
  const rechecks: number[] = []
  const toolNames = new Set((run.tools ?? AI_TOOLS).map(t => t.function.name))

  const rounds = budget.toolRounds
  for (let round = 0; round <= rounds; round++) {
    const last = round === rounds
    const messages: ChatMessage[] = [{ role: 'system', content: run.systemPrompt ?? SYSTEM_PROMPT }, ...fitContext(history, budget.contextChars)]
    if (last) messages.push({ role: 'user', content: FINAL_ROUND_NOTE })
    const result = await complete(run, withStyle(messages, run.styleNote), last ? 'none' : 'auto')
    run.usage.requests++
    if (result.tokens) {
      run.usage.prompt += result.tokens.prompt
      run.usage.completion += result.tokens.completion
      run.usage.cached += result.tokens.cached
    } else {
      run.usage.unreported++
    }
    run.onLive?.(NO_LIVE)

    let toolCalls = result.toolCalls
    const written = extractTextToolCalls(result.content, toolNames)
    if (!toolCalls.length && written.calls.length && !last) {
      toolCalls = written.calls.map(c => ({ id: '', type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
    }
    const content = written.text

    const answering = !toolCalls.length || last
    const thought = [result.reasoning, answering ? '' : content].filter(hasVisibleText).map(t => t.trim()).join('\n\n')
    if (thought) run.onStep({ tool: 'Thinking', summary: thought, thought: true })

    if (answering) {
      const answer = content || (last || written.calls.length ? 'I could not finish the analysis within the tool call limit. Ask a narrower question.' : '')
      if (!answer) throw new Error('The model returned an empty answer. Try again or pick another model.')
      history.push({ role: 'assistant', content: answer })
      const uiQuestion = UI_CONDITION.test(run.question) && toolNames.has('inspect_ui')
      const recheck = round === 0 && !last && (hasLogs(history) || uiQuestion)
        ? (run.detailed ? DETAILED_CHECK_NOTE : uiQuestion ? UI_CHECK_NOTE : unchecked(run.question, answer, history) ? CHECK_NOTE : '')
        : ''
      if (recheck) {
        run.onStep({
          tool: 'Check',
          summary: run.detailed ? 'Detailed answer without data, gathering it with tools' : 'Answer without evidence, verifying with tools',
        })
        rechecks.push(history.length - 1)
        history.push({ role: 'user', content: recheck })
        continue
      }
      for (const at of rechecks.reverse()) history.splice(at, 2)
      return { answer, history, model: result.model }
    }

    const calls = toolCalls.map(call => ({ ...call, id: call.id || `call_${round}_${++callCounter}` }))
    history.push({ role: 'assistant', content: content || null, tool_calls: calls })
    for (const call of calls) {
      run.request.signal?.throwIfAborted()
      const args = parseArgs(call)
      const step = describeToolCall(call.function.name, args)
      const key = callKey(call.function.name, args)
      let output: string
      if (!toolNames.has(call.function.name)) {
        run.onStep({ ...step, declined: true })
        output = `The tool "${call.function.name}" is not available: the user turned it off in the assistant access settings.`
      } else if (done?.has(key)) {
        run.onStep(step)
        output = 'The same call was made earlier in this question; its result is above. Use it, or call with other arguments.'
      } else if (run.approve && !(await run.approve(call.function.name, step))) {
        run.request.signal?.throwIfAborted()
        run.onStep({ ...step, declined: true })
        output = DECLINED
      } else {
        run.onStep(step)
        done?.add(key)
        const raw = await runTool(call.function.name, args)
        const full = run.protect ? run.protect(raw) : raw
        output = full.length > budget.toolResultChars
          ? `${full.slice(0, budget.toolResultChars)}\n... [${full.length - budget.toolResultChars} chars cut; ask for fewer items or a narrower range]`
          : full
      }
      history.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: output })
    }
    const left = rounds - round - 1
    if (left <= ROUNDS_LEFT_NOTE) {
      const lastTool = history[history.length - 1] as Extract<ChatMessage, { role: 'tool' }>
      lastTool.content += left
        ? `\n\n[${left} tool round${left === 1 ? '' : 's'} left, then you answer without tools]`
        : '\n\n[No tool rounds left: answer now from the data you have]'
    }
  }
  throw new Error('Unreachable')
}
