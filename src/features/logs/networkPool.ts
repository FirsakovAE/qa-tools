/**
 * Network entries of the Logs tab.
 *
 * One stored entry per request serves both the "Send request" and "Receive response" events,
 * which reference it by id (`data.entryId`). Entries live while at least one event references
 * them (reference counting), so clearing, ring-buffer eviction and the memory budget never
 * leave an event pointing to a missing entry. Equal bodies (e.g. a polled endpoint returning
 * the same response) are stored once in a body pool and are counted once in `size`.
 * Page-visible (Classic) header lists are kept as indexes into the full header lists.
 *
 * The entries are masked copies of the Network tab entries; when masking changes nothing they
 * reuse the Network tab's header lists and body strings instead of copying them.
 */

import type { BodyContent, HeaderEntry, NetworkEntry } from '@/types/network'
import type { HeaderRef, StoredNetworkEntry } from '@/types/logs'
import { logsRuntime as rt } from '@/injected/logs/runtime'

interface BodyRecord {
  ref: string
  body: BodyContent
  refs: number
  size: number
}

interface EntryRecord {
  stored: StoredNetworkEntry
  /** Number of log events referencing the entry */
  refs: number
  size: number
  resolved?: NetworkEntry
}

export interface NetworkPool {
  /** Full entry (bodies and page-visible headers resolved) */
  get(id: string): NetworkEntry | undefined
  getStored(id: string): StoredNetworkEntry | undefined
  getBody(ref: string): BodyContent | undefined
  /** Inserts or replaces an entry (already masked and size-limited); does not add a reference */
  put(entry: NetworkEntry, fixedSize: number): void
  retain(id: string): void
  release(id: string): void
  /** Drops the entry if no event references it */
  collect(id: string): void
  clear(): void
  readonly size: number
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function formDataJson(body: BodyContent): string {
  return body.formData?.length ? JSON.stringify(body.formData) : ''
}

function bodySignature(body: BodyContent): string {
  const form = formDataJson(body)
  return [
    fnv1a(body.text ?? ''), body.text?.length ?? 0, body.contentType ?? '', body.isBinary ? 1 : 0,
    body.truncated ? 1 : 0, body.originalSize ?? 0, form ? fnv1a(form) : '',
  ].join(':')
}

function sameBody(a: BodyContent, b: BodyContent): boolean {
  return a.text === b.text
    && a.contentType === b.contentType
    && !!a.isBinary === !!b.isBinary
    && !!a.truncated === !!b.truncated
    && a.originalSize === b.originalSize
    && formDataJson(a) === formDataJson(b)
}

function bodySize(body: BodyContent): number {
  return (body.text?.length ?? 0) + (body.contentType?.length ?? 0) + formDataJson(body).length + 80
}

/** Page-visible headers as references into the full list (same name and value) */
export function encodeVisibleHeaders(full: HeaderEntry[], visible: HeaderEntry[] | undefined): HeaderRef[] | undefined {
  if (!Array.isArray(visible)) return undefined
  const index = new Map<string, number>()
  full.forEach((h, i) => {
    const key = `${h.name}\u0000${h.value}`
    if (!index.has(key)) index.set(key, i)
  })
  return visible.map(h => index.get(`${h.name}\u0000${h.value}`) ?? { name: h.name, value: h.value })
}

export function createNetworkPool(): NetworkPool {
  const entries = new Map<string, EntryRecord>()
  const bodies = new Map<string, BodyRecord>()
  const bySignature = new Map<string, BodyRecord[]>()
  let bodyCounter = 0
  let size = 0

  function internBody(body: BodyContent | null | undefined): string | undefined {
    if (!body) return undefined
    const signature = bodySignature(body)
    const candidates = bySignature.get(signature)
    const existing = candidates?.find(r => sameBody(r.body, body))
    if (existing) {
      existing.refs++
      return existing.ref
    }
    const record: BodyRecord = { ref: `b${(++bodyCounter).toString(36)}`, body, refs: 1, size: bodySize(body) }
    bodies.set(record.ref, record)
    if (candidates) candidates.push(record)
    else bySignature.set(signature, [record])
    size += record.size
    return record.ref
  }

  function releaseBody(ref: string | undefined): void {
    const record = ref ? bodies.get(ref) : undefined
    if (!record || --record.refs > 0) return
    bodies.delete(record.ref)
    size -= record.size
    const signature = bodySignature(record.body)
    const list = bySignature.get(signature)?.filter(r => r !== record)
    if (list?.length) bySignature.set(signature, list)
    else bySignature.delete(signature)
  }

  function drop(id: string, record: EntryRecord): void {
    entries.delete(id)
    size -= record.size
    releaseBody(record.stored.requestBodyRef)
    releaseBody(record.stored.responseBodyRef)
  }

  function getBody(ref: string): BodyContent | undefined {
    return bodies.get(ref)?.body
  }

  return {
    get(id) {
      const record = entries.get(id)
      if (!record) return undefined
      if (!record.resolved) record.resolved = rt.resolveEntry(record.stored, getBody) as NetworkEntry
      return record.resolved
    },
    getStored: id => entries.get(id)?.stored,
    getBody,
    put(entry, fixedSize) {
      const {
        version: _version, name: _name, requestBody, responseBody,
        requestHeadersPageVisible, responseHeadersPageVisible, ...rest
      } = entry
      const stored: StoredNetworkEntry = { ...rest }
      const requestBodyRef = internBody(requestBody)
      const responseBodyRef = internBody(responseBody)
      if (requestBodyRef) stored.requestBodyRef = requestBodyRef
      if (responseBodyRef) stored.responseBodyRef = responseBodyRef
      const requestVisible = encodeVisibleHeaders(entry.requestHeaders, requestHeadersPageVisible)
      const responseVisible = encodeVisibleHeaders(entry.responseHeaders, responseHeadersPageVisible)
      if (requestVisible) stored.requestHeadersVisible = requestVisible
      if (responseVisible) stored.responseHeadersVisible = responseVisible

      const previous = entries.get(entry.id)
      if (previous) drop(entry.id, previous)
      const record: EntryRecord = { stored, refs: previous?.refs ?? 0, size: fixedSize }
      entries.set(entry.id, record)
      size += record.size
    },
    retain(id) {
      const record = entries.get(id)
      if (record) record.refs++
    },
    release(id) {
      const record = entries.get(id)
      if (record && --record.refs <= 0) drop(id, record)
    },
    collect(id) {
      const record = entries.get(id)
      if (record && record.refs <= 0) drop(id, record)
    },
    clear() {
      entries.clear()
      bodies.clear()
      bySignature.clear()
      size = 0
    },
    get size() {
      return size
    },
  }
}
