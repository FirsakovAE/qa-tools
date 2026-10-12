import type { BodyContent, HeaderEntry, NetworkEntry, UrlParam, FormDataEntry } from '@/types/network'
import { MASK, type Sanitizer } from '@/injected/logs/sanitize'

/** JSON bodies above this are masked as plain text instead of being parsed */
const MAX_PARSE_CHARS = 5_000_000

// Masking returns the input objects when nothing was masked: the Logs entry then shares
// headers and bodies with the Network tab entry instead of holding a copy.

function maskHeaders(list: HeaderEntry[] | undefined, s: Sanitizer): HeaderEntry[] {
  if (!Array.isArray(list)) return []
  let changed = false
  const out = list.map(h => {
    const value = String(h.value ?? '')
    const masked = s.isSensitiveKey(h.name) && value ? MASK : s.maskString(value)
    if (masked === h.value) return h
    changed = true
    return { name: h.name, value: masked }
  })
  return changed ? out : list
}

function maskPairs<T extends UrlParam | FormDataEntry>(list: T[] | undefined, s: Sanitizer): T[] {
  if (!Array.isArray(list)) return []
  let changed = false
  const out = list.map(p => {
    const value = String(p.value ?? '')
    const masked = s.isSensitiveKey(p.key) && value ? MASK : s.maskString(value)
    if (masked === p.value) return p
    changed = true
    return { ...p, value: masked }
  })
  return changed ? out : list
}

function maskBodyText(text: string, contentType: string, s: Sanitizer): string {
  if (!s.masking.enabled || !text) return text
  const trimmed = text.trimStart()
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && text.length <= MAX_PARSE_CHARS) {
    try {
      const parsed = JSON.parse(text)
      const masked = JSON.stringify(s.sanitize(parsed).value, null, text.includes('\n') ? 2 : undefined)
      return masked === text ? text : masked
    } catch { /* not JSON — mask as text */ }
  }
  if (/x-www-form-urlencoded/i.test(contentType)) return s.maskString(`?${text}`).slice(1)
  return s.maskString(text)
}

function maskBody(body: BodyContent | null | undefined, s: Sanitizer): BodyContent | null {
  if (!body) return null
  const text = body.isBinary ? body.text : maskBodyText(String(body.text ?? ''), body.contentType ?? '', s)
  const formData = body.formData ? maskPairs(body.formData, s) : undefined
  if (text === body.text && formData === body.formData) return body
  return { ...body, text, formData }
}

/** A fresh string: a slice may keep the whole original (shared with the Network tab) alive */
function detachedSlice(text: string, length: number): string {
  return JSON.parse(JSON.stringify(text.slice(0, length)))
}

function truncateBody(body: BodyContent | null, maxChars: number): BodyContent | null {
  if (!body || body.text.length <= maxChars) return body
  return { ...body, text: detachedSlice(body.text, Math.max(0, maxChars)), truncated: true }
}

function headersSize(list: HeaderEntry[]): number {
  let n = 0
  for (const h of list) n += h.name.length + h.value.length + 20
  return n
}

/**
 * Masked copy of a network entry that fits `maxChars` (bodies are truncated, largest first).
 * The input entry is shared with the Network tab and is never mutated. `fixedSize` is the
 * size without bodies (bodies are accounted for separately by the body pool).
 */
export function sanitizeNetworkEntry(
  entry: NetworkEntry,
  s: Sanitizer,
  maxChars: number,
): { entry: NetworkEntry; size: number; fixedSize: number } {
  const auth = entry.authorization
  const maskAuth = s.masking.enabled && (s.isSensitiveKey('authorization') || s.isSensitiveKey('token'))
  const out: NetworkEntry = {
    ...entry,
    url: s.maskString(entry.url ?? ''),
    path: s.maskString(entry.path ?? ''),
    error: entry.error ? s.maskString(entry.error) : entry.error,
    requestHeaders: maskHeaders(entry.requestHeaders, s),
    responseHeaders: maskHeaders(entry.responseHeaders, s),
    requestHeadersPageVisible: entry.requestHeadersPageVisible ? maskHeaders(entry.requestHeadersPageVisible, s) : undefined,
    responseHeadersPageVisible: entry.responseHeadersPageVisible ? maskHeaders(entry.responseHeadersPageVisible, s) : undefined,
    params: maskPairs(entry.params, s),
    authorization: auth
      ? (auth.token && maskAuth ? { ...auth, token: MASK } : auth)
      : { type: 'None' },
    requestBody: maskBody(entry.requestBody, s),
    responseBody: maskBody(entry.responseBody, s),
  }

  const fixedSize =
    out.url.length +
    headersSize(out.requestHeaders) +
    headersSize(out.responseHeaders) +
    out.params.reduce((n, p) => n + p.key.length + p.value.length + 20, 0) +
    600
  let reqLen = out.requestBody?.text.length ?? 0
  let resLen = out.responseBody?.text.length ?? 0

  if (fixedSize + reqLen + resLen > maxChars) {
    const available = Math.max(0, maxChars - fixedSize)
    // Give each body half; a smaller body leaves its unused share to the other
    const half = Math.floor(available / 2)
    const reqBudget = reqLen <= half ? reqLen : Math.max(half, available - Math.min(resLen, half))
    const resBudget = Math.max(0, available - Math.min(reqLen, reqBudget))
    out.requestBody = truncateBody(out.requestBody, reqBudget)
    out.responseBody = truncateBody(out.responseBody, resBudget)
    reqLen = out.requestBody?.text.length ?? 0
    resLen = out.responseBody?.text.length ?? 0
  }

  return { entry: out, size: fixedSize + reqLen + resLen, fixedSize }
}
