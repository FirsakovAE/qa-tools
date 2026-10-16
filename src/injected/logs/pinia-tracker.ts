/**
 * Pinia tracker: logs state changes and action calls.
 *
 * Every observed store starts its history with one full state: `Store initialized` when the
 * store was created while the inspector watched Pinia, `Store snapshot` when observation
 * started on an existing store (first attach, resume after pause, un-ignore, cleared logs).
 * Later changes are stored as diffs only; Before / After are restored on read.
 * A diff that cannot be replayed exactly (too many changes, truncated values) carries the
 * full new state as well, so the chain stays restorable.
 *
 * Mutations are coalesced per store until the next macrotask, so a loop of mutations produces
 * one "Change store" event. Pinia's $subscribe is a deep watcher that re-traverses the whole
 * state on every mutation, so during a burst it is detached and re-armed at flush time
 * (the diff captures everything in between). Stores are not watched at all while
 * logs are paused or the store is ignored.
 *
 * A logged state is `{ state, getters }`, split like the Store tab: `$state` keys, and getters
 * (computed, accessors, data outside `$state` such as `this.user = ...` for a key missing in
 * `state()`). `$subscribe` sees only `$state`, so getters are watched with the root component's
 * `$watch`; when that is unavailable (builds without the Options API), or a getter is a plain
 * value that may be non-reactive, the store is re-checked after its actions.
 */

import type { PiniaInstance, PiniaStore } from '../pinia/types'
import { waitForPinia, watchPiniaStores } from '../pinia/detect'
import { getGetterKeys, getStoreStateKeys, isComputedRef } from '../pinia/store-meta'
import { diffValues, limitChanges, withoutBefore, MAX_CHANGES } from './diff'
import { isIgnored, isLogsPaused, onLogsReset, onLogsStateChanged, recordLog } from './core'
import { createSanitizer } from './sanitize'
import { logsRuntime } from './runtime'

function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100
}

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
/** Whether the stored history of a store can be replayed up to its latest event */
const chainIntact = new Map<string, boolean>()
const activeActions = new Map<string, string[]>()
const pending = new Map<string, PendingMutation>()
/** Stores registered in Pinia while it was observed (consumed by the next sync) */
let created = new WeakSet<object>()
let pinia: PiniaInstance | null = null
let initialized = false

function storesOf(instance: PiniaInstance): PiniaStore[] {
  const s = instance._s
  return (s instanceof Map ? Array.from(s.values()) : Object.values(s)) as PiniaStore[]
}

interface StoreSnapshot {
  state: Record<string, unknown>
  getters: Record<string, unknown>
}

type WatchFn = (getter: () => unknown, cb: () => void, options: { deep: boolean; flush: 'sync' }) => unknown

const getterWatchers = new Map<PiniaStore, () => void>()
let rootWatch: WatchFn | null = null

