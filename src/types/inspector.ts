export interface FavoriteItem {
    id: string
    /** Session-specific node uid for exact same-session matching */
    nodeId?: string
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
    /** HTTP method (GET, POST, etc.) - optional, matches all if not set */
    method?: string
    /** When to trigger: request, response, or both */
    trigger: BreakpointTrigger
    /** Whether this breakpoint is active */
    enabled: boolean
    /** Creation timestamp */
    timestamp: string
    /** Description/note for this breakpoint */
    description?: string
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

/** Network tab search settings */
export interface NetworkSearchSettings {
    byPath: boolean
    byMethod: boolean
    byStatus: boolean
    byKey: boolean
    byValue: boolean
}

/** Props tab search settings */
export interface PropsSearchSettings {
    byName: boolean
    byLabel: boolean
    byRootElement: boolean
    byKey: boolean
    byValue: boolean
}

/** Pinia-specific search settings (no byLabel/byRootElement — not applicable to stores) */
export interface PiniaSearchSettings {
    byName: boolean
    byKey: boolean
    byValue: boolean
}

/** Global search parameters shared across all modules */
export interface GlobalSearchSettings {
    debounce: number
    minLength: number
}

export type DisplayMode = 'overlay' | 'devtools'

export type ThemeMode = 'dark' | 'light'

export type ImageSourceType = 'file' | 'link'

/** Standalone: wallpaper entry in IndexedDB wallpapers store */
export interface WallpaperEntry {
    id: string
    name: string
    size: number
    mimeType: string
}

export interface CustomizeSettings {
    image: {
        sourceType: ImageSourceType
        /** Currently selected URL (when sourceType is 'link') */
        url: string
        /** List of URLs added by user via Input - can add unlimited */
        urls: string[]
        savedFileId: string
        fileName: string
        /** Standalone: selected wallpaper id (key in IndexedDB wallpapers store) */
        wallpaperId?: string
        /** Standalone: list of wallpapers for picker (Blob in IndexedDB, key = id) */
        wallpapers?: WallpaperEntry[]
    }
    positionX: number
    positionY: number
    scale: number
    imageOpacity: number
    blur: number
}

export interface SavedFile {
    id: string
    name: string
    size: number
    mimeType: string
    /** @deprecated Stored in IndexedDB. Present only during migration from older versions. */
    dataUri?: string
}

export interface BaseInspectorSettings {
    theme: ThemeMode
    displayMode: DisplayMode
    blacklist: { active: string[]; inactive: string[] }
    favorites: FavoriteItem[]
    breakpoints: { active: BreakpointItem[]; inactive: BreakpointItem[] }
    /** Mock rules for Map Local feature - intercept requests and return fake responses */
    mocks: { active: MockRule[]; inactive: MockRule[] }
    /** @deprecated Kept for migration from older versions */
    search?: any
    /** Network tab search settings */
    networkSearch: NetworkSearchSettings
    /** Props tab search settings */
    propsSearch: PropsSearchSettings
    /** Pinia Store tab search settings */
    piniaSearch: PiniaSearchSettings
    /** Global search parameters (debounce, minLength) shared across all modules */
    searchParams: GlobalSearchSettings
    json: {
        mode: 'text' | 'tree'
    }
    updates?: { refreshIntervalMs?: number; autoRefresh?: boolean; autoRefreshInterval?: number }
    data?: { maxComponents?: number; preserveState?: boolean }
    savedFiles: SavedFile[]
    autoSaveFiles: boolean
    customize: CustomizeSettings
}
