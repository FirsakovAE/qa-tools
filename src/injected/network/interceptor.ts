/**
 * Network Interceptor Module
 * Intercepts fetch and XMLHttpRequest calls
 * 
 * Features:
 * - Event-based (no polling)
 * - Excludes extension requests
 * - Excludes OPTIONS method
 * - Supports REST API methods
 * - REAL breakpoint pause with Promise-based waiting
 */

import type { 
  PendingRequest, 
  InterceptorCallbacks, 
  ResponseData,
  BreakpointMatch,
  BreakpointModifiedRequest,
  BreakpointModifiedResponse
} from './types'

// Store original implementations
const originalFetch = window.fetch
const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader

// Extension URL patterns to exclude
const EXTENSION_PATTERNS = [
  'chrome-extension://',
  'moz-extension://',
  'edge-extension://',
  'webkit-resource://'
]

// Maximum body size to capture (100KB default)
let maxBodySize = 100 * 1024

// Callbacks for intercepted events
let callbacks: InterceptorCallbacks | null = null

// Paused state
let isPaused = false

// Request ID counter
let requestIdCounter = 0

// ============================================================================
// Breakpoint Pause System
// ============================================================================

interface PendingBreakpoint {
  resolve: (modified?: BreakpointModifiedRequest | BreakpointModifiedResponse) => void
  reject: (error: Error) => void
  trigger: 'request' | 'response'
  requestId: string
}

// Map of breakpoint ID -> resolver function
const breakpointResolvers = new Map<string, PendingBreakpoint>()

/**
 * Wait for breakpoint to be resumed
 * This ACTUALLY pauses the request execution
 */
function waitForBreakpointResume(
  requestId: string,
  breakpointId: string,
  trigger: 'request' | 'response'
): Promise<BreakpointModifiedRequest | BreakpointModifiedResponse | undefined> {
  return new Promise((resolve, reject) => {
    breakpointResolvers.set(requestId, {
      resolve,
      reject,
      trigger,
      requestId
    })
    
    // Notify that breakpoint was hit
    if (callbacks?.onBreakpointHit) {
      callbacks.onBreakpointHit(requestId, breakpointId, trigger)
    }
  })
}

/**
 * Resume a paused breakpoint (called from bridge)
 */
export function resumeBreakpoint(
  requestId: string,
  modifications?: BreakpointModifiedRequest | BreakpointModifiedResponse
): boolean {
  const pending = breakpointResolvers.get(requestId)
  if (pending) {
    pending.resolve(modifications)
    breakpointResolvers.delete(requestId)
    return true
  }
  return false
}

/**
 * Cancel a paused breakpoint (abort the request)
 */
export function cancelBreakpoint(requestId: string): boolean {
  const pending = breakpointResolvers.get(requestId)
  if (pending) {
    pending.reject(new Error('Breakpoint cancelled by user'))
    breakpointResolvers.delete(requestId)
    return true
  }
  return false
}

/**
 * Check if there's an active breakpoint waiting
 */
export function hasActiveBreakpoint(requestId: string): boolean {
  return breakpointResolvers.has(requestId)
}

/**
 * Get all active breakpoint request IDs
 */
export function getActiveBreakpointIds(): string[] {
  return Array.from(breakpointResolvers.keys())
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `net-${Date.now()}-${++requestIdCounter}`
}

/**
 * Check if URL should be excluded from interception
 */
function shouldExcludeUrl(url: string): boolean {
  return EXTENSION_PATTERNS.some(pattern => url.startsWith(pattern))
}

/**
 * Check if method should be excluded
 */
function shouldExcludeMethod(method: string): boolean {
  return method.toUpperCase() === 'OPTIONS'
}

/**
 * Truncate body if too large
 */
function truncateBody(body: string | null): { text: string; truncated: boolean; originalSize: number } {
  if (!body) {
    return { text: '', truncated: false, originalSize: 0 }
  }
  
  const originalSize = body.length
  if (originalSize > maxBodySize) {
    return {
      text: body.substring(0, maxBodySize),
      truncated: true,
      originalSize
    }
  }
  
  return { text: body, truncated: false, originalSize }
}

/**
 * Parse headers from Headers object
 */
