const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Key paths present in `before` but missing in `after`.
 * Arrays are replaced as a whole on save, so they are not descended into.
 */
export function findRemovedPaths(before: unknown, after: unknown, prefix: string[] = []): string[][] {
  if (!isPlainObject(before) || !isPlainObject(after)) return []
  const removed: string[][] = []
  for (const key of Object.keys(before)) {
    const path = [...prefix, key]
    if (!Object.prototype.hasOwnProperty.call(after, key)) removed.push(path)
    else removed.push(...findRemovedPaths(before[key], after[key], path))
  }
  return removed
}
