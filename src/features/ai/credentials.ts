/**
 * AI provider credentials and choices of the user.
 *
 * Kept under their own storage key, apart from the inspector settings, so API keys never end up
 * in a settings export. Keys are used only by extension pages (UI / background), never in the page.
 */

import { reactive } from 'vue'
import { getRuntimeAdapter } from '@/runtime'
import { DEFAULT_MASK_KEYS } from '@/injected/logs/config'
import type { AiModel, AiProviderId } from './types'

const STORAGE_KEY = 'vue-inspector-ai'

export type AiTone = 'default' | 'professional' | 'friendly' | 'direct' | 'mentor'
export type AiDetail = 'brief' | 'normal' | 'detailed'

export const CUSTOM_STYLE_MAX = 1000

/** Model value of the automatic mode: the assistant picks an available model and switches on limits */
export const AUTO_MODEL = 'auto'

/** allow: runs on its own; ask: the user confirms each call (or once per chat); deny: the model does not get the tool */
export type AiToolAccess = 'allow' | 'ask' | 'deny'
export type AiToolGroup = 'logs' | 'sources' | 'page'

export interface AiAccess {
  /** The short logs digest goes with a question */
  digest: boolean
  tools: Record<AiToolGroup, AiToolAccess>
  /** Request / response headers (sensitive ones stay masked anyway) */
  headers: boolean
  /** Request / response bodies and WebSocket messages */
  bodies: boolean
  /** Values of store state, props, emit and action payloads; off keeps only names and paths */
  appData: boolean
}

export interface AiMasking {
  /** Object keys / header / param names containing these words are masked before the model sees them */
  keys: string[]
  /** Mask JWTs, Bearer/Basic credentials and card numbers inside any text */
  valuePatterns: boolean
}

export const DEFAULT_AI_MASK_KEYS = [
  ...DEFAULT_MASK_KEYS,
  'auth',
  'bearer',
  'jwt',
  'credential',
  'session',
  'csrf',
  'xsrf',
  'signature',
  'accesskey',
  'passphrase',
]

export const DEFAULT_AI_ACCESS: AiAccess = {
  digest: true,
  tools: { logs: 'ask', sources: 'ask', page: 'ask' },
  headers: true,
  bodies: true,
  appData: true,
}

const TOOL_ACCESS = new Set<AiToolAccess>(['allow', 'ask', 'deny'])

function normalizeAccess(raw: Partial<AiAccess> | undefined): AiAccess {
  const tools = { ...DEFAULT_AI_ACCESS.tools }
  for (const group of Object.keys(tools) as AiToolGroup[]) {
    const value = raw?.tools?.[group]
    if (value && TOOL_ACCESS.has(value)) tools[group] = value
  }
  const flag = (key: 'digest' | 'headers' | 'bodies' | 'appData') => typeof raw?.[key] === 'boolean' ? raw[key] as boolean : DEFAULT_AI_ACCESS[key]
  return { digest: flag('digest'), tools, headers: flag('headers'), bodies: flag('bodies'), appData: flag('appData') }
}

function normalizeAiMasking(raw: Partial<AiMasking> | undefined): AiMasking {
  const keys = Array.isArray(raw?.keys)
    ? [...new Set(raw!.keys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map(k => k.trim()))]
    : [...DEFAULT_AI_MASK_KEYS]
  return { keys, valuePatterns: raw?.valuePatterns !== false }
}

export interface AiCredentials {
  provider: AiProviderId
  openRouterKey: string
  geminiKey: string
  groqKey: string
  /** Selected model per provider; `AUTO_MODEL` or missing: automatic choice */
  models: Partial<Record<AiProviderId, string>>
  /** The user accepted that logs and page sources are sent to the provider */
  consent: boolean
  /** Let thinking models reason before answering (spends completion tokens) */
  reasoning: boolean
  tone: AiTone
  detail: AiDetail
  /** Style instructions of the user, added to the system prompt */
  customStyle: string
  /** Models hidden from the AI tab and skipped as fallbacks, per provider */
  blockedModels: Partial<Record<AiProviderId, string[]>>
  /** Models the user added to the recommended ones, per provider */
  addedModels: Partial<Record<AiProviderId, AiModel[]>>
  /** Masking applied to everything the assistant sends to the provider, apart from the Logs masking */
  masking: AiMasking
  access: AiAccess
}

