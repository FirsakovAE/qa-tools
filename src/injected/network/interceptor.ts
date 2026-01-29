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
  BreakpointModifiedResponse,
  MockConfig,
  MockMatch
} from './types'

// Store original implementations
const originalFetch = window.fetch
const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
const originalXHRResponseTypeDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseType')

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
 * Build new URL from modifications
 */
function buildModifiedUrl(
  originalUrl: string,
  modifications: BreakpointModifiedRequest
): string {
  try {
    const url = new URL(originalUrl)
    
    // Apply scheme change
    if (modifications.scheme) {
      url.protocol = modifications.scheme + ':'
    }
    
    // Apply host change (may include port)
    if (modifications.host) {
      const [host, port] = modifications.host.split(':')
      url.hostname = host
      if (port) {
        url.port = port
      } else {
        url.port = ''
      }
    }
    
    // Apply path change (may include query)
    if (modifications.path) {
      const [pathname, search] = modifications.path.split('?')
      url.pathname = pathname
      if (search !== undefined) {
        url.search = search ? '?' + search : ''
      }
    }
    
    // Apply params change - rebuild query string (empty array clears all params)
    if (Array.isArray(modifications.params)) {
      if (modifications.params.length > 0) {
        const searchParams = new URLSearchParams()
        modifications.params.forEach(p => {
          if (p.key) {
            searchParams.append(p.key, p.value)
          }
        })
        url.search = searchParams.toString() ? '?' + searchParams.toString() : ''
      } else {
        // Empty array - clear all params
        url.search = ''
      }
    }
    
    return url.toString()
  } catch (e) {
    console.warn('[VueInspector Interceptor] Failed to build modified URL:', e)
    return originalUrl
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
  
  // Apply method change
  if (modifications.method) {
    modified.method = modifications.method
  }
  
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
 * Intercept fetch API with REAL breakpoint support and Mock (Map Local) feature
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
    
    // ========================================
    // 🎯 MOCK CHECK - BEFORE ANY NETWORK CALL!
    // This is Map Local: return fake response without hitting network
    // ========================================
    if (callbacks?.onMockCheck) {
      const mockMatch = callbacks.onMockCheck(url, method.toUpperCase())
      
      if (mockMatch && mockMatch.mock && mockMatch.mock.enabled) {
        console.log('[VueInspector Interceptor] 🎭 MOCK MATCH! Returning fake response for:', url)
        console.log('[VueInspector Interceptor] Mock details:', {
          id: mockMatch.mockId,
          status: mockMatch.mock.status,
          bodyLength: mockMatch.mock.body?.length,
          headersCount: mockMatch.mock.headers?.length
        })
        
        try {
          // Apply delay if configured (like Charles Proxy)
          if (mockMatch.mock.delay && mockMatch.mock.delay > 0) {
            console.log('[VueInspector Interceptor] Applying mock delay:', mockMatch.mock.delay, 'ms')
            await new Promise(resolve => setTimeout(resolve, mockMatch.mock.delay))
          }
          
          // ✅ FIX #1: Ensure body is ALWAYS a valid string
          // If body is object/array, stringify it. If undefined/null, use empty string
          let mockBody: string
          const rawBody = mockMatch.mock.body
          if (rawBody === undefined || rawBody === null) {
            mockBody = ''
          } else if (typeof rawBody === 'string') {
            mockBody = rawBody
          } else {
            mockBody = JSON.stringify(rawBody)
          }
          
          // ✅ FIX #2: Validate JSON if content-type is json
          const contentType = mockMatch.mock.headers?.find(
            h => h.name.toLowerCase() === 'content-type'
          )?.value || 'application/json'
          
          if (contentType.includes('json') && mockBody) {
            try {
              // Validate it's parseable JSON
              JSON.parse(mockBody)
            } catch {
              console.warn('[VueInspector Interceptor] Mock body is not valid JSON, wrapping as string')
              mockBody = JSON.stringify(mockBody)
            }
          }
          
          // Build response headers
          const responseHeaders = new Headers()
          if (mockMatch.mock.headers && Array.isArray(mockMatch.mock.headers)) {
            mockMatch.mock.headers.forEach(h => {
              if (h.name && h.value !== undefined) {
                responseHeaders.set(h.name, h.value)
              }
            })
          }
          
          // ✅ FIX #3: Ensure content-type and content-length are set
          if (!responseHeaders.has('content-type')) {
            responseHeaders.set('content-type', 'application/json; charset=utf-8')
          }
          responseHeaders.set('content-length', String(new TextEncoder().encode(mockBody).length))
          
          // Create synthetic Response
          const mockResponse = new Response(mockBody, {
            status: mockMatch.mock.status || 200,
            statusText: mockMatch.mock.statusText || 'OK',
            headers: responseHeaders
          })
          
          console.log('[VueInspector Interceptor] 🎭 Mock Response created successfully')
          
          // Notify that mock was applied (for UI logging)
          if (callbacks?.onMockApplied) {
            callbacks.onMockApplied(requestId, mockMatch.mockId)
          }
          
          // Extract request headers for logging
          let requestHeaders: Array<{ name: string; value: string }> = []
          const headersSource = init?.headers || (input instanceof Request ? input.headers : null)
          if (headersSource) {
            if (headersSource instanceof Headers) {
              headersSource.forEach((value, name) => requestHeaders.push({ name, value }))
            } else if (Array.isArray(headersSource)) {
              headersSource.forEach(([name, value]) => requestHeaders.push({ name, value }))
            } else {
              Object.entries(headersSource).forEach(([name, value]) => requestHeaders.push({ name, value }))
            }
          }
          
          // Log the mocked request (so it appears in Network tab)
          if (callbacks?.onRequest && !isPaused) {
            callbacks.onRequest({
              id: requestId,
              startTime,
              method: method.toUpperCase(),
              url,
              requestHeaders,
              requestBody: serializeRequestBody(init?.body || (input instanceof Request ? input.body as BodyInit : null))
            })
          }
          
          // Log the mocked response
          const endTime = performance.now()
          if (callbacks?.onResponse && !isPaused) {
            callbacks.onResponse(requestId, {
              status: mockMatch.mock.status || 200,
              statusText: mockMatch.mock.statusText || 'OK',
              headers: mockMatch.mock.headers || [],
              body: mockBody,
              size: mockBody.length,
              duration: endTime - startTime
            })
          }
          
          // 🔥 RETURN FAKE RESPONSE - NO NETWORK CALL MADE!
          console.log('[VueInspector Interceptor] 🎭 Mock response returned, request never hit network')
          return mockResponse
          
        } catch (mockError) {
          console.error('[VueInspector Interceptor] ❌ Error creating mock response:', mockError)
          // Fall through to real network call if mock fails
        }
      }
    }
    
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
          console.log('[VueInspector Interceptor] Applying modifications:', {
            method: modifications.method,
            scheme: modifications.scheme,
            host: modifications.host,
            path: modifications.path,
            paramsCount: modifications.params?.length,
            headersCount: modifications.requestHeaders?.length,
            hasBody: modifications.requestBody !== undefined
          })
          
          const modifiedInit = applyRequestModifications(init, modifications)
          
          // Apply URL modifications (scheme, host, path, params)
          // Note: empty params array also counts as URL modification (clears query string)
          const hasUrlMods = modifications.scheme || modifications.host || 
                            modifications.path || Array.isArray(modifications.params)
          
          if (hasUrlMods) {
            const modifiedUrl = buildModifiedUrl(url, modifications)
            console.log('[VueInspector Interceptor] URL modified:', url, '->', modifiedUrl)
            
            // If input is a Request object, we need to create a new one with new URL
            if (input instanceof Request) {
              effectiveInput = new Request(modifiedUrl, { ...modifiedInit })
              effectiveInit = undefined
            } else {
              effectiveInput = modifiedUrl
              effectiveInit = modifiedInit
            }
          } else {
            // No URL modifications, just apply init changes
            if (input instanceof Request) {
              effectiveInput = new Request(input, modifiedInit)
              effectiveInit = undefined
            } else {
              effectiveInit = modifiedInit
            }
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

      // Clone response only once, but defer reading until after breakpoint resume
      let responseBody: string | null = null
      const clone = response.clone()

      // Get response headers
      let responseHeaders = parseHeaders(response.headers)

      // ========================================
      // RESPONSE BREAKPOINT CHECK
      // ========================================
      let finalResponse = response

      if (callbacks?.onBreakpointCheck) {
        const match = callbacks.onBreakpointCheck(url, 'response')

        if (match) {
          console.log('[VueInspector Interceptor] 🛑 PAUSING RESPONSE - waiting for resume...')
          
          // Read response body BEFORE waiting for resume (so UI can show it)
          responseBody = await readResponseBody(response, clone)
          const trunc = truncateBody(responseBody)
          let bodyText = trunc.text
          let truncated = trunc.truncated
          let originalSize = trunc.originalSize

          // Calculate size
          const contentLength = getContentLength(responseHeaders)
          const size = contentLength || originalSize

          // ✅ Notify UI about the response BEFORE pausing (so user can see/edit body)
          // NOTE: Always notify for breakpoints, regardless of isPaused (breakpoints work even when logging is paused)
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

          // NOW pause and wait for user to modify and click Apply
          const modifications = await waitForBreakpointResume(
            requestId,
            match.breakpointId,
            'response'
          ) as BreakpointModifiedResponse | undefined

          // Apply any modifications from user
          if (modifications && modifications.responseBody !== undefined) {
            const modifiedBody = modifications.responseBody

            // Create modified headers
            const modifiedHeaders = new Headers()
            const headersToUse = modifications.responseHeaders ?? responseHeaders
            headersToUse.forEach(h => modifiedHeaders.set(h.name, h.value))

            // Update content-length if body changed
            if (modifiedBody !== null) {
              modifiedHeaders.set('content-length', String(modifiedBody.length))
            } else {
              modifiedHeaders.delete('content-length')
            }

            finalResponse = new Response(modifiedBody, {
              status: modifications.status ?? response.status,
              statusText: modifications.statusText ?? response.statusText,
              headers: modifiedHeaders
            })

            // Update for logging
            responseBody = modifiedBody
            responseHeaders = headersToUse

            // Update UI with modified response
            if (callbacks?.onResponse) {
              callbacks.onResponse(requestId, {
                status: finalResponse.status,
                statusText: finalResponse.statusText,
                headers: responseHeaders,
                body: modifiedBody,
                size: modifiedBody?.length || 0,
                duration
              })
            }
          }

          return finalResponse
        }
      }

      // No response breakpoint - read body normally from the existing clone
      responseBody = await readResponseBody(clone, clone)
      const trunc = truncateBody(responseBody)
      let bodyText = trunc.text
      let truncated = trunc.truncated
      let originalSize = trunc.originalSize

      // Calculate size
      const contentLength = getContentLength(responseHeaders)
      const size = contentLength || originalSize

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

// Store original addEventListener for XHR
const originalXHRAddEventListener = XMLHttpRequest.prototype.addEventListener

// Extended XHR data including event handler management
interface XHRData {
  id: string
  method: string
  url: string
  startTime: number
  requestHeaders: Array<{ name: string; value: string }>
  requestBody: string | null
  // Event handler queues - handlers are stored and called AFTER breakpoint resolves
  loadHandlers: Array<EventListenerOrEventListenerObject>
  readystatechangeHandlers: Array<EventListenerOrEventListenerObject>
  errorHandlers: Array<EventListenerOrEventListenerObject>
  // Flag to track if response breakpoint is active
  responseBreakpointPending: boolean
  // Stored response data for delayed handler calls
  storedResponseData: {
    responseText: string
    response: unknown
    status: number
    statusText: string
    responseHeaders: Array<{ name: string; value: string }>
  } | null
}

/**
 * Intercept XMLHttpRequest
 * 
 * Response breakpoint strategy for XHR:
 * 1. Intercept addEventListener and onload/onreadystatechange setters
 * 2. Store all handlers instead of attaching them directly
 * 3. When load event fires, check for breakpoint
 * 4. If breakpoint, wait for resume, apply modifications
 * 5. Override response properties with (possibly modified) values
 * 6. THEN call stored handlers - they see modified data
 */
function interceptXHR(): void {
  // Track pending XHR requests with extended data
  const xhrMap = new WeakMap<XMLHttpRequest, XHRData>()
  
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
        requestBody: null,
        loadHandlers: [],
        readystatechangeHandlers: [],
        errorHandlers: [],
        responseBreakpointPending: false,
        storedResponseData: null
      })
      
      // Intercept addEventListener for this XHR instance
      setupXHREventInterception(this, xhrMap.get(this)!)
    }
    
    return originalXHROpen.call(this, method, url, async, username, password)
  }
  
  // Setup event interception for XHR instance
  function setupXHREventInterception(xhr: XMLHttpRequest, data: XHRData): void {
    // Override addEventListener to capture handlers
    xhr.addEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void {
      if (type === 'load') {
        data.loadHandlers.push(listener)
        return // Don't attach directly - we'll call manually after breakpoint
      }
      if (type === 'readystatechange') {
        data.readystatechangeHandlers.push(listener)
        return
      }
      if (type === 'error') {
        data.errorHandlers.push(listener)
        // Still attach error handlers directly
      }
      // For other events, attach normally
      return originalXHRAddEventListener.call(this, type, listener, options)
    }
    
    // Track onload property assignment
    let _onload: ((this: XMLHttpRequest, ev: ProgressEvent) => unknown) | null = null
    Object.defineProperty(xhr, 'onload', {
      get: () => _onload,
      set: (handler) => {
        _onload = handler
        if (handler) {
          data.loadHandlers.push(handler as EventListenerOrEventListenerObject)
        }
      },
      configurable: true
    })
    
    // Track onreadystatechange property assignment  
    let _onreadystatechange: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null
    Object.defineProperty(xhr, 'onreadystatechange', {
      get: () => _onreadystatechange,
      set: (handler) => {
        _onreadystatechange = handler
        if (handler) {
          data.readystatechangeHandlers.push(handler as EventListenerOrEventListenerObject)
        }
      },
      configurable: true
    })
  }
  
  // Override setRequestHeader
  XMLHttpRequest.prototype.setRequestHeader = function(name: string, value: string): void {
    const data = xhrMap.get(this)
    if (data) {
      data.requestHeaders.push({ name, value })
    }
    return originalXHRSetRequestHeader.call(this, name, value)
  }
  
  // ✅ FIX: Track responseType for proper mock response handling
  if (originalXHRResponseTypeDescriptor) {
    Object.defineProperty(XMLHttpRequest.prototype, 'responseType', {
      get: function() {
        return (this as any)._responseType || ''
      },
      set: function(value: XMLHttpRequestResponseType) {
        (this as any)._responseType = value
        if (originalXHRResponseTypeDescriptor.set) {
          originalXHRResponseTypeDescriptor.set.call(this, value)
        }
      },
      configurable: true
    })
  }
  
  // Pending XHR requests waiting for breakpoint resume
  const pendingXHRRequests = new Map<string, {
    xhr: XMLHttpRequest
    body: Document | XMLHttpRequestBodyInit | null | undefined
    data: XHRData
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
    // 🎯 MOCK CHECK FOR XHR - BEFORE ANY NETWORK CALL!
    // ========================================
    if (callbacks?.onMockCheck) {
      const mockMatch = callbacks.onMockCheck(data.url, data.method)
      
      if (mockMatch && mockMatch.mock && mockMatch.mock.enabled) {
        console.log('[VueInspector Interceptor] 🎭 XHR MOCK MATCH! Returning fake response for:', data.url)
        console.log('[VueInspector Interceptor] XHR Mock details:', {
          id: mockMatch.mockId,
          status: mockMatch.mock.status,
          bodyLength: mockMatch.mock.body?.length,
          headersCount: mockMatch.mock.headers?.length
        })
        
        // Log the mocked request (so it appears in Network tab)
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
        
        // ✅ FIX: Ensure body is ALWAYS a valid string
        let mockBody: string
        const rawBody = mockMatch.mock.body
        if (rawBody === undefined || rawBody === null) {
          mockBody = ''
        } else if (typeof rawBody === 'string') {
          mockBody = rawBody
        } else {
          mockBody = JSON.stringify(rawBody)
        }
        
        const mockStatus = mockMatch.mock.status || 200
        const mockStatusText = mockMatch.mock.statusText || 'OK'
        const mockHeaders = mockMatch.mock.headers || []
        
        // ✅ FIX: Validate JSON if needed
        const contentType = mockHeaders.find(
          h => h.name.toLowerCase() === 'content-type'
        )?.value || 'application/json'
        
        if (contentType.includes('json') && mockBody) {
          try {
            JSON.parse(mockBody)
          } catch {
            console.warn('[VueInspector Interceptor] XHR Mock body is not valid JSON, wrapping')
            mockBody = JSON.stringify(mockBody)
          }
        }
        
        // Apply delay if configured
        const applyMockAndCallHandlers = async () => {
          try {
            if (mockMatch.mock.delay && mockMatch.mock.delay > 0) {
              console.log('[VueInspector Interceptor] Applying XHR mock delay:', mockMatch.mock.delay, 'ms')
              await new Promise(resolve => setTimeout(resolve, mockMatch.mock.delay))
            }
            
            const endTime = performance.now()
            const duration = endTime - data.startTime
            
            // ✅ FIX #4: Helper to dispatch readyState change properly
            const dispatchReadyStateChange = (state: number) => {
              Object.defineProperty(xhr, 'readyState', {
                get: () => state,
                configurable: true
              })
              xhr.dispatchEvent(new Event('readystatechange'))
            }
            
            // Override status properties FIRST (before readyState changes)
            Object.defineProperty(xhr, 'status', {
              get: () => mockStatus,
              configurable: true
            })
            
            Object.defineProperty(xhr, 'statusText', {
              get: () => mockStatusText,
              configurable: true
            })
            
            // ✅ FIX #5: Handle responseType properly
            const responseType = (xhr as any)._responseType || xhr.responseType || ''
            
            Object.defineProperty(xhr, 'responseText', {
              get: () => mockBody,
              configurable: true
            })
            
            // Set response based on responseType
            if (responseType === 'json') {
              // ✅ FIX #6: Return parsed JSON for responseType='json'
              let parsedResponse: any
              try {
                parsedResponse = mockBody ? JSON.parse(mockBody) : null
              } catch {
                parsedResponse = mockBody
              }
              Object.defineProperty(xhr, 'response', {
                get: () => parsedResponse,
                configurable: true
              })
            } else if (responseType === 'arraybuffer') {
              const encoder = new TextEncoder()
              Object.defineProperty(xhr, 'response', {
                get: () => encoder.encode(mockBody).buffer,
                configurable: true
              })
            } else if (responseType === 'blob') {
              Object.defineProperty(xhr, 'response', {
                get: () => new Blob([mockBody], { type: contentType }),
                configurable: true
              })
            } else {
              // Default: text or empty string
              Object.defineProperty(xhr, 'response', {
                get: () => mockBody,
                configurable: true
              })
            }
            
            // Override header methods
            const headerString = mockHeaders.length > 0 
              ? mockHeaders.map(h => `${h.name}: ${h.value}`).join('\r\n') + '\r\n\r\n'
              : 'content-type: application/json\r\n\r\n'
            const headerMap = new Map(mockHeaders.map(h => [h.name.toLowerCase(), h.value]))
            if (!headerMap.has('content-type')) {
              headerMap.set('content-type', 'application/json; charset=utf-8')
            }
            
            Object.defineProperty(xhr, 'getAllResponseHeaders', {
              value: () => headerString,
              configurable: true
            })
            
            Object.defineProperty(xhr, 'getResponseHeader', {
              value: (name: string) => headerMap.get(name.toLowerCase()) || null,
              configurable: true
            })
            
            // ✅ FIX #7: CRITICAL - Dispatch proper XHR lifecycle sequence
            // Many frameworks (Axios, Vue Resource) depend on this exact sequence
            console.log('[VueInspector Interceptor] 🎭 XHR dispatching lifecycle events...')
            
            // Simulate: OPENED -> HEADERS_RECEIVED -> LOADING -> DONE
            dispatchReadyStateChange(2) // HEADERS_RECEIVED
            dispatchReadyStateChange(3) // LOADING  
            dispatchReadyStateChange(4) // DONE
            
            // ✅ FIX #8: CRITICAL - Fire load AND loadend events
            // Without loadend, Axios/Vue promises may never resolve!
            const progressEventInit = {
              lengthComputable: true,
              loaded: mockBody.length,
              total: mockBody.length
            }
            
            xhr.dispatchEvent(new ProgressEvent('load', progressEventInit))
            xhr.dispatchEvent(new ProgressEvent('loadend', progressEventInit))
            
            console.log('[VueInspector Interceptor] 🎭 XHR lifecycle complete (load + loadend dispatched)')
            
            // Log the mocked response
            if (callbacks?.onResponse && !isPaused) {
              callbacks.onResponse(data.id, {
                status: mockStatus,
                statusText: mockStatusText,
                headers: mockHeaders,
                body: mockBody,
                size: mockBody.length,
                duration
              })
            }
            
            // Notify mock was applied
            if (callbacks?.onMockApplied) {
              callbacks.onMockApplied(data.id, mockMatch.mockId)
            }
            
            console.log('[VueInspector Interceptor] 🎭 XHR Mock response ready, calling stored handlers')
            
            // Call stored handlers with mock data (for manually attached handlers)
            callStoredHandlers(xhr, data)
            
          } catch (mockError) {
            console.error('[VueInspector Interceptor] ❌ Error applying XHR mock:', mockError)
            // If mock fails, we can't recover for XHR - just log error
          }
        }
        
        // Execute async but don't return from send()
        applyMockAndCallHandlers()
        
        // 🔥 DON'T CALL originalXHRSend - request never hits network!
        return
      }
    }
    
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
        if (callbacks?.onRequest) {
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
            
            const reqMods = modifications as BreakpointModifiedRequest | undefined

            // Apply modifications if any
            let finalBody = body
            if (reqMods?.requestBody !== undefined) {
              finalBody = reqMods.requestBody as XMLHttpRequestBodyInit
            }
            
            // Check if URL modifications require re-opening
            // Note: empty params array also counts as URL modification (clears query string)
            const hasUrlMods = reqMods && (reqMods.scheme || reqMods.host || 
                              reqMods.path || reqMods.method || 
                              Array.isArray(reqMods.params))
            
            if (hasUrlMods && reqMods) {
              // Build modified URL
              const modifiedUrl = buildModifiedUrl(data.url, reqMods)
              const modifiedMethod = reqMods.method || data.method
              
              console.log('[VueInspector Interceptor] XHR URL modified:', data.url, '->', modifiedUrl)
              
              // Re-open XHR with new URL (this resets headers)
              originalXHROpen.call(xhr, modifiedMethod, modifiedUrl, true)
              
              // Re-apply headers (use modified headers if available)
              const headersToApply = reqMods.requestHeaders || data.requestHeaders
              headersToApply.forEach(h => {
                try {
                  originalXHRSetRequestHeader.call(xhr, h.name, h.value)
                } catch { /* Some headers can't be set */ }
              })
              
              // Update data for logging
              data.url = modifiedUrl
              data.method = modifiedMethod
              if (reqMods.requestHeaders) {
                data.requestHeaders = reqMods.requestHeaders
              }
            } else if (reqMods?.requestHeaders) {
              // Only header modifications - can't easily re-apply without re-open
              // For now, log a warning - full solution would require re-opening
              console.warn('[VueInspector Interceptor] XHR header modifications require URL mods to take effect')
            }

            // Remove from pending
            pendingXHRRequests.delete(data.id)

            // Setup internal listener for response handling
            setupXHRInternalListener(xhr, data)

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
    
    // Setup internal listener for response handling
    setupXHRInternalListener(this, data)
    
    // Send the request
    return originalXHRSend.call(this, body)
  }
  
  /**
   * Setup internal XHR listener that handles:
   * 1. Response breakpoint detection
   * 2. Waiting for user resume
   * 3. Applying modifications
   * 4. Calling stored app handlers with (modified) data
   */
  function setupXHRInternalListener(
    xhr: XMLHttpRequest,
    data: XHRData
  ): void {
    // Use native addEventListener to attach our internal handler
    // This handler fires BEFORE we call app handlers
    originalXHRAddEventListener.call(xhr, 'load', async function(this: XMLHttpRequest) {
      const endTime = performance.now()
      const duration = endTime - data.startTime
      
      // Parse response headers
      const headerStr = this.getAllResponseHeaders()
      let responseHeaders: Array<{ name: string; value: string }> = []
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
      
      // ========================================
      // RESPONSE BREAKPOINT CHECK FOR XHR
      // ========================================

      if (callbacks?.onBreakpointCheck) {
        const match = callbacks.onBreakpointCheck(data.url, 'response')

        if (match) {
          console.log('[VueInspector Interceptor] 🛑 PAUSING XHR RESPONSE - waiting for resume...')
          
          // ✅ Notify UI about the response BEFORE pausing (so user can see/edit body)
          // NOTE: Always notify for breakpoints, regardless of isPaused
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

          // NOW pause and wait for user to modify and click Apply
          const modifications = await waitForBreakpointResume(
            data.id,
            match.breakpointId,
            'response'
          ) as BreakpointModifiedResponse | undefined

          // Apply any modifications from user
          if (modifications) {
            // For XHR, we need to override the response properties
            if (modifications.responseBody !== undefined) {
              // Override responseText and response
              const modifiedBody = modifications.responseBody
              Object.defineProperty(this, 'responseText', {
                get: () => modifiedBody || '',
                configurable: true
              })
              Object.defineProperty(this, 'response', {
                get: () => modifiedBody || null,
                configurable: true
              })

              // Update responseBody for logging
              responseBody = modifiedBody
            }

            if (modifications.status !== undefined) {
              Object.defineProperty(this, 'status', {
                get: () => modifications.status,
                configurable: true
              })
            }

            if (modifications.statusText !== undefined) {
              Object.defineProperty(this, 'statusText', {
                get: () => modifications.statusText,
                configurable: true
              })
            }

            if (modifications.responseHeaders) {
              // Override getAllResponseHeaders and getResponseHeader
              const headerString = modifications.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\r\n') + '\r\n\r\n'
              Object.defineProperty(this, 'getAllResponseHeaders', {
                value: () => headerString,
                configurable: true
              })

              const headerMap = new Map(modifications.responseHeaders.map(h => [h.name.toLowerCase(), h.value]))
              Object.defineProperty(this, 'getResponseHeader', {
                value: (name: string) => headerMap.get(name.toLowerCase()) || null,
                configurable: true
              })

              // Update responseHeaders for logging
              responseHeaders = modifications.responseHeaders
            }

            // Update UI with modified response
            if (callbacks?.onResponse) {
              callbacks.onResponse(data.id, {
                status: this.status,
                statusText: this.statusText,
                headers: responseHeaders,
                body: responseBody,
                size: responseBody?.length || 0,
                duration
              })
            }
          }
          
          // ✅ NOW call stored app handlers (they see modified data)
          callStoredHandlers(this, data)
        } else {
          // No breakpoint match - notify UI normally
          // Check for status 0 which indicates CORS or network error
          if (this.status === 0 && callbacks?.onError) {
            callbacks.onError(data.id, 'Network error (CORS blocked or connection failed)')
          } else if (callbacks?.onResponse && !isPaused) {
            callbacks.onResponse(data.id, {
              status: this.status,
              statusText: this.statusText,
              headers: responseHeaders,
              body: truncated ? bodyText : responseBody,
              size,
              duration
            })
          }
          // Call stored app handlers
          callStoredHandlers(this, data)
        }
      } else {
        // No breakpoint check available - notify UI normally
        // Check for status 0 which indicates CORS or network error
        if (this.status === 0 && callbacks?.onError) {
          callbacks.onError(data.id, 'Network error (CORS blocked or connection failed)')
        } else if (callbacks?.onResponse && !isPaused) {
          callbacks.onResponse(data.id, {
            status: this.status,
            statusText: this.statusText,
            headers: responseHeaders,
            body: truncated ? bodyText : responseBody,
            size,
            duration
          })
        }
        // Call stored app handlers
        callStoredHandlers(this, data)
      }
    })
    
    // Listen for errors - use original addEventListener
    originalXHRAddEventListener.call(xhr, 'error', function(this: XMLHttpRequest) {
      if (callbacks?.onError) {
        // Try to get more specific error info
        let errorMessage = 'XMLHttpRequest failed'
        
        // If status is available, include it
        if (this.status > 0) {
          errorMessage = `HTTP ${this.status}: ${this.statusText || 'Error'}`
        } else if (this.status === 0) {
          // Status 0 usually means CORS error or network failure
          errorMessage = 'Network error (CORS blocked or connection failed)'
        }
        
        callbacks.onError(data.id, errorMessage)
      }
      // Call stored error handlers
      callStoredErrorHandlers(xhr, data)
    })
    
    originalXHRAddEventListener.call(xhr, 'abort', function() {
      if (callbacks?.onError) {
        callbacks.onError(data.id, 'Request aborted')
      }
    })
    
    originalXHRAddEventListener.call(xhr, 'timeout', function() {
      if (callbacks?.onError) {
        callbacks.onError(data.id, 'Request timed out')
      }
    })
  }
  
  /**
   * Call stored load and readystatechange handlers
   * This is called AFTER breakpoint is resolved and modifications are applied
   */
  function callStoredHandlers(xhr: XMLHttpRequest, data: XHRData): void {
    // Create a synthetic load event
    const loadEvent = new ProgressEvent('load', {
      lengthComputable: true,
      loaded: xhr.response?.length || 0,
      total: xhr.response?.length || 0
    })
    
    // Call all stored load handlers
    for (const handler of data.loadHandlers) {
      try {
        if (typeof handler === 'function') {
          handler.call(xhr, loadEvent)
        } else if (handler && typeof handler.handleEvent === 'function') {
          handler.handleEvent(loadEvent)
        }
      } catch (err) {
        console.error('[VueInspector Interceptor] Error calling load handler:', err)
      }
    }
    
    // Call readystatechange handlers (readyState should be 4 = DONE)
    const readystateEvent = new Event('readystatechange')
    for (const handler of data.readystatechangeHandlers) {
      try {
        if (typeof handler === 'function') {
          handler.call(xhr, readystateEvent)
        } else if (handler && typeof handler.handleEvent === 'function') {
          handler.handleEvent(readystateEvent)
        }
      } catch (err) {
        console.error('[VueInspector Interceptor] Error calling readystatechange handler:', err)
      }
    }
  }
  
  /**
   * Call stored error handlers
   */
  function callStoredErrorHandlers(xhr: XMLHttpRequest, data: XHRData): void {
    const errorEvent = new ProgressEvent('error')
    
    for (const handler of data.errorHandlers) {
      try {
        if (typeof handler === 'function') {
          handler.call(xhr, errorEvent)
        } else if (handler && typeof handler.handleEvent === 'function') {
          handler.handleEvent(errorEvent)
        }
      } catch (err) {
        console.error('[VueInspector Interceptor] Error calling error handler:', err)
      }
    }
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
    hasOnBreakpointHit: !!cbs.onBreakpointHit,
    hasOnMockCheck: !!cbs.onMockCheck,
    hasOnMockApplied: !!cbs.onMockApplied
  })
  
  callbacks = cbs
  if (maxSize) {
    maxBodySize = maxSize
  }
  
  interceptFetch()
  interceptXHR()
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
  
  // Restore responseType descriptor
  if (originalXHRResponseTypeDescriptor) {
    Object.defineProperty(XMLHttpRequest.prototype, 'responseType', originalXHRResponseTypeDescriptor)
  }
  
  callbacks = null
  
  // Cancel all pending breakpoints
  breakpointResolvers.forEach((pending, id) => {
    pending.reject(new Error('Interceptor cleanup'))
  })
  breakpointResolvers.clear()
}