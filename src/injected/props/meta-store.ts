// src/injected/props/meta-store.ts

/**
 * 📐 ComponentMeta Store - Core architecture for Vue Inspector
 * 
 * Principles:
 * 1. Structure ≠ Data - Structure updates regularly, props read on-demand
 * 2. WeakMap as main store - All heavy entities tied to real instances
 * 3. Lazy and delta logic - No tree rebuilding, no unnecessary serialization
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Lightweight component metadata (always available)
 */
export interface ComponentMeta {
  /** Unique component ID */
  uid: number

  // Identification
  name?: string
  label?: string

  // References (weak via WeakMap key)
  instance: object
  vnode?: object
  rootEl?: HTMLElement

  // UI state
  isVisible: boolean
  isExpanded: boolean

  // Props (optional, loaded lazily)
  propsSnapshot?: PropsSnapshot

  // Tracking
  lastStructureUpdate: number
  propsUpdateCount: number
  propsDisabled: boolean
}

/**
 * Heavy props snapshot (created on-demand)
 */
export interface PropsSnapshot {
  /** Raw props reference */
  raw: object
  /** Last update timestamp */
  lastUpdated: number
  /** Hash for change detection */
  hash: string
}

/**
 * Change log entry for tracking
 */
export interface ChangeLogEntry {
  uid: number
  timestamp: number
  type: 'mount' | 'unmount' | 'props_change' | 'structure_change'
  diff?: Record<string, { old: any; new: any }>
}

/**
 * Store configuration
 */
export interface MetaStoreConfig {
  maxComponents: number
  maxHistorySize: number
  propsFloodLimit: number
  propsFloodWindow: number
  cleanupInterval: number
}

const DEFAULT_CONFIG: MetaStoreConfig = {
  maxComponents: 2000,
  maxHistorySize: 500,
  propsFloodLimit: 50,
  propsFloodWindow: 1000,
  cleanupInterval: 30000
}

// ============================================================================
// Ring Buffer for Change History
// ============================================================================

class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private tail = 0
  private size = 0
  private capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    
    if (this.size < this.capacity) {
      this.size++
    } else {
      // Overwrite oldest
      this.head = (this.head + 1) % this.capacity
    }
  }

  getAll(): T[] {
    const result: T[] = []
    let idx = this.head
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[idx]
      if (item !== undefined) {
        result.push(item)
      }
      idx = (idx + 1) % this.capacity
    }
    return result
  }

  getRecent(count: number): T[] {
    const result: T[] = []
    const start = Math.max(0, this.size - count)
    let idx = (this.head + start) % this.capacity
    for (let i = start; i < this.size; i++) {
      const item = this.buffer[idx]
      if (item !== undefined) {
        result.push(item)
      }
      idx = (idx + 1) % this.capacity
    }
    return result
  }

  clear(): void {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this.tail = 0
    this.size = 0
  }

  getSize(): number {
    return this.size
  }
}

// ============================================================================
// ComponentMeta Store
// ============================================================================

export class ComponentMetaStore {
  // Main storage (WeakMap for automatic GC)
  private instanceMap = new WeakMap<object, ComponentMeta>()
  
  // UID index (for fast lookup by uid)
  private uidIndex = new Map<number, WeakRef<object>>()
  
  // Structural indexes (without props)
  private nameIndex = new Map<string, Set<number>>()
  private labelIndex = new Map<string, Set<number>>()
  private rootIndex = new WeakMap<HTMLElement, number>()
  
  // Change history (ring buffer)
  private changeHistory: RingBuffer<ChangeLogEntry>
  
  // Props update tracking (per component)
  private propsUpdateTimestamps = new Map<number, number[]>()
  
  // Config
  private config: MetaStoreConfig
  
  // Cleanup timer
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  
  // Disposed flag
  private disposed = false
  
  // UID counter
  private nextUid = 1

  constructor(config: Partial<MetaStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.changeHistory = new RingBuffer(this.config.maxHistorySize)
    this.startCleanupTimer()
  }

  // =========================================================================
  // UID Management
  // =========================================================================

  /**
   * Generate a unique UID for a component
   */
  generateUid(): number {
    return this.nextUid++
  }

  /**
   * Get or create UID for an instance
   */
  getOrCreateUid(instance: object): number {
    const existing = this.instanceMap.get(instance)
    if (existing) {
      return existing.uid
    }
    return this.generateUid()
  }

  // =========================================================================
  // Component Registration (Structure Only)
  // =========================================================================

