/**
 * Structural diff and transport size limits for log payloads (plain JSON values only)
 */

import type { LogChange } from './types'

export const MAX_CHANGES = 200
const MAX_DIFF_DEPTH = 24
/** Full before/after blocks larger than this are replaced with a truncated preview */
const MAX_BLOCK_CHARS = 1_000_000
/** Single change value larger than this is replaced with a truncated preview */
const MAX_CHANGE_VALUE_CHARS = 50_000

const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function joinPath(parent: string, key: string, parentIsArray: boolean): string {
  if (parentIsArray) return `${parent}[${key}]`
  if (!IDENTIFIER_RE.test(key)) return `${parent}[${JSON.stringify(key)}]`
  return parent ? `${parent}.${key}` : key
}

function walk(before: unknown, after: unknown, path: string, out: LogChange[], depth: number): void {
  if (out.length >= MAX_CHANGES) return
  if (Object.is(before, after)) return

  if (
    isObject(before) &&
    isObject(after) &&
    Array.isArray(before) === Array.isArray(after) &&
    depth < MAX_DIFF_DEPTH
  ) {
    const isArray = Array.isArray(before)
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys) {
      const inBefore = Object.prototype.hasOwnProperty.call(before, key)
      const inAfter = Object.prototype.hasOwnProperty.call(after, key)
      if (inBefore && inAfter && Object.is(before[key], after[key])) continue
      const childPath = joinPath(path, key, isArray)
      if (!inBefore) out.push({ path: childPath, type: 'added', after: after[key] })
      else if (!inAfter) out.push({ path: childPath, type: 'removed', before: before[key] })
      else walk(before[key], after[key], childPath, out, depth + 1)
      if (out.length >= MAX_CHANGES) return
    }
    return
  }

  out.push({ path: path || '(root)', type: 'changed', before, after })
}

export function diffValues(before: unknown, after: unknown): LogChange[] {
  const out: LogChange[] = []
  walk(before, after, '', out, 0)
  return out
}

export function limitValue(value: unknown, maxChars = MAX_BLOCK_CHARS): unknown {
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

export function summarizeChanges(changes: LogChange[]): string {
  const shown = changes.slice(0, 3).map(c => c.path)
  const rest = changes.length - shown.length
  return rest > 0 ? `${shown.join(', ')} +${rest} more` : shown.join(', ')
}
