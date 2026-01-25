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

import { findVueRoots, extractRootVNode } from './vue-detect'
import { 
  collectComponentRefs, 
  componentRefToInfo,
  getCachedComponents,
  getCachedComponentsAsInfo,
  type ComponentRef
} from './collect'
import { 
  TraversalState, 
  getComponentStore,
  type ComponentInfo
} from './cache'

// ============================================================================
// Types
// ============================================================================

interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface CollectionStats {
  lastCollectionTime: number
  lastCollectionDuration: number
  totalCollections: number
  deltaUpdates: number
  fullCollections: number
  cacheHits: number
}

// ============================================================================
// State
// ============================================================================

let lastCollectionTime = 0
let lastRootsHash = ''
const DEBOUNCE_MS = 50

const stats: CollectionStats = {
  lastCollectionTime: 0,
  lastCollectionDuration: 0,
  totalCollections: 0,
  deltaUpdates: 0,
  fullCollections: 0,
  cacheHits: 0
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a hash of Vue roots for change detection
 */
function getRootsHash(roots: VueHTMLElement[]): string {
  if (roots.length === 0) return 'empty'
  
  const parts = roots.map((root, i) => {
    const app = root.__vue_app__
    const vue = root.__vue__
    const uid = app?._uid ?? vue?._uid ?? i
    return `${i}:${uid}`
  })
  
  return parts.join('|')
}

/**
 * Check if we should use cached components (debounce)
 */
function shouldUseCachedComponents(): boolean {
  const now = Date.now()
  if (now - lastCollectionTime < DEBOUNCE_MS) {
    const store = getComponentStore()
    const cached = store.getAllComponents()
    if (cached.length > 0) {
      return true
    }
  }
  return false
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get collection statistics
 */
export function getCollectionStats(): CollectionStats {
  return { ...stats }
}

/**
 * Reset collection statistics
 */
export function resetCollectionStats(): void {
  stats.lastCollectionTime = 0
  stats.lastCollectionDuration = 0
  stats.totalCollections = 0
  stats.deltaUpdates = 0
  stats.fullCollections = 0
  stats.cacheHits = 0
}

/**
 * Get Vue components with delta updates.
 * 
 * - Returns cached components if within debounce window
 * - Uses delta detection to reuse unchanged ComponentRef objects
 * - Serializes props lazily (only when accessed)
 * 
 * @returns Array of ComponentInfo with serialized props
 */
export function getVueComponents(): ComponentInfo[] {
  const now = Date.now()
  
  // Check debounce - return cached if recent
  if (shouldUseCachedComponents()) {
    stats.cacheHits++
    return getCachedComponentsAsInfo()
  }
  
  const startTime = performance.now()
  const allRefs: ComponentRef[] = []
  const vueRoots = findVueRoots()
  
  // Check if roots changed
  const currentRootsHash = getRootsHash(vueRoots)
  const rootsChanged = currentRootsHash !== lastRootsHash
  lastRootsHash = currentRootsHash
  
  if (vueRoots.length > 0) {
    for (let rootIndex = 0; rootIndex < vueRoots.length; rootIndex++) {
      const root = vueRoots[rootIndex]
      const rootVNode = extractRootVNode(root)
      
      if (!rootVNode) continue

      const isRootVue2 = root.__vue__ && !root.__vue_app__
      const vueContext: { version: 2 | 3; roots: VueHTMLElement[] } = {
        version: isRootVue2 ? 2 : 3,
        roots: vueRoots
      }

      // Use TraversalState with WeakSet for this traversal
      const traversalState = new TraversalState(10000)

      // Collect component refs (uses delta updates internally)
      const refs = collectComponentRefs(
        rootVNode,
        `root[${rootIndex}]`,
        0,
        root as HTMLElement,
        traversalState,
        vueContext
      )
      
      allRefs.push(...refs)
    }
  }

  // Update stats
  stats.lastCollectionTime = now
  stats.lastCollectionDuration = performance.now() - startTime
  stats.totalCollections++
  
  if (rootsChanged) {
    stats.fullCollections++
  } else {
    stats.deltaUpdates++
  }

  lastCollectionTime = now

  // Convert refs to ComponentInfo (props serialized lazily)
  return allRefs.map(componentRefToInfo)
}

/**
 * Get Vue components as lightweight info (without serializing props).
 * Use this when you only need to list components, not view their props.
 */
export function getVueComponentsLight(): ComponentInfo[] {
  const now = Date.now()
  
  if (shouldUseCachedComponents()) {
    stats.cacheHits++
    // Return cached without serializing props
    const cached = getCachedComponents()
    return cached.map(ref => ({
      name: ref.name,
      props: {}, // Don't serialize - lazy
      path: ref.path,
      element: ref.element,
      hasProps: ref.propsHash !== 'empty',
      propsCount: 0, // Unknown until serialized
      rootElement: ref.rootElement
    }))
  }
  
  // Fall back to full collection
  return getVueComponents()
}

/**
 * Get cached components without traversing the tree.
 * Returns components from WeakMap store (auto-excludes GC'd components).
 */
export function getCachedVueComponents(): ComponentInfo[] {
  return getCachedComponentsAsInfo()
}

/**
 * Force a fresh collection (ignores debounce and cache)
 */
export function forceRefreshComponents(): ComponentInfo[] {
  lastCollectionTime = 0
  lastRootsHash = ''
  return getVueComponents()
}

/**
 * Clear the component cache
 */
export function clearComponentCache(): void {
  lastCollectionTime = 0
  lastRootsHash = ''
  const store = getComponentStore()
  store.clear()
}

/**
 * Get a single component's props by path (lazy serialization)
 */
export function getComponentPropsByPath(path: string): Record<string, any> | null {
  const store = getComponentStore()
  const ref = store.getByPath(path)
  
  if (!ref) return null
  
  // Import getSerializedProps dynamically to avoid circular dependency
  const { getSerializedProps } = require('./collect')
  return getSerializedProps(ref)
}
