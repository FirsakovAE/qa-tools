import type { BodyContent, HeaderEntry, NetworkEntry, UrlParam, FormDataEntry } from '@/types/network'
import { MASK, type Sanitizer } from '@/injected/logs/sanitize'

/** JSON bodies above this are masked as plain text instead of being parsed */
const MAX_PARSE_CHARS = 5_000_000

function maskHeaders(list: HeaderEntry[] | undefined, s: Sanitizer): HeaderEntry[] {
  if (!Array.isArray(list)) return []
  return list.map(h => ({ name: h.name, value: s.isSensitiveKey(h.name) ? MASK : s.maskString(String(h.value ?? '')) }))
}

function maskPairs<T extends UrlParam | FormDataEntry>(list: T[] | undefined, s: Sanitizer): T[] {
  if (!Array.isArray(list)) return []
  return list.map(p => ({ ...p, value: s.isSensitiveKey(p.key) ? MASK : s.maskString(String(p.value ?? '')) }))
}

function maskBodyText(text: string, contentType: string, s: Sanitizer): string {
  if (!s.masking.enabled || !text) return text
  const trimmed = text.trimStart()
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && text.length <= MAX_PARSE_CHARS) {
    try {
      const parsed = JSON.parse(text)
      return JSON.stringify(s.sanitize(parsed).value, null, text.includes('\n') ? 2 : undefined)
    } catch { /* not JSON — mask as text */ }
  }
  if (/x-www-form-urlencoded/i.test(contentType)) return s.maskString(`?${text}`).slice(1)
  return s.maskString(text)
}

function maskBody(body: BodyContent | null | undefined, s: Sanitizer): BodyContent | null {
  if (!body) return null
  return {
    ...body,
    text: body.isBinary ? body.text : maskBodyText(String(body.text ?? ''), body.contentType ?? '', s),
    formData: body.formData ? maskPairs(body.formData, s) : undefined,
  }
}

function truncateBody(body: BodyContent | null, maxChars: number): BodyContent | null {
  if (!body || body.text.length <= maxChars) return body
  return { ...body, text: body.text.slice(0, Math.max(0, maxChars)), truncated: true }
}

function headersSize(list: HeaderEntry[]): number {
  let n = 0
  for (const h of list) n += h.name.length + h.value.length + 20
  return n
}

/**
 * Masked copy of a network entry that fits `maxChars` (bodies are truncated, largest first).
 * The input entry is shared with the Network tab and is never mutated.
 */
export function sanitizeNetworkEntry(entry: NetworkEntry, s: Sanitizer, maxChars: number): { entry: NetworkEntry; size: number } {
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
      ? { ...auth, token: auth.token && maskAuth ? MASK : auth.token }
      : { type: 'None' },
    requestBody: maskBody(entry.requestBody, s),
    responseBody: maskBody(entry.responseBody, s),
  }

  const fixed =
    out.url.length +
    headersSize(out.requestHeaders) +
    headersSize(out.responseHeaders) +
    headersSize(out.requestHeadersPageVisible ?? []) +
    headersSize(out.responseHeadersPageVisible ?? []) +
    out.params.reduce((n, p) => n + p.key.length + p.value.length + 20, 0) +
    600
  let reqLen = out.requestBody?.text.length ?? 0
  let resLen = out.responseBody?.text.length ?? 0

  if (fixed + reqLen + resLen > maxChars) {
    const available = Math.max(0, maxChars - fixed)
    // Give each body half; a smaller body leaves its unused share to the other
    const half = Math.floor(available / 2)
    const reqBudget = reqLen <= half ? reqLen : Math.max(half, available - Math.min(resLen, half))
    const resBudget = Math.max(0, available - Math.min(reqLen, reqBudget))
    out.requestBody = truncateBody(out.requestBody, reqBudget)
    out.responseBody = truncateBody(out.responseBody, resBudget)
    reqLen = out.requestBody?.text.length ?? 0
    resLen = out.responseBody?.text.length ?? 0
  }

  return { entry: out, size: fixed + reqLen + resLen }
}
