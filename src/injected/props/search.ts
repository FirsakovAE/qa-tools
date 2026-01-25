// src/injected/props/search.ts

/**
 * 📐 Search Module - Fast search (no props) and lazy search (with props)
 * 
 * Fast search (without props):
 * - Component name
 * - Component label
 * 
 * Lazy search (with props) - LIMITED SCOPE:
 * - Default: expanded + logged components only
 * - Deep search: explicit toggle required (like Vue DevTools)
 */

import { getMetaStore, type ComponentMeta } from './meta-store'
import { getLoggedComponents, isLoggingEnabled } from './props-reader'

// ============================================================================
// Types
// ============================================================================

export type SearchType = 'name' | 'label' | 'key' | 'value' | 'all'

/**
 * Search scope for props-based search
 * CRITICAL: Deep search is dangerous and should be explicit
 */
export type SearchScope = 'expanded' | 'visible' | 'logged' | 'expandedAndLogged' | 'explicitDeep'

export interface SearchResult {
  uid: number
  name: string
  label?: string
  matchType: SearchType | 'name' | 'label' | 'key' | 'value'
  matchedText?: string
  /** Props are NOT included by default - load on demand via expandAndReadProps */
  hasProps: boolean
}

export interface SearchOptions {
  /** Search type (default: 'all') */
  type?: SearchType
  /** Case sensitive (default: false) */
  caseSensitive?: boolean
  /** Max results (default: 100) */
  limit?: number
  /** 
   * Scope for props-based search (default: 'expandedAndLogged')
   * CRITICAL: 'explicitDeep' should only be used with user confirmation
   */
  scope?: SearchScope
}

const DEFAULT_OPTIONS: Required<SearchOptions> = {
  type: 'all',
  caseSensitive: false,
  limit: 100,
  scope: 'expandedAndLogged' // Safe default - only expanded and logged
}

// ============================================================================
// Scope Helpers
// ============================================================================

/**
 * Get components within the specified search scope
 * CRITICAL: This limits which components have their props read
 */
function getComponentsInScope(scope: SearchScope): ComponentMeta[] {
  const store = getMetaStore()
  
  switch (scope) {
    case 'expanded':
      return store.getExpandedComponents()
    
    case 'logged': {
      const loggedUids = new Set(getLoggedComponents())
      return store.getAllComponents().filter(m => loggedUids.has(m.uid))
    }
    
    case 'expandedAndLogged': {
      const loggedUids = new Set(getLoggedComponents())
      return store.getAllComponents().filter(m => m.isExpanded || loggedUids.has(m.uid))
    }
    
    case 'visible':
      return store.getAllComponents().filter(m => m.isVisible)
    
    case 'explicitDeep':
      // DANGEROUS: Returns all components
      // Should only be used with explicit user confirmation
      console.warn('[VueInspector] Deep props search requested - this may be slow')
      return store.getAllComponents()
    
    default:
      return store.getExpandedComponents()
  }
}

/**
 * Check if a component is in scope for props reading
 */
function isInScope(meta: ComponentMeta, scope: SearchScope): boolean {
  switch (scope) {
    case 'expanded':
      return meta.isExpanded
    
    case 'logged':
      return getLoggedComponents().includes(meta.uid)
    
    case 'expandedAndLogged':
      return meta.isExpanded || getLoggedComponents().includes(meta.uid)
    
    case 'visible':
      return meta.isVisible
    
    case 'explicitDeep':
      return true
    
    default:
      return meta.isExpanded
  }
}

// ============================================================================
// Fast Search (No Props) - ALWAYS SAFE
// ============================================================================

/**
 * Fast search by component name (no props loading)
 */
export function searchByName(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options, type: 'name' as const }
  const store = getMetaStore()
  const results: SearchResult[] = []
  const queryNorm = opts.caseSensitive ? query : query.toLowerCase()

  for (const meta of store.getAllComponents()) {
    if (results.length >= opts.limit) break

    const name = meta.name ?? 'Anonymous'
    const nameNorm = opts.caseSensitive ? name : name.toLowerCase()

    if (nameNorm.includes(queryNorm)) {
      results.push({
        uid: meta.uid,
        name,
        label: meta.label,
        matchType: 'name',
        matchedText: name,
        hasProps: !!meta.propsSnapshot
      })
    }
  }

  return results
}

/**
 * Fast search by component label (no props loading)
 */