  /**
   * Register or update component metadata (structure only, NO props)
   */
  registerComponent(
    instance: object,
    data: {
      uid?: number
      name?: string
      label?: string
      vnode?: object
      rootEl?: HTMLElement
    }
  ): ComponentMeta {
    const existing = this.instanceMap.get(instance)
    
    if (existing) {
      // Update existing meta
      const changed = 
        existing.name !== data.name ||
        existing.label !== data.label ||
        existing.rootEl !== data.rootEl

      if (changed) {
        // Update indexes
        this.updateIndexes(existing, data)
        
        existing.name = data.name
        existing.label = data.label
        existing.vnode = data.vnode
        existing.rootEl = data.rootEl
        existing.lastStructureUpdate = Date.now()
        existing.isVisible = true

        this.recordChange({
          uid: existing.uid,
          timestamp: Date.now(),
          type: 'structure_change'
        })
      }

      return existing
    }

    // Create new meta
    const uid = data.uid ?? this.generateUid()
    const meta: ComponentMeta = {
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
    }

    // Enforce max components
    if (this.uidIndex.size >= this.config.maxComponents) {
      this.evictOldest()
    }

    // Store
    this.instanceMap.set(instance, meta)
    this.uidIndex.set(uid, new WeakRef(instance))

    // Update indexes
    this.addToIndexes(meta)

    // Record change
    this.recordChange({
      uid,
      timestamp: Date.now(),
      type: 'mount'
    })

    return meta
  }

  /**
   * Mark component as unmounted
   */
  unregisterComponent(instance: object): void {
    const meta = this.instanceMap.get(instance)
    if (!meta) return

    // Record unmount
    this.recordChange({
      uid: meta.uid,
      timestamp: Date.now(),
      type: 'unmount'
    })

    // Remove from indexes
    this.removeFromIndexes(meta)

    // Remove from maps
    this.uidIndex.delete(meta.uid)
    this.propsUpdateTimestamps.delete(meta.uid)
    
    // WeakMap will be cleaned up automatically when instance is GC'd
  }

  // =========================================================================
  // Props Management (Lazy, On-Demand)
  // =========================================================================

  /**
   * Read and update props snapshot (with delta detection)
   * Returns true if props changed
   */
  readProps(meta: ComponentMeta, rawProps: object): boolean {
    if (meta.propsDisabled) {
      return false
    }

    // Check flood protection
    if (this.isPropsFlooding(meta.uid)) {
      meta.propsDisabled = true
      console.warn(`[VueInspector] Props tracking disabled for component ${meta.uid} due to flood`)
      return false
    }

    const newHash = this.hashProps(rawProps)
    const prev = meta.propsSnapshot

    if (prev && prev.hash === newHash) {
      // No change
      return false
    }

    // Create new snapshot
    meta.propsSnapshot = {
      raw: rawProps,
      lastUpdated: Date.now(),
      hash: newHash
    }

    // Track update
    meta.propsUpdateCount++
    this.trackPropsUpdate(meta.uid)

    // Record change with diff
    if (prev) {
      const diff = this.computePropsDiff(prev.raw, rawProps)
      if (Object.keys(diff).length > 0) {
        this.recordChange({
          uid: meta.uid,
          timestamp: Date.now(),
          type: 'props_change',
          diff
        })
      }
    }

    return true
  }

  /**
   * Clear props snapshot (to free memory)
   */
  clearPropsSnapshot(meta: ComponentMeta): void {
    meta.propsSnapshot = undefined
  }

  /**
   * Re-enable props tracking for a component
   */
  enablePropsTracking(uid: number): void {
    const meta = this.getByUid(uid)
    if (meta) {
      meta.propsDisabled = false
      meta.propsUpdateCount = 0
      this.propsUpdateTimestamps.delete(uid)
    }
  }

  // =========================================================================
  // Lookups
  // =========================================================================

  /**
   * Get meta by instance
   */
  getByInstance(instance: object): ComponentMeta | null {
    return this.instanceMap.get(instance) ?? null
  }

  /**
   * Get meta by UID
   */
  getByUid(uid: number): ComponentMeta | null {
    const weakRef = this.uidIndex.get(uid)
    if (!weakRef) return null

    const instance = weakRef.deref()
    if (!instance) {
      // Instance was GC'd, clean up
      this.uidIndex.delete(uid)
      return null
    }

    return this.instanceMap.get(instance) ?? null
  }

  /**
   * Get meta by root element
   */
  getByRootElement(el: HTMLElement): ComponentMeta | null {
    const uid = this.rootIndex.get(el)
    if (uid === undefined) return null
    return this.getByUid(uid)
  }

