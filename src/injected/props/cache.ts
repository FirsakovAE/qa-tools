// src/injected/props/cache.ts

/**
 * Advanced cache system for Vue component data with:
 * - WeakMap/WeakSet for automatic garbage collection
 * - Delta updates to minimize object creation
 * - Lazy serialization of props
 * - TTL-based invalidation
 * - Limited history to prevent memory bloat
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Lightweight component reference stored in WeakMap
 * Contains only identifiers and references, props are serialized lazily
 */
export interface ComponentRef {
  /** Component instance UID */
  uid: string
  /** Component name */
  name: string
  /** Full path identifier */
  path: string
  /** Reference to the actual component instance (weak reference via WeakMap key) */
  instance: object
  /** Reference to the VNode */
  vnode: object
  /** Element info (lightweight, always available) */
  element: ElementInfo | null
  /** Root element info */
  rootElement: ElementInfo | null
  /** Timestamp of last update */
  lastUpdated: number
  /** Hash of raw props for change detection */
  propsHash: string
  /** Cached serialized props (lazy, may be null) */
  _serializedProps: Record<string, any> | null
  /** Raw props reference for lazy serialization */
  _rawPropsRef: WeakRef<object> | null
}

export interface ElementInfo {
  tagName?: string
  id?: string
  className?: string
  testId?: string
}

/**
 * Public ComponentInfo interface returned to consumers
 * Props are serialized on-demand
 */
export interface ComponentInfo {
  name: string
  props: Record<string, any>
  path: string
  element: ElementInfo | null
  hasProps: boolean
  propsCount: number
  rootElement: ElementInfo | null
}

interface CacheConfig {
  /** Max components to track */
  maxComponents: number
  /** TTL for cached props in ms */
  propsCacheTtl: number
  /** Max history entries for change tracking */
  maxHistorySize: number
  /** Cleanup interval in ms */
  cleanupInterval: number
}

