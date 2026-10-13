/**
 * Content-addressed pool of immutable log values.
 *
 * After a payload is sanitized it is plain JSON and is never mutated. Objects, arrays and
 * strings at or above the size threshold are stored once. A later value with the same content
 * becomes `{ __snap: id }`. The id is a hash of the content; a hash hit is kept only when a
 * deep comparison confirms the contents match. The rule is the same for every event kind.
 *
 * A captured value that is itself `{ __snap: string }` is stored as `{ __snapLit }` so reading
 * it back returns that value instead of following a pool id.
 */

import { measureJson } from './sanitize'

const MIN_CHARS = 128
const MAX_DEPTH = 100

export interface SnapRef {
  __snap: string
}

export interface SnapshotStore {
  intern(value: unknown): unknown
  /** Registers entries already created elsewhere (the other side of a log message) */
  load(map: unknown): void
  /** Bytes of the pooled entries (each unique value once, nested refs not expanded) */
  readonly bytes: number
  /** Entries added since the last `drain` */
  peekPending(): Record<string, unknown>
  /** Pending entries, then clears the pending set. The pool itself is unchanged. */
  drain(): Record<string, unknown>
  all(): Record<string, unknown>
  get(id: string): unknown
  /** Pool entries reachable from `roots`, nested references included. Does not copy values. */
  reachable(roots: unknown[]): Record<string, unknown>
  /** Drops entries that `roots` (stored payloads, refs included) do not reach */
  collect(roots: unknown[]): void
}

