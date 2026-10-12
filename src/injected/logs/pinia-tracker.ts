/**
 * Pinia tracker: logs state changes (before/after snapshots + diff) and action calls.
 *
 * Mutations are coalesced per store until the next macrotask, so a loop of mutations produces
 * one "Change store" event. Pinia's $subscribe is a deep watcher that re-traverses the whole
 * state on every mutation, so during a burst it is detached and re-armed at flush time
 * (the before/after diff captures everything in between). Stores are not watched at all while
 * logs are paused or the store is ignored.
 */

import type { PiniaInstance, PiniaStore } from '../pinia/types'
import { waitForPinia, watchPiniaStores } from '../pinia/detect'
import { getStoreStateKeys } from '../pinia/store-meta'
import { diffValues, limitChanges, summarizeChanges, MAX_CHANGES } from './diff'
import { isIgnored, isLogsPaused, onLogsStateChanged, recordLog } from './core'
import { createSanitizer } from './sanitize'

interface PendingMutation {
  store: PiniaStore
  types: Set<string>
  actions: Set<string>
}

/** Plain-JSON copies without masking: snapshots are diffed raw and masked in recordLog */
const snapshotter = createSanitizer({ enabled: false, keys: [], valuePatterns: false })

const attached = new WeakSet<object>()
const enabled = new Set<PiniaStore>()
const watchers = new Map<PiniaStore, () => void>()
const snapshots = new Map<string, unknown>()
const activeActions = new Map<string, string[]>()
const pending = new Map<string, PendingMutation>()
let pinia: PiniaInstance | null = null
let initialized = false

function storesOf(instance: PiniaInstance): PiniaStore[] {
  const s = instance._s
  return (s instanceof Map ? Array.from(s.values()) : Object.values(s)) as PiniaStore[]
}

function takeSnapshot(store: PiniaStore): unknown {
  try {
    const state: Record<string, unknown> = {}
    for (const key of getStoreStateKeys(store)) state[key] = store[key]
    return snapshotter.sanitize(state).value
  } catch (e) {
    console.error('[injected/logs/pinia] snapshot failed:', store?.$id, e)
    return {}
  }
}

function copyValue(value: unknown): unknown {
  try {
    return snapshotter.sanitize(value).value
  } catch {
    return '[Non-serializable]'
  }
}

function serializeError(error: unknown): { message: string; name?: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, name: error.name, stack: error.stack }
  return { message: typeof error === 'string' ? error : JSON.stringify(copyValue(error)) }
}

function flushStore(storeId: string): void {
  const p = pending.get(storeId)
  pending.delete(storeId)
  if (!p || !enabled.has(p.store)) return

  arm(p.store)
  const before = snapshots.get(storeId)
  const after = takeSnapshot(p.store)
  snapshots.set(storeId, after)
  if (before === undefined) return

  const changes = diffValues(before, after)
  if (changes.length === 0) return

  recordLog({
    kind: 'store',
    key: storeId,
    level: 'info',
    title: storeId,
    subtitle: summarizeChanges(changes),
    data: {
      storeId,
      mutationType: Array.from(p.types).join(', '),
      actions: Array.from(p.actions),
      changes: limitChanges(changes),
      changesTruncated: changes.length >= MAX_CHANGES,
      before,
      after,
    },
  })
}

function onMutation(store: PiniaStore, mutation: { type?: string } | undefined): void {
  if (isLogsPaused()) return
  const storeId = store.$id

  let p = pending.get(storeId)
  if (!p) {
    p = { store, types: new Set(), actions: new Set() }
    pending.set(storeId, p)
    setTimeout(() => flushStore(storeId), 0)
  } else {
    // A burst: stop re-traversing the state on each further mutation until the flush
    disarm(store)
  }
  p.types.add(mutation?.type ?? 'direct')
  for (const name of activeActions.get(storeId) ?? []) p.actions.add(name)
}

