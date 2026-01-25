import type { BaseInspectorSettings, FavoriteItem, BreakpointItem } from '@/types/inspector'

export type InspectorSettings = BaseInspectorSettings
export type { FavoriteItem, BreakpointItem }

export const defaultInspectorSettings: InspectorSettings = {
    blacklist: { active: [], inactive: [] },
    favorites: [],
    breakpoints: { active: [], inactive: [] },
    search: { byName: true, byLabel: true, byRootElement: true, byKey: false, byValue: false, debounce: 300, minLength: 2 },
    json: { mode: 'text' },
    updates: { refreshIntervalMs: 1000, autoRefresh: true, autoRefreshInterval: 5000 },
    data: { maxComponents: 1000, preserveState: true },
    version: '1.0.0'
}
