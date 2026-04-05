import type {
  HeaderLinkRuleRowDraft,
  NetworkHeaderLinkRule,
  NetworkPinnedHeaderItem,
  NetworkPinnedHeaderScope,
} from '@/types/inspector'
import { applyHeaderLinkValueTransform } from '@/utils/headerLinkTransform'

export function normalizeNetworkHeaderHost(host: string): string {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]!
}

export function getEntryRequestHost(entryUrl: string): string {
  try {
    return normalizeNetworkHeaderHost(new URL(entryUrl).hostname)
  } catch {
    return ''
  }
}

export function findHeaderLinkRule(
  rules: NetworkHeaderLinkRule[] | undefined,
  headerName: string,
  entryHost: string,
): NetworkHeaderLinkRule | undefined {
  if (!rules?.length) return undefined
  const hn = headerName.toLowerCase()
  const h = normalizeNetworkHeaderHost(entryHost)
  return rules.find(
    (r) => r.headerName.toLowerCase() === hn && normalizeNetworkHeaderHost(r.host) === h,
  )
}

/**
 * Apply optional regex to the raw header value before URL substitution.
 * Uses the first capturing group when available, otherwise the full match; on no match or invalid pattern, returns the raw value.
 */
export function applyHeaderLinkValueExtract(
  headerValue: string,
  valueExtractRegex: string | undefined | null,
): string {
  const raw = String(headerValue ?? '')
  const p = String(valueExtractRegex ?? '').trim()
  if (!p) return raw
  try {
    const re = new RegExp(p)
    const m = raw.match(re)
    if (!m) return raw
    if (m.length > 1 && m[1] !== undefined) return m[1]
    return m[0] ?? raw
  } catch {
    return raw
  }
}

/** Replace {value} placeholders (all occurrences) after optional extract + transform pipeline. */
export function buildHeaderLinkUrl(
  template: string,
  headerValue: string,
  valueExtractRegex?: string | null,
  valueTransform?: string | null,
): string {
  const extracted = applyHeaderLinkValueExtract(headerValue, valueExtractRegex)
  const value = applyHeaderLinkValueTransform(extracted, valueTransform)
  return template.split('{value}').join(value)
}

/** Pinned headers that exist in `headers`, in `pinnedLowercase` order (one row per pinned name from map). */
export function headersMatchingPinOrder<T extends { name: string; value: string }>(
  headers: T[],
  pinnedLowercase: string[],
): T[] {
  const lower = (n: string) => n.toLowerCase()
  const byLower = new Map(headers.map((h) => [lower(h.name), h]))
  const result: T[] = []
  for (const p of pinnedLowercase) {
    const pl = p.toLowerCase()
    const row = byLower.get(pl)
    if (row) result.push(row)
  }
  return result
}

export function headersNotPinned<T extends { name: string; value: string }>(
  headers: T[],
  pinnedLowercase: string[],
): T[] {
  const pinnedSet = new Set(pinnedLowercase.map((p) => p.toLowerCase()))
  return headers.filter((h) => !pinnedSet.has(h.name.toLowerCase()))
}

export function orderHeadersByPin<T extends { name: string; value: string }>(
  headers: T[],
  pinnedLowercase: string[],
): T[] {
  return [...headersMatchingPinOrder(headers, pinnedLowercase), ...headersNotPinned(headers, pinnedLowercase)]
}

export function newHeaderLinkRuleId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Replace all rules for `headerDisplayName` (case-insensitive) with validated rows from the editor.
 */
export function replaceHeaderLinkRulesForHeaderName(
  list: NetworkHeaderLinkRule[],
  headerDisplayName: string,
  rows: HeaderLinkRuleRowDraft[],
): void {
  const hnLower = headerDisplayName.toLowerCase()
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.headerName.toLowerCase() === hnLower) {
      list.splice(i, 1)
    }
  }

  const now = new Date().toISOString()
  const byHost = new Map<string, HeaderLinkRuleRowDraft>()
  for (const row of rows) {
    const hostNorm = normalizeNetworkHeaderHost(row.host)
    const tpl = row.urlTemplate.trim()
    if (!hostNorm || !tpl) continue
    byHost.set(hostNorm, row)
  }

  for (const row of byHost.values()) {
    const hostNorm = normalizeNetworkHeaderHost(row.host)
    const tpl = row.urlTemplate.trim()
    const rx = (row.valueExtractRegex ?? '').trim()
    const tf = (row.valueTransform ?? '').trim()
    list.push({
      id: row.id ?? newHeaderLinkRuleId(),
      headerName: headerDisplayName,
      host: hostNorm,
      urlTemplate: tpl,
      ...(rx ? { valueExtractRegex: rx } : {}),
      ...(tf ? { valueTransform: tf } : {}),
      addedAt: row.addedAt ?? now,
    })
  }
}

export function newPinnedHeaderId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ph_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Ordered lowercase names for one scope (matches array order of items). */
export function pinnedHeaderOrderForScope(
  items: NetworkPinnedHeaderItem[] | undefined,
  scope: NetworkPinnedHeaderScope,
): string[] {
  if (!items?.length) return []
  return items.filter((it) => it.scope === scope).map((it) => it.name.toLowerCase())
}

export function togglePinnedHeaderItem(
  items: NetworkPinnedHeaderItem[],
  headerName: string,
  scope: NetworkPinnedHeaderScope,
): NetworkPinnedHeaderItem[] {
  const pl = headerName.toLowerCase()
  const i = items.findIndex(
    (it) => it.name.toLowerCase() === pl && it.scope === scope,
  )
  if (i === -1) {
    return [
      ...items,
      { id: newPinnedHeaderId(), name: headerName, scope },
    ]
  }
  return items.filter((_, idx) => idx !== i)
}
