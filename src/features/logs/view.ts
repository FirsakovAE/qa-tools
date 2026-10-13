/**
 * Read side of the Logs tab: derived display fields and full event views.
 *
 * Events are stored compactly (see types/logs.ts); the table, search, details, Raw and cURL
 * read through these helpers, which restore the computed fields with the shared runtime.
 */

import type { LogEvent } from '@/types/logs'
import { LOG_KIND_LABELS, LOG_KIND_META } from '@/types/logs'
import type { NetworkEntry } from '@/types/network'
import { logsRuntime as rt, type HydratedEvent, type StoreChains } from '@/injected/logs/runtime'
import type { NetworkPool } from './networkPool'

/** Events of one source (live buffer or an imported file) and its network entries */
export interface LogsSource {
  events: LogEvent[]
  pool: NetworkPool
  /** Shared immutable values referenced from event data */
  snapshotPool?: {
    get(id: string): unknown
    reachable(roots: unknown[]): Record<string, unknown>
  }
}

const HYDRATE_CACHE_SIZE = 16

const storeIndexes = new WeakMap<LogEvent[], StoreChains>()
const descriptions = new WeakMap<LogEvent, { title: string; subtitle?: string }>()
const hydrated = new Map<LogEvent, HydratedEvent>()

function storeChains(events: LogEvent[]): StoreChains {
  let index = storeIndexes.get(events)
  if (!index) {
    index = rt.indexStores(events)
    storeIndexes.set(events, index)
  }
  return index
}

function context(source: LogsSource) {
  return {
    stores: storeChains(source.events),
    getEntry: (id: string) => source.pool.get(id) as Record<string, any> | undefined,
  }
}

export function networkEntryOf(event: LogEvent, source: LogsSource): NetworkEntry | undefined {
  if (event.kind !== 'request' && event.kind !== 'response') return undefined
  const id = event.data?.entryId
  return typeof id === 'string' ? source.pool.get(id) : undefined
}

export function describeLog(event: LogEvent, source: LogsSource): { title: string; subtitle?: string } {
  let description = descriptions.get(event)
  if (!description) {
    // Store and props summaries depend only on the event itself
    description = rt.describe(event, { getEntry: id => source.pool.get(id) as Record<string, any> | undefined })
    descriptions.set(event, description)
  }
  return description
}

/** Type label (store bases have their own names within "Change store") */
export function logLabel(event: LogEvent): string {
  return rt.eventLabel(event, LOG_KIND_LABELS)
}

export function logBadgeClass(event: LogEvent): string {
  return LOG_KIND_META[event.kind]?.badgeClass ?? ''
}

/**
 * Full view with restored fields (Before / After, changes with old values, request / response
 * of the network entry...). A few recent views are cached; states are shared, do not mutate.
 */
export function hydrateLog(event: LogEvent, source: LogsSource): HydratedEvent {
  const cached = hydrated.get(event)
  if (cached) {
    hydrated.delete(event)
    hydrated.set(event, cached)
    return cached
  }
  const view = rt.hydrate(event, context(source), LOG_KIND_LABELS)
  hydrated.set(event, view)
  if (hydrated.size > HYDRATE_CACHE_SIZE) hydrated.delete(hydrated.keys().next().value as LogEvent)
  return view
}

/** Data indexed by key / value search: the stored payload, or the own half of a network entry */
export function searchPayload(event: LogEvent, source: LogsSource): unknown {
  const entry = networkEntryOf(event, source)
  return entry ? rt.entryPart(entry as Record<string, any>, event.kind) : rt.resolveValue(event.data)
}

/** The other network event of the same entry */
export function pairedNetworkEvent(
  event: LogEvent | null,
  source: LogsSource,
  getEvent: (id: string) => LogEvent | undefined,
): LogEvent | null {
  if (!event || (event.kind !== 'request' && event.kind !== 'response')) return null
  const entryId = event.data?.entryId
  if (typeof entryId !== 'string') return null
  const pairKind = event.kind === 'request' ? 'response' : 'request'
  const byConvention = getEvent(`net-${pairKind === 'request' ? 'req' : 'res'}-${entryId}`)
  if (byConvention?.kind === pairKind && byConvention.data?.entryId === entryId) return byConvention
  return source.events.find(e => e.kind === pairKind && e.data?.entryId === entryId) ?? null
}
