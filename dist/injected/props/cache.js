// src/injected/props/cache.ts
const DEFAULT_CONFIG = {
    maxComponents: 100000,
    propsCacheTtl: 2000,
    maxHistorySize: 100,
    cleanupInterval: 30000
};
// ============================================================================
// Component Store (WeakMap-based)
// ============================================================================
/**
 * Main component store using WeakMap for automatic GC
 * Key: component instance object
 * Value: ComponentRef with lazy props
 */
class ComponentStore {
    /** WeakMap for instance -> ComponentRef (allows GC when component is removed) */
    instanceMap = new WeakMap();
    /** Map for path -> WeakRef<instance> (for lookup by path) */
    pathToInstance = new Map();
    /** LRU list of paths for eviction */
    pathOrder = [];
    /** Change history (limited size) */
    changeHistory = [];
    /** Config */
    config;
    /** Cleanup timer */
    cleanupTimer = null;
    /** Disposed flag */
    disposed = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startCleanupTimer();
    }
    /**
     * Get component by instance
     */
    getByInstance(instance) {
        if (this.disposed)
            return null;
        return this.instanceMap.get(instance) ?? null;
    }
    /**
     * Get component by path
     */
    getByPath(path) {
        if (this.disposed)
            return null;
        const weakRef = this.pathToInstance.get(path);
        if (!weakRef)
            return null;
        const instance = weakRef.deref();
        if (!instance) {
            // Instance was GC'd, clean up the path
            this.pathToInstance.delete(path);
            this.removeFromPathOrder(path);
            return null;
        }
        return this.instanceMap.get(instance) ?? null;
    }
    /**
     * Store or update component reference
     * Returns true if this was an update (component existed), false if new
     */
    set(instance, ref) {
        if (this.disposed)
            return false;
        const existing = this.instanceMap.get(instance);
        const isUpdate = !!existing;
        // Evict if at max size and this is a new component
        if (!isUpdate && this.pathOrder.length >= this.config.maxComponents) {
            this.evictOldest();
        }
        // Store in WeakMap
        this.instanceMap.set(instance, ref);
        // Update path lookup
        this.pathToInstance.set(ref.path, new WeakRef(instance));
        this.updatePathOrder(ref.path);
        // Record change
        this.recordChange(ref.path, isUpdate ? 'update' : 'add');
        return isUpdate;
    }
    /**
     * Remove component by path
     */
    removeByPath(path) {
        if (this.disposed)
            return false;
        const weakRef = this.pathToInstance.get(path);
        if (!weakRef)
            return false;
        const instance = weakRef.deref();
        if (instance) {
            this.instanceMap.delete(instance);
        }
        this.pathToInstance.delete(path);
        this.removeFromPathOrder(path);
        this.recordChange(path, 'remove');
        return true;
    }
    /**
     * Get all valid components (filters out GC'd instances)
     */
    getAllComponents() {
        if (this.disposed)
            return [];
        const result = [];
        const deadPaths = [];
        for (const path of this.pathOrder) {
            const weakRef = this.pathToInstance.get(path);
            if (!weakRef) {
                deadPaths.push(path);
                continue;
            }
            const instance = weakRef.deref();
            if (!instance) {
                deadPaths.push(path);
                continue;
            }
            const ref = this.instanceMap.get(instance);
            if (ref) {
                result.push(ref);
            }
        }
        // Clean up dead paths
        for (const path of deadPaths) {
            this.pathToInstance.delete(path);
            this.removeFromPathOrder(path);
        }
        return result;
    }
    /**
     * Get change history
     */
    getChangeHistory() {
        return [...this.changeHistory];
    }
    /**
     * Clear all data
     */
    clear() {
        this.instanceMap = new WeakMap();
        this.pathToInstance.clear();
        this.pathOrder = [];
        this.changeHistory = [];
    }
    /**
     * Cleanup expired entries and dead references
     */
    cleanup() {
        if (this.disposed)
            return 0;
        let removed = 0;
        const now = Date.now();
        const deadPaths = [];
        for (const path of this.pathOrder) {
            const weakRef = this.pathToInstance.get(path);
            if (!weakRef) {
                deadPaths.push(path);
                continue;
            }
            const instance = weakRef.deref();
            if (!instance) {
                deadPaths.push(path);
                continue;
            }
            const ref = this.instanceMap.get(instance);
            if (ref) {
                // Clear cached serialized props if TTL expired
                if (ref._serializedProps && now - ref.lastUpdated > this.config.propsCacheTtl) {
                    ref._serializedProps = null;
                }
            }
        }
        // Remove dead paths
        for (const path of deadPaths) {
            this.pathToInstance.delete(path);
            this.removeFromPathOrder(path);
            removed++;
        }
        // Trim change history
        if (this.changeHistory.length > this.config.maxHistorySize) {
            this.changeHistory = this.changeHistory.slice(-this.config.maxHistorySize);
        }
        return removed;
    }
    /**
     * Dispose the store
     */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }
    /**
     * Check if disposed
     */
    isDisposed() {
        return this.disposed;
    }
    /**
     * Get stats
     */
    getStats() {
        return {
            size: this.pathOrder.length,
            maxSize: this.config.maxComponents,
            historySize: this.changeHistory.length
        };
    }
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }
    evictOldest() {
        if (this.pathOrder.length > 0) {
            const oldest = this.pathOrder.shift();
            if (oldest) {
                const weakRef = this.pathToInstance.get(oldest);
                if (weakRef) {
                    const instance = weakRef.deref();
                    if (instance) {
                        this.instanceMap.delete(instance);
                    }
                }
                this.pathToInstance.delete(oldest);
            }
        }
    }
    updatePathOrder(path) {
        this.removeFromPathOrder(path);
        this.pathOrder.push(path);
    }
    removeFromPathOrder(path) {
        const index = this.pathOrder.indexOf(path);
        if (index > -1) {
            this.pathOrder.splice(index, 1);
        }
    }
    recordChange(path, type) {
        this.changeHistory.push({
            path,
            timestamp: Date.now(),
            type
        });
        // Trim if over limit
        if (this.changeHistory.length > this.config.maxHistorySize * 2) {
            this.changeHistory = this.changeHistory.slice(-this.config.maxHistorySize);
        }
    }
}
// ============================================================================
// Props Hash (for change detection)
// ============================================================================
/**
 * Generate a fast hash of props for change detection
 * Uses a simple string-based hash, not cryptographic
 */