function parseHeaders(headers: Headers): Array<{ name: string; value: string }> {
  const result: Array<{ name: string; value: string }> = []
  headers.forEach((value, name) => {
    result.push({ name, value })
  })
  return result
}

/**
 * Get content length from headers
 */
function getContentLength(headers: Array<{ name: string; value: string }>): number {
  const contentLength = headers.find(
    h => h.name.toLowerCase() === 'content-length'
  )
  return contentLength ? parseInt(contentLength.value, 10) || 0 : 0
}

/**
 * Read response body safely
 */
async function readResponseBody(response: Response, clone: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') || ''
  
  // Skip binary content
  const binaryTypes = ['image/', 'audio/', 'video/', 'application/octet-stream', 'application/pdf', 'application/zip']
  if (binaryTypes.some(type => contentType.toLowerCase().startsWith(type))) {
    return null
  }
  
  try {
    return await clone.text()
  } catch {
    return null
  }
}

/**
 * Serialize request body to string
 */
function serializeRequestBody(body: BodyInit | null | undefined): string | null {
  if (!body) return null
  
  if (typeof body === 'string') {
    return body
  }
  
  if (body instanceof URLSearchParams) {
    return body.toString()
  }
  
  if (body instanceof FormData) {
    // FormData can't be easily serialized, provide placeholder
    return '[FormData]'
  }
  
  if (body instanceof Blob) {
    return `[Blob: ${body.size} bytes, type: ${body.type}]`
  }
  
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return `[Binary: ${body.byteLength} bytes]`
  }
  
  try {
    return JSON.stringify(body)
  } catch {
    return '[Object]'
  }
}

/**
 * Apply modifications to request init
 */
function applyRequestModifications(
  init: RequestInit | undefined,
  modifications: BreakpointModifiedRequest
): RequestInit {
  const modified: RequestInit = { ...init }
  
  if (modifications.requestHeaders) {
    const headers = new Headers()
    modifications.requestHeaders.forEach(h => headers.set(h.name, h.value))
    modified.headers = headers
  }
  
  if (modifications.requestBody !== undefined) {
    modified.body = modifications.requestBody
  }
  
  return modified
}

// ============================================================================
// Fetch Interceptor
// ============================================================================

/**
 * Intercept fetch API with REAL breakpoint support
 */
