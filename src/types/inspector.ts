export interface FavoriteItem {
    id: string
    tagName: string
    className?: string
    name: string
    timestamp: string
}

/**
 * Breakpoint trigger type - when to intercept
 */
export type BreakpointTrigger = 'request' | 'response' | 'both'

/**
 * Breakpoint item for network request interception
 */
export interface BreakpointItem {
    /** Unique identifier */
    id: string
    /** URL scheme (http, https, etc.) */
    scheme: string
    /** Protocol (HTTP/1.1, HTTP/2, etc.) - optional */
    protocol?: string
    /** Host (domain name) */
    host: string
    /** Port number (optional) */
    port?: string
    /** URL path */
    path: string
    /** Query string pattern (optional) */
    query?: string
    /** When to trigger: request, response, or both */
    trigger: BreakpointTrigger
    /** Whether this breakpoint is active */
    enabled: boolean
    /** Creation timestamp */
    timestamp: string
}

/**
 * Header entry for mock response
 */
export interface MockHeaderEntry {
    name: string
    value: string
}

/**
 * Mock rule for Map Local feature (like Charles Proxy)
 * Intercepts matching requests and returns synthetic response WITHOUT making real network call
 */
export interface MockRule {
    /** Unique identifier */
    id: string
    /** Whether this mock is enabled */
    enabled: boolean
    
    // URL matching (same as breakpoints)
    /** URL scheme (http, https) */
    scheme?: string
    /** Host pattern (supports * wildcard) */
    host?: string
    /** Port number */
    port?: string
    /** Path pattern (supports * wildcard) */
    path?: string
    /** Query pattern (supports * wildcard) */
    query?: string
    /** HTTP method (GET, POST, etc.) - optional, matches all if not set */
    method?: string
    
    // Response to return
    /** HTTP status code */
    status: number
    /** HTTP status text */
    statusText?: string
    /** Response headers */
    headers: MockHeaderEntry[]
    /** Response body (JSON string) - undefined means no body */
    body?: string
    
    /** Optional delay in ms before returning response (like Charles) */
    delay?: number
    
    /** Creation timestamp */
    timestamp: string
    /** Description/note for this mock */
    description?: string
}

export interface SearchIndexEntry {
    storeId: string
    baseId: string
    type: 'state' | 'getter'
    key: string
    value: any
    valueStr: string
}

export interface BaseInspectorSettings {
    blacklist: { active: string[]; inactive: string[] }
    favorites: FavoriteItem[]
    breakpoints: { active: BreakpointItem[]; inactive: BreakpointItem[] }
    /** Mock rules for Map Local feature - intercept requests and return fake responses */
    mocks: { active: MockRule[]; inactive: MockRule[] }
    search: {
        byName: boolean
        byLabel: boolean
        byRootElement: boolean
        byKey: boolean
        byValue: boolean
        debounce?: number
        minLength?: number
    }
    json: {
        mode: 'text' | 'tree'
    }
    updates?: { refreshIntervalMs?: number; autoRefresh?: boolean; autoRefreshInterval?: number }
    data?: { maxComponents?: number; preserveState?: boolean }
    version?: string
}