  /**
   * Get all registered components (visible only by default)
   */
  getAllComponents(includeHidden = false): ComponentMeta[] {
    const result: ComponentMeta[] = []
    const deadUids: number[] = []

    for (const [uid, weakRef] of this.uidIndex) {
      const instance = weakRef.deref()
      if (!instance) {
        deadUids.push(uid)
        continue
      }

      const meta = this.instanceMap.get(instance)
      if (meta && (includeHidden || meta.isVisible)) {
        result.push(meta)
      }
    }

    // Clean up dead refs
    for (const uid of deadUids) {
      this.uidIndex.delete(uid)
    }

    return result
  }

  // =========================================================================
  // Search (Fast - No Props)
  // =========================================================================

  /**
   * Search by component name (fast, no props)
   */
  searchByName(query: string): ComponentMeta[] {
    const results: ComponentMeta[] = []
    const queryLower = query.toLowerCase()

    for (const [name, uids] of this.nameIndex) {
      if (name.toLowerCase().includes(queryLower)) {
        for (const uid of uids) {
          const meta = this.getByUid(uid)
          if (meta) results.push(meta)
        }
      }
    }

    return results
  }

  /**
   * Search by label (fast, no props)
   */
  searchByLabel(query: string): ComponentMeta[] {
    const results: ComponentMeta[] = []
    const queryLower = query.toLowerCase()

    for (const [label, uids] of this.labelIndex) {
      if (label.toLowerCase().includes(queryLower)) {
        for (const uid of uids) {
          const meta = this.getByUid(uid)
          if (meta) results.push(meta)
        }
      }
    }

    return results
  }

  /**
   * Combined fast search (name + label)
   */
  fastSearch(query: string): ComponentMeta[] {
    const resultSet = new Set<number>()
    const results: ComponentMeta[] = []

    // Search by name
    for (const meta of this.searchByName(query)) {
      if (!resultSet.has(meta.uid)) {
        resultSet.add(meta.uid)
        results.push(meta)
      }
    }

    // Search by label
    for (const meta of this.searchByLabel(query)) {
      if (!resultSet.has(meta.uid)) {
        resultSet.add(meta.uid)
        results.push(meta)
      }
    }

    return results
  }

  // =========================================================================
  // Search (Lazy - With Props)
  // =========================================================================

  /**
   * Search by prop key or value (lazy - reads props on-demand)
   */
  searchByKeyValue(
    query: string,
    getRawProps: (meta: ComponentMeta) => object | null
  ): ComponentMeta[] {
    const results: ComponentMeta[] = []
    const queryLower = query.toLowerCase()

    for (const meta of this.getAllComponents()) {
      // Read props lazily
      if (!meta.propsSnapshot) {
        const rawProps = getRawProps(meta)
        if (rawProps) {
          this.readProps(meta, rawProps)
        }
      }

      // Search in props
      if (meta.propsSnapshot && this.matchesKeyValue(meta.propsSnapshot.raw, queryLower)) {
        results.push(meta)
      }
    }

    return results
  }

  // =========================================================================
  // UI State
  // =========================================================================

  /**
   * Mark component as expanded (triggers props loading)
   */
  setExpanded(uid: number, expanded: boolean): void {
    const meta = this.getByUid(uid)
    if (meta) {
      meta.isExpanded = expanded
    }
  }

  /**
   * Mark component as visible/hidden
   */
  setVisible(uid: number, visible: boolean): void {
    const meta = this.getByUid(uid)
    if (meta) {
      meta.isVisible = visible
    }
  }

  /**
   * Get expanded components (that need props)
   */
  getExpandedComponents(): ComponentMeta[] {
    return this.getAllComponents().filter(m => m.isExpanded)
  }

  // =========================================================================
  // Change History
  // =========================================================================

  /**
   * Get recent changes
   */
  getRecentChanges(count = 50): ChangeLogEntry[] {
    return this.changeHistory.getRecent(count)
  }

