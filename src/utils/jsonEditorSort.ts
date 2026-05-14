import {
  compileJSONPointer,
  getIn,
  isJSONArray,
  isJSONObject,
  type JSONPath,
  type JSONPatchDocument,
} from 'immutable-json-patch'
import {
  getFocusPath,
  isKeySelection,
  isMultiSelection,
  isObjectOrArray,
  isValueSelection,
  type JSONEditorSelection,
  type JSONSelection,
} from 'vanilla-jsoneditor'

function pathsEqual(a: JSONPath, b: JSONPath): boolean {
  if (a.length !== b.length) return false
  return a.every((seg, i) => seg === b[i])
}

/** Same idea as svelte-jsoneditor `findRootPath` (tree sort target path). */
export function findSortRootPath(
  json: unknown,
  selection: JSONEditorSelection | undefined,
): JSONPath {
  if (!selection || 'ranges' in selection) return []
  const sel = selection as JSONSelection
  const focusPath = getFocusPath(sel)
  const at = getIn(json, focusPath)
  const single =
    isKeySelection(sel)
    || isValueSelection(sel)
    || (isMultiSelection(sel) && pathsEqual(sel.focusPath, sel.anchorPath))
  return single && isObjectOrArray(at) ? focusPath : initialPath(focusPath)
}

function initialPath(path: JSONPath): JSONPath {
  return path.length === 0 ? [] : path.slice(0, -1)
}

export interface SortPathOption {
  value: JSONPath
  label: string
}

function compareForSort(a: unknown, b: unknown, direction: 1 | -1): number {
  const sign = direction
  if (a === b) return 0

  if (
    typeof a === 'number'
    && typeof b === 'number'
    && !Number.isNaN(a)
    && !Number.isNaN(b)
  ) {
    return (a - b) * sign
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0
    return (a ? 1 : -1) * sign - (b ? 1 : -1) * sign
  }

  const sa = typeof a === 'string' ? a : JSON.stringify(a)
  const sb = typeof b === 'string' ? b : JSON.stringify(b)
  return sa.localeCompare(sb, undefined, {
    numeric: true,
    sensitivity: 'base',
  }) * sign
}

/**
 * Build "sort by property" choices for an array at `rootPath`.
 * Mirrors vanilla-jsoneditor’s idea of shallow common keys for object items.
 */
export function getSortPathOptions(
  json: unknown,
  rootPath: JSONPath,
): SortPathOption[] {
  const val = getIn(json, rootPath)
  if (!isJSONArray(val) || val.length === 0) {
    return [{ value: [], label: 'Whole value' }]
  }

  const allObjects = val.every(isJSONObject)
  if (!allObjects) {
    return [{ value: [], label: 'Whole value' }]
  }

  const keySets = val.map(
    (o) => new Set(Object.keys(o as Record<string, unknown>)),
  )
  const first = keySets[0]!
  const common: string[] = []
  for (const k of first) {
    if (keySets.every((s) => s.has(k))) common.push(k)
  }
  common.sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )

  if (common.length === 0) {
    return [{ value: [], label: 'Whole value' }]
  }

  return common.map((k) => ({ value: [k], label: k }))
}

function sortObjectKeys(
  obj: Record<string, unknown>,
  direction: 1 | -1,
): Record<string, unknown> {
  const keys = Object.keys(obj).sort((ka, kb) =>
    compareForSort(ka, kb, direction),
  )
  const next: Record<string, unknown> = {}
  for (const k of keys) next[k] = obj[k]
  return next
}

/**
 * Match "Sort" modal persistence: any map key ending with
 * `:${JSON.stringify(rootPath)}` may hold the last chosen property path.
 */
export function resolveSortItemPathForQuickApply(
  json: unknown,
  rootPath: JSONPath,
  persisted:
    | Map<string, { itemPathKey: string, direction: 1 | -1 }>
    | undefined,
): JSONPath {
  const opts = getSortPathOptions(json, rootPath)
  if (opts.length === 0) return []
  const suffix = `:${JSON.stringify(rootPath)}`
  if (persisted) {
    for (const [k, v] of persisted) {
      if (!k.endsWith(suffix)) continue
      const hit = opts.find((o) => JSON.stringify(o.value) === v.itemPathKey)
      if (hit) return hit.value
    }
  }
  return opts[0]!.value
}

/**
 * Produce JSON Patch ops for sorting keys under `rootPath` (object) or items
 * under `rootPath` (array). `itemPath` is relative to each array element.
 */
export function sortJson(
  json: unknown,
  rootPath: JSONPath,
  itemPath: JSONPath,
  direction: 1 | -1,
): JSONPatchDocument {
  const pointer = compileJSONPointer(rootPath)
  const atRoot = getIn(json, rootPath)

  if (isJSONObject(atRoot)) {
    const next = sortObjectKeys(atRoot, direction)
    return [{ op: 'replace', path: pointer, value: next }]
  }

  if (isJSONArray(atRoot)) {
    const sorted = [...atRoot].sort((a, b) => {
      const da = itemPath.length ? getIn(a, itemPath) : a
      const db = itemPath.length ? getIn(b, itemPath) : b
      return compareForSort(da, db, direction)
    })
    return [{ op: 'replace', path: pointer, value: sorted }]
  }

  return []
}