const PROVIDERS = new Set<AiProviderId>(['gemini', 'openrouter', 'groq'])
const TONES = new Set<AiTone>(['default', 'professional', 'friendly', 'direct', 'mentor'])
const DETAILS = new Set<AiDetail>(['brief', 'normal', 'detailed'])

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeAdded(raw: AiCredentials['addedModels'] | undefined): AiCredentials['addedModels'] {
  const out: AiCredentials['addedModels'] = {}
  for (const provider of PROVIDERS) {
    const list = raw?.[provider]
    if (!Array.isArray(list)) continue
    out[provider] = list
      .filter(m => typeof m?.id === 'string' && m.id)
      .map(m => ({ id: m.id, name: text(m.name) || m.id, ...(m.paid ? { paid: true } : {}) }))
  }
  return out
}

/** Known fields only: fields of older versions are dropped from the storage on the next save */
function normalizeCredentials(raw: Partial<AiCredentials> = {}): AiCredentials {
  return {
    provider: raw.provider && PROVIDERS.has(raw.provider) ? raw.provider : 'gemini',
    openRouterKey: text(raw.openRouterKey),
    geminiKey: text(raw.geminiKey),
    groqKey: text(raw.groqKey),
    models: { ...raw.models },
    consent: raw.consent === true,
    reasoning: raw.reasoning === true,
    tone: raw.tone && TONES.has(raw.tone) ? raw.tone : 'default',
    detail: raw.detail && DETAILS.has(raw.detail) ? raw.detail : 'normal',
    customStyle: text(raw.customStyle).slice(0, CUSTOM_STYLE_MAX),
    blockedModels: { ...raw.blockedModels },
    addedModels: normalizeAdded(raw.addedModels),
    masking: normalizeAiMasking(raw.masking),
    access: normalizeAccess(raw.access),
  }
}

export const aiCredentials = reactive<AiCredentials>(normalizeCredentials())

let loaded: Promise<void> | null = null

export function loadAiCredentials(): Promise<void> {
  loaded ??= (async () => {
    const stored = await getRuntimeAdapter()?.storage.get<Partial<AiCredentials>>(STORAGE_KEY).catch(() => null)
    if (stored && typeof stored === 'object') Object.assign(aiCredentials, normalizeCredentials(stored))
  })()
  return loaded
}

export async function saveAiCredentials(patch: Partial<AiCredentials>): Promise<void> {
  Object.assign(aiCredentials, patch)
  await getRuntimeAdapter()?.storage.set(STORAGE_KEY, JSON.parse(JSON.stringify(aiCredentials)))
}

export function isModelBlocked(id: string, provider: AiProviderId = aiCredentials.provider): boolean {
  return aiCredentials.blockedModels[provider]?.includes(id) ?? false
}

export function setModelBlocked(provider: AiProviderId, id: string, blocked: boolean): Promise<void> {
  const list = (aiCredentials.blockedModels[provider] ?? []).filter(m => m !== id)
  if (blocked) list.push(id)
  return saveAiCredentials({ blockedModels: { ...aiCredentials.blockedModels, [provider]: list } })
}

export function isModelAdded(provider: AiProviderId, id: string): boolean {
  return aiCredentials.addedModels[provider]?.some(m => m.id === id) ?? false
}

export function setModelAdded(provider: AiProviderId, model: AiModel, added: boolean): Promise<void> {
  const list = (aiCredentials.addedModels[provider] ?? []).filter(m => m.id !== model.id)
  if (added) list.push({ id: model.id, name: model.name, ...(model.paid ? { paid: true } : {}) })
  return saveAiCredentials({ addedModels: { ...aiCredentials.addedModels, [provider]: list } })
}

export function selectedModel(provider: AiProviderId = aiCredentials.provider): string {
  return aiCredentials.models[provider] || AUTO_MODEL
}

export function setAiAccess(patch: Partial<AiAccess>): Promise<void> {
  return saveAiCredentials({ access: { ...aiCredentials.access, ...patch, tools: { ...aiCredentials.access.tools, ...patch.tools } } })
}

export function setAiMasking(patch: Partial<AiMasking>): Promise<void> {
  return saveAiCredentials({ masking: normalizeAiMasking({ ...aiCredentials.masking, ...patch }) })
}

export function activeKey(provider: AiProviderId = aiCredentials.provider): string {
  return { openrouter: aiCredentials.openRouterKey, gemini: aiCredentials.geminiKey, groq: aiCredentials.groqKey }[provider]
}