  /**
   * Get all changes
   */
  getAllChanges(): ChangeLogEntry[] {
    return this.changeHistory.getAll()
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Run cleanup - removes dead refs, clears stale props, cleans indexes
   */
  cleanup(): { removed: number; propsCleared: number; indexesCleaned: number } {
    if (this.disposed) return { removed: 0, propsCleared: 0, indexesCleaned: 0 }

    let removed = 0
    let propsCleared = 0
    let indexesCleaned = 0
    const deadUids: number[] = []

    for (const [uid, weakRef] of this.uidIndex) {
      const instance = weakRef.deref()
      if (!instance) {
        deadUids.push(uid)
        removed++
        continue
      }

      const meta = this.instanceMap.get(instance)
      if (meta) {
        // Clear props for non-expanded, non-visible components
        if (meta.propsSnapshot && !meta.isExpanded && !meta.isVisible) {
          meta.propsSnapshot = undefined
          propsCleared++
        }
      }
    }

    // Clean up dead refs and indexes
    for (const uid of deadUids) {
      this.uidIndex.delete(uid)
      this.propsUpdateTimestamps.delete(uid)
      
      // Clean up nameIndex - remove dead UIDs
      indexesCleaned += this.cleanDeadUidFromNameIndex(uid)
      
      // Clean up labelIndex - remove dead UIDs
      indexesCleaned += this.cleanDeadUidFromLabelIndex(uid)
    }

    return { removed, propsCleared, indexesCleaned }
  }

  /**
   * Remove a dead UID from nameIndex
   */
  private cleanDeadUidFromNameIndex(uid: number): number {
    let cleaned = 0
    const emptyNames: string[] = []
    
    for (const [name, uidSet] of this.nameIndex) {
      if (uidSet.has(uid)) {
        uidSet.delete(uid)
        cleaned++
        if (uidSet.size === 0) {
          emptyNames.push(name)
        }
      }
    }
    
    // Remove empty name entries
    for (const name of emptyNames) {
      this.nameIndex.delete(name)
    }
    
    return cleaned
  }

  /**
   * Remove a dead UID from labelIndex
   */
  private cleanDeadUidFromLabelIndex(uid: number): number {
    let cleaned = 0
    const emptyLabels: string[] = []
    
    for (const [label, uidSet] of this.labelIndex) {
      if (uidSet.has(uid)) {
        uidSet.delete(uid)
        cleaned++
        if (uidSet.size === 0) {
          emptyLabels.push(label)
        }
      }
    }
    
    // Remove empty label entries
    for (const label of emptyLabels) {
      this.labelIndex.delete(label)
    }
    
    return cleaned
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.instanceMap = new WeakMap()
    this.uidIndex.clear()
    this.nameIndex.clear()
    this.labelIndex.clear()
    this.rootIndex = new WeakMap()
    this.changeHistory.clear()
    this.propsUpdateTimestamps.clear()
    this.nextUid = 1
  }

  /**
   * Dispose the store
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    this.clear()
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed
  }

  /**
   * Get stats
   */
  getStats(): {
    componentCount: number
    maxComponents: number
    historySize: number
    maxHistorySize: number
  } {
    return {
      componentCount: this.uidIndex.size,
      maxComponents: this.config.maxComponents,
      historySize: this.changeHistory.getSize(),
      maxHistorySize: this.config.maxHistorySize
    }
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  private evictOldest(): void {
    // Find the oldest non-expanded component
    let oldestMeta: ComponentMeta | null = null
    let oldestTime = Infinity

    for (const meta of this.getAllComponents(true)) {
      if (!meta.isExpanded && meta.lastStructureUpdate < oldestTime) {
        oldestTime = meta.lastStructureUpdate
        oldestMeta = meta
      }
    }

    if (oldestMeta) {
      this.unregisterComponent(oldestMeta.instance)
    }
  }

  private addToIndexes(meta: ComponentMeta): void {
    // Name index
    if (meta.name) {
      const nameSet = this.nameIndex.get(meta.name) ?? new Set()
      nameSet.add(meta.uid)
      this.nameIndex.set(meta.name, nameSet)
    }

    // Label index
    if (meta.label) {
      const labelSet = this.labelIndex.get(meta.label) ?? new Set()
      labelSet.add(meta.uid)
      this.labelIndex.set(meta.label, labelSet)
    }

    // Root element index
    if (meta.rootEl) {
      this.rootIndex.set(meta.rootEl, meta.uid)
    }
  }

  private removeFromIndexes(meta: ComponentMeta): void {
    // Name index
    if (meta.name) {
      const nameSet = this.nameIndex.get(meta.name)
      if (nameSet) {
        nameSet.delete(meta.uid)
        if (nameSet.size === 0) {
          this.nameIndex.delete(meta.name)
        }
      }
    }

    // Label index
    if (meta.label) {
      const labelSet = this.labelIndex.get(meta.label)
      if (labelSet) {
        labelSet.delete(meta.uid)
        if (labelSet.size === 0) {
          this.labelIndex.delete(meta.label)
        }
      }
    }

    // Root element - WeakMap handles cleanup automatically
  }

  private updateIndexes(
    existing: ComponentMeta,
    newData: { name?: string; label?: string; rootEl?: HTMLElement }
  ): void {
    // Update name index if changed
    if (existing.name !== newData.name) {
      if (existing.name) {
        const oldSet = this.nameIndex.get(existing.name)
        if (oldSet) {
          oldSet.delete(existing.uid)
          if (oldSet.size === 0) {
            this.nameIndex.delete(existing.name)
          }
        }
      }
      if (newData.name) {
        const newSet = this.nameIndex.get(newData.name) ?? new Set()
        newSet.add(existing.uid)
        this.nameIndex.set(newData.name, newSet)
      }
    }

    // Update label index if changed
    if (existing.label !== newData.label) {
      if (existing.label) {
        const oldSet = this.labelIndex.get(existing.label)
        if (oldSet) {
          oldSet.delete(existing.uid)
          if (oldSet.size === 0) {
            this.labelIndex.delete(existing.label)
          }
        }
      }
      if (newData.label) {
        const newSet = this.labelIndex.get(newData.label) ?? new Set()
        newSet.add(existing.uid)
        this.labelIndex.set(newData.label, newSet)
      }
    }

    // Update root element index
    if (newData.rootEl && newData.rootEl !== existing.rootEl) {
      this.rootIndex.set(newData.rootEl, existing.uid)
    }
  }

  private recordChange(entry: ChangeLogEntry): void {
    this.changeHistory.push(entry)
  }

  private hashProps(props: object): string {
    if (!props || typeof props !== 'object') return 'empty'

    try {
      const keys = Object.keys(props).sort()
      if (keys.length === 0) return 'empty'

      const parts: string[] = []
      for (const key of keys.slice(0, 30)) {
        const value = (props as any)[key]
        const type = typeof value

        if (type === 'object' && value !== null) {
          if (Array.isArray(value)) {
            parts.push(`${key}:arr${value.length}`)
          } else {
            parts.push(`${key}:obj${Object.keys(value).length}`)
          }
        } else if (type === 'string') {
          parts.push(`${key}:s${String(value).substring(0, 30)}`)
        } else if (type === 'number' || type === 'boolean') {
          parts.push(`${key}:${value}`)
        } else {
          parts.push(`${key}:${type}`)
        }
      }

      return parts.join('|')
    } catch {
      return 'error'
    }
  }

  private computePropsDiff(
    prev: object,
    next: object
  ): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {}

    const prevObj = prev as Record<string, any>
    const nextObj = next as Record<string, any>

    const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)])

    for (const key of allKeys) {
      const oldVal = prevObj[key]
      const newVal = nextObj[key]

      if (oldVal !== newVal) {
        diff[key] = { old: oldVal, new: newVal }
      }
    }

    return diff
  }

  private isPropsFlooding(uid: number): boolean {
    const timestamps = this.propsUpdateTimestamps.get(uid) ?? []
    const now = Date.now()
    const windowStart = now - this.config.propsFloodWindow

    // Count updates within window
    const recentUpdates = timestamps.filter(t => t >= windowStart)

    return recentUpdates.length >= this.config.propsFloodLimit
  }

  private trackPropsUpdate(uid: number): void {
    const now = Date.now()
    const timestamps = this.propsUpdateTimestamps.get(uid) ?? []

    // Keep only recent timestamps
    const windowStart = now - this.config.propsFloodWindow
    const filtered = timestamps.filter(t => t >= windowStart)
    filtered.push(now)

    this.propsUpdateTimestamps.set(uid, filtered)
  }

  private matchesKeyValue(props: object, query: string): boolean {
    const propsObj = props as Record<string, any>

    for (const [key, value] of Object.entries(propsObj)) {
      // Match key
      if (key.toLowerCase().includes(query)) {
        return true
      }

      // Match value
      if (typeof value === 'string' && value.toLowerCase().includes(query)) {
        return true
      }
      if (typeof value === 'number' && String(value).includes(query)) {
        return true
      }
      if (typeof value === 'boolean' && String(value).includes(query)) {
        return true
      }
    }

    return false
  }
}

// ============================================================================
// Global Store Instance
// ============================================================================

let globalMetaStore: ComponentMetaStore | null = null

/**
 * Get or create the global meta store
 */
export function getMetaStore(): ComponentMetaStore {
  if (!globalMetaStore || globalMetaStore.isDisposed()) {
    globalMetaStore = new ComponentMetaStore()
  }
  return globalMetaStore
}

/**
 * Dispose the global meta store
 */
export function disposeMetaStore(): void {
  if (globalMetaStore) {
    globalMetaStore.dispose()
    globalMetaStore = null
  }
}
