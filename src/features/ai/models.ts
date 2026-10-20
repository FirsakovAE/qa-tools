/**
 * Free-model catalogs of each provider. Shared by the AI tab and Options, so a list loaded
 * in one place is reused in the other and OpenRouter's health checks run once.
 */

import { computed, reactive } from 'vue'
import { activeKey, isModelBlocked } from './credentials'
import { listModels, openRouterDailyLimit } from './providers'
import { reportedLimit, requestsToday, setReportedLimit } from './modelStatus'
import type { AiModel, AiProviderId } from './types'

interface Catalog {
  list: AiModel[]
  loading: boolean
  error: string | null
  request: number
}

const catalogs = reactive<Partial<Record<AiProviderId, Catalog>>>({})

function catalog(provider: AiProviderId): Catalog {
  return catalogs[provider] ??= { list: [], loading: false, error: null, request: 0 }
}

/** Loads (or reloads) the free models of `provider` for the current key */
export async function loadModels(provider: AiProviderId, force = false): Promise<void> {
  const key = activeKey(provider)
  const cat = catalog(provider)
  const request = ++cat.request
  cat.loading = true
  cat.error = null
  try {
    const list = await listModels(provider, key, force)
    if (request !== cat.request) return
    cat.list = list
    if (provider === 'openrouter' && key && (force || !reportedLimit('openrouter'))) {
      void openRouterDailyLimit(key).then(limit => {
        if (limit) setReportedLimit('openrouter', undefined, limit, Math.max(0, limit - requestsToday('openrouter')))
      })
    }
  } catch (e) {
    if (request !== cat.request) return
    cat.list = []
    cat.error = String((e as Error)?.message || e)
  } finally {
    if (request === cat.request) cat.loading = false
  }
}

/** Reactive view of one provider's catalog. `provider` is read on each access. */
export function providerModels(provider: () => AiProviderId) {
  return {
    all: computed(() => catalog(provider()).list),
    models: computed(() => catalog(provider()).list.filter(m => !isModelBlocked(m.id, provider()))),
    loading: computed(() => catalog(provider()).loading),
    error: computed(() => catalog(provider()).error),
    reload: (force = false) => loadModels(provider(), force),
  }
}
