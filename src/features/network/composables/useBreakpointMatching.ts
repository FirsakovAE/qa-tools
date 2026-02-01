/**
 * Breakpoint Matching Composable
 * Shared URL matching logic for breakpoints and mocks
 */

import type { BreakpointItem, MockRule } from '@/types/inspector'
import type { NetworkEntry } from '@/types/network'

/**
 * Match a URL against a pattern with wildcard support
 */
export function matchUrlPattern(url: string, pattern: string | undefined, mode: 'exact' | 'prefix' | 'contains' = 'prefix'): boolean {
  if (!pattern) return true
  
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  
  const regex = mode === 'exact' 
    ? new RegExp(`^${regexPattern}$`, 'i')
    : mode === 'prefix'
      ? new RegExp(`^${regexPattern}`, 'i')
      : new RegExp(regexPattern, 'i')
  
  return regex.test(url)
}

/**
 * Match a NetworkEntry against a BreakpointItem
 */
export function matchesBreakpoint(entry: NetworkEntry, bp: BreakpointItem): boolean {
  if (!bp.enabled) return false
  
  try {
    const urlObj = new URL(entry.url)
    
    // Check scheme
    if (bp.scheme) {
      const urlScheme = urlObj.protocol.replace(':', '')
      if (urlScheme.toLowerCase() !== bp.scheme.toLowerCase()) {
        return false
      }
    }
    
    // Check host (supports wildcard *)
    if (bp.host && !matchUrlPattern(urlObj.hostname, bp.host, 'exact')) {
      return false
    }
    
    // Check port
    if (bp.port) {
      const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
      if (urlPort !== bp.port) {
        return false
      }
    }
    
    // Check path (startsWith, supports wildcard *)
    if (bp.path && !matchUrlPattern(urlObj.pathname, bp.path, 'prefix')) {
      return false
    }
    
    // Check query (partial match)
    if (bp.query) {
      const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : ''
      if (!searchWithoutPrefix) return false
      if (!matchUrlPattern(searchWithoutPrefix, bp.query, 'contains')) {
        return false
      }
    }
    
    return true
  } catch {
    return false
  }
}

/**
 * Find the first matching breakpoint for an entry
 */
export function findMatchingBreakpoint(
  entry: NetworkEntry,
  breakpoints: BreakpointItem[]
): BreakpointItem | null {
  for (const bp of breakpoints) {
    if (matchesBreakpoint(entry, bp)) {
      return bp
    }
  }
  return null
}

/**
 * Get set of entry IDs that match any active breakpoint
 */
export function getMatchingEntryIds(
  entries: NetworkEntry[],
  breakpoints: BreakpointItem[]
): Set<string> {
  const matchingIds = new Set<string>()
  
  for (const entry of entries) {
    if (findMatchingBreakpoint(entry, breakpoints)) {
      matchingIds.add(entry.id)
    }
  }
  
  return matchingIds
}

// ============================================================================
// Mock Matching
// ============================================================================

/**
 * Match a NetworkEntry against a MockRule
 */
export function matchesMock(entry: NetworkEntry, mock: MockRule): boolean {
  if (!mock.enabled) return false
  
  try {
    const urlObj = new URL(entry.url)
    
    // Check scheme
    if (mock.scheme) {
      const urlScheme = urlObj.protocol.replace(':', '')
      if (urlScheme.toLowerCase() !== mock.scheme.toLowerCase()) {
        return false
      }
    }
    
    // Check host (supports wildcard *)
    if (mock.host && !matchUrlPattern(urlObj.hostname, mock.host, 'exact')) {
      return false
    }
    
    // Check port
    if (mock.port) {
      const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
      if (urlPort !== mock.port) {
        return false
      }
    }
    
    // Check path (startsWith, supports wildcard *)
    if (mock.path && !matchUrlPattern(urlObj.pathname, mock.path, 'prefix')) {
      return false
    }
    
    // Check query (partial match)
    if (mock.query) {
      const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : ''
      if (!searchWithoutPrefix) return false
      if (!matchUrlPattern(searchWithoutPrefix, mock.query, 'contains')) {
        return false
      }
    }
    
    // Check method (optional - if set, must match)
    if (mock.method && entry.method.toUpperCase() !== mock.method.toUpperCase()) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}

/**
 * Find the first matching mock for an entry
 */
export function findMatchingMock(
  entry: NetworkEntry,
  mocks: MockRule[]
): MockRule | null {
  for (const mock of mocks) {
    if (matchesMock(entry, mock)) {
      return mock
    }
  }
  return null
}

/**
 * Get set of entry IDs that match any active mock
 */
export function getMockMatchingEntryIds(
  entries: NetworkEntry[],
  mocks: MockRule[]
): Set<string> {
  const matchingIds = new Set<string>()
  
  for (const entry of entries) {
    if (findMatchingMock(entry, mocks)) {
      matchingIds.add(entry.id)
    }
  }
  
  return matchingIds
}
