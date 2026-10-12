export function formatLogTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function formatLogDateTime(ts: number): string {
  return `${new Date(ts).toLocaleDateString()} ${formatLogTime(ts)}`
}

/** Compact one-line preview of a JSON value for diff rows */
export function previewValue(value: unknown, max = 300): string {
  if (value === undefined) return 'undefined'
  let text: string
  try {
    text = JSON.stringify(value) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function toPrettyJson(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch {
    return String(value)
  }
}
