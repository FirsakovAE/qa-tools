/**
 * Logs limits shared by the page buffer and the Logs tab.
 *
 * Beyond the memory budget the log is cut at a Navigation. Everything recorded before that
 * Navigation is removed (network, WebSocket, props, Pinia, emit, store actions, errors).
 * A Pinia chain that still has changes after the cut is sealed into one checkpoint at the cut,
 * and the older base and diffs are deleted. While an earlier Navigation remains, the cut moves
 * to the next one. The last Navigation is rewritten as a snapshot of the page at that moment,
 * data before it is removed the same way, and anything still over the budget is dropped
 * oldest-first. The newest event is always kept, even when it alone exceeds the budget.
 */

import type { LogEvent } from './types'
import type { LogsLimits } from './config'
import { logsRuntime as rt } from './runtime'
import { measureJson, type OmittedValue } from './sanitize'

/**
 * Checkpoint sizes are estimated incrementally (previous size + folded diffs) and measured
 * exactly every N folds, or when the estimate drifts beyond twice the last exact size
 */
const CHECKPOINT_REMEASURE_EVERY = 32
const measuredSizes = new WeakMap<LogEvent, number>()

export const CHECKPOINT_ID_PREFIX = 'store-cp-'

export interface EnforceOptions {
  /**
   * Checkpoint states may be updated in place: the caller owns them and never hands them out
   * by reference (page buffer). The UI keeps states immutable because views share them.
   */
  inPlace?: boolean
  /** Size of data stored outside the events (shared network entries, snapshot pool) */
  extraSize?: () => number
  /**
   * Rewrites a new checkpoint payload before it is measured (snapshot interning).
   * `size` is the serialized size of `data` only; the key and envelope are added here.
   */
  compactData?: (data: Record<string, any>) => { data: Record<string, any>; size: number }
  /** Called for every dropped event (folded store changes are not dropped) */
  onDrop?: (event: LogEvent) => void
}

export interface EnforceResult {
  list: LogEvent[]
  changed: boolean
  removed: LogEvent[]
  added: LogEvent[]
  total: number
}

export function isStoreBase(event: LogEvent): boolean {
  return rt.isStoreBase(event)
}

/** Event that may be dropped / folded by the budget before the store bases */
export function countsTowardLimit(event: LogEvent): boolean {
  return !rt.isStoreBase(event)
}

/** Id of the change a checkpoint was folded through (empty for other events) */
export function checkpointThrough(event: LogEvent): string {
  return event.id.startsWith(CHECKPOINT_ID_PREFIX) ? event.id.slice(CHECKPOINT_ID_PREFIX.length) : ''
}

function sizeOf(event: LogEvent): number {
  return event.size ?? 0
}

interface FoldState {
  current: unknown
  known: boolean
  /** `current` may be mutated */
  owned: boolean
  compacted: number
  last: LogEvent | null
  previousCheckpoint: LogEvent | null
  firstBase: LogEvent | null
  superseded: LogEvent[]
  foldedSize: number
}

/**
 * Folds store changes into one checkpoint per store. `fold` must hold the oldest changes of
 * their stores (callers pick events oldest-first). Bases preceding the folded changes are
 * superseded by the checkpoint, except the first original snapshot of the store.
 */
