/**
 * Chat completions for OpenRouter, Gemini and Groq through their OpenAI-compatible endpoints,
 * and the free models each of them offers.
 */

import { reactive } from 'vue'
import { GITHUB_REPO_SLUG } from '@/services/githubReleaseService'
import type { AiModel, AiProviderId, AiTokens, ChatMessage, ChatToolCall, ToolDefinition } from './types'

const OPENROUTER_API = 'https://openrouter.ai/api/v1'
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta'
const GROQ_API = 'https://api.groq.com/openai/v1'

export const PROVIDER_LABELS: Record<AiProviderId, string> = { openrouter: 'OpenRouter', gemini: 'Gemini', groq: 'Groq' }

export interface ProviderBudget {
  /** Timeline lines of the logs digest sent with a question */
  digestTimeline: number
  /** Size of the whole logs digest and of each body in its Problems */
  digestChars?: number
  digestBodyChars?: number
  /** One tool result is cut to this size */
  toolResultChars: number
  /** Conversation size per request (without the system prompt and tool definitions) */
  contextChars: number
  maxTokens?: number
}

/**
 * Groq free tier rejects a single request above ~8K tokens (the minute cap). The system
 * prompt and tool definitions take about 2.5K tokens; the conversation stays under 10K chars.
 */
export const PROVIDER_BUDGET: Record<AiProviderId, ProviderBudget> = {
  openrouter: { digestTimeline: 250, toolResultChars: 24_000, contextChars: Infinity },
  gemini: { digestTimeline: 250, toolResultChars: 24_000, contextChars: Infinity },
  groq: { digestTimeline: 40, digestChars: 5500, digestBodyChars: 500, toolResultChars: 3500, contextChars: 10_000, maxTokens: 2500 },
}

/**
 * Preferred model families, best first; one model of each of the first matching families becomes
 * the quick-switch list. The free catalog changes every few weeks, so the list is broad.
 */
const OPENROUTER_PREFERRED = [
  /nemotron-3-ultra/i,
  /google\/(gemini|gemma)/i,
  /deepseek/i,
  /qwen/i,
  /gpt-oss/i,
  /nemotron.*super/i,
  /inkling(?!-small)/i,
  /llama/i,
  /mistral/i,
]
const GEMINI_PREFERRED = [/^gemini-[\d.]+-flash$/i, /^gemini-[\d.]+-flash-lite$/i, /flash/i]
const GEMINI_FALLBACK: AiModel[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', recommended: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', recommended: true },
]
const GROQ_PREFERRED = [/gpt-oss-120b/i, /qwen/i, /llama-3\.3-70b|llama-4/i, /minimax|kimi|muse/i, /gpt-oss-20b/i, /llama/i]
/** Speech, moderation and server-side agent models: no function calling with our tools */
const GROQ_EXCLUDED = /whisper|orpheus|playai|tts|guard|safeguard|compound|allam/i
const GROQ_FALLBACK: AiModel[] = [
  { id: 'openai/gpt-oss-120b', name: 'gpt-oss-120b', recommended: true },
  { id: 'qwen/qwen3.8-27b', name: 'qwen3.8-27b', recommended: true },
  { id: 'openai/gpt-oss-20b', name: 'gpt-oss-20b', recommended: true },
]
/** Waits for a per-minute limit up to this long instead of switching models */
export const MAX_RATE_WAIT_MS = 20_000
const RECOMMENDED_COUNT = 3
/** Models tried in one request: the chosen one and the fallbacks */
const CHAIN_SIZE = 3
/** A model that failed is skipped for this long */
const BUSY_MS = 10 * 60_000
const HEALTH_PARALLEL = 6
/** Uptime (%) of the best endpoint below which a model is hidden / marked unstable */
const HIDDEN_UPTIME = 20
const UNSTABLE_UPTIME = 80

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
    /** The provider asked to repeat the request after this delay */
    readonly retryAfterMs?: number,
  ) {
    super(message)
  }
}

/** Model id → time until which it is skipped after an error */
export const busyModels = reactive<Record<string, number>>({})

export function markModelBusy(id: string): void {
  busyModels[id] = Date.now() + BUSY_MS
}

export function isModelBusy(id: string): boolean {
  return (busyModels[id] ?? 0) > Date.now()
}

/**
 * Models for one request: the chosen model first (unless it failed recently and others are
 * available), then healthy recommended and other models that did not fail recently.
 */
