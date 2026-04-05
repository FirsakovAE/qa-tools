import type { NetworkEntry, HeaderEntry } from '@/types/network'
import type { BaseInspectorSettings } from '@/types/inspector'
import { orderHeadersByPin, pinnedHeaderOrderForScope } from '@/utils/networkHeaderLinks'

/**
 * Classic-visible headers plus any pinned names taken from the full (webRequest) list.
 */
export function filterHeadersToPageVisiblePlusPinned(
  full: HeaderEntry[],
  page: HeaderEntry[] | undefined,
  pinnedLowercase: string[],
): HeaderEntry[] {
  if (!page) return full

  const fullByLower = new Map(full.map((h) => [h.name.toLowerCase(), h]))
  const pinnedSet = new Set(pinnedLowercase.map((p) => p.toLowerCase()))

  const augmented: HeaderEntry[] = []
  for (const h of page) {
    const key = h.name.toLowerCase()
    if (pinnedSet.has(key)) {
      const f = fullByLower.get(key)
      augmented.push(f ? { name: f.name, value: f.value } : h)
    } else {
      augmented.push(h)
    }
  }

  const pageKeys = new Set(page.map((h) => h.name.toLowerCase()))
  const extraPinned: HeaderEntry[] = []
  for (const pl of pinnedLowercase) {
    if (pageKeys.has(pl)) continue
    const f = fullByLower.get(pl)
    if (f) extraPinned.push({ name: f.name, value: f.value })
  }

  return orderHeadersByPin([...augmented, ...extraPinned], pinnedLowercase)
}

export function effectiveRequestHeadersForDisplay(
  entry: NetworkEntry,
  settings: BaseInspectorSettings | null | undefined,
): HeaderEntry[] {
  return effectiveRequestHeaders(entry, settings, 'display')
}

function effectiveRequestHeaders(
  entry: NetworkEntry,
  settings: BaseInspectorSettings | null | undefined,
  purpose: 'display' | 'curl' | 'export',
): HeaderEntry[] {
  const pol = settings?.networkAdvancedHeaderPolicy
  if (settings?.networkCaptureMode !== 'advanced' || !pol) return entry.requestHeaders

  const strip =
    purpose === 'display'
      ? pol.showInDetails === false
      : purpose === 'curl'
        ? pol.includeInCurl === false
        : pol.includeInExport === false

  if (!strip || !entry.requestHeadersPageVisible) return entry.requestHeaders

  const pinned = pinnedHeaderOrderForScope(settings.networkPinnedHeaders, 'request')
  return filterHeadersToPageVisiblePlusPinned(
    entry.requestHeaders,
    entry.requestHeadersPageVisible,
    pinned,
  )
}

export function effectiveResponseHeadersForDisplay(
  entry: NetworkEntry,
  settings: BaseInspectorSettings | null | undefined,
): HeaderEntry[] {
  const pol = settings?.networkAdvancedHeaderPolicy
  if (
    settings?.networkCaptureMode !== 'advanced' ||
    !pol ||
    pol.showInDetails !== false ||
    !entry.responseHeadersPageVisible
  ) {
    return entry.responseHeaders
  }
  const pinned = pinnedHeaderOrderForScope(settings.networkPinnedHeaders, 'response')
  return filterHeadersToPageVisiblePlusPinned(
    entry.responseHeaders,
    entry.responseHeadersPageVisible,
    pinned,
  )
}

/** Shallow clone with request headers adjusted for Advanced export policy (cURL / Postman). */
export function networkEntryForCurl(
  entry: NetworkEntry,
  settings: BaseInspectorSettings | null | undefined,
): NetworkEntry {
  const headers = effectiveRequestHeaders(entry, settings, 'curl')
  if (headers === entry.requestHeaders) return entry
  return { ...entry, requestHeaders: headers }
}

export function mapEntriesForPostmanExport(
  entries: NetworkEntry[],
  settings: BaseInspectorSettings | null | undefined,
): NetworkEntry[] {
  return entries.map((e) => {
    const headers = effectiveRequestHeaders(e, settings, 'export')
    if (headers === e.requestHeaders) return e
    return { ...e, requestHeaders: headers }
  })
}
