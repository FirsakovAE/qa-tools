/**
 * Network Tab Types
 * DTO contracts for network request interception
 */

/**
 * HTTP methods supported by the network interceptor
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

/**
 * Request status categories for styling
 */
export type RequestStatusCategory = 'success' | 'redirect' | 'client-error' | 'server-error' | 'pending' | 'failed'

/**
 * Header entry structure
 */
export interface HeaderEntry {
  name: string
  value: string
}

/**
 * Authorization info extracted from request
 */
export interface AuthorizationInfo {
  type: 'Bearer' | 'Basic' | 'ApiKey' | 'Custom' | 'None'
  token?: string
  username?: string
  headerName?: string
}

/**
 * URL parameter entry
 */
export interface UrlParam {
  key: string
  value: string
}

/**
 * Body content with truncation support
 */
export interface BodyContent {
  /** The body text (may be truncated) */
  text: string
  /** Whether the body was truncated due to size limits */
  truncated: boolean
  /** Original size in bytes before truncation */
  originalSize: number
  /** Content type of the body */
  contentType: string
  /** Whether this is binary content (not displayed) */
  isBinary: boolean
}

/**
 * Main NetworkEntry DTO
 * One request = one JSON object
 */
export interface NetworkEntry {
  /** Unique identifier for this request */
  id: string
  
  /** Version number for reactivity (incremented on any change) */
  version: number
  
  /** Request timestamp (ISO string) */
  timestamp: string
  
  /** HTTP method */
  method: HttpMethod | string
  
  /** Full URL of the request */
  url: string

  /** URL path without query string */
  path: string

  /** Short name for display (extracted from URL) */
  name: string
  
  /** HTTP status code (0 if failed/pending) */
  status: number
  
  /** Status text (e.g., "OK", "Not Found") */
  statusText: string
  
  /** Request execution time in milliseconds */
  duration: number
  
  /** Response size in bytes */
  size: number
  
  /** Request headers */
  requestHeaders: HeaderEntry[]
  
  /** Response headers */
  responseHeaders: HeaderEntry[]
  
  /** URL query parameters */
  params: UrlParam[]
  
  /** Authorization information */
  authorization: AuthorizationInfo
  
  /** Request body */
  requestBody: BodyContent | null
  
  /** Response body */
  responseBody: BodyContent | null
  
  /** Error message if request failed */
  error?: string
  
  /** Whether request is still pending */
  pending: boolean
  
  /** Initiator type (fetch, xhr) */
  initiator: 'fetch' | 'xhr'
}

/**
 * Network store configuration
 */
export interface NetworkConfig {
  /** Maximum number of entries to keep (FIFO) */
  maxEntries: number
  /** Maximum body size in bytes before truncation */
  maxBodySize: number
  /** Whether to capture request bodies */
  captureRequestBody: boolean
  /** Whether to capture response bodies */
  captureResponseBody: boolean
}

/**
 * Default network configuration values
 */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  maxEntries: 500,
  maxBodySize: 100 * 1024, // 100KB
  captureRequestBody: true,
  captureResponseBody: true
}

/**
 * Network store state
 */
export interface NetworkState {
  /** List of captured network entries */
  entries: NetworkEntry[]
  /** Whether capturing is paused */
  paused: boolean
  /** Configuration */
  config: NetworkConfig
}

/**
 * Message types for network IPC
 */
export type NetworkMessageType =
  | 'NETWORK_ENTRY_CAPTURED'
  | 'NETWORK_ENTRY_UPDATED'
  | 'NETWORK_CLEAR'
  | 'NETWORK_PAUSE'
  | 'NETWORK_RESUME'
  | 'NETWORK_GET_ENTRIES'
  | 'NETWORK_ENTRIES_DATA'
  | 'NETWORK_CONFIG_UPDATE'
  | 'NETWORK_BREAKPOINT_HIT'
  | 'NETWORK_BREAKPOINT_RESUME'

/**
 * Network IPC message structure
 */
export interface NetworkMessage {
  type: NetworkMessageType
  entry?: NetworkEntry
  entries?: NetworkEntry[]
  paused?: boolean
  config?: Partial<NetworkConfig>
}

/**
 * Get status category from HTTP status code
 */
export function getStatusCategory(status: number): RequestStatusCategory {
  if (status === 0) return 'pending'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'redirect'
  if (status >= 400 && status < 500) return 'client-error'
  if (status >= 500) return 'server-error'
  return 'failed'
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Format duration to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

/**
 * Extract short name from URL
 */
export function extractUrlName(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    // Get last segment of path or host if root
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      return segments[segments.length - 1]
    }
    return urlObj.host
  } catch {
    return url.substring(0, 50)
  }
}

/**
 * Parse query parameters from URL
 */
export function parseUrlParams(url: string): UrlParam[] {
  try {
    const urlObj = new URL(url)
    const params: UrlParam[] = []
    urlObj.searchParams.forEach((value, key) => {
      params.push({ key, value })
    })
    return params
  } catch {
    return []
  }
}

/**
 * Extract authorization info from headers
 */
export function extractAuthorization(headers: HeaderEntry[]): AuthorizationInfo {
  const authHeader = headers.find(
    h => h.name.toLowerCase() === 'authorization'
  )
  
  if (!authHeader) {
    // Check for API key headers
    const apiKeyHeader = headers.find(h => 
      h.name.toLowerCase().includes('api-key') ||
      h.name.toLowerCase().includes('x-api-key')
    )
    if (apiKeyHeader) {
      return {
        type: 'ApiKey',
        token: apiKeyHeader.value,
        headerName: apiKeyHeader.name
      }
    }
    return { type: 'None' }
  }
  
  const value = authHeader.value
  
  if (value.startsWith('Bearer ')) {
    return {
      type: 'Bearer',
      token: value.substring(7)
    }
  }
  
  if (value.startsWith('Basic ')) {
    const decoded = atob(value.substring(6))
    const [username] = decoded.split(':')
    return {
      type: 'Basic',
      token: value.substring(6),
      username
    }
  }
  
  return {
    type: 'Custom',
    token: value
  }
}

/**
 * Check if content type is binary
 */
export function isBinaryContentType(contentType: string): boolean {
  const binaryTypes = [
    'image/',
    'audio/',
    'video/',
    'application/octet-stream',
    'application/pdf',
    'application/zip',
    'application/gzip',
    'application/x-tar'
  ]
  return binaryTypes.some(type => contentType.toLowerCase().startsWith(type))
}

/**
 * Generate unique ID for network entry
 */
export function generateEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
