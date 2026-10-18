/**
 * The assistant loop: the question goes out with the short logs digest; the model calls tools
 * (full logs, page sources) until it can answer.
 */

import {
  AiProviderError,
  chatCompletion,
  markModelBusy,
  MAX_RATE_WAIT_MS,
  modelChain,
  PROVIDER_BUDGET,
  type ChatLive,
  type ChatRequest,
  type ChatResult,
} from './providers'
import { FINAL_ROUND_NOTE, SYSTEM_PROMPT } from './prompt'
import { AI_TOOLS, describeToolCall, runTool } from './tools'
import { extractTextToolCalls } from './textToolCalls'
import type { AiModel, AiStep, AiUsage, ChatMessage, ChatToolCall } from './types'

/** Tool rounds per question; the round after the last one must answer with text */
const MAX_TOOL_ROUNDS = 6
/** Extra attempts with other models when every model of a request was busy */
const RETRIES = { openrouter: 1, gemini: 2, groq: 2 } as const
/** Waits for a per-minute limit within one completion */
const MAX_RATE_WAITS = 2
/** Tool results of earlier questions are shortened to this size in the history */
const OLD_TOOL_RESULT_CHARS = 1500
/** Tool results shortened to fit a small context */
const FIT_TOOL_RESULT_CHARS = 400
const DIGEST_TAG = /<logs_digest[^>]*>[\s\S]*?<\/logs_digest>/g
const NO_LIVE: ChatLive = { content: '', reasoning: '' }
const TOOL_NAMES = new Set(AI_TOOLS.map(t => t.function.name))
/** The model is told how many tool rounds are left from this many on */
const ROUNDS_LEFT_NOTE = 2

export interface AgentRun {
  question: string
  /** Attached when the logs changed since the last question */
  digest?: string
  digestCount?: number
  history: ChatMessage[]
  request: Omit<ChatRequest, 'messages' | 'tools' | 'toolChoice' | 'fallbacks' | 'onDelta'>
  /** Models of the provider, for fallbacks when the chosen one is busy */
  models: AiModel[]
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

async function complete(run: AgentRun, messages: ChatMessage[], toolChoice: 'auto' | 'none'): Promise<ChatResult> {
  const { provider } = run.request
  const tried = new Set<string>()
  let lastError: unknown
  let waits = 0
  for (let attempt = 0; attempt <= RETRIES[provider]; attempt++) {
    const chain = provider === 'openrouter'
      ? modelChain(run.request.model, run.models, tried)
      : modelChain(run.request.model, run.models, tried).slice(0, 1)
    if (!chain.length) break
    run.onLive?.(NO_LIVE)
    try {
      const result = await chatCompletion({
        ...run.request,
        model: chain[0],
        fallbacks: chain.slice(1),
        messages,
        tools: AI_TOOLS,
        toolChoice,
        onDelta: run.onLive,
      })
      const answered = chain.findIndex(id => sameModel(id, result.model))
      chain.slice(0, Math.max(answered, 0)).forEach(markModelBusy)
      return result
    } catch (e) {
      lastError = e
      if (!(e instanceof AiProviderError) || !e.retryable || run.request.signal?.aborted) throw e
      // A per-minute limit: the same model answers after a short pause
      if (e.retryAfterMs && e.retryAfterMs <= MAX_RATE_WAIT_MS && waits < MAX_RATE_WAITS) {
        waits++
        attempt--
        run.onStep({ tool: 'wait', summary: `rate limit, retrying in ${Math.ceil(e.retryAfterMs / 1000)} s` })
        await sleep(e.retryAfterMs + 250, run.request.signal)
        continue
      }
      for (const id of chain) {
        tried.add(id)
        markModelBusy(id)
      }
    }
  }
  throw lastError ?? new Error('No available models. Pick another model or try later.')
}

function userMessage(run: AgentRun): ChatMessage {
  if (!run.digest) return { role: 'user', content: run.question }
  return {
    role: 'user',
    content: `${run.question}\n\n<logs_digest events="${run.digestCount ?? 0}">\n${run.digest}\n</logs_digest>`,
  }
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

function callKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(Object.keys(args).sort().map(k => [k, args[k]]))}`
}

export async function runAgent(run: AgentRun): Promise<AgentResult> {
  const budget = PROVIDER_BUDGET[run.request.provider]
  const history = [...compactHistory(run.history, !!run.digest), userMessage(run)]
  // A repeated call can point to the earlier result only while results stay whole in the context
  const done = Number.isFinite(budget.contextChars) ? null : new Set<string>()
  let callCounter = 0

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const last = round === MAX_TOOL_ROUNDS
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...fitContext(history, budget.contextChars)]
    if (last) messages.push({ role: 'user', content: FINAL_ROUND_NOTE })
    const result = await complete(run, messages, last ? 'none' : 'auto')
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
    const written = extractTextToolCalls(result.content, TOOL_NAMES)
    if (!toolCalls.length && written.calls.length && !last) {
      toolCalls = written.calls.map(c => ({ id: '', type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
    }
    const content = written.text

    const answering = !toolCalls.length || last
    const thought = [result.reasoning, answering ? '' : content].filter(Boolean).join('\n\n')
    if (thought) run.onStep({ tool: 'Thinking', summary: thought, thought: true })

    if (answering) {
      const answer = content || (last || written.calls.length ? 'I could not finish the analysis within the tool call limit. Ask a narrower question.' : '')
      if (!answer) throw new Error('The model returned an empty answer. Try again or pick another model.')
      history.push({ role: 'assistant', content: answer })
      return { answer, history, model: result.model }
    }

    const calls = toolCalls.map(call => ({ ...call, id: call.id || `call_${round}_${++callCounter}` }))
    history.push({ role: 'assistant', content: content || null, tool_calls: calls })
    for (const call of calls) {
      run.request.signal?.throwIfAborted()
      const args = parseArgs(call)
      run.onStep(describeToolCall(call.function.name, args))
      const key = callKey(call.function.name, args)
      let output: string
      if (done?.has(key)) {
        output = 'The same call was made earlier in this question; its result is above. Use it, or call with other arguments.'
      } else {
        done?.add(key)
        const full = await runTool(call.function.name, args)
        output = full.length > budget.toolResultChars
          ? `${full.slice(0, budget.toolResultChars)}\n... [${full.length - budget.toolResultChars} chars cut; ask for fewer items or a narrower range]`
          : full
      }
      history.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: output })
    }
    const left = MAX_TOOL_ROUNDS - round - 1
    if (left <= ROUNDS_LEFT_NOTE) {
      const lastTool = history[history.length - 1] as Extract<ChatMessage, { role: 'tool' }>
      lastTool.content += left
        ? `\n\n[${left} tool round${left === 1 ? '' : 's'} left, then you answer without tools]`
        : '\n\n[No tool rounds left: answer now from the data you have]'
    }
  }
  throw new Error('Unreachable')
}