function candidateApps(): any[] {
  const apps: any[] = [(pinia as any)?._a]
  try {
    apps.push(...((window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__?.apps ?? []))
    document.querySelectorAll('[data-v-app], #app, #root').forEach(el => apps.push((el as any).__vue_app__))
  } catch { /* no DOM access */ }
  return apps.filter(Boolean)
}

/** `$watch` of a mounted root component (public instance API); null until an app is mounted */
function getRootWatch(): WatchFn | null {
  if (rootWatch) return rootWatch
  for (const app of candidateApps()) {
    const root = app._instance ?? app._container?._vnode?.component
    const proxy = root?.proxy
    if (proxy && typeof proxy.$watch === 'function') {
      rootWatch = proxy.$watch.bind(proxy) as WatchFn
      return rootWatch
    }
  }
  return null
}

function ownValue(store: PiniaStore, key: string): { value: unknown } | null {
  const desc = Object.getOwnPropertyDescriptor(store, key)
  return desc && 'value' in desc ? { value: desc.value } : null
}

/** Getter keys as the Store tab shows them, without plugin properties and markRaw objects (router, API clients) */
function getterKeys(store: PiniaStore): string[] {
  const custom: unknown = (store as any)._customProperties
  return getGetterKeys(store).filter(key => {
    if (custom instanceof Set && custom.has(key)) return false
    const own = ownValue(store, key)
    const value = own?.value
    // Options-store getters are `markRaw(computed())`
    if (isComputedRef(value)) return true
    return !(value && typeof value === 'object' && (value as { __v_skip?: boolean }).__v_skip)
  })
}

/** Getters that are plain values assigned to the store (`this.user = ...`), possibly non-reactive */
function hasPlainGetters(store: PiniaStore): boolean {
  return getterKeys(store).some(key => {
    const own = ownValue(store, key)
    return !!own && !isComputedRef(own.value)
  })
}

function readGetter(store: PiniaStore, key: string): unknown {
  try {
    return store[key]
  } catch (e) {
    return `[Error: ${e instanceof Error ? e.message : String(e)}]`
  }
}

/** Same split as the Store tab: `$state` keys and getters (computed, accessors, data outside `$state`) */
function readStoreData(store: PiniaStore): StoreSnapshot {
  const state: Record<string, unknown> = {}
  const getters: Record<string, unknown> = {}
  for (const key of getStoreStateKeys(store)) state[key] = store[key]
  for (const key of getterKeys(store)) getters[key] = readGetter(store, key)
  return { state, getters }
}

function takeSnapshot(store: PiniaStore): unknown {
  try {
    return snapshotter.sanitize(readStoreData(store)).value
  } catch (e) {
    console.error('[injected/logs/pinia] snapshot failed:', store?.$id, e)
    return { state: {}, getters: {} }
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

function recordBase(storeId: string, op: 'init' | 'snapshot', state: unknown): void {
  recordLog({
    kind: 'store',
    key: storeId,
    level: 'info',
    data: { op, state },
    finalize: data => {
      chainIntact.set(storeId, logsRuntime.isComplete(data.state))
      return data
    },
  })
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

  const limited = limitChanges(changes)
  const truncated = changes.length >= MAX_CHANGES
  const exact = !truncated && !limited.some(c => logsRuntime.isIncomplete(c.after))
  // On an intact chain the old values are read from the previous state
  const intact = chainIntact.get(storeId) !== false
  const mutationType = Array.from(p.types).join(', ')

  const data: Record<string, unknown> = {
    op: 'change',
    changes: intact ? limited.map(withoutBefore) : limited,
  }
  if (mutationType && mutationType !== 'direct') data.mutationType = mutationType
  if (p.actions.size > 0) data.actions = Array.from(p.actions)
  if (truncated) data.changesTruncated = true
  if (!exact || !intact) data.state = after

  recordLog({
    kind: 'store',
    key: storeId,
    level: 'info',
    data,
    finalize: stored => {
      if (stored.state !== undefined) chainIntact.set(storeId, logsRuntime.isComplete(stored.state))
      else if (!Array.isArray(stored.changes)) chainIntact.set(storeId, false)
      return stored
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
    // Getters may be unwatched, and plain values outside `$state` non-reactive: the action may have changed them unseen
    if (enabled.has(store) && !isLogsPaused() && (!getterWatchers.has(store) || hasPlainGetters(store))) {
      onMutation(store, undefined)
      pending.get(storeId)?.actions.add(name)
    }
  }

  if (isIgnored('action', key)) {
    ctx.after?.(finish)
    ctx.onError?.(finish)
    return
  }

  const start = performance.now()
  const args = copyValue(Array.from(ctx?.args ?? []))

  ctx.after?.((result: unknown) => {
    finish()
    recordLog({
      kind: 'action',
      key,
      level: 'info',
      data: { args, result, duration: roundMs(performance.now() - start) },
    })
  })

  ctx.onError?.((error: unknown) => {
    finish()
    recordLog({
      kind: 'action',
      key,
      level: 'error',
      data: { args, error: serializeError(error), duration: roundMs(performance.now() - start) },
    })
  })
}

function armGetters(store: PiniaStore): void {
  if (getterWatchers.has(store)) return
  const watch = getRootWatch()
  if (!watch) return
  try {
    const stop = watch(
      () => getterKeys(store).map(key => readGetter(store, key)),
      () => {
        try {
          onMutation(store, undefined)
        } catch (e) {
          console.error('[injected/logs/pinia] onMutation failed:', store.$id, e)
        }
      },
      { deep: true, flush: 'sync' },
    )
    // `$watch` is a no-op in builds without the Options API
    if (typeof stop === 'function') getterWatchers.set(store, stop as () => void)
  } catch (e) {
    console.error('[injected/logs/pinia] $watch failed:', store.$id, e)
  }
}

function arm(store: PiniaStore): void {
  armGetters(store)
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
  for (const map of [watchers, getterWatchers]) {
    const stop = map.get(store)
    if (!stop) continue
    map.delete(store)
    try {
      stop()
    } catch { /* store disposed */ }
  }
}

/** Starts observing a store; a store that is already observed keeps its history as is */
function enable(store: PiniaStore, op: 'init' | 'snapshot'): void {
  if (enabled.has(store)) {
    // The app may have mounted after the store was enabled: `$watch` is available now
    if (!pending.has(store.$id)) armGetters(store)
    return
  }
  enabled.add(store)
  const state = takeSnapshot(store)
  snapshots.set(store.$id, state)
  recordBase(store.$id, op, state)
  arm(store)
}

function disable(store: PiniaStore): void {
  if (!enabled.delete(store)) return
  disarm(store)
  snapshots.delete(store.$id)
  chainIntact.delete(store.$id)
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
    else enable(store, created.has(store) ? 'init' : 'snapshot')
  }
  // A store enabled later (resume, un-ignore) already existed when observation started
  created = new WeakSet()
}

/** Stores just registered in Pinia: their first state is the initial one */
function markCreatedStores(): void {
  if (!pinia || isLogsPaused()) return
  for (const store of storesOf(pinia)) {
    if (store && !attached.has(store)) created.add(store)
  }
}

/** History was cleared or re-masked: restart every observed chain from a full state */
function resnapshot(): void {
  for (const store of enabled) {
    const p = pending.get(store.$id)
    if (p) {
      pending.delete(store.$id)
      arm(store)
    }
    const state = takeSnapshot(store)
    snapshots.set(store.$id, state)
    recordBase(store.$id, 'snapshot', state)
  }
}

export function initPiniaLogs(): void {
  if (initialized) return
  initialized = true

  onLogsStateChanged(syncStores)
  onLogsReset(resnapshot)

  waitForPinia(5000)
    .then(instance => {
      if (!instance) {
        initialized = false
        return
      }
      pinia = instance
      syncStores()
      // Store setup runs after `_s.set` — attach on the next task so the initial state is populated
      watchPiniaStores(instance, () => {
        markCreatedStores()
        setTimeout(syncStores, 0)
      })
    })
    .catch(e => {
      initialized = false
      console.error('[injected/logs/pinia] waitForPinia failed:', e)
    })
}
