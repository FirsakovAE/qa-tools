/**
 * Lightweight dock-state persistence via chrome.storage.local.
 * Runs independently of the main extension storage / iframe — available
 * immediately in the content script so the panel can restore its last
 * position before the app is loaded.
 */
const STORAGE_KEY = 'vue-inspector-dock-state';
const VALID_DOCKS = ['bottom', 'top', 'left', 'right', 'floating'];
export async function loadDockState() {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const s = result[STORAGE_KEY];
        if (!s || typeof s !== 'object')
            return null;
        if (!VALID_DOCKS.includes(s.dockPosition))
            return null;
        return {
            dockPosition: s.dockPosition,
            height: typeof s.height === 'number' ? Math.max(120, s.height) : 360,
            dockWidth: typeof s.dockWidth === 'number' ? Math.max(200, s.dockWidth) : 360,
            floatingX: typeof s.floatingX === 'number' ? s.floatingX : 0,
            floatingY: typeof s.floatingY === 'number' ? s.floatingY : 0,
            floatingWidth: typeof s.floatingWidth === 'number' ? Math.max(200, s.floatingWidth) : 600,
            floatingHeight: typeof s.floatingHeight === 'number' ? Math.max(156, s.floatingHeight) : 400,
        };
    }
    catch {
        return null;
    }
}
export function saveDockState(state) {
    chrome.storage.local.set({ [STORAGE_KEY]: state }).catch(() => { });
}
//# sourceMappingURL=inspector-window-state.js.map