const DEFAULT_CONFIG: CacheConfig = {
  maxComponents: 1000,
  propsCacheTtl: 2000,
  maxHistorySize: 100,
  cleanupInterval: 30000
}

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
  private instanceMap = new WeakMap<object, ComponentRef>()
  
  /** Map for path -> WeakRef<instance> (for lookup by path) */
  private pathToInstance = new Map<string, WeakRef<object>>()
  
  /** LRU list of paths for eviction */
  private pathOrder: string[] = []
  
  /** Change history (limited size) */
  private changeHistory: Array<{ path: string; timestamp: number; type: 'add' | 'update' | 'remove' }> = []
  
  /** Config */
  private config: CacheConfig
  
  /** Cleanup timer */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  
  /** Disposed flag */
  private disposed = false

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startCleanupTimer()
  }

  /**
   * Get component by instance
   */
  getByInstance(instance: object): ComponentRef | null {
    if (this.disposed) return null
    return this.instanceMap.get(instance) ?? null
  }

  /**
   * Get component by path
   */
  getByPath(path: string): ComponentRef | null {
    if (this.disposed) return null
    
    const weakRef = this.pathToInstance.get(path)
    if (!weakRef) return null
    
    const instance = weakRef.deref()
    if (!instance) {
      // Instance was GC'd, clean up the path
      this.pathToInstance.delete(path)
      this.removeFromPathOrder(path)
      return null
    }
    
    return this.instanceMap.get(instance) ?? null
  }

  /**
   * Store or update component reference
   * Returns true if this was an update (component existed), false if new
   */
  set(instance: object, ref: ComponentRef): boolean {
    if (this.disposed) return false
    
    const existing = this.instanceMap.get(instance)
    const isUpdate = !!existing
    
    // Evict if at max size and this is a new component
    if (!isUpdate && this.pathOrder.length >= this.config.maxComponents) {
      this.evictOldest()
    }
    
    // Store in WeakMap
    this.instanceMap.set(instance, ref)
    
    // Update path lookup
    this.pathToInstance.set(ref.path, new WeakRef(instance))
    this.updatePathOrder(ref.path)
    
    // Record change
    this.recordChange(ref.path, isUpdate ? 'update' : 'add')
    
    return isUpdate
  }

  /**
   * Remove component by path
   */
  removeByPath(path: string): boolean {
    if (this.disposed) return false
    
    const weakRef = this.pathToInstance.get(path)
    if (!weakRef) return false
    
    const instance = weakRef.deref()
    if (instance) {
      this.instanceMap.delete(instance)
    }
    
    this.pathToInstance.delete(path)
    this.removeFromPathOrder(path)
    this.recordChange(path, 'remove')
    
    return true
  }

  /**
   * Get all valid components (filters out GC'd instances)
   */
  getAllComponents(): ComponentRef[] {
    if (this.disposed) return []
    
    const result: ComponentRef[] = []
    const deadPaths: string[] = []
    
    for (const path of this.pathOrder) {
      const weakRef = this.pathToInstance.get(path)
      if (!weakRef) {
        deadPaths.push(path)
        continue
      }
      
      const instance = weakRef.deref()
      if (!instance) {
        deadPaths.push(path)
        continue
      }
      
      const ref = this.instanceMap.get(instance)
      if (ref) {
        result.push(ref)
      }
    }
    
    // Clean up dead paths
    for (const path of deadPaths) {
      this.pathToInstance.delete(path)
      this.removeFromPathOrder(path)
    }
    
    return result
  }

  /**
   * Get change history
   */
  getChangeHistory(): Array<{ path: string; timestamp: number; type: 'add' | 'update' | 'remove' }> {
    return [...this.changeHistory]
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.instanceMap = new WeakMap()
    this.pathToInstance.clear()
    this.pathOrder = []
    this.changeHistory = []
  }

  /**
   * Cleanup expired entries and dead references
   */
  cleanup(): number {
    if (this.disposed) return 0
    
    let removed = 0
    const now = Date.now()
    const deadPaths: string[] = []
    
    for (const path of this.pathOrder) {
      const weakRef = this.pathToInstance.get(path)
      if (!weakRef) {
        deadPaths.push(path)
        continue
      }
      
      const instance = weakRef.deref()
      if (!instance) {
        deadPaths.push(path)
        continue
      }
      
      const ref = this.instanceMap.get(instance)
      if (ref) {
        // Clear cached serialized props if TTL expired
        if (ref._serializedProps && now - ref.lastUpdated > this.config.propsCacheTtl) {
          ref._serializedProps = null
        }
      }
    }
    
    // Remove dead paths
    for (const path of deadPaths) {
      this.pathToInstance.delete(path)
      this.removeFromPathOrder(path)
      removed++
    }
    
    // Trim change history
    if (this.changeHistory.length > this.config.maxHistorySize) {
      this.changeHistory = this.changeHistory.slice(-this.config.maxHistorySize)
    }
    
    return removed
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
  getStats(): { size: number; maxSize: number; historySize: number } {
    return {
      size: this.pathOrder.length,
      maxSize: this.config.maxComponents,
      historySize: this.changeHistory.length
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  private evictOldest(): void {
    if (this.pathOrder.length > 0) {
      const oldest = this.pathOrder.shift()
      if (oldest) {
        const weakRef = this.pathToInstance.get(oldest)
        if (weakRef) {
          const instance = weakRef.deref()
          if (instance) {
            this.instanceMap.delete(instance)
          }
        }
        this.pathToInstance.delete(oldest)
      }
    }
  }

  private updatePathOrder(path: string): void {
    this.removeFromPathOrder(path)
    this.pathOrder.push(path)
  }

  private removeFromPathOrder(path: string): void {
    const index = this.pathOrder.indexOf(path)
    if (index > -1) {
      this.pathOrder.splice(index, 1)
    }
  }

  private recordChange(path: string, type: 'add' | 'update' | 'remove'): void {
    this.changeHistory.push({
      path,
      timestamp: Date.now(),
      type
    })
    
    // Trim if over limit
    if (this.changeHistory.length > this.config.maxHistorySize * 2) {
      this.changeHistory = this.changeHistory.slice(-this.config.maxHistorySize)
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
export function generatePropsHash(props: any): string {
  if (!props || typeof props !== 'object') return 'empty'
  
  try {
    const keys = Object.keys(props).sort()
    if (keys.length === 0) return 'empty'
    
    // Create a simple fingerprint based on keys and value types
    const parts: string[] = []
    for (const key of keys.slice(0, 20)) { // Limit to first 20 keys for performance
      const value = props[key]
      const type = typeof value
      
      if (type === 'object' && value !== null) {
        if (Array.isArray(value)) {
          parts.push(`${key}:arr${value.length}`)
        } else {
          parts.push(`${key}:obj${Object.keys(value).length}`)
        }
      } else if (type === 'string') {
        // Include first 20 chars of string for better change detection
        parts.push(`${key}:s${value.substring(0, 20)}`)
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

/**
 * Check if props have changed by comparing hashes
 */
export function havePropsChanged(oldHash: string, newProps: any): boolean {
  const newHash = generatePropsHash(newProps)
  return oldHash !== newHash
}

// ============================================================================
// Global Store Instance
// ============================================================================

let globalStore: ComponentStore | null = null

/**
 * Get or create the global component store
 */
export function getComponentStore(): ComponentStore {
  if (!globalStore || globalStore.isDisposed()) {
    globalStore = new ComponentStore({
      maxComponents: 1000,
      propsCacheTtl: 2000,
      maxHistorySize: 100,
      cleanupInterval: 30000
    })
  }
  return globalStore
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  if (globalStore) {
    globalStore.dispose()
    globalStore = null
  }
}

// ============================================================================
// Traversal State (for tree traversal without memory leaks)
// ============================================================================

/**
 * Traversal state manager using WeakSet for visited tracking
 */
export class TraversalState {
  private visited: WeakSet<object> = new WeakSet()
  private visitedPrimitives: Set<any> = new Set()
  private visitCount = 0
  private maxVisits: number

  constructor(maxVisits = 10000) {
    this.maxVisits = maxVisits
  }

  private isValidObject(node: any): node is object {
    return node !== null && (typeof node === 'object' || typeof node === 'function')
  }

  visit(node: any): boolean {
    if (this.visitCount >= this.maxVisits) return false
    if (node === null || node === undefined) return false

    if (this.isValidObject(node)) {
      if (this.visited.has(node)) return false
      this.visited.add(node)
      this.visitCount++
      return true
    }

    if (this.visitedPrimitives.has(node)) return false
    this.visitedPrimitives.add(node)
    this.visitCount++
    return true
  }

  hasVisited(node: any): boolean {
    if (node === null || node === undefined) return false
    if (this.isValidObject(node)) return this.visited.has(node)
    return this.visitedPrimitives.has(node)
  }

  getVisitCount(): number {
    return this.visitCount
  }

  isLimitReached(): boolean {
    return this.visitCount >= this.maxVisits
  }

  clear(): void {
    this.visited = new WeakSet()
    this.visitedPrimitives.clear()
    this.visitCount = 0
  }
}

// ============================================================================
// Legacy exports (for backwards compatibility)
// ============================================================================

// ComponentCache type alias for backwards compatibility
export type ComponentCache<T> = ComponentStore

export function getComponentCache(): ComponentStore {
  return getComponentStore()
}

export function generateVNodeCacheKey(vnode: any, rootIndex: number): string {
  const uid = vnode?.component?.uid ?? vnode?._uid ?? 'unknown'
  const name = vnode?.component?.type?.name ?? vnode?.$options?.name ?? 'anon'
  return `${rootIndex}:${uid}:${name}`
}

// Export types
export type { ComponentStore, CacheConfig as ComponentCacheConfig }
