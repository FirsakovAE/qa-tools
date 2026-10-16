/**
 * Heuristic: string might be JSON (object/array/primitive). Skips plain text, HTML, placeholders.
 */
export function looksLikeJsonValue(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const c = t[0]
  if (c === '{' || c === '[' || c === '"') return true
  if (t === 'true' || t === 'false' || t === 'null') return true
  if (c === '-' || (c >= '0' && c <= '9')) return true
  return false
}

const JSON_PRETTY_MAX = 64 * 1024

function prettyJsonValue(text: string): string | null {
  const jsonLike = (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))
  if (!jsonLike) return null
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return null
  }
}

/**
 * Pretty-print one JSON value. A frame may also carry several JSON values separated by newlines
 * (Centrifuge packs commands that way); each value is formatted on its own. Anything else stays as received.
 */
export function formatJsonPayload(text: string, maxLen = JSON_PRETTY_MAX): string {
  if (!text || text.length > maxLen) return text
  const trimmed = text.trim()
  if (!trimmed) return text
  const one = prettyJsonValue(trimmed)
  if (one !== null) return one
  const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return text
  const parts: string[] = []
  for (const line of lines) {
    const pretty = prettyJsonValue(line)
    if (pretty === null) return text
    parts.push(pretty)
  }
  return parts.join('\n\n')
}

/** Breakpoint FormData draft serialized as JSON with __formData marker. */
export function looksLikeFormDataDraftJson(text: string): boolean {
  const t = text.trim()
  return t.startsWith('{') && t.includes('"__formData"')
}
