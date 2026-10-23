/**
 * Model catalogs of each provider. Shared by the AI tab and Options, so a list loaded
 * in one place is reused in the other and OpenRouter's health checks run once.
 *
 * The models the assistant uses are the recommended free ones plus those the user added;
 * the whole catalog (free and paid) is loaded only to search it in Options.
 */

import { computed, reactive } from 'vue'
import { activeKey, aiCredentials, isModelBlocked } from './credentials'
import { catalogModels, listModels, openRouterDailyLimit } from './providers'
import { reportedLimit, requestsToday, setReportedLimit } from './modelStatus'
import type { AiModel, AiProviderId } from './types'

interface Loadable {
  list: AiModel[]
  loading: boolean
  error: string | null
  request: number
}

interface Catalog {
  /** Free models, recommended ones marked */
  free: Loadable
  /** Every model of the provider, for the search */
  all: Loadable
}

const catalogs = reactive<Partial<Record<AiProviderId, Catalog>>>({})

function loadable(): Loadable {
  return { list: [], loading: false, error: null, request: 0 }
}

function catalog(provider: AiProviderId): Catalog {
  // Read back through the proxy: `??=` returns the raw object, whose changes the UI would not see
  catalogs[provider] ??= { free: loadable(), all: loadable() }
  return catalogs[provider]!
}

async function fill(target: Loadable, load: () => Promise<AiModel[]>): Promise<boolean> {
  const request = ++target.request
  target.loading = true
  target.error = null
  try {
    const list = await load()
    if (request !== target.request) return false
    target.list = list
    return true
  } catch (e) {
    if (request !== target.request) return false
    target.list = []
    target.error = String((e as Error)?.message || e)
    return false
  } finally {
    if (request === target.request) target.loading = false
  }
}

/** Loads (or reloads) the free models of `provider` for the current key */
export async function loadModels(provider: AiProviderId, force = false): Promise<void> {
  const key = activeKey(provider)
  const ok = await fill(catalog(provider).free, () => listModels(provider, key, force))
  if (ok && provider === 'openrouter' && key && (force || !reportedLimit('openrouter'))) {
    void openRouterDailyLimit(key).then(limit => {
      if (limit) setReportedLimit('openrouter', undefined, limit, Math.max(0, limit - requestsToday('openrouter')))
    })
  }
}

/** Loads the whole catalog of `provider` (free and paid) once per key and TTL */
export async function loadCatalog(provider: AiProviderId, force = false): Promise<void> {
  const target = catalog(provider).all
  if (!force && (target.loading || target.list.length)) return
  const key = activeKey(provider)
  await fill(target, () => catalogModels(provider, key, force))
}

/** Recommended free models, then the added ones; a known model keeps its catalog info (unstable) */
function availableModels(provider: AiProviderId): AiModel[] {
  const free = catalog(provider).free.list
  const byId = new Map(free.map(m => [m.id, m]))
  const out = free.filter(m => m.recommended)
  const seen = new Set(out.map(m => m.id))
  for (const added of aiCredentials.addedModels[provider] ?? []) {
    if (seen.has(added.id)) continue
    seen.add(added.id)
    const known = byId.get(added.id)
    out.push(known ? { ...known, recommended: false } : added)
  }
  return out
}

/** Reactive view of one provider's models. `provider` is read on each access. */
export function providerModels(provider: () => AiProviderId) {
  const all = computed(() => availableModels(provider()))
  return {
    /** Recommended and added models, blocked ones included */
    all,
    /** What the AI tab offers and Auto picks from */
    models: computed(() => all.value.filter(m => !isModelBlocked(m.id, provider()))),
    /** Free models of the catalog */
    free: computed(() => catalog(provider()).free.list),
    loading: computed(() => catalog(provider()).free.loading),
    error: computed(() => catalog(provider()).free.error),
    reload: (force = false) => loadModels(provider(), force),
    /** Free and paid models, filled by `loadCatalog` */
    catalog: computed(() => catalog(provider()).all.list),
    catalogLoading: computed(() => catalog(provider()).all.loading),
    catalogError: computed(() => catalog(provider()).all.error),
  }
}
