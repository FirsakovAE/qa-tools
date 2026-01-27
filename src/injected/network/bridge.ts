/**
 * Network Bridge Module
 * Handles communication between injected script and content script
 * 
 * NOTE: This module must be completely self-contained (no external imports from @/types)
 * to prevent Vite from code-splitting it into a separate chunk.
 */

import type { PendingRequest, ResponseData, BreakpointConfig, BreakpointMatch, MockConfig, MockMatch } from './types'
import {
  initNetworkInterceptor,
  pauseInterception,
  resumeInterception,
  cleanupNetworkInterceptor,
  isInterceptionPaused,
  resumeBreakpoint,
  cancelBreakpoint,
  hasActiveBreakpoint,
  getActiveBreakpointIds
} from './interceptor'

// ============================================================================
// Inline Types (to avoid cross-bundle imports)
// ============================================================================

interface HeaderEntry {
  name: string
  value: string
}

interface AuthorizationInfo {
  type: 'Bearer' | 'Basic' | 'ApiKey' | 'Custom' | 'None'
  token?: string
  username?: string
  headerName?: string
}

interface UrlParam {
  key: string
  value: string
}

interface BodyContent {
  text: string
  truncated: boolean
  originalSize: number
  contentType: string
  isBinary: boolean
}

interface NetworkEntry {
  id: string
  version: number
  timestamp: string
  method: string
  url: string
  path: string
  name: string
  status: number
  statusText: string
  duration: number
  size: number
  requestHeaders: HeaderEntry[]
  responseHeaders: HeaderEntry[]
  params: UrlParam[]
  authorization: AuthorizationInfo
  requestBody: BodyContent | null
  responseBody: BodyContent | null
  error?: string
  pending: boolean
  initiator: 'fetch' | 'xhr'
}

interface NetworkConfig {
  maxEntries: number
  maxBodySize: number
  captureRequestBody: boolean
  captureResponseBody: boolean
}

// ============================================================================
// Inline Utility Functions (to avoid cross-bundle imports)
// ============================================================================

function extractUrlName(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      return segments[segments.length - 1]
    }
    return urlObj.host
  } catch {
    return url.substring(0, 50)
  }
}

function extractUrlPath(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname
  } catch {
    return url
  }
}

function parseUrlParams(url: string): UrlParam[] {
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

function extractAuthorization(headers: HeaderEntry[]): AuthorizationInfo {
  const authHeader = headers.find(
    h => h.name.toLowerCase() === 'authorization'
  )
  
  if (!authHeader) {
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
    try {
      const decoded = atob(value.substring(6))
      const [username] = decoded.split(':')
      return {
        type: 'Basic',
        token: value.substring(6),
        username
      }
    } catch {
      return {
        type: 'Basic',
        token: value.substring(6)
      }
    }
  }
  
  return {
    type: 'Custom',
    token: value
  }
}

function isBinaryContentType(contentType: string): boolean {
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

// ============================================================================
// Module State
// ============================================================================

// Store pending requests for response matching
const pendingRequests = new Map<string, Partial<NetworkEntry>>()

// Store completed entries
let entries: NetworkEntry[] = []

// Configuration
let config: NetworkConfig = {
  maxEntries: 500,
  maxBodySize: 100 * 1024,
  captureRequestBody: true,
  captureResponseBody: true
}

// ============================================================================
// Breakpoint Configuration State
// ============================================================================

// Active breakpoints (synced from UI settings)
let activeBreakpoints: BreakpointConfig[] = []

// ============================================================================
// Mock (Map Local) Configuration State
// ============================================================================

// Active mocks (synced from UI settings)
let activeMocks: MockConfig[] = []

/**
 * Match URL against a breakpoint pattern
 */
function matchUrlToBreakpoint(url: string, breakpoint: BreakpointConfig): boolean {
  try {
    const urlObj = new URL(url)
    
    console.log('[VueInspector Network] Matching URL:', {
      scheme: urlObj.protocol.replace(':', ''),
      host: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
      path: urlObj.pathname,
      query: urlObj.search ? urlObj.search.substring(1) : ''
    })
    
    // Check scheme (http, https)
    if (breakpoint.scheme) {
      const urlScheme = urlObj.protocol.replace(':', '')
      if (urlScheme !== breakpoint.scheme) {
        console.log('[VueInspector Network] ❌ Scheme mismatch:', urlScheme, '!==', breakpoint.scheme)
        return false
      }
    }
    
    // Check host (supports wildcard *)
    if (breakpoint.host) {
      const hostPattern = breakpoint.host
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '.*') // Convert * to .*
      const hostRegex = new RegExp(`^${hostPattern}$`, 'i')
      if (!hostRegex.test(urlObj.hostname)) {
        console.log('[VueInspector Network] ❌ Host mismatch:', urlObj.hostname, 'vs pattern', breakpoint.host)
        return false
      }
    }
    
    // Check port
    if (breakpoint.port) {
      const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
      if (urlPort !== breakpoint.port) {
        console.log('[VueInspector Network] ❌ Port mismatch:', urlPort, '!==', breakpoint.port)
        return false
      }
    }
    
    // Check path (supports wildcard *)
    if (breakpoint.path) {
      const pathPattern = breakpoint.path
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '.*') // Convert * to .*
      const pathRegex = new RegExp(`^${pathPattern}`, 'i') // Starts with (partial match allowed)
      if (!pathRegex.test(urlObj.pathname)) {
        console.log('[VueInspector Network] ❌ Path mismatch:', urlObj.pathname, 'vs pattern', breakpoint.path)
        return false
      }
    }
    
    // Check query (if specified, use partial match)
    if (breakpoint.query) {
      const queryPattern = breakpoint.query
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      const queryRegex = new RegExp(queryPattern, 'i')
      const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : ''
      if (!queryRegex.test(searchWithoutPrefix)) {
        console.log('[VueInspector Network] ❌ Query mismatch:', searchWithoutPrefix, 'vs pattern', breakpoint.query)
        return false
      }
    }
    
    console.log('[VueInspector Network] ✅ All checks passed!')
    return true
  } catch (e) {
    console.log('[VueInspector Network] ❌ URL parse error:', e)
    return false
  }
}

