// src/injected/props/collect-all.ts
/**
 * High-level component collection with delta updates.
 *
 * Optimizations:
 * - Uses WeakMap-based store for automatic GC
 * - Delta updates: reuses existing ComponentRef when unchanged
 * - Lazy serialization: props are only serialized when requested
 * - Debounced collection to prevent excessive traversals
 */
import { findVueRoots, extractRootVNode } from './vue-detect';
import { collectComponentRefs, componentRefToInfo, getCachedComponents, getCachedComponentsAsInfo } from './collect';
/** Inlined likeMatch - injected script must not use external imports (no type="module") */
function likeMatch(value, pattern) {
    const v = value.toLowerCase();
    const p = pattern.toLowerCase();
    if (!p.includes('%') && !p.includes('*'))
        return v === p;
    const escaped = p.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    return new RegExp('^' + escaped.replace(/[%*]/g, '.*') + '$').test(v);
}
import { TraversalState, getComponentStore } from './cache';
// ============================================================================
// State
// ============================================================================
let lastCollectionTime = 0;
let lastRootsHash = '';
const DEBOUNCE_MS = 50;
const stats = {
    lastCollectionTime: 0,
    lastCollectionDuration: 0,
    totalCollections: 0,
    deltaUpdates: 0,
    fullCollections: 0,
    cacheHits: 0
};
// ============================================================================
// Helpers
// ============================================================================
/**
 * Generate a hash of Vue roots for change detection
 */
function getRootsHash(roots) {
    if (roots.length === 0)
        return 'empty';
    const parts = roots.map((root, i) => {
        const app = root.__vue_app__;
        const vue = root.__vue__;
        const uid = app?._uid ?? vue?._uid ?? i;
        return `${i}:${uid}`;
    });
    return parts.join('|');
}
/**
 * Check if we should use cached components (debounce)
 */
function shouldUseCachedComponents() {
    const now = Date.now();
    if (now - lastCollectionTime < DEBOUNCE_MS) {
        const store = getComponentStore();
        const cached = store.getAllComponents();
        if (cached.length > 0) {
            return true;
        }
    }
    return false;
}
// ============================================================================
// Public API
// ============================================================================
/**
 * Get collection statistics
 */
export function getCollectionStats() {
    return { ...stats };
}
/**
 * Reset collection statistics
 */
export function resetCollectionStats() {
    stats.lastCollectionTime = 0;
    stats.lastCollectionDuration = 0;
    stats.totalCollections = 0;
    stats.deltaUpdates = 0;
    stats.fullCollections = 0;
    stats.cacheHits = 0;
}
/** Normalize blacklist (safe for cross-context / postMessage) */
function normalizeBlacklist(bl) {
    if (!bl || typeof bl !== 'object' || !Array.isArray(bl.active))
        return undefined;
    const b = bl;
    return {
        active: b.active.filter((r) => typeof r === 'string'),
        inactive: Array.isArray(b.inactive) ? b.inactive.filter((r) => typeof r === 'string') : []
    };
}
function isBlacklisted(name, norm) {
    if (!norm.active.length)
        return false;
    const n = name || '';
    if (norm.inactive.some((rule) => likeMatch(n, rule)))
        return false;
    return norm.active.some((rule) => likeMatch(n, rule));
}
function filterByBlacklist(items, blacklist) {
    const norm = normalizeBlacklist(blacklist);
    if (!norm?.active?.length)
        return items;
    return items.filter(item => !isBlacklisted(item.name ?? '', norm));
}
/**
 * Get Vue components with delta updates.
 *
 * - Returns cached components if within debounce window
 * - Uses delta detection to reuse unchanged ComponentRef objects
 * - Serializes props lazily (only when accessed)
 * - Blacklisted components excluded at source: no tree, no props extraction, no serialization
 *
 * @returns Array of ComponentInfo with serialized props
 */
