/**
 * Logs limits shared by the page buffer and the Logs tab.
 *
 * Beyond the memory budget events are dropped oldest-first, except Pinia store changes: they are
 * folded into a per-store checkpoint, so the history keeps `initial state -> checkpoint -> recent
 * diffs` and every remaining change can still be restored. Store bases (initial snapshot,
 * checkpoint) go only when nothing else is left. The newest event is always kept, even when it
 * alone exceeds the budget.
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
  /** Size of data stored outside the events (shared network entries) */
  extraSize?: () => number
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
      s.owned = inPlace && op === 'checkpoint'
      if (op === 'checkpoint') {
        s.compacted += Number(event.data?.compacted) || 0
        s.previousCheckpoint = event
      }
      if (!s.firstBase && op !== 'checkpoint') s.firstBase = event
      else s.superseded.push(event)
      continue
    }

    const data = event.data ?? {}
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
    s.compacted++
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
    const useEstimate = s.known && previousMeasured !== undefined
      && s.compacted % CHECKPOINT_REMEASURE_EVERY !== 0 && estimate <= previousMeasured * 2 + 1024
    const size = useEstimate ? estimate : measureJson(state) + key.length + 120
    const measured = useEstimate ? previousMeasured! : size
    const checkpoint: LogEvent = {
      id: `${CHECKPOINT_ID_PREFIX}${s.last.id}`,
      kind: 'store',
      timestamp: s.last.timestamp,
      key,
      level: 'info',
      data: { op: 'checkpoint', compacted: s.compacted, state },
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

/** Applies the memory budget to a chronologically sorted list */
export function enforceLogLimits(input: LogEvent[], limits: LogsLimits, options: EnforceOptions = {}): EnforceResult {
  let list = input
  let changed = false
  const removed: LogEvent[] = []
  const added: LogEvent[] = []

  const apply = (drop: Set<LogEvent>, fold: Set<LogEvent>) => {
    if (drop.size > 0) {
      list = list.filter(e => !drop.has(e))
      for (const event of drop) {
        removed.push(event)
        options.onDrop?.(event)
      }
    }
    if (fold.size > 0) {
      const folded = foldStoreChanges(list, fold, !!options.inPlace)
      list = folded.list
      removed.push(...folded.removed)
      added.push(...folded.added)
    }
    changed = true
  }

  const budget = limits.maxMemoryMB * 1024 * 1024
  let total = totalSize(list, options.extraSize)
  while (total > budget && list.length > 1) {
    const drop = new Set<LogEvent>()
    const fold = new Set<LogEvent>()
    const newest = list[list.length - 1]
    let projected = total
    for (const event of list) {
      if (projected <= budget || event === newest) break
      if (!countsTowardLimit(event)) continue
      ;(event.kind === 'store' ? fold : drop).add(event)
      projected -= sizeOf(event)
    }
    // Only store bases are left and nothing depends on them any more; initial snapshots go last
    if (drop.size === 0 && fold.size === 0) {
      const bases = list.slice(0, -1)
      drop.add(bases.find(e => rt.storeOp(e) === 'checkpoint') ?? bases[0])
    }
    const before = list.length
    apply(drop, fold)
    total = totalSize(list, options.extraSize)
    if (list.length === before && fold.size === 0) break
  }

  return { list, changed, removed, added, total }
}
