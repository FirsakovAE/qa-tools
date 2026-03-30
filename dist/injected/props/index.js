// src/injected/props/index.ts
/**
 * 📐 Vue Inspector Props Module
 *
 * Architecture Overview:
 * 1. Structure ≠ Data - Structure updates regularly, props read on-demand
 * 2. WeakMap as main store - All heavy entities tied to real instances
 * 3. Lazy and delta logic - No tree rebuilding, no unnecessary serialization
 */
import { initPropsBridge, cleanupPropsBridge, isBridgeInitialized } from './bridge';
import { getMetaStore, disposeMetaStore } from './meta-store';
import { scanStructure, getComponentList, getScannerStats, resetScanner, initVisibilityAwareness, pauseScanning, resumeScanning, isScanningPaused, getThrottleMultiplier } from './structure-scanner';
import { readPropsByUid, expandAndReadProps, collapseAndClearProps, readExpandedComponentsProps, enablePropsLogging, disablePropsLogging, isLoggingEnabled, getLoggedComponents } from './props-reader';
import { search, fastSearch, lazySearch, deepSearch, searchByName, searchByLabel, searchByPropKey, searchByPropValue } from './search';
import { clearPathCache, disposePathCache } from './find-by-path';
// ============================================================================
// Module State
// ============================================================================
let initialized = false;
let cleanupRegistered = false;
// ============================================================================
// Initialization & Cleanup
// ============================================================================
/**
 * Initialize the props module (registers message handlers)
 */
export function initPropsModule() {
    if (initialized)
        return;
    initialized = true;
    initPropsBridge();
    // Initialize visibility-aware scanning
    initVisibilityAwareness();
    // Register cleanup handlers only once
    if (!cleanupRegistered && typeof window !== 'undefined') {
        cleanupRegistered = true;
        window.addEventListener('beforeunload', disposePropsModule);
        window.addEventListener('pagehide', disposePropsModule);
        // Handle visibilitychange for mobile browsers
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                try {
                    // Clear props caches when page is hidden
                    forceMemoryCleanup();
                }
                catch (e) {
                    console.error('[injected/props] visibilitychange forceMemoryCleanup failed:', e);
                }
                // Scanning is automatically throttled by initVisibilityAwareness
            }
        });
    }
}
/**
 * Full disposal of the props module - removes all listeners and clears all caches
 * Call this on page unload/pagehide
 */
export function disposePropsModule() {
    if (!initialized)
        return;
    cleanupPropsBridge();
    disposeMetaStore();
    disposePathCache();
    resetScanner();
    initialized = false;
}
/**
 * Cleanup the props module - clears caches but keeps listeners
 * Call this when inspector is closed
 */
export function cleanupPropsModule() {
    if (!initialized)
        return;
    cleanupPropsBridge();
    const store = getMetaStore();
    store.cleanup();
    clearPathCache();
    initialized = false;
}
/**
 * Check if the module is initialized
 */
export function isPropsModuleInitialized() {
    return initialized && isBridgeInitialized();
}
/**
 * Force a garbage collection cycle by clearing all props snapshots
 */
export function forceMemoryCleanup() {
    const store = getMetaStore();
    store.cleanup();
    clearPathCache();
}
// ============================================================================
// Debug Stats
// ============================================================================
/**
 * Get debug statistics about the props module
 */
export function getDebugStats() {
    const store = getMetaStore();
    return {
        scannerStats: getScannerStats(),
        storeStats: store.getStats(),
        initialized,
        loggingEnabled: isLoggingEnabled(),
        loggedComponents: getLoggedComponents()
    };
}
// ============================================================================
// Legacy Imports (for backwards compatibility)
// ============================================================================
import { findVueRoots, extractRootVNode, isVueDetected, detectVueContext } from './vue-detect';
import { collectComponentsRecursively } from './collect';
import { findComponentByPath } from './find-by-path';
import { updateComponentProps } from './update-props';
import { getVueComponents, forceRefreshComponents, clearComponentCache } from './collect-all';
// ============================================================================
// Global API
// ============================================================================
const vueInspectorAPI = {
    // Detection
    isVueDetected: () => isVueDetected(),
    findVueRoots: () => findVueRoots(),
    // Structure (no props)
    scanStructure: (options) => scanStructure(options),
    getComponentList: () => getComponentList(),
    // Scanning control
    pauseScanning: () => pauseScanning(),
    resumeScanning: () => resumeScanning(),
    isScanningPaused: () => isScanningPaused(),
    // Props (lazy)
    expandComponent: (uid) => expandAndReadProps(uid),
    collapseComponent: (uid) => collapseAndClearProps(uid),
    getComponentProps: (uid) => readPropsByUid(uid),
    getExpandedProps: () => readExpandedComponentsProps(),
    // Search (with scope protection)
    search: (query, options) => search(query, options),
    fastSearch: (query) => fastSearch(query),
    lazySearch: (query) => lazySearch(query),
    deepSearch: (query) => deepSearch(query), // DANGER: scans all components
    // Logging
    enableLogging: (uid) => enablePropsLogging(uid),
    disableLogging: (uid) => disablePropsLogging(uid),
    getLoggedComponents: () => getLoggedComponents(),
    // Store
    getStore: () => getMetaStore(),
    getRecentChanges: (count) => getMetaStore().getRecentChanges(count),
    // Legacy (backwards compatibility)
    getComponents: (options) => getVueComponents(options),
    findComponentByPath: (path) => findComponentByPath(path),
    updateComponentProps: (path, newProps) => {
        return updateComponentProps(path, newProps);
    },
    forceRefresh: () => forceRefreshComponents(),
    // Cleanup
    forceMemoryCleanup: () => forceMemoryCleanup(),
    getDebugStats: () => getDebugStats(),
    // Version
    version: '3.1.0' // Fixed: scope-limited search, shallow props copies, visibility throttling
};
// Assign API to global window object
Object.assign(window, {
    __VUE_INSPECTOR__: vueInspectorAPI,
    __VUE_INSPECTOR_INJECTED__: {
        // Legacy API
        getComponents: (options) => getVueComponents(options),
        isVueDetected: () => isVueDetected(),
        findComponentByPath: (path) => findComponentByPath(path),
        updateComponentProps: (path, newProps) => {
            return updateComponentProps(path, newProps);
        },
        // New API
        scanStructure: () => scanStructure(),
        getComponentList: () => getComponentList(),
        expandComponent: (uid) => expandAndReadProps(uid),
        collapseComponent: (uid) => collapseAndClearProps(uid),
        search: (query, options) => search(query, options)
    }
});
// ============================================================================
// Exports
// ============================================================================
// New architecture exports
export { 
// Meta store
getMetaStore, disposeMetaStore, 
// Structure scanner
scanStructure, getComponentList, getScannerStats, resetScanner, initVisibilityAwareness, pauseScanning, resumeScanning, isScanningPaused, getThrottleMultiplier, 
// Props reader
readPropsByUid, expandAndReadProps, collapseAndClearProps, readExpandedComponentsProps, enablePropsLogging, disablePropsLogging, isLoggingEnabled, getLoggedComponents, 
// Search
search, fastSearch, lazySearch, deepSearch, searchByName, searchByLabel, searchByPropKey, searchByPropValue };
// Legacy exports (backwards compatibility)
export { findVueRoots, extractRootVNode, isVueDetected, collectComponentsRecursively, findComponentByPath, updateComponentProps, getVueComponents, detectVueContext, forceRefreshComponents, clearComponentCache };
//# sourceMappingURL=index.js.map