/**
 * Check if a URL matches any active breakpoint for the given trigger
 */
function checkBreakpoint(url: string, trigger: 'request' | 'response'): BreakpointMatch | null {
  // Debug: log check attempt
  if (activeBreakpoints.length > 0) {
    console.log('[VueInspector Network] Checking breakpoint for:', url, 'trigger:', trigger, 'active breakpoints:', activeBreakpoints.length)
  }
  
  for (const bp of activeBreakpoints) {
    // Debug: show breakpoint details
    console.log('[VueInspector Network] Checking against breakpoint:', {
      id: bp.id,
      scheme: bp.scheme,
      host: bp.host,
      port: bp.port,
      path: bp.path,
      query: bp.query,
      trigger: bp.trigger,
      enabled: bp.enabled
    })
    
    if (!bp.enabled) {
      console.log('[VueInspector Network] ❌ Breakpoint disabled')
      continue
    }
    
    // Check if trigger matches
    const triggerMatches = bp.trigger === 'both' || bp.trigger === trigger
    if (!triggerMatches) {
      console.log('[VueInspector Network] ❌ Trigger mismatch:', bp.trigger, 'vs', trigger)
      continue
    }
    
    // Check URL match with detailed logging
    const urlMatches = matchUrlToBreakpoint(url, bp)
    console.log('[VueInspector Network] URL match result:', urlMatches)
    
    if (urlMatches) {
      console.log('[VueInspector Network] 🛑 BREAKPOINT MATCH!', bp.id, 'for', url)
      return {
        breakpointId: bp.id,
        trigger
      }
    }
  }
  return null
}

/**
 * Handle breakpoint hit notification
 */
function handleBreakpointHit(requestId: string, breakpointId: string, trigger: 'request' | 'response'): void {
  // Find the pending entry to get full details
  const entry = pendingRequests.get(requestId)
  
  sendToContentScript('NETWORK_BREAKPOINT_HIT', {
    requestId,
    breakpointId,
    trigger,
    entry: entry || null
  })
}

// ============================================================================
// Mock (Map Local) Matching
// ============================================================================

/**
 * Match URL against a mock pattern (same logic as breakpoint matching)
 */
