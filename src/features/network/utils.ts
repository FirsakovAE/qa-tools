/**
 * Network Feature Utilities
 * Shared utilities for URL parsing, status styling, and JSON formatting
 */

import { getStatusCategory } from '@/types/network'
import { looksLikeJsonValue } from '@/utils/jsonGuards'

// ============================================================================
// URL Parsing
// ============================================================================

export interface ParsedUrl {
  scheme: string
  host: string
  port: string
  path: string
  query: string
}

/**
 * Parse URL into components
 */
export function parseUrl(url: string): ParsedUrl {
  try {
    const urlObj = new URL(url)
    return {
      scheme: urlObj.protocol.replace(':', ''),
      host: urlObj.hostname,
      port: urlObj.port || '',
      path: urlObj.pathname || '/',
      query: urlObj.search ? urlObj.search.substring(1) : ''
    }
  } catch (error) {
    console.error('[network/utils] parseUrl failed:', url, error)
    return {
      scheme: 'https',
      host: '',
      port: '',
      path: '/',
      query: ''
    }
  }
}

/**
 * Build URL preview from components
 */
export function buildUrlPreview(
  scheme: string,
  host: string,
  port: string,
  path: string,
  query: string
): string {
  let url = `${scheme || '*'}://${host || '*'}`
  if (port) url += `:${port}`
  url += path || '/*'
  if (query) url += `?${query}`
  return url
}

// ============================================================================
// Status Styling
// ============================================================================

/**
 * Get CSS class for status badge based on status code
 */
export function getStatusClass(status: number, pending: boolean = false): string {
  if (pending) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
  
  const category = getStatusCategory(status)
  switch (category) {
    case 'success':
      return 'bg-green-500/20 text-green-500 border-green-500/30'
    case 'redirect':
      return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    case 'client-error':
      return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
    case 'server-error':
    case 'failed':
    default:
      return 'bg-red-500/20 text-red-500 border-red-500/30'
  }
}

// ============================================================================
// JSON Formatting
// ============================================================================

/**
 * Format JSON string for display/editing
 */
export function formatJson(text: string | undefined | null): string {
  if (!text?.trim()) return ''
  if (!looksLikeJsonValue(text)) return text
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string') {
      try {
        const inner = JSON.parse(parsed)
        if (typeof inner === 'object' && inner !== null) {
          return JSON.stringify(inner, null, 2)
        }
      } catch { /* inner is not JSON */ }
      return parsed
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(parsed, null, 2)
    }
    return text
  } catch {
    return text
  }
}

/**
 * Format body text for read-only display.
 * Handles JSON (pretty-print), double-wrapped JSON strings, and non-JSON content.
 */
export function formatBodyForDisplay(text: string | undefined | null, contentType?: string): string {
  if (!text?.trim()) return ''

  const ct = (contentType ?? '').toLowerCase()
  const declaresJson = ct.includes('json')
  // Without Content-Type, only pretty-print when the payload looks like JSON (avoid HTML/XML as JSON attempts).
  const shouldTryJson =
    declaresJson || ((contentType == null || contentType === '') && looksLikeJsonValue(text))

  if (shouldTryJson) {
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed === 'string') {
        try {
          const inner = JSON.parse(parsed)
          if (typeof inner === 'object' && inner !== null) {
            return JSON.stringify(inner, null, 2)
          }
        } catch { /* inner is not JSON */ }
        return parsed
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return JSON.stringify(parsed, null, 2)
      }
      return text
    } catch {
      return text
    }
  }

  return text
}

/**
 * Detect Prism language from content type
 */
export function detectLanguage(contentType: string | undefined | null): string {
  if (!contentType) return 'json'
  const ct = contentType.toLowerCase()
  if (ct.includes('json')) return 'json'
  if (ct.includes('xml') || ct.includes('svg')) return 'xml'
  if (ct.includes('html')) return 'html'
  if (ct.includes('css')) return 'css'
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'javascript'
  if (ct.includes('text/plain')) return 'plain'
  return 'plain'
}

/**
 * Generate unique ID with prefix
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// ============================================================================
// Deep Clone
// ============================================================================

/**
 * Deep clone object using JSON (handles Vue proxies)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}
