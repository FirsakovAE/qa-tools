/**
 * What the assistant learned about models from their errors and responses, kept across sessions:
 * models out of their daily quota or gone for the key, requests made today and the limits the
 * provider reported. Auto mode skips unavailable models; the AI tab and Options show the state.
 */

import { reactive } from 'vue'
import { getRuntimeAdapter } from '@/runtime'
import type { AiProviderId } from './types'

const STORAGE_KEY = 'vue-inspector-ai-status'
const SAVE_DELAY_MS = 500
/** A reported limit (e.g. OpenRouter's 50 or 1000 a day) stays useful as the limit of later days */
const LIMIT_KEEP_MS = 7 * 24 * 3_600_000

/** quota: daily or project quota used up; gone: the key cannot use the model; busy: overloaded or rate-limited */
export type ModelState = 'quota' | 'gone' | 'busy'

export interface ModelStatus {
  state: ModelState
  /** Time until which the model is skipped */
  until: number
  message: string
}

export interface ReportedLimit {
  limit: number
  remaining: number
  at: number
}

interface StatusData {
  models: Record<string, ModelStatus>
  /** Requests by day: `provider` and `provider:model` → count */
  usage: { day: string; counts: Record<string, number> }
  /** Requests per day the provider reported (Groq headers, OpenRouter key info) */
  limits: Record<string, ReportedLimit>
}

const status = reactive<StatusData>({ models: {}, usage: { day: today(), counts: {} }, limits: {} })

let loaded: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

function dayOf(time: number): string {
  const d = new Date(time)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function today(): string {
  return dayOf(Date.now())
}

function key(provider: AiProviderId, model?: string): string {
  return model ? `${provider}:${model}` : provider
}

/** Expired marks and limits of earlier days are dropped, so the stored object does not grow */
function prune(): void {
  const now = Date.now()
  for (const [id, entry] of Object.entries(status.models)) {
    if (entry.until <= now) delete status.models[id]
  }
  for (const [id, entry] of Object.entries(status.limits)) {
    if (now - entry.at > LIMIT_KEEP_MS) delete status.limits[id]
  }
}

function save(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    prune()
    void getRuntimeAdapter()?.storage.set(STORAGE_KEY, JSON.parse(JSON.stringify(status))).catch(() => {})
  }, SAVE_DELAY_MS)
}

function rollDay(): void {
  const day = today()
  if (status.usage.day === day) return
  status.usage = { day, counts: {} }
}

export function loadModelStatus(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      const stored = await getRuntimeAdapter()?.storage.get<Partial<StatusData>>(STORAGE_KEY).catch(() => null)
      if (!stored || typeof stored !== 'object') return
      const now = Date.now()
      for (const [id, entry] of Object.entries(stored.models ?? {})) {
        if (entry && typeof entry.until === 'number' && entry.until > now) status.models[id] = entry
      }
      if (stored.usage?.day === today() && stored.usage.counts) status.usage = { day: stored.usage.day, counts: { ...stored.usage.counts } }
      Object.assign(status.limits, stored.limits ?? {})
    })()
  }
  return loaded
}

/** Current problem of the model; `null` when it is usable or the problem expired */
export function modelStatus(provider: AiProviderId, model: string): ModelStatus | null {
  const entry = status.models[key(provider, model)]
  return entry && entry.until > Date.now() ? entry : null
}

export function markModel(provider: AiProviderId, model: string, state: ModelState, until: number, message: string): void {
  status.models[key(provider, model)] = { state, until, message }
  save()
}

export function clearModel(provider: AiProviderId, model: string): void {
  const id = key(provider, model)
  if (!status.models[id]) return
  delete status.models[id]
  save()
}

/** Forgets the marks and reported limits of the provider (a new key, or the user resets them) */
export function clearProviderStatus(provider: AiProviderId): void {
  for (const id of Object.keys(status.models)) {
    if (id.startsWith(`${provider}:`)) delete status.models[id]
  }
  for (const id of Object.keys(status.limits)) {
    if (id === provider || id.startsWith(`${provider}:`)) delete status.limits[id]
  }
  save()
}

export function recordRequest(provider: AiProviderId, model: string): void {
  rollDay()
  const counts = status.usage.counts
  counts[provider] = (counts[provider] ?? 0) + 1
  counts[key(provider, model)] = (counts[key(provider, model)] ?? 0) + 1
  save()
}

/** Requests sent from this browser today: to the whole provider or to one model */
export function requestsToday(provider: AiProviderId, model?: string): number {
  if (status.usage.day !== today()) return 0
  return status.usage.counts[key(provider, model)] ?? 0
}

export function setReportedLimit(provider: AiProviderId, model: string | undefined, limit: number, remaining: number): void {
  status.limits[key(provider, model)] = { limit, remaining, at: Date.now() }
  save()
}

/** A limit reported on an earlier day has been reset since */
function current(entry: ReportedLimit): ReportedLimit {
  return dayOf(entry.at) === today() ? entry : { ...entry, remaining: entry.limit }
}

export function reportedLimit(provider: AiProviderId, model?: string): ReportedLimit | null {
  const entry = status.limits[key(provider, model)]
  return entry ? current(entry) : null
}

/** The newest per-model limit of the provider, with its model id */
export function latestReportedLimit(provider: AiProviderId): (ReportedLimit & { model: string }) | null {
  let best: [string, ReportedLimit] | null = null
  for (const pair of Object.entries(status.limits)) {
    if (pair[0].startsWith(`${provider}:`) && (!best || pair[1].at > best[1].at)) best = pair
  }
  return best ? { ...current(best[1]), model: best[0].slice(provider.length + 1) } : null
}

/** Models of the list Auto mode skips right now */
export function unavailableCount(provider: AiProviderId, models: { id: string }[]): number {
  return models.filter(m => modelStatus(provider, m.id)).length
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** State for model lists: "quota used up, resets in 14 h 57 min"; empty when the model is usable */
export function statusLabel(provider: AiProviderId, model: string): string {
  const entry = modelStatus(provider, model)
  if (!entry) return ''
  const left = formatDuration(entry.until - Date.now())
  if (entry.state === 'quota') return `quota used up, resets in ${left}`
  if (entry.state === 'gone') return 'not available for this key'
  return `busy, retry in ${left}`
}
