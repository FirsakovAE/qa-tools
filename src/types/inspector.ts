export interface FavoriteItem {
    id: string
    tagName: string
    className?: string
    name: string
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
