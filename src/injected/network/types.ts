/**
 * Network interceptor internal types
 */

export interface PendingRequest {
  id: string
  startTime: number
  method: string
  url: string
  requestHeaders: Array<{ name: string; value: string }>
  requestBody: string | null
}

export interface InterceptorCallbacks {
  onRequest: (request: PendingRequest) => void
  onResponse: (id: string, response: ResponseData) => void
  onError: (id: string, error: string) => void
  /** Called to check if a breakpoint should trigger */
  onBreakpointCheck?: (url: string, trigger: 'request' | 'response') => BreakpointMatch | null
  /** Called when a breakpoint is hit */
  onBreakpointHit?: (requestId: string, breakpointId: string, trigger: 'request' | 'response') => void
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Array<{ name: string; value: string }>
  body: string | null
  size: number
  duration: number
}

/**
 * Breakpoint configuration for matching
 */
export interface BreakpointConfig {
  id: string
  scheme: string
  host: string
  port?: string
  path: string
  query?: string
  trigger: 'request' | 'response' | 'both'
  enabled: boolean
}

/**
 * Result of breakpoint match
 */
export interface BreakpointMatch {
  breakpointId: string
  trigger: 'request' | 'response'
}

/**
 * Modified request data from breakpoint edit
 */
export interface BreakpointModifiedRequest {
  requestHeaders?: Array<{ name: string; value: string }>
  requestBody?: string | null
}

/**
 * Modified response data from breakpoint edit
 */
export interface BreakpointModifiedResponse {
  status?: number
  statusText?: string
  responseHeaders?: Array<{ name: string; value: string }>
  responseBody?: string | null
}