export function modelChain(selected: string, models: AiModel[], exclude: Set<string> = new Set()): string[] {
  const usable = (id: string) => !exclude.has(id) && !isModelBusy(id)
  const fallbacks = models
    .filter(m => m.id !== selected && !m.unstable && usable(m.id))
    .sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended))
    .map(m => m.id)
  const chain = !exclude.has(selected) && (usable(selected) || !fallbacks.length) ? [selected, ...fallbacks] : fallbacks
  return chain.slice(0, CHAIN_SIZE)
}

function rank(id: string, preferred: RegExp[]): number {
  const index = preferred.findIndex(re => re.test(id))
  return index === -1 ? preferred.length : index
}

/** Sorts by preference and marks one stable model per preferred family as recommended */
function withRecommended(models: AiModel[], preferred: RegExp[]): AiModel[] {
  // Within a family a higher version / size usually sorts last by name, so names go descending
  const sorted = models.slice().sort((a, b) =>
    Number(!!a.unstable) - Number(!!b.unstable)
    || rank(a.id, preferred) - rank(b.id, preferred)
    || b.name.localeCompare(a.name, undefined, { numeric: true }))
  const families = new Set<number>()
  let picked = 0
  for (const model of sorted) {
    const family = rank(model.id, preferred)
    if (picked >= RECOMMENDED_COUNT || model.unstable || family === preferred.length || families.has(family)) continue
    families.add(family)
    model.recommended = true
    picked++
  }
  return sorted
}

/**
 * Endpoint status of a model from the public OpenRouter catalog (costs no requests of the user).
 * `null` when the status is unknown: the model is kept.
 */
async function endpointHealth(id: string): Promise<{ hidden: boolean; unstable: boolean } | null> {
  try {
    const res = await fetch(`${OPENROUTER_API}/models/${id}/endpoints`)
    if (!res.ok) return null
    const data = await res.json()
    const endpoints: any[] = Array.isArray(data?.data?.endpoints) ? data.data.endpoints : []
    const usable = endpoints.filter(e => !Array.isArray(e?.supported_parameters) || e.supported_parameters.includes('tools'))
    if (!usable.length) return { hidden: true, unstable: true }
    const uptime = (e: any) => Number(e.uptime_last_30m ?? e.uptime_last_5m ?? e.uptime_last_1d ?? 100)
    const best = usable.reduce((a, b) => (uptime(b) > uptime(a) || (uptime(b) === uptime(a) && b.status > a.status) ? b : a))
    return {
      hidden: uptime(best) < HIDDEN_UPTIME,
      unstable: Number(best.status) < 0 || uptime(best) < UNSTABLE_UPTIME,
    }
  } catch {
    return null
  }
}

async function withHealth(models: AiModel[]): Promise<AiModel[]> {
  const hidden = new Set<string>()
  let next = 0
  const worker = async () => {
    while (next < models.length) {
      const model = models[next++]
      const health = await endpointHealth(model.id)
      if (health?.hidden) hidden.add(model.id)
      else if (health?.unstable) model.unstable = true
    }
  }
  await Promise.all(Array.from({ length: Math.min(HEALTH_PARALLEL, models.length) }, worker))
  return models.filter(m => !hidden.has(m.id))
}

/** Free OpenRouter models that support tool calling */
async function listOpenRouterModels(): Promise<AiModel[]> {
  const res = await fetch(`${OPENROUTER_API}/models?supported_parameters=tools`)
  if (!res.ok) throw new AiProviderError(`Could not load OpenRouter models (${res.status})`, res.status)
  const data = await res.json()
  const models: AiModel[] = (Array.isArray(data?.data) ? data.data : [])
    .filter((m: any) => typeof m?.id === 'string' && m.id.endsWith(':free'))
    .filter((m: any) => !Array.isArray(m.supported_parameters) || m.supported_parameters.includes('tools'))
    .map((m: any) => ({
      id: m.id,
      name: String(m.name || m.id).replace(/\s*\(free\)\s*$/i, ''),
      contextLength: Number(m.context_length) || undefined,
    }))
  return withRecommended(await withHealth(models), OPENROUTER_PREFERRED)
}

