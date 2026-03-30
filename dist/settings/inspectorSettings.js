/** Default Network table columns (all visible except Name) */
const defaultNetworkTableColumns = {
    status: true,
    method: true,
    name: false,
    path: true,
    time: true,
    size: true,
};
/** Default Props table columns (all visible) */
const defaultPropsTableColumns = {
    name: true,
    rootElement: true,
    propsReceived: true,
    propsDeclared: true,
};
/** Default Pinia table columns (all visible) */
const defaultPiniaTableColumns = {
    name: true,
    state: true,
    getters: true,
};
/** Default Network search settings */
const defaultNetworkSearchSettings = {
    byName: false,
    byPath: true,
    byMethod: true,
    byStatus: false,
    byKey: false,
    byValue: false,
};
/** Default Props search settings */
const defaultPropsSearchSettings = {
    byName: true,
    byLabel: true,
    byRootElement: true,
    byKey: false,
    byValue: false,
};
/** Default Pinia search settings */
const defaultPiniaSearchSettings = {
    byName: true,
    byKey: false,
    byValue: false,
};
/** Default global search parameters */
const defaultSearchParams = {
    debounce: 300,
    minLength: 2,
};
export const defaultInspectorSettings = {
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
};
export const defaultCustomizeSettings = defaultInspectorSettings.customize;
//# sourceMappingURL=inspectorSettings.js.map