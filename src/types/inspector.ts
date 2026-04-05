export interface FavoriteItem {
    id: string
    /** Session-specific node uid for exact same-session matching */
    nodeId?: string
    tagName: string
    className?: string
    name: string
    timestamp: string
}

/** Pinia store favorite - identified by store name */
export interface PiniaFavoriteItem {
    /** Store name (used as identifier) */
    id: string
    /** Store ID for exact matching */
    storeId?: string
    /** Store name (display) */
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

/** Breakpoint with active/inactive status for UI display */
export type BreakpointWithStatus = BreakpointItem & { isActive: boolean }

/** Mock rule with active/inactive status for UI display */
export type MockWithStatus = MockRule & { isActive: boolean }

export interface SearchIndexEntry {
    storeId: string
    baseId: string
    type: 'state' | 'getter'
    key: string
    value: any
    valueStr: string
}

/** Network table column visibility */
export interface NetworkTableColumnsSettings {
    status: boolean
    method: boolean
    name: boolean
    path: boolean
    time: boolean
    size: boolean
}

/** Props table column visibility */
export interface PropsTableColumnsSettings {
    name: boolean
    rootElement: boolean
    propsReceived: boolean
    propsDeclared: boolean
}

/** Pinia table column visibility */
export interface PiniaTableColumnsSettings {
    name: boolean
    state: boolean
    getters: boolean
}

/** Network tab search settings */
export interface NetworkSearchSettings {
    /** Search in list column "Name" (short label from URL). Default off. */
    byName: boolean
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

/**
 * Network tab capture: page hooks only (CORS-filtered headers) vs extension webRequest (full headers).
 */
export type NetworkCaptureMode = 'saved' | 'advanced'

/** Open external trace/monitoring URL from a header value ({value} in template) */
export interface NetworkHeaderLinkRule {
    id: string
    /** Header name, matched case-insensitively */
    headerName: string
    /** Request URL host this rule applies to (e.g. api.example.com) */
    host: string
    /** URL template; use {value} for the header value */
    urlTemplate: string
    /**
     * Optional RegExp (pattern as for `new RegExp(pattern)`).
     * When set, the substring for `{value}` is the first capturing group if present, else the full match;
     * if the pattern does not match or is invalid, the raw header value is used.
     */
    valueExtractRegex?: string
    /**
     * Optional transform pipeline after extraction: steps separated by `|`, e.g. replace("-", "") | lowercase().
     */
    valueTransform?: string
    /** ISO timestamp */
    addedAt: string
}

export type NetworkPinnedHeaderScope = 'request' | 'response'

export interface NetworkPinnedHeaderItem {
    id: string
    /** Header name (matched case-insensitively) */
    name: string
    scope: NetworkPinnedHeaderScope
}

/** Draft row while editing header link rules (Options / Network) */
export interface HeaderLinkRuleRowDraft {
    id: string | null
    host: string
    urlTemplate: string
    valueExtractRegex: string
    valueTransform: string
    addedAt: string | null
}

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

/** Entry in the site whitelist / blacklist for Auto Run */
export interface SiteListEntry {
    id: string
    /**
     * Matched against location.origin (scheme + host, incl. www + port). Path in the pattern is ignored.
     * Use a full URL (e.g. https://app.example/) or wildcards (e.g. *localhost*, http://localhost*).
     */
    pattern: string
    /** ISO timestamp when added */
    addedAt: string
}

/** Auto Run settings — gate overlay pill display per-site */
export interface AutoRunSettings {
    advancedMode: boolean
    siteBlacklist: SiteListEntry[]
    siteWhitelist: SiteListEntry[]
}

export interface BaseInspectorSettings {
    theme: ThemeMode
    displayMode: DisplayMode
    blacklist: { active: string[]; inactive: string[] }
    favorites: FavoriteItem[]
    /** Pinia store favorites (by store name) */
    piniaFavorites: PiniaFavoriteItem[]
    breakpoints: { active: BreakpointItem[]; inactive: BreakpointItem[] }
    /** Mock rules for Map Local feature - intercept requests and return fake responses */
    mocks: { active: MockRule[]; inactive: MockRule[] }
    /** Network table column visibility */
    networkTableColumns?: NetworkTableColumnsSettings
    /** Props table column visibility */
    propsTableColumns?: PropsTableColumnsSettings
    /** Pinia table column visibility */
    piniaTableColumns?: PiniaTableColumnsSettings
    /** @deprecated Kept for migration from older versions */
    search?: any
    /** Network tab search settings */
    networkSearch: NetworkSearchSettings
    /** Network capture: saved (Classic) = page-visible headers only; advanced = full request/response headers via webRequest */
    networkCaptureMode: NetworkCaptureMode
    /** Header → external link rules (Advanced headers UI + Options) */
    networkHeaderLinks: NetworkHeaderLinkRule[]
    /** Pinned headers per scope (Advanced Network only), in display order */
    networkPinnedHeaders: NetworkPinnedHeaderItem[]
    /** Props tab search settings */
    propsSearch: PropsSearchSettings
    /**
     * Overlay mode: collapse the inspector iframe while Props Inspect (element picker) is active.
     * Default true; restore panel when pick ends (Esc / selection).
     */
    collapseOverlayOnPropsInspect: boolean
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
    /** Auto Run: site whitelist/blacklist to control overlay pill visibility */
    autoRun?: AutoRunSettings
}
