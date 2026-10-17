/**
 * AI provider credentials and choices of the user.
 *
 * Kept under their own storage key, apart from the inspector settings, so API keys never end up
 * in a settings export. Keys are used only by extension pages (UI / background), never in the page.
 */

import { reactive } from 'vue'
import { getRuntimeAdapter } from '@/runtime'
import type { AiProviderId } from './types'

const STORAGE_KEY = 'vue-inspector-ai'

export interface AiCredentials {
  provider: AiProviderId
  openRouterKey: string
  geminiKey: string
  groqKey: string
  /** Selected model per provider */
  models: Partial<Record<AiProviderId, string>>
  /** The user accepted that logs and page sources are sent to the provider */
  consent: boolean
  /** Let thinking models reason before answering (spends completion tokens) */
  reasoning: boolean
}

const DEFAULTS: AiCredentials = {
  provider: 'openrouter',
  openRouterKey: '',
  geminiKey: '',
  groqKey: '',
  models: {},
  consent: false,
  reasoning: false,
}

export const aiCredentials = reactive<AiCredentials>({ ...DEFAULTS, models: {} })

let loaded: Promise<void> | null = null

export function loadAiCredentials(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      const stored = await getRuntimeAdapter()?.storage.get<Partial<AiCredentials>>(STORAGE_KEY).catch(() => null)
      if (stored && typeof stored === 'object') {
        Object.assign(aiCredentials, DEFAULTS, stored, { models: { ...stored.models } })
      }
    })()
  }
  return loaded
}

export async function saveAiCredentials(patch: Partial<AiCredentials>): Promise<void> {
  Object.assign(aiCredentials, patch)
  await getRuntimeAdapter()?.storage.set(STORAGE_KEY, JSON.parse(JSON.stringify(aiCredentials)))
}

/** OAuth needs `chrome.identity` in the background script (extension only) */
export function canSignInWithOpenRouter(): boolean {
  return getRuntimeAdapter()?.capabilities.hasBackgroundScript === true && typeof chrome !== 'undefined' && !!chrome.runtime?.id
}

export async function signInWithOpenRouter(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'AI_OPENROUTER_SIGN_IN' }) as { key?: string; error?: string } | undefined
  if (!response?.key) throw new Error(response?.error || 'Sign-in failed')
  await saveAiCredentials({ openRouterKey: response.key, provider: 'openrouter' })
}

export function signOutOfOpenRouter(): Promise<void> {
  return saveAiCredentials({ openRouterKey: '' })
}

export function activeKey(provider: AiProviderId = aiCredentials.provider): string {
  return { openrouter: aiCredentials.openRouterKey, gemini: aiCredentials.geminiKey, groq: aiCredentials.groqKey }[provider]
}
