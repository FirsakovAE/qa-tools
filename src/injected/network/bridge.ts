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
// Inline Utility Functions
// ============================================================================

function extractUrlName(url: string): string {
  try {
    const urlObj = new URL(url)
    const segments = urlObj.pathname.split('/').filter(Boolean)
    return segments.length > 0 ? segments[segments.length - 1] : urlObj.host
  } catch {
    return url.substring(0, 50)
  }
}

function extractUrlPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function parseUrlParams(url: string): UrlParam[] {
  try {
    const urlObj = new URL(url)
    const params: UrlParam[] = []
    urlObj.searchParams.forEach((value, key) => params.push({ key, value }))
    return params
  } catch {
    return []
  }
}

function extractAuthorization(headers: HeaderEntry[]): AuthorizationInfo {
  const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization')
  
  if (!authHeader) {
    const apiKeyHeader = headers.find(h => 
      h.name.toLowerCase().includes('api-key') || h.name.toLowerCase().includes('x-api-key')
    )
    if (apiKeyHeader) {
      return { type: 'ApiKey', token: apiKeyHeader.value, headerName: apiKeyHeader.name }
    }
    return { type: 'None' }
  }
  
  const value = authHeader.value
  
  if (value.startsWith('Bearer ')) {
    return { type: 'Bearer', token: value.substring(7) }
  }
  
  if (value.startsWith('Basic ')) {
    try {
      const decoded = atob(value.substring(6))
      const [username] = decoded.split(':')
      return { type: 'Basic', token: value.substring(6), username }
    } catch {
      return { type: 'Basic', token: value.substring(6) }
    }
  }
  
  return { type: 'Custom', token: value }
}

function isBinaryContentType(contentType: string): boolean {
  const binaryTypes = ['image/', 'audio/', 'video/', 'application/octet-stream', 'application/pdf', 'application/zip', 'application/gzip', 'application/x-tar']
  return binaryTypes.some(type => contentType.toLowerCase().startsWith(type))
}

