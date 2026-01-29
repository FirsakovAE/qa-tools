/**
 * Network Feature Utilities
 * Shared utilities for URL parsing, status styling, and JSON formatting
 */

import { getStatusCategory } from '@/types/network'

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
  } catch {
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
  if (!text) return '{}'
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return text
  }
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