export function foldStoreChanges(
  list: LogEvent[],
  fold: Set<LogEvent>,
  inPlace: boolean,
  compactData?: EnforceOptions['compactData'],
): { list: LogEvent[]; removed: LogEvent[]; added: LogEvent[] } {
  const left = new Map<string, number>()
  for (const event of fold) left.set(event.key, (left.get(event.key) ?? 0) + 1)

  const states = new Map<string, FoldState>()
  for (const event of list) {
    if (event.kind !== 'store' || !left.get(event.key)) continue
    let s = states.get(event.key)
    if (!s) {
      s = { current: undefined, known: false, owned: false, compacted: 0, last: null, previousCheckpoint: null, firstBase: null, superseded: [], foldedSize: 0 }
      states.set(event.key, s)
    }
    const data = rt.payload(event)
    const anchor = rt.storeAnchor(event)
    const op = rt.storeOp(event)

    if (!fold.has(event)) {
      if (op === 'change') {
        // Not a prefix of the store's changes: the chain cannot be continued exactly
        s.known = false
        continue
      }
      s.known = rt.isComplete(anchor)
      s.current = anchor
      // A pooled snapshot is shared; mutating it would change every event that references it
      s.owned = inPlace && op === 'checkpoint' && !rt.sharesSnapshot(anchor)
      if (op === 'checkpoint') {
        s.compacted += Number(data.compacted) || 0
        s.previousCheckpoint = event
      }
      if (!s.firstBase && op !== 'checkpoint') s.firstBase = event
      else s.superseded.push(event)
      continue
    }

    if (rt.isComplete(anchor)) {
      s.current = anchor
      s.known = true
      s.owned = false
    } else if (s.known && Array.isArray(data.changes) && !data.changesTruncated) {
      if (!s.owned) {
        s.current = rt.clone(s.current)
        s.owned = true
      }
      const applied = rt.applyChanges(s.current, data.changes, false)
      s.current = applied.root
      s.known = applied.exact
    } else {
      s.known = false
    }
    if (op === 'change') s.compacted++
    s.foldedSize += sizeOf(event)
    if (s.last) s.superseded.push(s.last)
    s.last = event
    left.set(event.key, (left.get(event.key) ?? 1) - 1)
  }

  const removed = new Set<LogEvent>()
  const replace = new Map<LogEvent, LogEvent>()
  const added: LogEvent[] = []
  for (const [key, s] of states) {
    if (!s.last) continue
    for (const event of s.superseded) removed.add(event)
    const unavailable: OmittedValue = { __omitted: true, reason: 'unavailable', size: 0 }
    const state = s.known ? s.current : unavailable
    const previousSize = s.previousCheckpoint?.size
    const previousMeasured = s.previousCheckpoint ? measuredSizes.get(s.previousCheckpoint) : undefined
    const estimate = previousSize !== undefined ? previousSize + s.foldedSize : Infinity
    const useEstimate = !compactData && s.known && previousMeasured !== undefined
      && s.compacted % CHECKPOINT_REMEASURE_EVERY !== 0 && estimate <= previousMeasured * 2 + 1024
    let data: Record<string, any> = { op: 'checkpoint', compacted: s.compacted, state }
    let size = useEstimate ? estimate : measureJson(state) + key.length + 120
    if (compactData) {
      const compacted = compactData(data)
      data = compacted.data
      size = compacted.size + key.length + 120
    }
    const measured = useEstimate ? previousMeasured! : size
    const checkpoint: LogEvent = {
      id: `${CHECKPOINT_ID_PREFIX}${s.last.id}`,
      kind: 'store',
      timestamp: s.last.timestamp,
      key,
      level: 'info',
      data,
      size,
    }
    measuredSizes.set(checkpoint, measured)
    replace.set(s.last, checkpoint)
    removed.add(s.last)
    added.push(checkpoint)
  }

  const out: LogEvent[] = []
  for (const event of list) {
    const replacement = replace.get(event)
    if (replacement) out.push(replacement)
    else if (!removed.has(event)) out.push(event)
  }
  return { list: out, removed: [...removed], added }
}

function totalSize(list: LogEvent[], extra?: () => number): number {
  let total = extra ? extra() : 0
  for (const event of list) total += sizeOf(event)
  return total
}

function navigationIndexes(list: LogEvent[]): number[] {
  const out: number[] = []
  for (let i = 0; i < list.length; i++) if (list[i].kind === 'navigation') out.push(i)
  return out
}

/** Second Navigation: the oldest period, including the previous Navigation, is the next cut. */
function segmentCutoff(list: LogEvent[]): number {
  const navs = navigationIndexes(list)
  return navs.length >= 2 ? navs[1] : -1
}

/** A later change of this store still needs the state from before `cut`. */
function storeContinues(list: LogEvent[], key: string, cut: number): boolean {
  for (let i = cut; i < list.length; i++) {
    const event = list[i]
    if (event.kind !== 'store' || event.key !== key) continue
    return rt.storeOp(event) === 'change'
  }
  return false
}

/** The first kept store event after the dropped prefix is a change, so the prefix must be sealed. */
function keptChangeFollows(list: LogEvent[], key: string, chosen: Set<LogEvent>): boolean {
  let passed = false
  for (const event of list) {
    if (event.kind !== 'store' || event.key !== key) continue
    if (chosen.has(event)) {
      passed = true
      continue
    }
    if (!passed) return false
    return rt.storeOp(event) === 'change'
  }
  return false
}

