/** JS error events (uncaught errors, unhandled rejections, console.error of the page) */

import { recordLog } from './core'
import { compactStack, isForeignUrl, parseFrames } from './stack'

export interface ErrorInfo {
  message: string
  name?: string
  stack?: string
}

export function errorInfoOf(value: unknown): ErrorInfo {
  if (value instanceof Error) return { message: value.message, name: value.name, stack: value.stack }
  if (typeof value === 'string') return { message: value }
  try {
    return { message: JSON.stringify(value) ?? String(value) }
  } catch {
    return { message: String(value) }
  }
}

/** Location of the top page frame (frames of Vue Inspector and extensions are skipped) */
export function locationOf(stack: string | undefined): Record<string, unknown> {
  const frames = parseFrames(stack ?? '')
  const frame = frames.find(f => !isForeignUrl(f.url)) ?? frames[0]
  return frame ? { filename: frame.url, lineno: frame.lineno, colno: frame.colno } : {}
}

export function recordError(source: string, err: ErrorInfo, extra: Record<string, unknown> = {}): void {
  const message = err.message || 'Unknown error'
  const data: Record<string, unknown> = { source, message }
  if (err.name) data.name = err.name
  if (err.stack) Object.assign(data, compactStack(err.stack))
  recordLog({
    kind: 'error',
    key: message.slice(0, 300),
    level: 'error',
    data: { ...data, ...extra },
    // A message that fits the key is read from it
    finalize: (stored, key) => {
      if (stored.message === key) delete stored.message
      return stored
    },
  })
}
