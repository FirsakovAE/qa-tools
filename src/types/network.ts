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
 * Single form-data field
 */
export interface FormDataEntry {
  key: string
  type: 'text' | 'file'
  value: string
  /** Original file name (for type=file) */
  fileName?: string
  /** MIME type (for type=file) */
  fileType?: string
  /** File size in bytes (for type=file) */
  fileSize?: number
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
  /** Whether this is binary content */
  isBinary: boolean
  /** Parsed form-data entries (when contentType is multipart/form-data) */
  formData?: FormDataEntry[]
  /** Binary response summary: format label. The byte size is `originalSize`. */
  media?: {
    format: string
  }
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

  /**
   * Before Advanced webRequest merge: headers visible to page scripts (Classic subset).
   * Used to hide “advanced-only” headers in UI / cURL / export when settings ask for it; pinned names still use merged values.
   */
  requestHeadersPageVisible?: HeaderEntry[]
  
  /** Response headers */
  responseHeaders: HeaderEntry[]

  /** Same as requestHeadersPageVisible for the response direction (after merge). */
  responseHeadersPageVisible?: HeaderEntry[]
  
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
  
  /** Initiator type (fetch, xhr, websocket) */
  initiator: 'fetch' | 'xhr' | 'websocket'

  /** Present for a WebSocket row: connection state and the message log */
  websocket?: WebSocketInfo
}

/** One WebSocket message captured from `send` or `message`. */
export interface WebSocketFrame {
  id: string
  time: number
  direction: 'sent' | 'received'
  kind: 'text' | 'binary'
  data: string
  size: number
  truncated: boolean
  /** Incoming text delivered from a mock rule */
  mocked?: boolean
}

/** Live WebSocket connection attached to a network row. */
export interface WebSocketInfo {
  protocols: string[]
  protocol: string
  state: 'connecting' | 'open' | 'closed'
  closeCode?: number
  closeReason?: string
  /** Set when the protocol says the client will not open a new socket on its own */
  reconnect?: boolean
  frames: WebSocketFrame[]
  droppedFrames: number
}

/**
 * Network store configuration
 */
export interface NetworkConfig {
  /** Maximum HTTP requests to keep (FIFO) */
  maxEntries: number
  /** Maximum WebSocket rows to keep (FIFO). Logs counts each WebSocket event toward the same number. */
  maxWebSocketEntries: number
  /** Maximum body size in bytes before truncation */
  maxBodySize: number
  /** Whether to capture request bodies */
  captureRequestBody: boolean
  /** Whether to capture response bodies */
  captureResponseBody: boolean
}

/** Shared bounds for Maximum HTTP requests and Maximum WebSocket events. */
export const NETWORK_ENTRY_LIMIT = { min: 50, max: 5000, default: 500 } as const

/** Clamps a stored or typed request-limit to {@link NETWORK_ENTRY_LIMIT}. */
export function normalizeNetworkMaxEntries(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return NETWORK_ENTRY_LIMIT.default
  return Math.min(NETWORK_ENTRY_LIMIT.max, Math.max(NETWORK_ENTRY_LIMIT.min, n))
}

/**
 * Default network configuration values
 */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  maxEntries: NETWORK_ENTRY_LIMIT.default,
  maxWebSocketEntries: NETWORK_ENTRY_LIMIT.default,
  maxBodySize: 20 * 1024 * 1024, // 20MB
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
  | 'NETWORK_ENTRY_MODIFIED'
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
/** Milliseconds with two digits after the decimal point (`635.90 ms`). */
export function formatDurationMs(ms: number): string {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '0.00 ms'
  return `${n.toFixed(2)} ms`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '0.00 ms'
  if (ms < 1000) return formatDurationMs(ms)
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