export function searchByLabel(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options, type: 'label' as const }
  const store = getMetaStore()
  const results: SearchResult[] = []
  const queryNorm = opts.caseSensitive ? query : query.toLowerCase()

  for (const meta of store.getAllComponents()) {
    if (results.length >= opts.limit) break
    if (!meta.label) continue

    const labelNorm = opts.caseSensitive ? meta.label : meta.label.toLowerCase()

    if (labelNorm.includes(queryNorm)) {
      results.push({
        uid: meta.uid,
        name: meta.name ?? 'Anonymous',
        label: meta.label,
        matchType: 'label',
        matchedText: meta.label,
        hasProps: !!meta.propsSnapshot
      })
    }
  }

  return results
}

/**
 * Combined fast search (name + label, no props loading) - ALWAYS SAFE
 */
export function fastSearch(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const resultMap = new Map<number, SearchResult>()
  const queryNorm = opts.caseSensitive ? query : query.toLowerCase()
  const store = getMetaStore()

  for (const meta of store.getAllComponents()) {
    if (resultMap.size >= opts.limit) break

    const name = meta.name ?? 'Anonymous'
    const nameNorm = opts.caseSensitive ? name : name.toLowerCase()

    // Match by name
    if (nameNorm.includes(queryNorm)) {
      resultMap.set(meta.uid, {
        uid: meta.uid,
        name,
        label: meta.label,
        matchType: 'name',
        matchedText: name,
        hasProps: !!meta.propsSnapshot
      })
      continue
    }

    // Match by label
    if (meta.label) {
      const labelNorm = opts.caseSensitive ? meta.label : meta.label.toLowerCase()
      if (labelNorm.includes(queryNorm)) {
        resultMap.set(meta.uid, {
          uid: meta.uid,
          name,
          label: meta.label,
          matchType: 'label',
          matchedText: meta.label,
          hasProps: !!meta.propsSnapshot
        })
      }
    }
  }

  return Array.from(resultMap.values())
}

// ============================================================================
// Lazy Search (With Props) - SCOPE LIMITED
// ============================================================================

/**
 * Get props for search from existing snapshot.
 * Only uses already-loaded props, doesn't trigger new reads.
 */
function getPropsForSearch(meta: ComponentMeta): Record<string, any> | null {
  // Only read from existing snapshot - don't trigger new reads
  if (!meta.propsSnapshot) {
    return null
  }
  
  // Return existing snapshot raw
  return meta.propsSnapshot.raw as Record<string, any>
}

/**
 * Search by prop key - LIMITED TO SCOPE
 * Default: Only searches expanded + logged components
 */
export function searchByPropKey(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options, type: 'key' as const }
  const results: SearchResult[] = []
  const queryNorm = opts.caseSensitive ? query : query.toLowerCase()

  // Get components in scope - THIS IS THE CRITICAL LIMITATION
  const componentsInScope = getComponentsInScope(opts.scope)
  
  for (const meta of componentsInScope) {
    if (results.length >= opts.limit) break

    // Only use existing props snapshot - don't trigger new reads
    const props = getPropsForSearch(meta)
    if (!props) continue

    // Search in prop keys
    for (const key of Object.keys(props)) {
      const keyNorm = opts.caseSensitive ? key : key.toLowerCase()
      if (keyNorm.includes(queryNorm)) {
        results.push({
          uid: meta.uid,
          name: meta.name ?? 'Anonymous',
          label: meta.label,
          matchType: 'key',
          matchedText: key,
          hasProps: true
        })
        break // Only add component once
      }
    }
  }

  return results
}

/**
 * Search by prop value - LIMITED TO SCOPE
 * Default: Only searches expanded + logged components
 */
export function searchByPropValue(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options, type: 'value' as const }
  const results: SearchResult[] = []
  const queryNorm = opts.caseSensitive ? query : query.toLowerCase()

  // Get components in scope - THIS IS THE CRITICAL LIMITATION
  const componentsInScope = getComponentsInScope(opts.scope)

  for (const meta of componentsInScope) {
    if (results.length >= opts.limit) break

    // Only use existing props snapshot - don't trigger new reads
    const props = getPropsForSearch(meta)
    if (!props) continue

    // Search in prop values
    for (const [key, value] of Object.entries(props)) {
      if (matchesValue(value, queryNorm, opts.caseSensitive)) {
        results.push({
          uid: meta.uid,
          name: meta.name ?? 'Anonymous',
          label: meta.label,
          matchType: 'value',
          matchedText: `${key}: ${stringifyValue(value)}`,
          hasProps: true
        })
        break // Only add component once
      }
    }
  }

  return results
}

