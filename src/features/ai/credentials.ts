/**
 * AI provider credentials and choices of the user.
 *
 * Kept under their own storage key, apart from the inspector settings. A settings export copies
 * every choice except the API keys, which stay in this browser. Keys are used only by extension
 * pages (UI / background), never in the page.
 */

import { reactive } from 'vue'
import { getRuntimeAdapter } from '@/runtime'
import { DEFAULT_MASK_KEYS } from '@/injected/logs/config'
import { isCustomProvider, normalizeCustomProviders } from './customProviders'
import type { AiModel, AiProviderId, BuiltinProviderId, CustomProvider, CustomProviderId } from './types'

const STORAGE_KEY = 'vue-inspector-ai'

export type AiTone = 'default' | 'professional' | 'friendly' | 'direct' | 'mentor'
export type AiDetail = 'brief' | 'normal' | 'detailed'
/** full: every skill in the system prompt; lite: a skill list, the model loads the rules it needs */
export type AiRouting = 'full' | 'lite'

export const CUSTOM_STYLE_MAX = 2000

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
  'passcode',
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

function coversKey(keys: string[], word: string): boolean {
  const needle = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  return keys.some(key => key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(needle))
}

function normalizeAiMasking(raw: Partial<AiMasking> | undefined): AiMasking {
  const keys = Array.isArray(raw?.keys)
    ? [...new Set(raw!.keys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map(k => k.trim()))]
    : [...DEFAULT_AI_MASK_KEYS]
  if (!coversKey(keys, 'passcode')) keys.push('passcode')
  return { keys, valuePatterns: raw?.valuePatterns !== false }
}

export interface AiCredentials {
  provider: AiProviderId
  openRouterKey: string
  geminiKey: string
  /** Own connections: OpenAI, DeepSeek, local servers, OpenAI-compatible agents */
  customProviders: CustomProvider[]
  /** Selected model per provider; `AUTO_MODEL` or missing: automatic choice */
  models: Partial<Record<AiProviderId, string>>
  /** The user accepted that logs and page sources are sent to OpenRouter / Gemini (own connections keep their own) */
  consent: boolean
  tone: AiTone
  detail: AiDetail
  /** Style instructions of the user, added to the system prompt */
  customStyle: string
  routing: AiRouting
  /** Models hidden from the AI tab and skipped as fallbacks, per provider */
  blockedModels: Partial<Record<AiProviderId, string[]>>
  /** Models the user added to the recommended ones, per provider */
  addedModels: Partial<Record<AiProviderId, AiModel[]>>
  /** Masking applied to everything the assistant sends to the provider, apart from the Logs masking */
  masking: AiMasking
  access: AiAccess
}

export const BUILTIN_PROVIDERS: readonly BuiltinProviderId[] = ['openrouter', 'gemini']
const TONES = new Set<AiTone>(['default', 'professional', 'friendly', 'direct', 'mentor'])
const DETAILS = new Set<AiDetail>(['brief', 'normal', 'detailed'])
const ROUTINGS = new Set<AiRouting>(['full', 'lite'])

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function providerIds(customs: CustomProvider[]): AiProviderId[] {
  return [...BUILTIN_PROVIDERS, ...customs.map(p => p.id)]
}

function knownProviderRecord<T>(raw: Partial<Record<string, T>> | undefined, ids: AiProviderId[]): Partial<Record<AiProviderId, T>> {
  const out: Partial<Record<AiProviderId, T>> = {}
  if (!raw) return out
  for (const provider of ids) {
    if (raw[provider] !== undefined) out[provider] = raw[provider]
  }
  return out
}

