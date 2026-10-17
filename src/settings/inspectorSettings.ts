import type { BaseInspectorSettings, FavoriteItem, PiniaFavoriteItem, BreakpointItem, MockRule, MockHeaderEntry, NetworkSearchSettings, NetworkTableColumnsSettings, PropsTableColumnsSettings, PiniaTableColumnsSettings, PropsSearchSettings, PiniaSearchSettings, GlobalSearchSettings, DisplayMode, ThemeMode, SavedFile, CustomizeSettings, ImageSourceType, AutoRunSettings, SiteListEntry, NetworkCaptureMode, NetworkAdvancedHeaderPolicy, NetworkHeaderLinkRule, NetworkPinnedHeaderItem, NetworkPinnedHeaderScope } from '@/types/inspector'

import { DEFAULT_LOGS_LIMITS, DEFAULT_LOGS_MASKING } from '@/injected/logs/config'
import { NETWORK_ENTRY_LIMIT } from '@/types/network'

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
    networkBreakpointsEnabled: true,
    networkMocksEnabled: true,
    networkTableColumns: { ...defaultNetworkTableColumns },
    propsTableColumns: { ...defaultPropsTableColumns },
    piniaTableColumns: { ...defaultPiniaTableColumns },
    networkSearch: { ...defaultNetworkSearchSettings },
    networkMaxHttpRequests: NETWORK_ENTRY_LIMIT.default,
    networkMaxWebSocketEvents: NETWORK_ENTRY_LIMIT.default,
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
    json: { editor: 'jsoneditor', mode: 'text' },
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
    logsIgnoreRules: [],
    logsSearch: { byName: true, byKey: false, byValue: false },
    logsLimits: structuredClone(DEFAULT_LOGS_LIMITS),
    logsMasking: structuredClone(DEFAULT_LOGS_MASKING),
    logsExport: { compress: true },
}

export const defaultCustomizeSettings: CustomizeSettings = defaultInspectorSettings.customize