function matchUrlToMock(url: string, method: string, mock: MockConfig): boolean {
  try {
    const urlObj = new URL(url)
    
    // Check method first (if specified)
    if (mock.method && mock.method.toUpperCase() !== method.toUpperCase()) {
      return false
    }
    
    // Check scheme (http, https)
    if (mock.scheme) {
      const urlScheme = urlObj.protocol.replace(':', '')
      if (urlScheme !== mock.scheme) {
        return false
      }
    }
    
    // Check host (supports wildcard *)
    if (mock.host) {
      const hostPattern = mock.host
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      const hostRegex = new RegExp(`^${hostPattern}$`, 'i')
      if (!hostRegex.test(urlObj.hostname)) {
        return false
      }
    }
    
    // Check port
    if (mock.port) {
      const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
      if (urlPort !== mock.port) {
        return false
      }
    }
    
    // Check path (supports wildcard *)
    if (mock.path) {
      const pathPattern = mock.path
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      const pathRegex = new RegExp(`^${pathPattern}`, 'i')
      if (!pathRegex.test(urlObj.pathname)) {
        return false
      }
    }
    
    // Check query (if specified, use partial match)
    if (mock.query) {
      const queryPattern = mock.query
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      const queryRegex = new RegExp(queryPattern, 'i')
      const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : ''
      if (!queryRegex.test(searchWithoutPrefix)) {
        return false
      }
    }
    
    return true
  } catch (e) {
    console.log('[VueInspector Network] ❌ Mock URL parse error:', e)
    return false
  }
}

/**
 * Check if a URL matches any active mock (Map Local)
 * Returns MockMatch if found, null otherwise
 */
function checkMock(url: string, method: string): MockMatch | null {
  console.log('[VueInspector Network] checkMock called:', url, 'method:', method, 'activeMocks count:', activeMocks.length)
  
  if (activeMocks.length === 0) {
    return null
  }
  
  for (const mock of activeMocks) {
    console.log('[VueInspector Network] Checking against mock:', {
      id: mock.id,
      enabled: mock.enabled,
      host: mock.host,
      path: mock.path
    })
    
    if (!mock.enabled) {
      console.log('[VueInspector Network] Mock disabled, skipping')
      continue
    }
    
    const matches = matchUrlToMock(url, method, mock)
    console.log('[VueInspector Network] Match result:', matches)
    
    if (matches) {
      console.log('[VueInspector Network] 🎭 MOCK MATCH!', mock.id, 'for', url)
      console.log('[VueInspector Network] 🎭 Returning mock with body length:', mock.body?.length)
      return {
        mockId: mock.id,
        mock
      }
    }
  }
  
  console.log('[VueInspector Network] No mock match found')
  return null
}

/**
 * Handle mock applied notification (for UI logging)
 */
function handleMockApplied(requestId: string, mockId: string): void {
  sendToContentScript('NETWORK_MOCK_APPLIED', {
    requestId,
    mockId
  })
}

// ============================================================================
// IPC Communication
// ============================================================================

/**
 * Send message to content script
 */
function sendToContentScript(type: string, data: any): void {
  window.postMessage({
    type,
    __FROM_VUE_INSPECTOR__: true,
    __NETWORK__: true,
    ...data
  }, '*')
}

/**
 * Create body content object
 */
function createBodyContent(
  body: string | null,
  contentType: string,
  originalSize: number,
  truncated: boolean = false
): BodyContent | null {
  if (body === null) {
    return null
  }
  
  const isBinary = isBinaryContentType(contentType)
  
  return {
    text: isBinary ? '' : body,
    truncated,
    originalSize,
    contentType,
    isBinary
  }
}

// ============================================================================
// Request/Response Handlers
// ============================================================================

/**
 * Handle new request from interceptor
 */
function handleRequest(request: PendingRequest): void {
  const contentType = request.requestHeaders.find(
    h => h.name.toLowerCase() === 'content-type'
  )?.value || ''
  
  const entry: Partial<NetworkEntry> = {
    id: request.id,
    version: 1,
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    path: extractUrlPath(request.url),
    name: extractUrlName(request.url),
    status: 0,
    statusText: '',
    duration: 0,
    size: 0,
    requestHeaders: request.requestHeaders,
    responseHeaders: [],
    params: parseUrlParams(request.url),
    authorization: extractAuthorization(request.requestHeaders),
    requestBody: config.captureRequestBody && request.requestBody
      ? createBodyContent(
          request.requestBody,
          contentType,
          request.requestBody.length
        )
      : null,
    responseBody: null,
    pending: true,
    initiator: 'fetch'
  }
  
  pendingRequests.set(request.id, entry)
  
  // Send to UI
  sendToContentScript('NETWORK_ENTRY_CAPTURED', { entry })
}

/**
 * Handle response from interceptor
 */
