import type { BaseInspectorSettings, FavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, SearchSettings } from '@/types/inspector'

export type InspectorSettings = BaseInspectorSettings
export type { FavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, SearchSettings }

/** Default search settings shared as a base for each module */
const defaultSearchSettings: SearchSettings = {
    byName: true,
    byLabel: true,
    byRootElement: true,
    byKey: false,
    byValue: false,
    debounce: 300,
    minLength: 2,
}

export const defaultInspectorSettings: InspectorSettings = {
    blacklist: { active: [], inactive: [] },
    favorites: [],
    breakpoints: { active: [], inactive: [] },
    mocks: { active: [], inactive: [] },
    networkSearch: { ...defaultSearchSettings },
    propsSearch: { ...defaultSearchSettings },
    piniaSearch: { ...defaultSearchSettings },
    json: { mode: 'text' },
    updates: { refreshIntervalMs: 1000, autoRefresh: false, autoRefreshInterval: 5000 },
    data: { maxComponents: 1000, preserveState: true },
    version: '2.2.0'
}