/**
 * Convert wildcard pattern to regex
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

// ============================================================================
// Module State
// ============================================================================

const pendingRequests = new Map<string, Partial<NetworkEntry>>()
let entries: NetworkEntry[] = []
let config: NetworkConfig = {
  maxEntries: 500,
  maxBodySize: 100 * 1024,
  captureRequestBody: true,
  captureResponseBody: true
}

let activeBreakpoints: BreakpointConfig[] = []
let activeMocks: MockConfig[] = []

// ============================================================================
// URL Matching (shared by breakpoints and mocks)
// ============================================================================

function matchUrl(url: string, pattern: { scheme?: string; host?: string; port?: string; path?: string; query?: string }): boolean {
  try {
    const urlObj = new URL(url)
    
    if (pattern.scheme && urlObj.protocol.replace(':', '') !== pattern.scheme) return false
    if (pattern.host && !patternToRegex(pattern.host).test(urlObj.hostname)) return false
    if (pattern.port) {
      const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
      if (urlPort !== pattern.port) return false
    }
    if (pattern.path) {
      const pathRegex = new RegExp(`^${pattern.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`, 'i')
      if (!pathRegex.test(urlObj.pathname)) return false
    }
    if (pattern.query) {
      const queryRegex = new RegExp(pattern.query.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'), 'i')
      const search = urlObj.search ? urlObj.search.substring(1) : ''
      if (!queryRegex.test(search)) return false
    }
    
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Breakpoint Logic
// ============================================================================

function checkBreakpoint(url: string, trigger: 'request' | 'response'): BreakpointMatch | null {
  for (const bp of activeBreakpoints) {
    if (!bp.enabled) continue
    if (bp.trigger !== 'both' && bp.trigger !== trigger) continue
    if (matchUrl(url, bp)) {
      return { breakpointId: bp.id, trigger }
    }
  }
  return null
}

function handleBreakpointHit(requestId: string, breakpointId: string, trigger: 'request' | 'response'): void {
  const entry = pendingRequests.get(requestId)
  sendToContentScript('NETWORK_BREAKPOINT_HIT', { requestId, breakpointId, trigger, entry: entry || null })
}

// ============================================================================
// Mock Logic
// ============================================================================

function checkMock(url: string, method: string): MockMatch | null {
  for (const mock of activeMocks) {
    if (!mock.enabled) continue
    if (mock.method && mock.method.toUpperCase() !== method.toUpperCase()) continue
    if (matchUrl(url, mock)) {
      return { mockId: mock.id, mock }
    }
  }
  return null
}

function handleMockApplied(requestId: string, mockId: string): void {
  sendToContentScript('NETWORK_MOCK_APPLIED', { requestId, mockId })
}

// ============================================================================
// IPC Communication
// ============================================================================

function sendToContentScript(type: string, data: any): void {
  window.postMessage({ type, __FROM_VUE_INSPECTOR__: true, __NETWORK__: true, ...data }, '*')
}

function createBodyContent(body: string | null, contentType: string, originalSize: number, truncated = false): BodyContent | null {
  if (body === null) return null
  const isBinary = isBinaryContentType(contentType)
  return { text: isBinary ? '' : body, truncated, originalSize, contentType, isBinary }
}

// ============================================================================
// Request/Response Handlers
// ============================================================================

function handleRequest(request: PendingRequest): void {
  const contentType = request.requestHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value || ''
  
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
      ? createBodyContent(request.requestBody, contentType, request.requestBody.length)
      : null,
    responseBody: null,
    pending: true,
    initiator: 'fetch'
  }
  
  pendingRequests.set(request.id, entry)
  sendToContentScript('NETWORK_ENTRY_CAPTURED', { entry })
}

function handleResponse(id: string, response: ResponseData): void {
  const pendingEntry = pendingRequests.get(id)
  if (!pendingEntry) return
  
  const contentType = response.headers.find(h => h.name.toLowerCase() === 'content-type')?.value || ''
  
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
      ? createBodyContent(response.body, contentType, response.size, response.body.length < response.size)
      : null,
    pending: false,
    initiator: pendingEntry.initiator || 'fetch'
  }
  
  pendingRequests.delete(id)
  entries.push(completedEntry)
  if (entries.length > config.maxEntries) {
    entries = entries.slice(-config.maxEntries)
  }
  sendToContentScript('NETWORK_ENTRY_UPDATED', { entry: completedEntry })
}

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
  entries.push(errorEntry)
  if (entries.length > config.maxEntries) {
    entries = entries.slice(-config.maxEntries)
  }
  sendToContentScript('NETWORK_ENTRY_UPDATED', { entry: errorEntry })
}

// ============================================================================
// Message Handler
// ============================================================================

function handleMessage(event: MessageEvent): void {
  if (event.source !== window || !event.data) return
  
  const { type, __VUE_INSPECTOR__, __NETWORK_CMD__ } = event.data
  if (!__VUE_INSPECTOR__ || !__NETWORK_CMD__) return
  
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
      
    case 'NETWORK_BREAKPOINTS_SYNC':
      if (Array.isArray(event.data.breakpoints)) {
        activeBreakpoints = event.data.breakpoints
        sendToContentScript('NETWORK_BREAKPOINTS_SYNCED', {
          count: activeBreakpoints.length,
          breakpoints: activeBreakpoints.map(bp => ({ id: bp.id, host: bp.host, path: bp.path }))
        })
      }
      break
      
    case 'NETWORK_MOCKS_SYNC':
      if (Array.isArray(event.data.mocks)) {
        activeMocks = event.data.mocks
        sendToContentScript('NETWORK_MOCKS_SYNCED', {
          count: activeMocks.length,
          mocks: activeMocks.map(m => ({ id: m.id, host: m.host, path: m.path, status: m.status }))
        })
      }
      break
      
    case 'NETWORK_BREAKPOINT_RESUME':
      if (event.data.requestId) {
        const success = resumeBreakpoint(event.data.requestId, event.data.modifications)
        sendToContentScript('NETWORK_BREAKPOINT_RESUMED', { requestId: event.data.requestId, success })
      }
      break
      
    case 'NETWORK_BREAKPOINT_CANCEL':
      if (event.data.requestId) {
        const success = cancelBreakpoint(event.data.requestId)
        sendToContentScript('NETWORK_BREAKPOINT_CANCELLED', { requestId: event.data.requestId, success })
      }
      break
  }
}

// ============================================================================
// Module Lifecycle
// ============================================================================

export function initNetworkModule(): void {
  window.addEventListener('message', handleMessage)
  
  initNetworkInterceptor({
    onRequest: handleRequest,
    onResponse: handleResponse,
    onError: handleError,
    onBreakpointCheck: checkBreakpoint,
    onBreakpointHit: handleBreakpointHit,
    onMockCheck: checkMock,
    onMockApplied: handleMockApplied
  }, config.maxBodySize)
  
  sendToContentScript('NETWORK_READY', { paused: isInterceptionPaused(), entriesCount: entries.length })
  sendToContentScript('NETWORK_STATUS', { paused: isInterceptionPaused(), entriesCount: entries.length })
}

export function cleanupNetworkModule(): void {
  window.removeEventListener('message', handleMessage)
  cleanupNetworkInterceptor()
  entries = []
  pendingRequests.clear()
  activeBreakpoints = []
  activeMocks = []
}