function handleResponse(id: string, response: ResponseData): void {
  const pendingEntry = pendingRequests.get(id)
  if (!pendingEntry) return
  
  const contentType = response.headers.find(
    h => h.name.toLowerCase() === 'content-type'
  )?.value || ''
  
  const completedEntry: NetworkEntry = {
    ...pendingEntry,
    id,
    version: (pendingEntry.version || 1) + 1,
    timestamp: pendingEntry.timestamp || new Date().toISOString(),
    method: pendingEntry.method || 'GET',
    url: pendingEntry.url || '',
    path: pendingEntry.path || extractUrlPath(pendingEntry.url || ''),
    name: pendingEntry.name || '',
    status: response.status,
    statusText: response.statusText,
    duration: response.duration,
    size: response.size,
    requestHeaders: pendingEntry.requestHeaders || [],
    responseHeaders: response.headers,
    params: pendingEntry.params || [],
    authorization: pendingEntry.authorization || { type: 'None' },
    requestBody: pendingEntry.requestBody || null,
    responseBody: config.captureResponseBody && response.body
      ? createBodyContent(
          response.body,
          contentType,
          response.size,
          response.body.length < response.size
        )
      : null,
    pending: false,
    initiator: pendingEntry.initiator || 'fetch'
  }
  
  pendingRequests.delete(id)
  
  // Add to entries with FIFO
  entries.push(completedEntry)
  if (entries.length > config.maxEntries) {
    entries = entries.slice(-config.maxEntries)
  }
  
  // Send to UI
  sendToContentScript('NETWORK_ENTRY_UPDATED', { entry: completedEntry })
}

/**
 * Handle error from interceptor
 */
