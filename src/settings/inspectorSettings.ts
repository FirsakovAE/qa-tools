import type { BaseInspectorSettings, FavoriteItem, PiniaFavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, NetworkSearchSettings, NetworkTableColumnsSettings, PropsTableColumnsSettings, PiniaTableColumnsSettings, PropsSearchSettings, PiniaSearchSettings, GlobalSearchSettings, DisplayMode, ThemeMode, SavedFile, CustomizeSettings, ImageSourceType, AutoRunSettings, SiteListEntry, NetworkCaptureMode, NetworkAdvancedHeaderPolicy, NetworkHeaderLinkRule, NetworkPinnedHeaderItem, NetworkPinnedHeaderScope } from '@/types/inspector'

export type InspectorSettings = BaseInspectorSettings
export type { FavoriteItem, PiniaFavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, NetworkSearchSettings, NetworkTableColumnsSettings, PropsTableColumnsSettings, PiniaTableColumnsSettings, PropsSearchSettings, PiniaSearchSettings, GlobalSearchSettings, DisplayMode, ThemeMode, SavedFile, CustomizeSettings, ImageSourceType, AutoRunSettings, SiteListEntry, NetworkCaptureMode, NetworkAdvancedHeaderPolicy, NetworkHeaderLinkRule, NetworkPinnedHeaderItem, NetworkPinnedHeaderScope }

/** Default Network table columns (all visible except Name) */
const defaultNetworkTableColumns: NetworkTableColumnsSettings = {
    status: true,
    method: true,
    name: false,
    path: true,
    time: true,
    size: true,
}

/** Default Props table columns (all visible) */
const defaultPropsTableColumns: PropsTableColumnsSettings = {
    name: true,
    rootElement: true,
    propsReceived: true,
    propsDeclared: true,
}

/** Default Pinia table columns (all visible) */
const defaultPiniaTableColumns: PiniaTableColumnsSettings = {
    name: true,
    state: true,
    getters: true,
}

/** Default Network search settings */
const defaultNetworkSearchSettings: NetworkSearchSettings = {
    byName: false,
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
    theme: 'dark',
    displayMode: 'overlay',
    blacklist: { active: [], inactive: [] },
    favorites: [],
    piniaFavorites: [],
    breakpoints: { active: [], inactive: [] },
    mocks: { active: [], inactive: [] },
    networkTableColumns: { ...defaultNetworkTableColumns },
    propsTableColumns: { ...defaultPropsTableColumns },
    piniaTableColumns: { ...defaultPiniaTableColumns },
    networkSearch: { ...defaultNetworkSearchSettings },
    networkCaptureMode: 'saved',
    networkAdvancedHeaderPolicy: {
        showInDetails: true,
        includeInCurl: true,
        includeInExport: true,
    },
    networkHeaderLinks: [],
    networkPinnedHeaders: [],
    propsSearch: { ...defaultPropsSearchSettings },
    collapseOverlayOnPropsInspect: true,
    piniaSearch: { ...defaultPiniaSearchSettings },
    searchParams: { ...defaultSearchParams },
    json: { mode: 'text' },
    updates: { refreshIntervalMs: 1000, autoRefresh: false, autoRefreshInterval: 5000 },
    data: { maxComponents: 100000, preserveState: true },
    savedFiles: [],
    autoSaveFiles: false,
    customize: {
        image: { sourceType: 'file', url: '', urls: [], savedFileId: '', fileName: '', wallpaperId: '', wallpapers: [] },
        positionX: 22,
        positionY: 30,
        scale: 100,
        imageOpacity: 0.2,
        blur: 34,
    },
    autoRun: {
        advancedMode: false,
        siteBlacklist: [],
        siteWhitelist: [],
    },
}

export const defaultCustomizeSettings: CustomizeSettings = defaultInspectorSettings.customize