function normalizeAdded(raw: AiCredentials['addedModels'] | undefined, ids: AiProviderId[]): AiCredentials['addedModels'] {
  const out: AiCredentials['addedModels'] = {}
  for (const provider of ids) {
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
  const customProviders = normalizeCustomProviders(raw.customProviders)
  const ids = providerIds(customProviders)
  return {
    provider: raw.provider && ids.includes(raw.provider) ? raw.provider : 'gemini',
    openRouterKey: text(raw.openRouterKey),
    geminiKey: text(raw.geminiKey),
    customProviders,
    models: knownProviderRecord(raw.models, ids),
    consent: raw.consent === true,
    tone: raw.tone && TONES.has(raw.tone) ? raw.tone : 'default',
    detail: raw.detail && DETAILS.has(raw.detail) ? raw.detail : 'normal',
    customStyle: text(raw.customStyle).slice(0, CUSTOM_STYLE_MAX),
    routing: raw.routing && ROUTINGS.has(raw.routing) ? raw.routing : 'lite',
    blockedModels: knownProviderRecord(raw.blockedModels, ids),
    addedModels: normalizeAdded(raw.addedModels, ids),
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
  return saveAiCredentials({
    access: {
      ...aiCredentials.access,
      ...patch,
      tools: { ...aiCredentials.access.tools, ...patch.tools },
    },
  })
}

export function setAiMasking(patch: Partial<AiMasking>): Promise<void> {
  return saveAiCredentials({ masking: normalizeAiMasking({ ...aiCredentials.masking, ...patch }) })
}

export function customProvider(id: AiProviderId = aiCredentials.provider): CustomProvider | undefined {
  return isCustomProvider(id) ? aiCredentials.customProviders.find(p => p.id === id) : undefined
}

export function activeKey(provider: AiProviderId = aiCredentials.provider): string {
  if (provider === 'openrouter') return aiCredentials.openRouterKey
  if (provider === 'gemini') return aiCredentials.geminiKey
  return customProvider(provider)?.apiKey ?? ''
}

/** The provider can take requests: a built-in one has its key, an own connection exists (local servers need no key) */
export function isConnected(provider: AiProviderId = aiCredentials.provider): boolean {
  return isCustomProvider(provider) ? !!customProvider(provider) : !!activeKey(provider)
}

/** What a new key or address makes stale: model marks and limits learned with the old one */
export function connectionSignature(provider: AiProviderId): string {
  const custom = customProvider(provider)
  return custom ? `${custom.baseUrl}\u0000${custom.apiKey}\u0000${JSON.stringify(custom.headers)}` : activeKey(provider)
}

export function hasConsent(provider: AiProviderId = aiCredentials.provider): boolean {
  return isCustomProvider(provider) ? customProvider(provider)?.consent === true : aiCredentials.consent
}

export function giveConsent(provider: AiProviderId = aiCredentials.provider): Promise<void> {
  return isCustomProvider(provider) ? updateCustomProvider(provider, { consent: true }) : saveAiCredentials({ consent: true })
}

/** Adds or replaces an own connection and makes it the current provider */
export function saveCustomProvider(provider: CustomProvider): Promise<void> {
  const list = aiCredentials.customProviders.filter(p => p.id !== provider.id)
  const index = aiCredentials.customProviders.findIndex(p => p.id === provider.id)
  list.splice(index === -1 ? list.length : index, 0, provider)
  return saveAiCredentials({ customProviders: list, provider: provider.id })
}

export function updateCustomProvider(id: CustomProviderId, patch: Partial<Omit<CustomProvider, 'id'>>): Promise<void> {
  return saveAiCredentials({
    customProviders: aiCredentials.customProviders.map(p => (p.id === id ? { ...p, ...patch } : p)),
  })
}

/** Drops the connection with its model choices; the current provider falls back to a built-in one */
export function removeCustomProvider(id: CustomProviderId): Promise<void> {
  const without = <T>(record: Partial<Record<AiProviderId, T>>) => {
    const copy = { ...record }
    delete copy[id]
    return copy
  }
  return saveAiCredentials({
    customProviders: aiCredentials.customProviders.filter(p => p.id !== id),
    provider: aiCredentials.provider === id ? (aiCredentials.openRouterKey && !aiCredentials.geminiKey ? 'openrouter' : 'gemini') : aiCredentials.provider,
    models: without(aiCredentials.models),
    blockedModels: without(aiCredentials.blockedModels),
    addedModels: without(aiCredentials.addedModels),
  })
}

/** Options → AI without API keys and connection headers, for the settings export file */
export type AiSettingsExport = Omit<AiCredentials, 'openRouterKey' | 'geminiKey'>

export async function aiSettingsForExport(): Promise<AiSettingsExport> {
  await loadAiCredentials()
  const snapshot = normalizeCredentials(aiCredentials)
  const rest: AiSettingsExport = {
    provider: snapshot.provider,
    customProviders: snapshot.customProviders.map(p => ({ ...p, apiKey: '', headers: {} })),
    models: snapshot.models,
    consent: snapshot.consent,
    tone: snapshot.tone,
    detail: snapshot.detail,
    customStyle: snapshot.customStyle,
    routing: snapshot.routing,
    blockedModels: snapshot.blockedModels,
    addedModels: snapshot.addedModels,
    masking: snapshot.masking,
    access: snapshot.access,
  }
  return JSON.parse(JSON.stringify(rest))
}

/**
 * Applies Options → AI from a settings file. API keys and connection headers in the file are
 * ignored; those already stored in this browser stay (an own connection keeps them by its id).
 * Own connections of the file are added or updated; connections only in this browser stay.
 */
export async function importAiSettings(raw: unknown): Promise<void> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
  await loadAiCredentials()
  const imported = raw as Partial<AiCredentials>
  const fromFile = normalizeCustomProviders(imported.customProviders).map(p => {
    const local = customProvider(p.id)
    return { ...p, apiKey: local?.apiKey ?? '', headers: local?.headers ?? {}, consent: local?.consent ?? false }
  })
  const customProviders = [
    ...aiCredentials.customProviders.map(local => fromFile.find(p => p.id === local.id) ?? local),
    ...fromFile.filter(p => !customProvider(p.id)),
  ]
  const localOnly = aiCredentials.customProviders.filter(p => !fromFile.some(f => f.id === p.id)).map(p => p.id)
  const keepLocal = <T>(record: Partial<Record<AiProviderId, T>>, fileRecord: unknown) => ({
    ...Object.fromEntries(localOnly.filter(id => record[id] !== undefined).map(id => [id, record[id]])),
    ...(fileRecord && typeof fileRecord === 'object' ? fileRecord : {}),
  })
  const next = normalizeCredentials({
    ...imported,
    customProviders,
    models: keepLocal(aiCredentials.models, imported.models),
    blockedModels: keepLocal(aiCredentials.blockedModels, imported.blockedModels),
    addedModels: keepLocal(aiCredentials.addedModels, imported.addedModels),
    openRouterKey: aiCredentials.openRouterKey,
    geminiKey: aiCredentials.geminiKey,
  })
  await saveAiCredentials(next)
}
