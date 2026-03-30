// src/injected/props/meta-store.ts
const DEFAULT_CONFIG = {
    maxComponents: 100000,
    maxHistorySize: 500,
    propsFloodLimit: 50,
    propsFloodWindow: 1000,
    cleanupInterval: 30000
};
// ============================================================================
// Ring Buffer for Change History
// ============================================================================
class RingBuffer {
    buffer;
    head = 0;
    tail = 0;
    size = 0;
    capacity;
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }
    push(item) {
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        if (this.size < this.capacity) {
            this.size++;
        }
        else {
            // Overwrite oldest
            this.head = (this.head + 1) % this.capacity;
        }
    }
    getAll() {
        const result = [];
        let idx = this.head;
        for (let i = 0; i < this.size; i++) {
            const item = this.buffer[idx];
            if (item !== undefined) {
                result.push(item);
            }
            idx = (idx + 1) % this.capacity;
        }
        return result;
    }
    getRecent(count) {
        const result = [];
        const start = Math.max(0, this.size - count);
        let idx = (this.head + start) % this.capacity;
        for (let i = start; i < this.size; i++) {
            const item = this.buffer[idx];
            if (item !== undefined) {
                result.push(item);
            }
            idx = (idx + 1) % this.capacity;
        }
        return result;
    }
    clear() {
        this.buffer = new Array(this.capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }
    getSize() {
        return this.size;
    }
}
// ============================================================================
// ComponentMeta Store
// ============================================================================
export class ComponentMetaStore {
    // Main storage (WeakMap for automatic GC)
    instanceMap = new WeakMap();
    // UID index (for fast lookup by uid)
    uidIndex = new Map();
    // Structural indexes (without props)
    nameIndex = new Map();
    labelIndex = new Map();
    rootIndex = new WeakMap();
    // Change history (ring buffer)
    changeHistory;
    // Props update tracking (per component)
    propsUpdateTimestamps = new Map();
    // Config
    config;
    // Cleanup timer
    cleanupTimer = null;
    // Disposed flag
    disposed = false;
    // UID counter
    nextUid = 1;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.changeHistory = new RingBuffer(this.config.maxHistorySize);
        this.startCleanupTimer();
    }
    // =========================================================================
    // UID Management
    // =========================================================================
    /**
     * Generate a unique UID for a component
     */
    generateUid() {
        return this.nextUid++;
    }
    /**
     * Get or create UID for an instance
     */
    getOrCreateUid(instance) {
        const existing = this.instanceMap.get(instance);
        if (existing) {
            return existing.uid;
        }
        return this.generateUid();
    }
    // =========================================================================
    // Component Registration (Structure Only)
    // =========================================================================
    /**
     * Register or update component metadata (structure only, NO props)
     */
    registerComponent(instance, data) {
        const existing = this.instanceMap.get(instance);
        if (existing) {
            // Update existing meta
            const changed = existing.name !== data.name ||
                existing.label !== data.label ||
                existing.rootEl !== data.rootEl;
            if (changed) {
                // Update indexes
                this.updateIndexes(existing, data);
                existing.name = data.name;
                existing.label = data.label;
                existing.vnode = data.vnode;
                existing.rootEl = data.rootEl;
                existing.lastStructureUpdate = Date.now();
                existing.isVisible = true;
                this.recordChange({
                    uid: existing.uid,
                    timestamp: Date.now(),
                    type: 'structure_change'
                });
            }
            return existing;
        }
        // Create new meta
        const uid = data.uid ?? this.generateUid();
        const meta = {
            uid,
            name: data.name,
            label: data.label,
            instance,
            vnode: data.vnode,
            rootEl: data.rootEl,
            isVisible: true,
            isExpanded: false,
            lastStructureUpdate: Date.now(),
            propsUpdateCount: 0,
            propsDisabled: false
        };
        // Enforce max components
        if (this.uidIndex.size >= this.config.maxComponents) {
            this.evictOldest();
        }
        // Store
        this.instanceMap.set(instance, meta);
        this.uidIndex.set(uid, new WeakRef(instance));
        // Update indexes
        this.addToIndexes(meta);
        // Record change
        this.recordChange({
            uid,
            timestamp: Date.now(),
            type: 'mount'
        });
        return meta;
    }
    /**
     * Mark component as unmounted
     */
    unregisterComponent(instance) {
        const meta = this.instanceMap.get(instance);
        if (!meta)
            return;
        // Record unmount
        this.recordChange({
            uid: meta.uid,
            timestamp: Date.now(),
            type: 'unmount'
        });
        // Remove from indexes
        this.removeFromIndexes(meta);
        // Remove from maps
        this.uidIndex.delete(meta.uid);
        this.propsUpdateTimestamps.delete(meta.uid);
        // WeakMap will be cleaned up automatically when instance is GC'd
    }
    // =========================================================================
    // Props Management (Lazy, On-Demand)
    // =========================================================================
    /**
     * Read and update props snapshot (with delta detection)
     * Returns true if props changed
     */
    readProps(meta, rawProps) {
        if (meta.propsDisabled) {
            return false;
        }
        // Check flood protection
        if (this.isPropsFlooding(meta.uid)) {
            meta.propsDisabled = true;
            console.warn('[injected/props/meta-store] Props tracking disabled for component', meta.uid, 'due to flood');
            return false;
        }
        const newHash = this.hashProps(rawProps);
        const prev = meta.propsSnapshot;
        if (prev && prev.hash === newHash) {
            // No change
            return false;
        }
        // Create new snapshot
        meta.propsSnapshot = {
            raw: rawProps,
            lastUpdated: Date.now(),
            hash: newHash
        };
        // Track update
        meta.propsUpdateCount++;
        this.trackPropsUpdate(meta.uid);
        // Record change with diff
        if (prev) {
            const diff = this.computePropsDiff(prev.raw, rawProps);
            if (Object.keys(diff).length > 0) {
                this.recordChange({
                    uid: meta.uid,
                    timestamp: Date.now(),
                    type: 'props_change',
                    diff
                });
            }
        }
        return true;
    }
    /**
     * Clear props snapshot (to free memory)
     */
    clearPropsSnapshot(meta) {
        meta.propsSnapshot = undefined;
    }
    /**
     * Re-enable props tracking for a component
     */
    enablePropsTracking(uid) {
        const meta = this.getByUid(uid);
        if (meta) {
            meta.propsDisabled = false;
            meta.propsUpdateCount = 0;
            this.propsUpdateTimestamps.delete(uid);
        }
    }
    // =========================================================================
    // Lookups
    // =========================================================================
    /**
     * Get meta by instance
     */
    getByInstance(instance) {
        return this.instanceMap.get(instance) ?? null;
    }
    /**
     * Get meta by UID
     */
    getByUid(uid) {
        const weakRef = this.uidIndex.get(uid);
        if (!weakRef)
            return null;
        const instance = weakRef.deref();
        if (!instance) {
            // Instance was GC'd, clean up
            this.uidIndex.delete(uid);
            return null;
        }
        return this.instanceMap.get(instance) ?? null;
    }
    /**
     * Get meta by root element
     */
    getByRootElement(el) {
        const uid = this.rootIndex.get(el);
        if (uid === undefined)
            return null;
        return this.getByUid(uid);
    }
    /**
     * Get all registered components (visible only by default)
     */
    getAllComponents(includeHidden = false) {
        const result = [];
        const deadUids = [];
        for (const [uid, weakRef] of this.uidIndex) {
            const instance = weakRef.deref();
            if (!instance) {
                deadUids.push(uid);
                continue;
            }
            const meta = this.instanceMap.get(instance);
            if (meta && (includeHidden || meta.isVisible)) {
                result.push(meta);
            }
        }
        // Clean up dead refs
        for (const uid of deadUids) {
            this.uidIndex.delete(uid);
        }
        return result;
    }
    // =========================================================================
    // Search (Fast - No Props)
    // =========================================================================
    /**
     * Search by component name (fast, no props)
     */
    searchByName(query) {
        const results = [];
        const queryLower = query.toLowerCase();
        for (const [name, uids] of this.nameIndex) {
            if (name.toLowerCase().includes(queryLower)) {
                for (const uid of uids) {
                    const meta = this.getByUid(uid);
                    if (meta)
                        results.push(meta);
                }
            }
        }
        return results;
    }
    /**
     * Search by label (fast, no props)
     */
    searchByLabel(query) {
        const results = [];
        const queryLower = query.toLowerCase();
        for (const [label, uids] of this.labelIndex) {
            if (label.toLowerCase().includes(queryLower)) {
                for (const uid of uids) {
                    const meta = this.getByUid(uid);
                    if (meta)
                        results.push(meta);
                }
            }
        }
        return results;
    }
    /**
     * Combined fast search (name + label)
     */
    fastSearch(query) {
        const resultSet = new Set();
        const results = [];
        // Search by name
        for (const meta of this.searchByName(query)) {
            if (!resultSet.has(meta.uid)) {
                resultSet.add(meta.uid);
                results.push(meta);
            }
        }
        // Search by label
        for (const meta of this.searchByLabel(query)) {
            if (!resultSet.has(meta.uid)) {
                resultSet.add(meta.uid);
                results.push(meta);
            }
        }
        return results;
    }
    // =========================================================================
    // Search (Lazy - With Props)
    // =========================================================================
    /**
     * Search by prop key or value (lazy - reads props on-demand)
     */
    searchByKeyValue(query, getRawProps) {
        const results = [];
        const queryLower = query.toLowerCase();
        for (const meta of this.getAllComponents()) {
            // Read props lazily
            if (!meta.propsSnapshot) {
                const rawProps = getRawProps(meta);
                if (rawProps) {
                    this.readProps(meta, rawProps);
                }
            }
            // Search in props
            if (meta.propsSnapshot && this.matchesKeyValue(meta.propsSnapshot.raw, queryLower)) {
                results.push(meta);
            }
        }
        return results;
    }
    // =========================================================================
    // UI State
    // =========================================================================
    /**
     * Mark component as expanded (triggers props loading)
     */
    setExpanded(uid, expanded) {
        const meta = this.getByUid(uid);
        if (meta) {
            meta.isExpanded = expanded;
        }
    }
    /**
     * Mark component as visible/hidden
     */
    setVisible(uid, visible) {
        const meta = this.getByUid(uid);
        if (meta) {
            meta.isVisible = visible;
        }
    }
    /**
     * Get expanded components (that need props)
     */
    getExpandedComponents() {
        return this.getAllComponents().filter(m => m.isExpanded);
    }
    // =========================================================================
    // Change History
    // =========================================================================
    /**
     * Get recent changes
     */
    getRecentChanges(count = 50) {
        return this.changeHistory.getRecent(count);
    }
    /**
     * Get all changes
     */
    getAllChanges() {
        return this.changeHistory.getAll();
    }
    // =========================================================================
    // Cleanup
    // =========================================================================
    /**
     * Run cleanup - removes dead refs, clears stale props, cleans indexes
     */
    cleanup() {
        if (this.disposed)
            return { removed: 0, propsCleared: 0, indexesCleaned: 0 };
        let removed = 0;
        let propsCleared = 0;
        let indexesCleaned = 0;
        const deadUids = [];
        for (const [uid, weakRef] of this.uidIndex) {
            const instance = weakRef.deref();
            if (!instance) {
                deadUids.push(uid);
                removed++;
                continue;
            }
            const meta = this.instanceMap.get(instance);
            if (meta) {
                // Clear props for non-expanded, non-visible components
                if (meta.propsSnapshot && !meta.isExpanded && !meta.isVisible) {
                    meta.propsSnapshot = undefined;
                    propsCleared++;
                }
            }
        }
        // Clean up dead refs and indexes
        for (const uid of deadUids) {
            this.uidIndex.delete(uid);
            this.propsUpdateTimestamps.delete(uid);
            // Clean up nameIndex - remove dead UIDs
            indexesCleaned += this.cleanDeadUidFromNameIndex(uid);
            // Clean up labelIndex - remove dead UIDs
            indexesCleaned += this.cleanDeadUidFromLabelIndex(uid);
        }
        return { removed, propsCleared, indexesCleaned };
    }
    /**
     * Remove a dead UID from nameIndex
     */
    cleanDeadUidFromNameIndex(uid) {
        let cleaned = 0;
        const emptyNames = [];
        for (const [name, uidSet] of this.nameIndex) {
            if (uidSet.has(uid)) {
                uidSet.delete(uid);
                cleaned++;
                if (uidSet.size === 0) {
                    emptyNames.push(name);
                }
            }
        }
        // Remove empty name entries
        for (const name of emptyNames) {
            this.nameIndex.delete(name);
        }
        return cleaned;
    }
    /**
     * Remove a dead UID from labelIndex
     */
    cleanDeadUidFromLabelIndex(uid) {
        let cleaned = 0;
        const emptyLabels = [];
        for (const [label, uidSet] of this.labelIndex) {
            if (uidSet.has(uid)) {
                uidSet.delete(uid);
                cleaned++;
                if (uidSet.size === 0) {
                    emptyLabels.push(label);
                }
            }
        }
        // Remove empty label entries
        for (const label of emptyLabels) {
            this.labelIndex.delete(label);
        }
        return cleaned;
    }
    /**
     * Clear all data
     */
    clear() {
        this.instanceMap = new WeakMap();
        this.uidIndex.clear();
        this.nameIndex.clear();
        this.labelIndex.clear();
        this.rootIndex = new WeakMap();
        this.changeHistory.clear();
        this.propsUpdateTimestamps.clear();
        this.nextUid = 1;
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
            componentCount: this.uidIndex.size,
            maxComponents: this.config.maxComponents,
            historySize: this.changeHistory.getSize(),
            maxHistorySize: this.config.maxHistorySize
        };
    }
    // =========================================================================
    // Private Helpers
    // =========================================================================
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }
    evictOldest() {
        // Find the oldest non-expanded component
        let oldestMeta = null;
        let oldestTime = Infinity;
        for (const meta of this.getAllComponents(true)) {
            if (!meta.isExpanded && meta.lastStructureUpdate < oldestTime) {
                oldestTime = meta.lastStructureUpdate;
                oldestMeta = meta;
            }
        }
        if (oldestMeta) {
            this.unregisterComponent(oldestMeta.instance);
        }
    }
    addToIndexes(meta) {
        // Name index
        if (meta.name) {
            const nameSet = this.nameIndex.get(meta.name) ?? new Set();
            nameSet.add(meta.uid);
            this.nameIndex.set(meta.name, nameSet);
        }
        // Label index
        if (meta.label) {
            const labelSet = this.labelIndex.get(meta.label) ?? new Set();
            labelSet.add(meta.uid);
            this.labelIndex.set(meta.label, labelSet);
        }
        // Root element index
        if (meta.rootEl) {
            this.rootIndex.set(meta.rootEl, meta.uid);
        }
    }
    removeFromIndexes(meta) {
        // Name index
        if (meta.name) {
            const nameSet = this.nameIndex.get(meta.name);
            if (nameSet) {
                nameSet.delete(meta.uid);
                if (nameSet.size === 0) {
                    this.nameIndex.delete(meta.name);
                }
            }
        }
        // Label index
        if (meta.label) {
            const labelSet = this.labelIndex.get(meta.label);
            if (labelSet) {
                labelSet.delete(meta.uid);
                if (labelSet.size === 0) {
                    this.labelIndex.delete(meta.label);
                }
            }
        }
        // Root element - WeakMap handles cleanup automatically
    }
    updateIndexes(existing, newData) {
        // Update name index if changed
        if (existing.name !== newData.name) {
            if (existing.name) {
                const oldSet = this.nameIndex.get(existing.name);
                if (oldSet) {
                    oldSet.delete(existing.uid);
                    if (oldSet.size === 0) {
                        this.nameIndex.delete(existing.name);
                    }
                }
            }
            if (newData.name) {
                const newSet = this.nameIndex.get(newData.name) ?? new Set();
                newSet.add(existing.uid);
                this.nameIndex.set(newData.name, newSet);
            }
        }
        // Update label index if changed
        if (existing.label !== newData.label) {
            if (existing.label) {
                const oldSet = this.labelIndex.get(existing.label);
                if (oldSet) {
                    oldSet.delete(existing.uid);
                    if (oldSet.size === 0) {
                        this.labelIndex.delete(existing.label);
                    }
                }
            }
            if (newData.label) {
                const newSet = this.labelIndex.get(newData.label) ?? new Set();
                newSet.add(existing.uid);
                this.labelIndex.set(newData.label, newSet);
            }
        }
        // Update root element index
        if (newData.rootEl && newData.rootEl !== existing.rootEl) {
            this.rootIndex.set(newData.rootEl, existing.uid);
        }
    }
    recordChange(entry) {
        this.changeHistory.push(entry);
    }
    hashProps(props) {
        if (!props || typeof props !== 'object')
            return 'empty';
        try {
            const keys = Object.keys(props).sort();
            if (keys.length === 0)
                return 'empty';
            const parts = [];
            for (const key of keys.slice(0, 30)) {
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
                    parts.push(`${key}:s${String(value).substring(0, 30)}`);
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
            console.error('[injected/props/meta-store] hashProps failed:', e);
            return 'error';
        }
    }
    computePropsDiff(prev, next) {
        const diff = {};
        const prevObj = prev;
        const nextObj = next;
        const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
        for (const key of allKeys) {
            const oldVal = prevObj[key];
            const newVal = nextObj[key];
            if (oldVal !== newVal) {
                diff[key] = { old: oldVal, new: newVal };
            }
        }
        return diff;
    }
    isPropsFlooding(uid) {
        const timestamps = this.propsUpdateTimestamps.get(uid) ?? [];
        const now = Date.now();
        const windowStart = now - this.config.propsFloodWindow;
        // Count updates within window
        const recentUpdates = timestamps.filter(t => t >= windowStart);
        return recentUpdates.length >= this.config.propsFloodLimit;
    }
    trackPropsUpdate(uid) {
        const now = Date.now();
        const timestamps = this.propsUpdateTimestamps.get(uid) ?? [];
        // Keep only recent timestamps
        const windowStart = now - this.config.propsFloodWindow;
        const filtered = timestamps.filter(t => t >= windowStart);
        filtered.push(now);
        this.propsUpdateTimestamps.set(uid, filtered);
    }
    matchesKeyValue(props, query) {
        const propsObj = props;
        for (const [key, value] of Object.entries(propsObj)) {
            // Match key
            if (key.toLowerCase().includes(query)) {
                return true;
            }
            // Match value
            if (typeof value === 'string' && value.toLowerCase().includes(query)) {
                return true;
            }
            if (typeof value === 'number' && String(value).includes(query)) {
                return true;
            }
            if (typeof value === 'boolean' && String(value).includes(query)) {
                return true;
            }
        }
        return false;
    }
}
// ============================================================================
// Global Store Instance
// ============================================================================
let globalMetaStore = null;
/**
 * Get or create the global meta store
 */
export function getMetaStore() {
    if (!globalMetaStore || globalMetaStore.isDisposed()) {
        globalMetaStore = new ComponentMetaStore();
    }
    return globalMetaStore;
}
/**
 * Dispose the global meta store
 */
export function disposeMetaStore() {
    if (globalMetaStore) {
        globalMetaStore.dispose();
        globalMetaStore = null;
    }
}
//# sourceMappingURL=meta-store.js.map