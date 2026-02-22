import type { BaseInspectorSettings, FavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, NetworkSearchSettings, PropsSearchSettings, PiniaSearchSettings, GlobalSearchSettings, DisplayMode } from '@/types/inspector'

export type InspectorSettings = BaseInspectorSettings
export type { FavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, NetworkSearchSettings, PropsSearchSettings, PiniaSearchSettings, GlobalSearchSettings, DisplayMode }

/** Default Network search settings */
const defaultNetworkSearchSettings: NetworkSearchSettings = {
    byPath: true,
    byMethod: true,
    byStatus: false,
    byKey: false,
    byValue: false,
}

/** Default Props search settings */
const defaultPropsSearchSettings: PropsSearchSettings = {
    byName: true,
    byLabel: true,
    byRootElement: true,
    byKey: false,
    byValue: false,
}

/** Default Pinia search settings */
const defaultPiniaSearchSettings: PiniaSearchSettings = {
    byName: true,
    byKey: false,
    byValue: false,
}

/** Default global search parameters */
const defaultSearchParams: GlobalSearchSettings = {
    debounce: 300,
    minLength: 2,
}

export const defaultInspectorSettings: InspectorSettings = {
    displayMode: 'overlay',
    blacklist: { active: [], inactive: [] },
    favorites: [],
    breakpoints: { active: [], inactive: [] },
    mocks: { active: [], inactive: [] },
    networkSearch: { ...defaultNetworkSearchSettings },
    propsSearch: { ...defaultPropsSearchSettings },
    piniaSearch: { ...defaultPiniaSearchSettings },
    searchParams: { ...defaultSearchParams },
    json: { mode: 'text' },
    updates: { refreshIntervalMs: 1000, autoRefresh: false, autoRefreshInterval: 5000 },
    data: { maxComponents: 1000, preserveState: true },
}