/**
 * Combined lazy search (key + value) - LIMITED TO SCOPE
 * Default: Only searches expanded + logged components
 */
export function lazySearch(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const resultMap = new Map<number, SearchResult>()
  const queryNorm = opts.caseSensitive ? query : query.toLowerCase()

  // Get components in scope - THIS IS THE CRITICAL LIMITATION
  const componentsInScope = getComponentsInScope(opts.scope)

  for (const meta of componentsInScope) {
    if (resultMap.size >= opts.limit) break

    // Only use existing props snapshot - don't trigger new reads
    const props = getPropsForSearch(meta)
    if (!props) continue

    // Search in keys
    for (const key of Object.keys(props)) {
      const keyNorm = opts.caseSensitive ? key : key.toLowerCase()
      if (keyNorm.includes(queryNorm)) {
        resultMap.set(meta.uid, {
          uid: meta.uid,
          name: meta.name ?? 'Anonymous',
          label: meta.label,
          matchType: 'key',
          matchedText: key,
          hasProps: true
        })
        break
      }
    }

    if (resultMap.has(meta.uid)) continue

    // Search in values
    for (const [key, value] of Object.entries(props)) {
      if (matchesValue(value, queryNorm, opts.caseSensitive)) {
        resultMap.set(meta.uid, {
          uid: meta.uid,
          name: meta.name ?? 'Anonymous',
          label: meta.label,
          matchType: 'value',
          matchedText: `${key}: ${stringifyValue(value)}`,
          hasProps: true
        })
        break
      }
    }
  }

  return Array.from(resultMap.values())
}

// ============================================================================
// Full Search (All Types)
// ============================================================================

/**
 * Full search across all types (name, label, key, value).
 * Fast search is done first, then lazy search ONLY within scope.
 */
export function fullSearch(
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const resultMap = new Map<number, SearchResult>()

  // Fast search first (name + label) - ALWAYS SAFE
  const fastResults = fastSearch(query, { ...opts, limit: opts.limit })
  for (const result of fastResults) {
    resultMap.set(result.uid, result)
  }

  // If we haven't reached the limit, do lazy search WITHIN SCOPE
  if (resultMap.size < opts.limit) {
    const remaining = opts.limit - resultMap.size
    const lazyResults = lazySearch(query, { ...opts, limit: remaining })
    for (const result of lazyResults) {
      if (!resultMap.has(result.uid)) {
        resultMap.set(result.uid, result)
      }
    }
  }

  return Array.from(resultMap.values())
}

/**
 * Search with specific type
 */
export function search(
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  switch (opts.type) {
    case 'name':
      return searchByName(query, opts)
    case 'label':
      return searchByLabel(query, opts)
    case 'key':
      return searchByPropKey(query, opts)
    case 'value':
      return searchByPropValue(query, opts)
    case 'all':
    default:
      return fullSearch(query, opts)
  }
}

/**
 * Deep search - REQUIRES EXPLICIT CALL
 * This searches ALL components and should only be triggered by explicit user action
 */
export function deepSearch(
  query: string,
  options: Omit<SearchOptions, 'scope'> = {}
): SearchResult[] {
  console.warn('[VueInspector] Deep search initiated - this scans all components')
  return search(query, { ...options, scope: 'explicitDeep' })
}

// ============================================================================
// Helpers
// ============================================================================

function matchesValue(value: any, query: string, caseSensitive: boolean): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    const valueNorm = caseSensitive ? value : value.toLowerCase()
    return valueNorm.includes(query)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).includes(query)
  }

  // For objects and arrays - DON'T stringify (expensive)
  // Just check shallow
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) { // Limit to first 10 items
      if (matchesValue(item, query, caseSensitive)) {
        return true
      }
    }
    return false
  }

  if (typeof value === 'object') {
    // Check only immediate values, not nested
    for (const v of Object.values(value).slice(0, 10)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        if (matchesValue(v, query, caseSensitive)) {
          return true
        }
      }
    }
    return false
  }

  return false
}

function stringifyValue(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  if (typeof value === 'string') {
    return value.length > 50 ? value.substring(0, 50) + '...' : value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`
  }

  if (typeof value === 'object') {
    return `Object{${Object.keys(value).length}}`
  }

  return String(value)
}