export function generatePropsHash(props) {
    if (!props || typeof props !== 'object')
        return 'empty';
    try {
        const keys = Object.keys(props).sort();
        if (keys.length === 0)
            return 'empty';
        // Create a simple fingerprint based on keys and value types
        const parts = [];
        for (const key of keys.slice(0, 20)) { // Limit to first 20 keys for performance
            const value = props[key];
            const type = typeof value;
            if (type === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    parts.push(`${key}:arr${value.length}`);
                }
                else {
                    parts.push(`${key}:obj${Object.keys(value).length}`);
                }
            }
            else if (type === 'string') {
                // Include first 20 chars of string for better change detection
                parts.push(`${key}:s${value.substring(0, 20)}`);
            }
            else if (type === 'number' || type === 'boolean') {
                parts.push(`${key}:${value}`);
            }
            else {
                parts.push(`${key}:${type}`);
            }
        }
        return parts.join('|');
    }
    catch (e) {
        console.error('[injected/props/cache] generatePropsHash failed:', e);
        return 'error';
    }
}
/**
 * Check if props have changed by comparing hashes
 */
export function havePropsChanged(oldHash, newProps) {
    const newHash = generatePropsHash(newProps);
    return oldHash !== newHash;
}
// ============================================================================
// Global Store Instance
// ============================================================================
let globalStore = null;
/**
 * Get or create the global component store
 */
export function getComponentStore() {
    if (!globalStore || globalStore.isDisposed()) {
        globalStore = new ComponentStore({
            maxComponents: 100000,
            propsCacheTtl: 2000,
            maxHistorySize: 100,
            cleanupInterval: 30000
        });
    }
    return globalStore;
}
/**
 * Clear all caches
 */
export function clearAllCaches() {
    if (globalStore) {
        globalStore.dispose();
        globalStore = null;
    }
}
// ============================================================================
// Traversal State (for tree traversal without memory leaks)
// ============================================================================
/**
 * Traversal state manager using WeakSet for visited tracking
 */
export class TraversalState {
    visited = new WeakSet();
    visitedPrimitives = new Set();
    visitCount = 0;
    maxVisits;
    constructor(maxVisits = 10000) {
        this.maxVisits = maxVisits;
    }
    isValidObject(node) {
        return node !== null && (typeof node === 'object' || typeof node === 'function');
    }
    visit(node) {
        if (this.visitCount >= this.maxVisits)
            return false;
        if (node === null || node === undefined)
            return false;
        if (this.isValidObject(node)) {
            if (this.visited.has(node))
                return false;
            this.visited.add(node);
            this.visitCount++;
            return true;
        }
        if (this.visitedPrimitives.has(node))
            return false;
        this.visitedPrimitives.add(node);
        this.visitCount++;
        return true;
    }
    hasVisited(node) {
        if (node === null || node === undefined)
            return false;
        if (this.isValidObject(node))
            return this.visited.has(node);
        return this.visitedPrimitives.has(node);
    }
    getVisitCount() {
        return this.visitCount;
    }
    isLimitReached() {
        return this.visitCount >= this.maxVisits;
    }
    clear() {
        this.visited = new WeakSet();
        this.visitedPrimitives.clear();
        this.visitCount = 0;
    }
}
export function getComponentCache() {
    return getComponentStore();
}
export function generateVNodeCacheKey(vnode, rootIndex) {
    const uid = vnode?.component?.uid ?? vnode?._uid ?? 'unknown';
    const name = vnode?.component?.type?.name ?? vnode?.$options?.name ?? 'anon';
    return `${rootIndex}:${uid}:${name}`;
}
//# sourceMappingURL=cache.js.map