function handleError(id: string, errorMessage: string): void {
  const pendingEntry = pendingRequests.get(id)
  if (!pendingEntry) return
  
  const errorEntry: NetworkEntry = {
    ...pendingEntry,
    id,
    version: (pendingEntry.version || 1) + 1,
    timestamp: pendingEntry.timestamp || new Date().toISOString(),
    method: pendingEntry.method || 'GET',
    url: pendingEntry.url || '',
    path: pendingEntry.path || extractUrlPath(pendingEntry.url || ''),
    name: pendingEntry.name || '',
    status: 0,
    statusText: 'Failed',
    duration: performance.now() - (pendingEntry as any).startTime || 0,
    size: 0,
    requestHeaders: pendingEntry.requestHeaders || [],
    responseHeaders: [],
    params: pendingEntry.params || [],
    authorization: pendingEntry.authorization || { type: 'None' },
    requestBody: pendingEntry.requestBody || null,
    responseBody: null,
    error: errorMessage,
    pending: false,
    initiator: pendingEntry.initiator || 'fetch'
  }
  
  pendingRequests.delete(id)
  
  // Add to entries with FIFO
  entries.push(errorEntry)
  if (entries.length > config.maxEntries) {
    entries = entries.slice(-config.maxEntries)
  }
  
  // Send to UI
  sendToContentScript('NETWORK_ENTRY_UPDATED', { entry: errorEntry })
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle messages from content script
 */
function handleMessage(event: MessageEvent): void {
  if (event.source !== window || !event.data) return
  
  const { type, __VUE_INSPECTOR__, __NETWORK_CMD__ } = event.data
  
  // Only handle network commands
  if (!__VUE_INSPECTOR__ || !__NETWORK_CMD__) return
  
  // Debug: log received commands
  if (type?.startsWith('NETWORK_BREAKPOINT') || type?.startsWith('NETWORK_MOCK')) {
    console.log('[VueInspector Network] Received command:', type, event.data)
  }
  
  switch (type) {
    case 'NETWORK_PAUSE':
      pauseInterception()
      sendToContentScript('NETWORK_PAUSED', { paused: true })
      break
      
    case 'NETWORK_RESUME':
      resumeInterception()
      sendToContentScript('NETWORK_RESUMED', { paused: false })
      break
      
    case 'NETWORK_CLEAR':
      entries = []
      pendingRequests.clear()
      sendToContentScript('NETWORK_CLEARED', {})
      break
      
    case 'NETWORK_GET_ENTRIES':
      sendToContentScript('NETWORK_ENTRIES_DATA', { entries })
      break
      
    case 'NETWORK_GET_STATUS':
      sendToContentScript('NETWORK_STATUS', { 
        paused: isInterceptionPaused(),
        entriesCount: entries.length,
        activeBreakpointIds: getActiveBreakpointIds()
      })
      break
      
    case 'NETWORK_CONFIG_UPDATE':
      if (event.data.config) {
        config = { ...config, ...event.data.config }
      }
      break
      
    // ========================================
    // BREAKPOINT COMMANDS
    // ========================================
    
    case 'NETWORK_BREAKPOINTS_SYNC':
      // Sync breakpoints from UI settings
      if (Array.isArray(event.data.breakpoints)) {
        activeBreakpoints = event.data.breakpoints
        // Debug: confirm sync received
        console.log('[VueInspector Network] Breakpoints synced:', activeBreakpoints.length, 'breakpoints')
        // Notify UI that sync was successful
        sendToContentScript('NETWORK_BREAKPOINTS_SYNCED', {
          count: activeBreakpoints.length,
          breakpoints: activeBreakpoints.map(bp => ({ id: bp.id, host: bp.host, path: bp.path }))
        })
      }
      break
      
    case 'NETWORK_MOCKS_SYNC':
      // Sync mocks from UI settings (Map Local feature)
      if (Array.isArray(event.data.mocks)) {
        activeMocks = event.data.mocks
        console.log('[VueInspector Network] 🎭 Mocks synced:', activeMocks.length, 'mocks')
        if (activeMocks.length > 0) {
          console.log('[VueInspector Network] 🎭 First mock details:', {
            id: activeMocks[0].id,
            enabled: activeMocks[0].enabled,
            host: activeMocks[0].host,
            path: activeMocks[0].path,
            status: activeMocks[0].status,
            bodyLength: activeMocks[0].body?.length,
            headersCount: activeMocks[0].headers?.length
          })
        }
        // Notify UI that sync was successful
        sendToContentScript('NETWORK_MOCKS_SYNCED', {
          count: activeMocks.length,
          mocks: activeMocks.map(m => ({ id: m.id, host: m.host, path: m.path, status: m.status }))
        })
      }
      break
      
    case 'NETWORK_BREAKPOINT_RESUME':
      // Resume a paused breakpoint
      if (event.data.requestId) {
        const success = resumeBreakpoint(event.data.requestId, event.data.modifications)
        sendToContentScript('NETWORK_BREAKPOINT_RESUMED', {
          requestId: event.data.requestId,
          success
        })
      }
      break
      
    case 'NETWORK_BREAKPOINT_CANCEL':
      // Cancel a paused breakpoint (abort the request)
      if (event.data.requestId) {
        const success = cancelBreakpoint(event.data.requestId)
        sendToContentScript('NETWORK_BREAKPOINT_CANCELLED', {
          requestId: event.data.requestId,
          success
        })
      }
      break
      
    case 'NETWORK_OVERRIDE_RESPONSE':
      // Store override for potential mocking (future feature)
      if (event.data.entryId && event.data.newResponse) {
        const entryIndex = entries.findIndex(e => e.id === event.data.entryId)
        if (entryIndex !== -1) {
          const oldEntry = entries[entryIndex]
          const updatedEntry: NetworkEntry = {
            ...oldEntry,
            version: oldEntry.version + 1,
            responseBody: oldEntry.responseBody ? {
              ...oldEntry.responseBody,
              text: event.data.newResponse,
              originalSize: event.data.newResponse.length
            } : null
          }
          entries[entryIndex] = updatedEntry
          sendToContentScript('NETWORK_ENTRY_UPDATED', { entry: updatedEntry })
        }
      }
      break
  }
}

// ============================================================================
// Module Lifecycle
// ============================================================================

/**
 * Initialize network module
 */
export function initNetworkModule(): void {
  console.log('[VueInspector Bridge] Initializing network module...')
  
  // Listen for commands
  window.addEventListener('message', handleMessage)
  
  // Initialize interceptor with breakpoint and mock (Map Local) support
  try {
    initNetworkInterceptor({
      onRequest: handleRequest,
      onResponse: handleResponse,
      onError: handleError,
      onBreakpointCheck: checkBreakpoint,
      onBreakpointHit: handleBreakpointHit,
      onMockCheck: checkMock,
      onMockApplied: handleMockApplied
    }, config.maxBodySize)
    console.log('[VueInspector Bridge] ✅ Interceptor initialized with Mock (Map Local) support')
  } catch (error) {
    console.error('[VueInspector Bridge] ❌ Failed to initialize interceptor:', error)
  }
  
  // Notify ready with initial status
  sendToContentScript('NETWORK_READY', { 
    paused: isInterceptionPaused(),
    entriesCount: entries.length
  })
  
  // Also send status immediately so UI gets initial state
  sendToContentScript('NETWORK_STATUS', { 
    paused: isInterceptionPaused(),
    entriesCount: entries.length
  })
}

/**
 * Cleanup network module
 */
export function cleanupNetworkModule(): void {
  window.removeEventListener('message', handleMessage)
  cleanupNetworkInterceptor()
  entries = []
  pendingRequests.clear()
  activeBreakpoints = []
  activeMocks = []
}