function onAction(store: PiniaStore, ctx: any): void {
  if (isLogsPaused()) return
  const storeId = store.$id
  const name = String(ctx?.name ?? 'unknown')
  const key = `${storeId}.${name}`

  const stack = activeActions.get(storeId) ?? []
  stack.push(name)
  activeActions.set(storeId, stack)
  // The watcher is detached while a change is pending: attribute actions run in that window
  pending.get(storeId)?.actions.add(name)
  const finish = () => {
    const s = activeActions.get(storeId)
    const i = s ? s.lastIndexOf(name) : -1
    if (s && i !== -1) s.splice(i, 1)
  }

  if (isIgnored('action', key)) {
    ctx.after?.(finish)
    ctx.onError?.(finish)
    return
  }

  const start = performance.now()
  const args = copyValue(Array.from(ctx?.args ?? []))
  const base = { storeId, action: name, args }

  ctx.after?.((result: unknown) => {
    finish()
    const duration = Math.round(performance.now() - start)
    recordLog({
      kind: 'action',
      key,
      level: 'info',
      title: `${storeId}.${name}()`,
      subtitle: `${duration} ms`,
      data: { ...base, status: 'success', result, duration },
    })
  })

  ctx.onError?.((error: unknown) => {
    finish()
    const duration = Math.round(performance.now() - start)
    const err = serializeError(error)
    recordLog({
      kind: 'action',
      key,
      level: 'error',
      title: `${storeId}.${name}()`,
      subtitle: `Error: ${err.message}`,
      data: { ...base, status: 'error', error: err, duration },
    })
  })
}

function arm(store: PiniaStore): void {
  if (watchers.has(store)) return
  try {
    const stop = (store.$subscribe as any)((mutation: any) => {
      try {
        onMutation(store, mutation)
      } catch (e) {
        console.error('[injected/logs/pinia] onMutation failed:', store.$id, e)
      }
    }, { detached: true, flush: 'sync' })
    watchers.set(store, typeof stop === 'function' ? stop : () => {})
  } catch (e) {
    console.error('[injected/logs/pinia] $subscribe failed:', store.$id, e)
  }
}

function disarm(store: PiniaStore): void {
  const stop = watchers.get(store)
  if (!stop) return
  watchers.delete(store)
  try {
    stop()
  } catch { /* store disposed */ }
}

function enable(store: PiniaStore): void {
  if (enabled.has(store)) return
  enabled.add(store)
  snapshots.set(store.$id, takeSnapshot(store))
  arm(store)
}

function disable(store: PiniaStore): void {
  if (!enabled.delete(store)) return
  disarm(store)
  snapshots.delete(store.$id)
  pending.delete(store.$id)
}

function attachStore(store: PiniaStore): void {
  if (!store || attached.has(store) || typeof store.$subscribe !== 'function') return
  attached.add(store)

  if (typeof store.$onAction === 'function') {
    try {
      store.$onAction((ctx: any) => {
        try {
          onAction(store, ctx)
        } catch (e) {
          console.error('[injected/logs/pinia] onAction failed:', store.$id, e)
        }
      }, true)
    } catch (e) {
      console.error('[injected/logs/pinia] $onAction failed:', store.$id, e)
    }
  }
}

/** Attach new stores and (un)subscribe mutations according to pause / ignore state */
function syncStores(): void {
  if (!pinia) return
  const current = storesOf(pinia)
  const alive = new Set(current)
  for (const store of [...enabled]) {
    if (!alive.has(store)) disable(store)
  }
  for (const store of current) {
    attachStore(store)
    if (!attached.has(store)) continue
    if (isLogsPaused() || isIgnored('store', store.$id)) disable(store)
    else enable(store)
  }
}

export function initPiniaLogs(): void {
  if (initialized) return
  initialized = true

  onLogsStateChanged(syncStores)

  waitForPinia(5000)
    .then(instance => {
      if (!instance) {
        initialized = false
        return
      }
      pinia = instance
      syncStores()
      // Store setup runs after `_s.set` — attach on the next task so the initial snapshot is populated
      watchPiniaStores(instance, () => setTimeout(syncStores, 0))
    })
    .catch(e => {
      initialized = false
      console.error('[injected/logs/pinia] waitForPinia failed:', e)
    })
}