export function getVueComponents(options) {
    const now = Date.now();
    const blacklist = options?.blacklist;
    // Check debounce - return cached if recent
    if (shouldUseCachedComponents()) {
        stats.cacheHits++;
        const cached = getCachedComponentsAsInfo();
        return filterByBlacklist(cached, blacklist);
    }
    const startTime = performance.now();
    const allRefs = [];
    const vueRoots = findVueRoots();
    // Check if roots changed
    const currentRootsHash = getRootsHash(vueRoots);
    const rootsChanged = currentRootsHash !== lastRootsHash;
    lastRootsHash = currentRootsHash;
    if (vueRoots.length > 0) {
        for (let rootIndex = 0; rootIndex < vueRoots.length; rootIndex++) {
            const root = vueRoots[rootIndex];
            const rootVNode = extractRootVNode(root);
            if (!rootVNode)
                continue;
            const isRootVue2 = root.__vue__ && !root.__vue_app__;
            const vueContext = {
                version: isRootVue2 ? 2 : 3,
                roots: vueRoots
            };
            // Use TraversalState with WeakSet for this traversal
            const traversalState = new TraversalState(10000);
            // Collect component refs (uses delta updates internally)
            const refs = collectComponentRefs(rootVNode, `root[${rootIndex}]`, 0, root, traversalState, vueContext);
            allRefs.push(...refs);
        }
    }
    // Update stats
    stats.lastCollectionTime = now;
    stats.lastCollectionDuration = performance.now() - startTime;
    stats.totalCollections++;
    if (rootsChanged) {
        stats.fullCollections++;
    }
    else {
        stats.deltaUpdates++;
    }
    lastCollectionTime = now;
    // Filter blacklisted BEFORE componentRefToInfo - no props extraction, no serialization
    const filteredRefs = filterByBlacklist(allRefs, blacklist);
    return filteredRefs.map(ref => {
        try {
            return componentRefToInfo(ref);
        }
        catch (e) {
            console.error('[injected/props/collect-all] componentRefToInfo failed:', ref.path, e);
            return {
                name: ref.name,
                props: {},
                path: ref.path,
                element: ref.element,
                hasProps: false,
                propsCount: 0,
                rootElement: ref.rootElement
            };
        }
    });
}
/**
 * Get Vue components as lightweight info (without serializing props).
 * Use this when you only need to list components, not view their props.
 */
export function getVueComponentsLight() {
    const now = Date.now();
    if (shouldUseCachedComponents()) {
        stats.cacheHits++;
        // Return cached without serializing props
        const cached = getCachedComponents();
        return cached.map(ref => ({
            name: ref.name,
            props: {}, // Don't serialize - lazy
            path: ref.path,
            element: ref.element,
            hasProps: ref.propsHash !== 'empty',
            propsCount: 0, // Unknown until serialized
            rootElement: ref.rootElement
        }));
    }
    // Fall back to full collection
    return getVueComponents();
}
/**
 * Get cached components without traversing the tree.
 * Returns components from WeakMap store (auto-excludes GC'd components).
 */
export function getCachedVueComponents() {
    return getCachedComponentsAsInfo();
}
/**
 * Force a fresh collection (ignores debounce and cache)
 */
export function forceRefreshComponents() {
    lastCollectionTime = 0;
    lastRootsHash = '';
    return getVueComponents();
}
/**
 * Clear the component cache
 */
export function clearComponentCache() {
    lastCollectionTime = 0;
    lastRootsHash = '';
    const store = getComponentStore();
    store.clear();
}
/**
 * Get a single component's props by path (lazy serialization)
 */
export function getComponentPropsByPath(path) {
    try {
        const store = getComponentStore();
        const ref = store.getByPath(path);
        if (!ref)
            return null;
        // Import getSerializedProps dynamically to avoid circular dependency
        const { getSerializedProps } = require('./collect');
        return getSerializedProps(ref);
    }
    catch (e) {
        console.error('[injected/props/collect-all] getComponentPropsByPath failed:', path, e);
        return null;
    }
}
//# sourceMappingURL=collect-all.js.map