function interceptFetch(): void {
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.href 
        : input.url
    
    const method = init?.method || (input instanceof Request ? input.method : 'GET')
    
    // Debug: log every fetch call
    console.log('[VueInspector Interceptor] 📡 fetch() called:', method, url)
    
    // Check exclusions (but NOT isPaused - that only affects logging, not breakpoints)
    if (shouldExcludeUrl(url) || shouldExcludeMethod(method)) {
      console.log('[VueInspector Interceptor] Skipping (excluded):', url)
      return originalFetch.call(window, input, init)
    }
    
    const requestId = generateRequestId()
    const startTime = performance.now()
    
    // Extract request headers (from init or Request object)
    let requestHeaders: Array<{ name: string; value: string }> = []
    const headersSource = init?.headers || (input instanceof Request ? input.headers : null)
    if (headersSource) {
      if (headersSource instanceof Headers) {
        headersSource.forEach((value, name) => {
          requestHeaders.push({ name, value })
        })
      } else if (Array.isArray(headersSource)) {
        headersSource.forEach(([name, value]) => {
          requestHeaders.push({ name, value })
        })
      } else {
        Object.entries(headersSource).forEach(([name, value]) => {
          requestHeaders.push({ name, value })
        })
      }
    }
    
    // Extract request body (from init or Request object)
    let requestBody = serializeRequestBody(init?.body || (input instanceof Request ? input.body as BodyInit : null))
    
    // Notify about new request (only if not paused for logging)
    if (callbacks?.onRequest && !isPaused) {
      callbacks.onRequest({
        id: requestId,
        startTime,
        method: method.toUpperCase(),
        url,
        requestHeaders,
        requestBody
      })
    }
    
    // ========================================
    // REQUEST BREAKPOINT CHECK
    // (works even when logging is paused!)
    // ========================================
    let effectiveInput: RequestInfo | URL = input
    let effectiveInit: RequestInit | undefined = init
    
    // Debug: check if breakpoint callback exists
    console.log('[VueInspector Interceptor] Checking request breakpoint for:', url, 'callback exists:', !!callbacks?.onBreakpointCheck)
    
    if (callbacks?.onBreakpointCheck) {
      const match = callbacks.onBreakpointCheck(url, 'request')
      console.log('[VueInspector Interceptor] Breakpoint match result:', match)
      
      if (match) {
        console.log('[VueInspector Interceptor] 🛑 PAUSING REQUEST - waiting for resume...')
        // ACTUALLY PAUSE HERE - request has NOT been sent yet!
        const modifications = await waitForBreakpointResume(
          requestId,
          match.breakpointId,
          'request'
        ) as BreakpointModifiedRequest | undefined
        
        // Apply any modifications from user
        if (modifications) {
          const modifiedInit = applyRequestModifications(init, modifications)
          
          // If input is a Request object, we need to create a new one with modifications
          if (input instanceof Request) {
            effectiveInput = new Request(input, modifiedInit)
            effectiveInit = undefined // Options are now in the Request object
          } else {
            effectiveInit = modifiedInit
          }
          
          // Update captured data with modifications
          if (modifications.requestHeaders) {
            requestHeaders = modifications.requestHeaders
          }
          if (modifications.requestBody !== undefined) {
            requestBody = modifications.requestBody
          }
        }
      }
    }
    
    // ========================================
    // SEND THE ACTUAL REQUEST
    // ========================================
    try {
      const response = await originalFetch.call(window, effectiveInput, effectiveInit)
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Clone response to read body
      const clone = response.clone()
      
      // Read response body
      let responseBody = await readResponseBody(response, clone)
      const { text: bodyText, truncated, originalSize } = truncateBody(responseBody)
      
      // Get response headers
      let responseHeaders = parseHeaders(response.headers)
      
      // Calculate size
      const contentLength = getContentLength(responseHeaders)
      const size = contentLength || originalSize
      
      // ========================================
      // RESPONSE BREAKPOINT CHECK
      // ========================================
      let finalResponse = response
      
      if (callbacks?.onBreakpointCheck) {
        const match = callbacks.onBreakpointCheck(url, 'response')
        
        if (match) {
          // First notify about response so UI can show it
          if (callbacks?.onResponse) {
            callbacks.onResponse(requestId, {
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
              body: truncated ? bodyText : responseBody,
              size,
              duration
            })
          }
          
          // ACTUALLY PAUSE HERE - response has been received but NOT returned to app yet!
          const modifications = await waitForBreakpointResume(
            requestId,
            match.breakpointId,
            'response'
          ) as BreakpointModifiedResponse | undefined
          
          // Apply any modifications from user
          if (modifications && modifications.responseBody !== undefined) {
            // Create a new Response with modified body
            const modifiedBody = modifications.responseBody
            const modifiedStatus = modifications.status ?? response.status
            const modifiedStatusText = modifications.statusText ?? response.statusText
            
            // Create modified headers
            const modifiedHeaders = new Headers()
            const headersToUse = modifications.responseHeaders ?? responseHeaders
            headersToUse.forEach(h => modifiedHeaders.set(h.name, h.value))
            
            // Update content-length if body changed
            if (modifiedBody !== null) {
              modifiedHeaders.set('content-length', String(modifiedBody.length))
            }
            
            finalResponse = new Response(modifiedBody, {
              status: modifiedStatus,
              statusText: modifiedStatusText,
              headers: modifiedHeaders
            })
            
            // Update for logging
            responseBody = modifiedBody
            responseHeaders = headersToUse
          }
          
          return finalResponse
        }
      }
      
      // Notify about response (normal flow, no response breakpoint)
      // Only log if not paused
      if (callbacks?.onResponse && !isPaused) {
        callbacks.onResponse(requestId, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: truncated ? bodyText : responseBody,
          size,
          duration
        })
      }
      
      return finalResponse
    } catch (error) {
      // Notify about error
      if (callbacks?.onError) {
        callbacks.onError(
          requestId,
          error instanceof Error ? error.message : 'Network request failed'
        )
      }
      throw error
    }
  }
}

// ============================================================================
// XMLHttpRequest Interceptor
// ============================================================================

