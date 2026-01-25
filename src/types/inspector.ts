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
