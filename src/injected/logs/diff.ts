/**
 * Structural diff and transport size limits for log payloads (plain JSON values only)
 */

import type { LogChange } from './types'
import { logsRuntime } from './runtime'

export const MAX_CHANGES = logsRuntime.MAX_CHANGES
/** Single change value larger than this is replaced with a truncated preview */
const MAX_CHANGE_VALUE_CHARS = 50_000

export function diffValues(before: unknown, after: unknown): LogChange[] {
  return logsRuntime.diffValues(before, after)
}

function limitValue(value: unknown, maxChars: number): unknown {
  if (value === undefined || value === null || typeof value !== 'object') return value
  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    return '[Non-serializable]'
  }
  if (json === undefined || json.length <= maxChars) return value
  return { __truncated: true, size: json.length, preview: json.slice(0, Math.min(maxChars, 10_000)) }
}

export function limitChanges(changes: LogChange[]): LogChange[] {
  return changes.map(c => ({
    path: c.path,
    type: c.type,
    ...('before' in c ? { before: limitValue(c.before, MAX_CHANGE_VALUE_CHARS) } : {}),
    ...('after' in c ? { after: limitValue(c.after, MAX_CHANGE_VALUE_CHARS) } : {}),
  }))
}

/** Change without the old value (restored from the previous state on read) */
export function withoutBefore(c: LogChange): LogChange {
  return 'after' in c ? { path: c.path, type: c.type, after: c.after } : { path: c.path, type: c.type }
}

/** Change without the new value (read from the stored new state) */
export function withoutAfter(c: LogChange): LogChange {
  return 'before' in c ? { path: c.path, type: c.type, before: c.before } : { path: c.path, type: c.type }
}