/**
 * Intercept XMLHttpRequest
 * Note: XHR breakpoints are more complex due to async event-based nature
 * For now, we support logging but request breakpoints require fetch
 */
function interceptXHR(): void {
  // Track pending XHR requests
  const xhrMap = new WeakMap<XMLHttpRequest, {
    id: string
    method: string
    url: string
    startTime: number
    requestHeaders: Array<{ name: string; value: string }>
    requestBody: string | null
  }>()
  
  // Override open
  XMLHttpRequest.prototype.open = function(
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ): void {
    const urlStr = url.toString()
    
    if (!shouldExcludeUrl(urlStr) && !shouldExcludeMethod(method)) {
      xhrMap.set(this, {
        id: generateRequestId(),
        method: method.toUpperCase(),
        url: urlStr,
        startTime: 0,
        requestHeaders: [],
        requestBody: null
      })
    }
    
    return originalXHROpen.call(this, method, url, async, username, password)
  }
  
  // Override setRequestHeader
  XMLHttpRequest.prototype.setRequestHeader = function(name: string, value: string): void {
    const data = xhrMap.get(this)
    if (data) {
      data.requestHeaders.push({ name, value })
    }
    return originalXHRSetRequestHeader.call(this, name, value)
  }
  
  // Pending XHR requests waiting for breakpoint resume
  const pendingXHRRequests = new Map<string, {
    xhr: XMLHttpRequest
    body: Document | XMLHttpRequestBodyInit | null | undefined
    data: typeof xhrMap extends WeakMap<XMLHttpRequest, infer T> ? T : never
  }>()
  
  // Override send
  XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
    const data = xhrMap.get(this)
    const xhr = this
    
    // Debug: log XHR calls
    if (data) {
      console.log('[VueInspector Interceptor] 📡 XHR send() called:', data.method, data.url)
    }
    
    if (!data) {
      return originalXHRSend.call(this, body)
    }
    
    data.startTime = performance.now()
    data.requestBody = serializeRequestBody(body as BodyInit)
    
    // ========================================
    // REQUEST BREAKPOINT CHECK FOR XHR
    // ========================================
    console.log('[VueInspector Interceptor] Checking XHR request breakpoint for:', data.url, 'callback exists:', !!callbacks?.onBreakpointCheck)
    
    if (callbacks?.onBreakpointCheck) {
      const match = callbacks.onBreakpointCheck(data.url, 'request')
      console.log('[VueInspector Interceptor] XHR Breakpoint match result:', match)
      
      if (match) {
        console.log('[VueInspector Interceptor] 🛑 PAUSING XHR REQUEST - waiting for resume...')
        
        // Store pending XHR request
        pendingXHRRequests.set(data.id, { xhr, body, data })
        
        // Notify about request first (so UI shows it)
        if (callbacks?.onRequest && !isPaused) {
          callbacks.onRequest({
            id: data.id,
            startTime: data.startTime,
            method: data.method,
            url: data.url,
            requestHeaders: data.requestHeaders,
            requestBody: data.requestBody
          })
        }
        
        // Notify that breakpoint was hit - this will pause until resume
        if (callbacks?.onBreakpointHit) {
          callbacks.onBreakpointHit(data.id, match.breakpointId, 'request')
        }
        
        // Store resolver for this XHR - will be called when user clicks Apply
        breakpointResolvers.set(data.id, {
          resolve: (modifications) => {
            console.log('[VueInspector Interceptor] XHR breakpoint resumed, sending request...')
            
            // Apply modifications if any
            let finalBody = body
            if (modifications && 'requestBody' in modifications && modifications.requestBody !== undefined) {
              finalBody = modifications.requestBody as XMLHttpRequestBodyInit
            }
            
            // Remove from pending
            pendingXHRRequests.delete(data.id)
            
            // Setup listeners BEFORE sending (for response handling)
            setupXHRListeners(xhr, data)
            
            // Now actually send the request
            originalXHRSend.call(xhr, finalBody)
          },
          reject: (error) => {
            console.log('[VueInspector Interceptor] XHR breakpoint cancelled:', error.message)
            pendingXHRRequests.delete(data.id)
            // Abort the XHR
            xhr.abort()
          },
          trigger: 'request',
          requestId: data.id
        })
        
        // DON'T call originalXHRSend - we wait for resume
        return
      }
    }
    
    // No breakpoint - proceed normally
    // Notify about request (only if not paused for logging)
    if (callbacks?.onRequest && !isPaused) {
      callbacks.onRequest({
        id: data.id,
        startTime: data.startTime,
        method: data.method,
        url: data.url,
        requestHeaders: data.requestHeaders,
        requestBody: data.requestBody
      })
    }
    
    // Setup response listeners
    setupXHRListeners(this, data)
    
    // Send the request
    return originalXHRSend.call(this, body)
  }
  
  // Helper to setup XHR event listeners
  function setupXHRListeners(
    xhr: XMLHttpRequest, 
    data: { id: string; startTime: number }
  ): void {
    // Listen for response
    xhr.addEventListener('load', function(this: XMLHttpRequest) {
      const endTime = performance.now()
      const duration = endTime - data.startTime
      
      // Parse response headers
      const headerStr = this.getAllResponseHeaders()
      const responseHeaders: Array<{ name: string; value: string }> = []
      headerStr.split('\r\n').forEach(line => {
        const idx = line.indexOf(':')
        if (idx > 0) {
          responseHeaders.push({
            name: line.substring(0, idx).trim(),
            value: line.substring(idx + 1).trim()
          })
        }
      })
      
      // Get response body
      let responseBody: string | null = null
      const contentType = this.getResponseHeader('content-type') || ''
      const binaryTypes = ['image/', 'audio/', 'video/', 'application/octet-stream']
      
      if (!binaryTypes.some(type => contentType.toLowerCase().startsWith(type))) {
        try {
          responseBody = this.responseText
        } catch {
          responseBody = null
        }
      }
      
      const { text: bodyText, truncated, originalSize } = truncateBody(responseBody)
      const contentLength = parseInt(this.getResponseHeader('content-length') || '0', 10)
      const size = contentLength || originalSize
      
      // Notify about response
      if (callbacks?.onResponse) {
        callbacks.onResponse(data.id, {
          status: this.status,
          statusText: this.statusText,
          headers: responseHeaders,
          body: truncated ? bodyText : responseBody,
          size,
          duration
        })
      }
    })
    
    // Listen for errors
    xhr.addEventListener('error', function() {
      if (callbacks?.onError) {
        callbacks.onError(data.id, 'XMLHttpRequest failed')
      }
    })
    
    xhr.addEventListener('abort', function() {
      if (callbacks?.onError) {
        callbacks.onError(data.id, 'Request aborted')
      }
    })
    
    xhr.addEventListener('timeout', function() {
      if (callbacks?.onError) {
        callbacks.onError(data.id, 'Request timed out')
      }
    })
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize network interceptor
 */
export function initNetworkInterceptor(cbs: InterceptorCallbacks, maxSize?: number): void {
  console.log('[VueInspector Interceptor] Initializing...', {
    hasOnRequest: !!cbs.onRequest,
    hasOnResponse: !!cbs.onResponse,
    hasOnError: !!cbs.onError,
    hasOnBreakpointCheck: !!cbs.onBreakpointCheck,
    hasOnBreakpointHit: !!cbs.onBreakpointHit
  })
  
  callbacks = cbs
  if (maxSize) {
    maxBodySize = maxSize
  }
  
  interceptFetch()
  interceptXHR()
  
  console.log('[VueInspector Interceptor] ✅ Initialized, fetch intercepted')
}

/**
 * Pause interception (new requests won't be captured)
 */
export function pauseInterception(): void {
  isPaused = true
}

/**
 * Resume interception
 */
export function resumeInterception(): void {
  isPaused = false
}

/**
 * Check if interception is paused
 */
export function isInterceptionPaused(): boolean {
  return isPaused
}

/**
 * Restore original implementations (cleanup)
 */
export function cleanupNetworkInterceptor(): void {
  window.fetch = originalFetch
  XMLHttpRequest.prototype.open = originalXHROpen
  XMLHttpRequest.prototype.send = originalXHRSend
  XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader
  callbacks = null
  
  // Cancel all pending breakpoints
  breakpointResolvers.forEach((pending, id) => {
    pending.reject(new Error('Interceptor cleanup'))
  })
  breakpointResolvers.clear()
}