/** Gemini Flash models available to the key (the free tier covers the Flash family) */
async function listGeminiModels(key: string): Promise<AiModel[]> {
  if (!key) return GEMINI_FALLBACK
  try {
    const res = await fetch(`${GEMINI_API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })
    if (!res.ok) throw new AiProviderError(await errorMessage(res), res.status)
    const data = await res.json()
    const models: AiModel[] = (Array.isArray(data?.models) ? data.models : [])
      .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => ({
        id: String(m.name || '').replace(/^models\//, ''),
        name: String(m.displayName || m.name),
        contextLength: Number(m.inputTokenLimit) || undefined,
      }))
      .filter((m: AiModel) => /^gemini-.*flash/i.test(m.id) && !/(image|tts|audio|live|thinking|embedding)/i.test(m.id))
    return models.length ? withRecommended(models, GEMINI_PREFERRED) : GEMINI_FALLBACK
  } catch (e) {
    if (e instanceof AiProviderError && (e.status === 400 || e.status === 401 || e.status === 403)) throw e
    return GEMINI_FALLBACK
  }
}

/** Groq chat models of the key's organization; all of them support tool calling */
async function listGroqModels(key: string): Promise<AiModel[]> {
  if (!key) return GROQ_FALLBACK
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (!res.ok) throw new AiProviderError(await errorMessage(res), res.status)
    const data = await res.json()
    const models: AiModel[] = (Array.isArray(data?.data) ? data.data : [])
      .filter((m: any) => typeof m?.id === 'string' && m.active !== false && !GROQ_EXCLUDED.test(m.id))
      .map((m: any) => ({
        id: m.id,
        name: m.id.replace(/^[^/]+\//, ''),
        contextLength: Number(m.context_window) || undefined,
      }))
    return models.length ? withRecommended(models, GROQ_PREFERRED) : GROQ_FALLBACK
  } catch (e) {
    if (e instanceof AiProviderError && (e.status === 401 || e.status === 403)) throw e
    return GROQ_FALLBACK
  }
}

export function listModels(provider: AiProviderId, key: string): Promise<AiModel[]> {
  if (provider === 'openrouter') return listOpenRouterModels()
  return provider === 'groq' ? listGroqModels(key) : listGeminiModels(key)
}

/** `retry-after` header or "try again in 1m2.5s" / "in 450ms" in the message */
function retryAfter(res: Response | null, message: string): number | undefined {
  const header = Number(res?.headers.get('retry-after'))
  if (header > 0) return header * 1000
  const match = /try again in\s+((?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+s)?(?:[\d.]+ms)?)/i.exec(message)
  if (!match?.[1]) return undefined
  let ms = 0
  for (const [, value, unit] of match[1].matchAll(/([\d.]+)(h|ms|m|s)/g)) {
    ms += Number(value) * ({ h: 3_600_000, m: 60_000, s: 1000, ms: 1 } as Record<string, number>)[unit]
  }
  return ms > 0 ? Math.ceil(ms) : undefined
}

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const data = JSON.parse(text)
    const err = Array.isArray(data) ? data[0]?.error : data?.error
    const raw = err?.metadata?.raw
    if (err?.message) return raw && typeof raw === 'string' ? `${err.message}: ${raw.slice(0, 300)}` : String(err.message)
  } catch { /* not JSON */ }
  return text.slice(0, 300) || `HTTP ${res.status}`
}

/** The account-wide daily cap: switching models does not help */
const DAILY_LIMIT = /per[- ]day|free-models-per-day|daily/i
/** One model or its provider is overloaded / rate-limited: another model may answer */
const MODEL_BUSY = /upstream|overload|temporar|rate[- ]limit|unavailable|capacity|timeout|try again|retry/i

function providerError(status: number, message: string, provider: AiProviderId, res: Response | null = null): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError(provider === 'openrouter'
      ? `OpenRouter rejected the key. Sign in again. (${message})`
      : `${PROVIDER_LABELS[provider]} rejected the API key. (${message})`, status)
  }
  if (status === 402) return new AiProviderError(`The provider requires credits for this request. (${message})`, status)
  if (status === 413) {
    return new AiProviderError(`The request is larger than the model accepts on the free tier. Start a new chat or ask a narrower question. (${message})`, status)
  }
  if (status === 429 && DAILY_LIMIT.test(message)) {
    // Groq limits each model separately: another model still has its own daily quota
    if (provider === 'groq') return new AiProviderError(`Daily limit of this Groq model reached. (${message})`, status, true)
    return new AiProviderError(provider === 'openrouter'
      ? `Daily limit of free requests reached (OpenRouter allows 50 a day on free models). Try again tomorrow. (${message})`
      : `Gemini free tier daily limit reached. Try again tomorrow. (${message})`, status)
  }
  if (status === 429 || status === 408 || status >= 500 || MODEL_BUSY.test(message)) {
    return new AiProviderError(`The model is temporarily unavailable. (${message})`, status, true, retryAfter(res, message))
  }
  return new AiProviderError(message, status)
}

export interface ChatRequest {
  provider: AiProviderId
  key: string
  model: string
  /** OpenRouter tries these when `model` fails (rate limit, downtime) */
  fallbacks?: string[]
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  /** `none` forces a text answer */
  toolChoice?: 'auto' | 'none'
  signal?: AbortSignal
  /** Thinking models reason before answering; off asks them to skip it where the model allows */
  reasoning?: boolean
  /** Streams the response: called with the text received so far */
  onDelta?: (live: ChatLive) => void
}

export interface ChatLive {
  content: string
  reasoning: string
}

export interface ChatResult {
  content: string
  /** Reasoning of a thinking model; shown to the user, never sent back */
  reasoning: string
  toolCalls: ChatToolCall[]
  /** Model that answered (a fallback when the chosen one failed) */
  model: string
  tokens?: AiTokens
}

function readTokens(usage: any): AiTokens | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  const prompt = Number(usage.prompt_tokens) || 0
  const completion = Number(usage.completion_tokens) || 0
  if (!prompt && !completion) return undefined
  return { prompt, completion, cached: Number(usage.prompt_tokens_details?.cached_tokens) || 0 }
}

const THINK_BLOCK = /<think>([\s\S]*?)(?:<\/think>|$)/g

/** Some models put their reasoning into the text as `<think>` blocks; it must not stay in the history */
function splitThink(raw: string): ChatLive {
  if (!raw.includes('<think>')) return { content: raw, reasoning: '' }
  const reasoning: string[] = []
  const content = raw.replace(THINK_BLOCK, (_, text: string) => {
    if (text.trim()) reasoning.push(text.trim())
    return ''
  })
  return { content: content.trim(), reasoning: reasoning.join('\n\n') }
}

/**
 * Reasoning switch per provider. Models that always reason (gpt-oss, Gemini Pro) get the lowest
 * effort when it is off; models without reasoning get nothing, an unknown parameter may fail there.
 */
function reasoningParams(provider: AiProviderId, model: string, on: boolean): Record<string, unknown> {
  if (provider === 'openrouter') return { reasoning: { enabled: on } }
  if (provider === 'gemini') {
    if (/gemini-2\.5-flash/i.test(model)) return on ? {} : { reasoning_effort: 'none' }
    if (/gemini-(2\.5|[3-9])/i.test(model)) return on ? {} : { reasoning_effort: 'low' }
    return {}
  }
  if (/qwen3/i.test(model)) return { reasoning_effort: on ? 'default' : 'none', reasoning_format: 'parsed' }
  if (/gpt-oss/i.test(model)) return { reasoning_effort: on ? 'medium' : 'low' }
  return {}
}

function joinReasoning(...parts: string[]): string {
  return parts.map(p => p.trim()).filter(Boolean).join('\n\n')
}

/** OpenRouter reports upstream failures with HTTP 200 and an `error` object, also inside a stream */
function upstreamError(data: any, provider: AiProviderId): AiProviderError {
  const raw = data.error.metadata?.raw
  const message = `${String(data.error.message || 'Provider error')}${typeof raw === 'string' ? `: ${raw.slice(0, 300)}` : ''}`
  return providerError(Number(data.error.code) || 500, message, provider)
}

function parseJson(data: any, req: ChatRequest): ChatResult {
  if (data?.error) throw upstreamError(data, req.provider)
  const message = data?.choices?.[0]?.message
  if (!message) throw new AiProviderError('The model returned an empty response', undefined, true)
  const split = splitThink(typeof message.content === 'string' ? message.content : '')
  const field = typeof message.reasoning === 'string' ? message.reasoning : typeof message.reasoning_content === 'string' ? message.reasoning_content : ''
  return {
    content: split.content,
    reasoning: joinReasoning(field, split.reasoning),
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    model: typeof data.model === 'string' && data.model ? data.model : req.model,
    tokens: readTokens(data.usage),
  }
}

/** Tool calls arrive in pieces by `index`; some providers send each call whole with a repeated or missing index */
function mergeToolCalls(calls: ChatToolCall[], byIndex: Map<number, ChatToolCall>, deltas: any[]): void {
  for (const d of deltas) {
    if (!d || typeof d !== 'object') continue
    const index = typeof d.index === 'number' ? d.index : undefined
    let call = index !== undefined ? byIndex.get(index) : calls[calls.length - 1]
    if (!call || (d.id && call.id && d.id !== call.id)) {
      call = { id: '', type: 'function', function: { name: '', arguments: '' } }
      calls.push(call)
      if (index !== undefined) byIndex.set(index, call)
    }
    for (const [key, value] of Object.entries(d)) {
      if (key === 'index' || key === 'function' || value == null) continue
      call[key] = value
    }
    if (typeof d.function?.name === 'string' && d.function.name && !call.function.name) call.function.name = d.function.name
    if (typeof d.function?.arguments === 'string') call.function.arguments += d.function.arguments
  }
}

async function readStream(res: Response, req: ChatRequest): Promise<ChatResult> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const calls: ChatToolCall[] = []
  const byIndex = new Map<number, ChatToolCall>()
  let buffer = ''
  let content = ''
  let reasoning = ''
  let model = req.model
  let tokens: AiTokens | undefined
  let received = false

  const onData = (data: any) => {
    if (data?.error) throw upstreamError(data, req.provider)
    if (typeof data?.model === 'string' && data.model) model = data.model
    tokens = readTokens(data?.usage ?? data?.x_groq?.usage) ?? tokens
    const choice = data?.choices?.[0]
    if (!choice) return
    received = true
    const delta = choice.delta ?? choice.message ?? {}
    const text = typeof delta.content === 'string' ? delta.content : ''
    const thought = typeof delta.reasoning === 'string' ? delta.reasoning : typeof delta.reasoning_content === 'string' ? delta.reasoning_content : ''
    if (Array.isArray(delta.tool_calls)) mergeToolCalls(calls, byIndex, delta.tool_calls)
    if (!text && !thought) return
    content += text
    reasoning += thought
    const split = splitThink(content)
    req.onDelta?.({ content: split.content, reasoning: joinReasoning(reasoning, split.reasoning) })
  }
  const onLine = (line: string) => {
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    let data: unknown
    try {
      data = JSON.parse(payload)
    } catch {
      return
    }
    onData(data)
  }

  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      onLine(buffer.slice(0, nl).trim())
      buffer = buffer.slice(nl + 1)
    }
    if (done) break
  }
  onLine(buffer.trim())

  if (!received) throw new AiProviderError('The model returned an empty response', undefined, true)
  const split = splitThink(content)
  return { content: split.content, reasoning: joinReasoning(reasoning, split.reasoning), toolCalls: calls, model, tokens }
}

export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const url = {
    openrouter: `${OPENROUTER_API}/chat/completions`,
    gemini: `${GEMINI_API}/openai/chat/completions`,
    groq: `${GROQ_API}/chat/completions`,
  }[req.provider]
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${req.key}`,
  }
  if (req.provider === 'openrouter') {
    headers['HTTP-Referer'] = `https://github.com/${GITHUB_REPO_SLUG}`
    headers['X-Title'] = 'Vue Inspector'
  }
  const body: Record<string, unknown> = {
    messages: req.messages,
    temperature: 0.2,
  }
  const { maxTokens } = PROVIDER_BUDGET[req.provider]
  if (maxTokens) body.max_tokens = maxTokens
  Object.assign(body, reasoningParams(req.provider, req.model, req.reasoning === true))
  const fallbacks = req.provider === 'openrouter' ? (req.fallbacks ?? []).filter(id => id !== req.model) : []
  if (fallbacks.length) body.models = [req.model, ...fallbacks].slice(0, CHAIN_SIZE)
  else body.model = req.model
  if (req.tools?.length) {
    body.tools = req.tools
    body.tool_choice = req.toolChoice ?? 'auto'
  }

  if (req.onDelta) {
    body.stream = true
    // Gemini and Groq add the usage to the last chunk on their own
    if (req.provider === 'openrouter') body.stream_options = { include_usage: true }
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal })
  if (!res.ok) throw providerError(res.status, await errorMessage(res), req.provider, res)
  if (req.onDelta && res.body && res.headers.get('content-type')?.includes('text/event-stream')) return readStream(res, req)
  return parseJson(await res.json(), req)
}
