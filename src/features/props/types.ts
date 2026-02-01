/**
 * Optimized row model for PropsTable
 * 
 * Key principles:
 * - `rows` array NEVER changes (stable reference)
 * - Only `visible` and `isFavorite` flags are mutated
 * - Zero array recreation on filter change
 */

import type { TreeNodeModel } from '@/types/tree'

// ============================================================================
// Deep Search Utilities (CPU-optimized)
// ============================================================================

const MAX_SEARCH_DEPTH = 20 // Prevent infinite recursion on circular refs

/**
 * Deep search for a key in nested object
 * Returns true immediately when match is found (early exit)
 */
export function deepSearchKey(obj: unknown, query: string, depth = 0): boolean {
  if (depth > MAX_SEARCH_DEPTH || obj === null || obj === undefined) {
    return false
  }

  if (typeof obj !== 'object') {
    return false
  }

  // Handle arrays - search each element
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (deepSearchKey(item, query, depth + 1)) {
        return true
      }
    }
    return false
  }

  // Handle objects - check keys and recurse into values
  for (const key of Object.keys(obj)) {
    // Check if key matches
    if (key.toLowerCase().includes(query)) {
      return true
    }
    // Recurse into value
    if (deepSearchKey((obj as Record<string, unknown>)[key], query, depth + 1)) {
      return true
    }
  }

  return false
}

/**
 * Deep search for a value in nested object
 * Returns true immediately when match is found (early exit)
 */
export function deepSearchValue(obj: unknown, query: string, depth = 0): boolean {
  if (depth > MAX_SEARCH_DEPTH) {
    return false
  }

  if (obj === null || obj === undefined) {
    return false
  }

  // Primitive types - check string representation
  if (typeof obj !== 'object') {
    return String(obj).toLowerCase().includes(query)
  }

  // Handle arrays - search each element
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (deepSearchValue(item, query, depth + 1)) {
        return true
      }
    }
    return false
  }

  // Handle objects - recurse into values
  for (const key of Object.keys(obj)) {
    if (deepSearchValue((obj as Record<string, unknown>)[key], query, depth + 1)) {
      return true
    }
  }

  return false
}

export interface PropsRow extends TreeNodeModel {
  /** Pre-calculated: has props with count > 0 */
  hasPropsFlag: boolean
  /** Pre-calculated: has DOM element */
  hasDomElement: boolean
  /** Mutable: visibility state (for filtering) */
  visible: boolean
  /** Mutable: favorite state */
  isFavoriteFlag: boolean
  /** Pre-calculated: element info string */
  elementInfo: string
  /** Pre-calculated: extracted UID */
  uid: number | null
}

/**
 * Create PropsRow from TreeNodeModel
 */
export function createPropsRow(node: TreeNodeModel, isFavorite: boolean): PropsRow {
  const elementInfo = getElementInfo(node)
  
  return {
    ...node,
    hasPropsFlag: !!(node.props && Object.keys(node.props).length > 0),
    hasDomElement: !!(node.rootElement?.tagName || node.element),
    visible: true,
    isFavoriteFlag: isFavorite,
    elementInfo,
    uid: extractUid(node)
  }
}

function getElementInfo(node: TreeNodeModel): string {
  if (node.element) {
    if (node.element instanceof HTMLElement) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className
        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    } else if (node.element.tagName) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className
        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    }
  }
  
  if (node.rootElement?.tagName) {
    const tag = node.rootElement.tagName.toLowerCase()
    const cls = node.rootElement.className
      ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.')
      : ''
    return tag + cls
  }
  
  return 'Logic only'
}

function extractUid(node: TreeNodeModel): number | null {
  const path = node.componentUid || node.id
  if (!path) return null
  
  if (typeof path === 'string' && path.startsWith('uid:')) {
    const uid = parseInt(path.substring(4), 10)
    return isNaN(uid) ? null : uid
  }
  
  return null
}

/**
 * Update visibility for all rows based on filters
 * This is O(n) simple assignments - zero array recreation
 */
export function updateRowsVisibility(
  rows: PropsRow[],
  options: {
    searchTerm: string
    searchByName: boolean
    searchByRootElement: boolean
    searchByKey: boolean
    searchByValue: boolean
  }
): void {
  const { searchTerm, searchByName, searchByRootElement, searchByKey, searchByValue } = options
  const q = searchTerm.toLowerCase().trim()
  const hasSearch = q.length > 0

  for (const row of rows) {

    // Search filter
    if (hasSearch) {
      let matches = false

      if (searchByName && row.name?.toLowerCase().includes(q)) {
        matches = true
      }

      if (!matches && searchByRootElement && row.elementInfo.toLowerCase().includes(q)) {
        matches = true
      }

      if (!matches && searchByKey && row.props) {
        if (deepSearchKey(row.props, q)) {
          matches = true
        }
      }

      if (!matches && searchByValue && row.props) {
        if (deepSearchValue(row.props, q)) {
          matches = true
        }
      }

      row.visible = matches
      continue
    }

    row.visible = true
  }
}

/**
 * Sort rows by favorite status (in-place, stable sort)
 */
export function sortRowsByFavorite(rows: PropsRow[]): void {
  rows.sort((a, b) => {
    if (a.isFavoriteFlag && !b.isFavoriteFlag) return -1
    if (!a.isFavoriteFlag && b.isFavoriteFlag) return 1
    return 0
  })
}
