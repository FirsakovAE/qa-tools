/**
 * Pinia detection module
 * Uses multiple strategies to find Pinia instance
 */
// Cached Pinia instance
let cachedPinia = null;
/**
 * Detect Pinia from window._s (Map)
 */
export function detectFromWindow() {
    try {
        if (window._s && window._s instanceof Map) {
            return {
                _s: window._s,
                $id: 'found-in-window'
            };
        }
    }
    catch (e) {
        console.error('[injected/pinia/detect] detectFromWindow failed:', e);
    }
    return null;
}
/**
 * Detect Pinia via Vue DevTools Hook
 */
export function detectFromDevtools() {
    try {
        const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
        if (hook?.apps) {
            for (const app of hook.apps) {
                const pinia = app._context?.provides?.pinia ||
                    app._context?.config?.globalProperties?.$pinia ||
                    app.config?.globalProperties?.$pinia;
                if (pinia && pinia._s) {
                    return pinia;
                }
            }
        }
    }
    catch (e) {
        console.error('[injected/pinia/detect] detectFromDevtools failed:', e);
    }
    return null;
}
/**
 * Detect Pinia from Vue app roots in DOM
 */
export function detectFromVueRoots() {
    try {
        // Check common container selectors
        const selectors = ['#app', '#root', '[data-v-app]'];
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el?.__vue_app__) {
                const app = el.__vue_app__;
                const pinia = app._context?.provides?.pinia ||
                    app._context?.config?.globalProperties?.$pinia ||
                    app.config?.globalProperties?.$pinia;
                if (pinia && pinia._s) {
                    return pinia;
                }
            }
        }
        // Also check body children
        const children = document.body?.children;
        if (children) {
            const max = Math.min(children.length, 10);
            for (let i = 0; i < max; i++) {
                const el = children[i];
                if (el.__vue_app__) {
                    const app = el.__vue_app__;
                    const pinia = app._context?.provides?.pinia ||
                        app._context?.config?.globalProperties?.$pinia;
                    if (pinia && pinia._s) {
                        return pinia;
                    }
                }
            }
        }
    }
    catch (e) {
        console.error('[injected/pinia/detect] detectFromVueRoots failed:', e);
    }
    return null;
}
/**
 * Detect Pinia from global __VUE_INSPECTOR__ (if props module loaded first)
 */
export function detectFromInspector() {
    try {
        const vueInspector = window.__VUE_INSPECTOR__;
        const findVueRoots = vueInspector?.findVueRoots;
        if (!findVueRoots)
            return null;
        const vueRoots = findVueRoots();
        for (const root of vueRoots) {
            if (root.__vue_app__) {
                const app = root.__vue_app__;
                const pinia = app._context?.provides?.pinia ||
                    app._context?.config?.globalProperties?.$pinia;
                if (pinia && pinia._s) {
                    return pinia;
                }
            }
        }
    }
    catch (e) {
        console.error('[injected/pinia/detect] detectFromInspector failed:', e);
    }
    return null;
}
/**
 * Main Pinia finder - uses all detection strategies
 * Results are cached for performance
 */
export function findPinia() {
    // Return cached if available
    if (cachedPinia) {
        // Verify cache is still valid
        if (cachedPinia._s instanceof Map) {
            return cachedPinia;
        }
        cachedPinia = null;
    }
    // Method 1: Check window._s (Map)
    let pinia = detectFromWindow();
    if (pinia) {
        cachedPinia = pinia;
        return pinia;
    }
    // Method 2: Check Vue DevTools Hook
    pinia = detectFromDevtools();
    if (pinia) {
        cachedPinia = pinia;
        return pinia;
    }
    // Method 3: Search in Vue app roots in DOM
    pinia = detectFromVueRoots();
    if (pinia) {
        cachedPinia = pinia;
        return pinia;
    }
    // Method 4: Use Vue Inspector if available
    pinia = detectFromInspector();
    if (pinia) {
        cachedPinia = pinia;
        return pinia;
    }
    return null;
}
/**
 * Clear cached Pinia instance
 */
export function clearPiniaCache() {
    cachedPinia = null;
}
/**
 * Check if Pinia is detected
 */
export function isPiniaDetected() {
    return findPinia() !== null;
}
// Timeout ID for waitForPinia
let waitForPiniaTimeoutId = null;
/**
 * Cancel waiting for Pinia (for cleanup)
 */
export function cancelWaitForPinia() {
    if (waitForPiniaTimeoutId !== null) {
        clearTimeout(waitForPiniaTimeoutId);
        waitForPiniaTimeoutId = null;
    }
}
/**
 * Wait for Pinia to appear with timeout
 * Optimized: increased interval, reduced default timeout
 */
export async function waitForPinia(timeout = 2000, interval = 500) {
    cancelWaitForPinia();
    return new Promise(resolve => {
        const start = Date.now();
        const tick = () => {
            const pinia = findPinia();
            if (pinia) {
                waitForPiniaTimeoutId = null;
                return resolve(pinia);
            }
            if (Date.now() - start > timeout) {
                waitForPiniaTimeoutId = null;
                return resolve(null);
            }
            waitForPiniaTimeoutId = setTimeout(tick, interval);
        };
        tick();
    });
}
/**
 * Subscribe to Pinia store changes
 */
export function watchPiniaStores(pinia, onUpdate) {
    if (!pinia._s || !(pinia._s instanceof Map)) {
        return () => { };
    }
    try {
        const originalSet = pinia._s.set.bind(pinia._s);
        const originalDelete = pinia._s.delete.bind(pinia._s);
        pinia._s.set = function (...args) {
            const result = originalSet(...args);
            try {
                onUpdate();
            }
            catch (e) {
                console.error('[injected/pinia/detect] watchPiniaStores onUpdate failed:', e);
            }
            return result;
        };
        pinia._s.delete = function (...args) {
            const result = originalDelete(...args);
            try {
                onUpdate();
            }
            catch (e) {
                console.error('[injected/pinia/detect] watchPiniaStores onUpdate failed:', e);
            }
            return result;
        };
        return () => {
            pinia._s.set = originalSet;
            pinia._s.delete = originalDelete;
        };
    }
    catch (e) {
        console.error('[injected/pinia/detect] watchPiniaStores setup failed:', e);
        return () => { };
    }
}
//# sourceMappingURL=detect.js.map