/** Top object of a stored payload. One reference is followed, nested values stay as references. */
export function storedRecord(value: unknown, get: (id: string) => unknown): Record<string, unknown> {
  if (!isObject(value) || Array.isArray(value)) return {}
  if (!isSnapRef(value)) return value
  const stored = get(value.__snap)
  if (!isObject(stored) || Array.isArray(stored) || isSnapRef(stored)) return {}
  return stored
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isSnapRef(value: unknown): value is SnapRef {
  if (!isObject(value) || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === '__snap' && typeof value.__snap === 'string'
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false
    return true
  }
  const ak = Object.keys(a as object)
  const bk = b as Record<string, unknown>
  if (ak.length !== Object.keys(bk).length) return false
  for (const key of ak) {
    if (!Object.prototype.hasOwnProperty.call(bk, key) || !same((a as Record<string, unknown>)[key], bk[key])) return false
  }
  return true
}

interface Fingerprint {
  hash: string
  size: number
}

function fingerprint(value: unknown): Fingerprint {
  const h = [0x811c9dc5, 0x811c9dc5 ^ 0x12345678, 0x811c9dc5 ^ 0x9e3779b9, 0x811c9dc5 ^ 0x85ebca6b]
  let size = 0
  const mix = (n: number) => {
    for (let i = 0; i < 4; i++) h[i] = Math.imul(h[i] ^ n, 0x01000193) >>> 0
  }
  const mixString = (text: string) => {
    for (let i = 0; i < text.length; i++) mix(text.charCodeAt(i))
  }
  const walk = (current: unknown, depth: number) => {
    if (current === null) {
      mix(0)
      size += 4
      return
    }
    const type = typeof current
    if (type === 'string') {
      mix(1)
      size += (current as string).length + 2
      mixString(current as string)
      return
    }
    if (type === 'number') {
      mix(2)
      const text = String(current)
      size += text.length
      mixString(text)
      return
    }
    if (type === 'boolean') {
      mix(current ? 3 : 4)
      size += current ? 4 : 5
      return
    }
    if (type !== 'object' || depth > MAX_DEPTH) {
      mix(5)
      return
    }
    if (Array.isArray(current)) {
      mix(6)
      mix(current.length)
      size += 2
      for (let i = 0; i < current.length; i++) walk(current[i], depth + 1)
      return
    }
    if (isSnapRef(current)) {
      mix(7)
      size += current.__snap.length + 12
      mixString(current.__snap)
      return
    }
    mix(8)
    const record = current as Record<string, unknown>
    const keys = Object.keys(record).sort()
    mix(keys.length)
    size += 2
    for (const key of keys) {
      size += key.length + 3
      mixString(key)
      walk(record[key], depth + 1)
    }
  }
  walk(value, 0)
  return { hash: h.map(part => part.toString(16).padStart(8, '0')).join(''), size }
}

export function createSnapshotStore(): SnapshotStore {
  const values = new Map<string, unknown>()
  const sizes = new Map<string, number>()
  const hashOf = new Map<string, string>()
  const byHash = new Map<string, string[]>()
  const pending = new Map<string, unknown>()
  let bytes = 0

  function poolNode(node: unknown, fp: Fingerprint): SnapRef {
    const existing = byHash.get(fp.hash)
    if (existing) {
      for (const id of existing) {
        if (same(values.get(id), node)) return { __snap: id }
      }
    }
    const id = `s${fp.hash}${existing && existing.length > 0 ? `_${existing.length}` : ''}`
    const size = measureJson(node)
    values.set(id, node)
    sizes.set(id, size)
    hashOf.set(id, fp.hash)
    byHash.set(fp.hash, existing ? existing.concat(id) : [id])
    pending.set(id, node)
    bytes += size
    return { __snap: id }
  }

  function loadNode(id: string, node: unknown): void {
    if (values.has(id)) return
    const fp = fingerprint(node)
    const size = measureJson(node)
    values.set(id, node)
    sizes.set(id, size)
    hashOf.set(id, fp.hash)
    const list = byHash.get(fp.hash)
    byHash.set(fp.hash, list ? list.concat(id) : [id])
    bytes += size
  }

  function internNode(value: unknown): unknown {
    if (typeof value === 'string') {
      if (value.length < MIN_CHARS) return value
      return poolNode(value, fingerprint(value))
    }
    if (!isObject(value)) return value
    if (isSnapRef(value)) {
      if (values.has(value.__snap)) return value
      return poolNode({ __snapLit: value.__snap }, fingerprint({ __snapLit: value.__snap }))
    }
    if (Array.isArray(value)) {
      let changed = false
      const out = new Array(value.length)
      for (let i = 0; i < value.length; i++) {
        out[i] = internNode(value[i])
        if (out[i] !== value[i]) changed = true
      }
      const node = changed ? out : value
      const fp = fingerprint(node)
      return fp.size >= MIN_CHARS ? poolNode(node, fp) : node
    }
    let changed = false
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      const next = internNode(value[key])
      out[key] = next
      if (next !== value[key]) changed = true
    }
    const node = changed ? out : value
    const fp = fingerprint(node)
    return fp.size >= MIN_CHARS ? poolNode(node, fp) : node
  }

  function toRecord(source: Map<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [id, value] of source) out[id] = value
    return out
  }

  function mark(value: unknown, keep: Set<string>): void {
    if (!isObject(value)) return
    if (isSnapRef(value)) {
      if (keep.has(value.__snap) || !values.has(value.__snap)) return
      keep.add(value.__snap)
      mark(values.get(value.__snap), keep)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) mark(item, keep)
      return
    }
    for (const key of Object.keys(value)) mark(value[key], keep)
  }

  return {
    intern: internNode,
    load(map: unknown) {
      if (!isObject(map)) return
      for (const id of Object.keys(map)) loadNode(id, map[id])
    },
    get bytes() {
      return bytes
    },
    peekPending: () => toRecord(pending),
    drain: () => {
      const out = toRecord(pending)
      pending.clear()
      return out
    },
    all: () => toRecord(values),
    get: (id: string) => values.get(id),
    reachable(roots: unknown[]) {
      const keep = new Set<string>()
      for (const root of roots) mark(root, keep)
      const out: Record<string, unknown> = {}
      for (const id of keep) out[id] = values.get(id)
      return out
    },
    collect(roots: unknown[]) {
      const keep = new Set<string>()
      for (const root of roots) mark(root, keep)
      for (const id of [...values.keys()]) {
        if (keep.has(id)) continue
        bytes -= sizes.get(id) ?? 0
        const hash = hashOf.get(id)
        values.delete(id)
        sizes.delete(id)
        hashOf.delete(id)
        pending.delete(id)
        if (!hash) continue
        const list = byHash.get(hash)
        if (!list) continue
        const next = list.filter(item => item !== id)
        if (next.length > 0) byHash.set(hash, next)
        else byHash.delete(hash)
      }
      if (bytes < 0) bytes = 0
    },
  }
}