/** Applies the memory budget to a chronologically sorted list */
export function enforceLogLimits(input: LogEvent[], limits: LogsLimits, options: EnforceOptions = {}): EnforceResult {
  let list = input
  let changed = false
  const removed: LogEvent[] = []
  const added: LogEvent[] = []
  let sealedLast = false

  const apply = (drop: Set<LogEvent>, fold: Set<LogEvent>) => {
    if (drop.size === 0 && fold.size === 0) return
    if (drop.size > 0) {
      list = list.filter(e => !drop.has(e))
      for (const event of drop) {
        removed.push(event)
        options.onDrop?.(event)
      }
    }
    if (fold.size > 0) {
      const folded = foldStoreChanges(list, fold, !!options.inPlace, options.compactData)
      list = folded.list
      removed.push(...folded.removed)
      added.push(...folded.added)
    }
    changed = true
  }

  /** Removes every event before `cut`. Store chains that continue afterwards become one checkpoint. */
  const cutBefore = (cut: number) => {
    const drop = new Set<LogEvent>()
    const fold = new Set<LogEvent>()
    const continuing = new Set<string>()
    for (let i = 0; i < cut; i++) {
      const event = list[i]
      if (event.kind === 'store' && !continuing.has(event.key) && storeContinues(list, event.key, cut)) {
        continuing.add(event.key)
      }
    }
    for (let i = 0; i < cut; i++) {
      const event = list[i]
      if (event.kind === 'store' && continuing.has(event.key)) fold.add(event)
      else drop.add(event)
    }
    apply(drop, fold)
  }

  const rewriteNavigation = (index: number) => {
    const event = list[index]
    const prev = rt.payload(event)
    if (prev.navType === 'snapshot' && !prev.from) return
    const data: Record<string, any> = { ...prev, navType: 'snapshot', from: '' }
    let stored = data
    let size = measureJson(data) + event.key.length + 80
    if (options.compactData) {
      const compacted = options.compactData(data)
      stored = compacted.data
      size = compacted.size + event.key.length + 80
    }
    const rewritten: LogEvent = { ...event, data: stored, size }
    list = list.slice()
    list[index] = rewritten
    removed.push(event)
    added.push(rewritten)
    changed = true
  }

  /** Oldest events go. A store prefix that a later change still replays is sealed, not dropped raw. */
  const evictOldest = (): boolean => {
    const newest = list[list.length - 1]
    const chosen: LogEvent[] = []
    let projected = totalSize(list, options.extraSize)
    for (const event of list) {
      if (projected <= budget || event === newest) break
      chosen.push(event)
      projected -= sizeOf(event)
    }
    if (chosen.length === 0) return false
    const chosenSet = new Set(chosen)
    const drop = new Set<LogEvent>()
    const fold = new Set<LogEvent>()
    const sealThrough = new Map<string, number>()
    for (let i = 0; i < list.length; i++) {
      const event = list[i]
      if (event.kind === 'store' && chosenSet.has(event)) sealThrough.set(event.key, i)
    }
    for (const key of [...sealThrough.keys()]) {
      if (!keptChangeFollows(list, key, chosenSet)) sealThrough.delete(key)
    }
    for (let i = 0; i < list.length; i++) {
      const event = list[i]
      const end = event.kind === 'store' ? sealThrough.get(event.key) : undefined
      if (end !== undefined && i <= end) fold.add(event)
      else if (chosenSet.has(event)) drop.add(event)
    }
    const before = totalSize(list, options.extraSize)
    apply(drop, fold)
    return totalSize(list, options.extraSize) < before
  }

  const budget = limits.maxMemoryMB * 1024 * 1024
  let total = totalSize(list, options.extraSize)
  while (total > budget && list.length > 1) {
    const segment = segmentCutoff(list)
    if (segment !== -1) {
      cutBefore(segment)
      sealedLast = false
    } else if (!sealedLast) {
      const navs = navigationIndexes(list)
      const last = navs.length > 0 ? navs[navs.length - 1] : -1
      if (last !== -1) rewriteNavigation(last)
      if (last > 0) cutBefore(last)
      sealedLast = true
    } else if (!evictOldest()) {
      break
    }
    total = totalSize(list, options.extraSize)
  }

  return { list, changed, removed, added, total }
}
