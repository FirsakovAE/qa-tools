// src/injected/props/structure-scanner.ts

/**
 * 📐 Structure Scanner - Auto-refresh component structure without reading props
 * 
 * What it does:
 * - Detects mount/unmount
 * - Updates meta (name, label, root)
 * - Updates structural indexes
 * - Updates visibility
 * 
 * ❗ Does NOT read props
 */

import { findVueRoots, extractRootVNode } from './vue-detect'
import { getMetaStore, type ComponentMeta } from './meta-store'
import { TraversalState } from './cache'

// ============================================================================
// Types
// ============================================================================

interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}

interface ScanResult {
  total: number
  mounted: number
  unmounted: number
  updated: number
  duration: number
}

interface ScannerConfig {
  maxDepth: number
  maxComponents: number
}

const DEFAULT_CONFIG: ScannerConfig = {
  maxDepth: 100,
  maxComponents: 10000
}

// ============================================================================
// State
// ============================================================================

let lastScanTime = 0
let lastSeenUids = new Set<number>()
let scanningPaused = false
let visibilityThrottleMultiplier = 1

const stats = {
  totalScans: 0,
  lastScanDuration: 0,
  lastScanResult: null as ScanResult | null,
  skippedDueToVisibility: 0
}

// ============================================================================
// Visibility-Aware Throttling
// ============================================================================

/**
 * Initialize visibility change listener
 * When page is hidden, we significantly reduce scanning
 */
export function initVisibilityAwareness(): void {
  if (typeof document === 'undefined') return
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Page is hidden - reduce scanning by 10x
      visibilityThrottleMultiplier = 10
      console.debug('[VueInspector] Page hidden - reducing scan frequency')
    } else {
      // Page is visible - normal scanning
      visibilityThrottleMultiplier = 1
      console.debug('[VueInspector] Page visible - normal scan frequency')
    }
  })
}

/**
 * Pause scanning completely
 */
export function pauseScanning(): void {
  scanningPaused = true
}

/**
 * Resume scanning
 */
export function resumeScanning(): void {
  scanningPaused = false
}

/**
 * Check if scanning is currently paused
 */
export function isScanningPaused(): boolean {
  return scanningPaused
}

/**
 * Get the current throttle multiplier based on visibility
 */
export function getThrottleMultiplier(): number {
  return visibilityThrottleMultiplier
}

/**
 * Check if we should skip this scan based on visibility and throttle
 */
function shouldSkipScan(minIntervalMs: number): boolean {
  if (scanningPaused) {
    stats.skippedDueToVisibility++
    return true
  }
  
  const effectiveInterval = minIntervalMs * visibilityThrottleMultiplier
  const now = Date.now()
  
  if (now - lastScanTime < effectiveInterval) {
    return true
  }
  
  return false
}

// ============================================================================
// Component Name/Label Extraction
// ============================================================================

function getComponentName(instance: any): string {
  if (!instance) return 'Anonymous'

  return (
    instance.type?.name ||
    instance.type?.__name ||
    instance.type?.displayName ||
    instance.$options?.name ||
    instance.$options?._componentTag ||
    'Anonymous'
  )
}

function getComponentLabel(instance: any, vnode: any): string | undefined {
  // Try to get a meaningful label from:
  // 1. data-testid or data-test
  // 2. Component's ref name
  // 3. Key if it's a list item
  
  const el = vnode?.el || vnode?.elm
  if (el instanceof HTMLElement) {
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test')
    if (testId) return testId
  }

  // Ref name
  if (vnode?.ref) {
    if (typeof vnode.ref === 'string') return vnode.ref
    if (vnode.ref?.i) return String(vnode.ref.i)
  }

  // Key
  if (vnode?.key !== undefined && vnode?.key !== null) {
    return `key:${vnode.key}`
  }

  return undefined
}

function getComponentRootEl(instance: any, vnode: any): HTMLElement | undefined {
  // Vue 3
  if (vnode?.el instanceof HTMLElement) {
    return vnode.el
  }

  // Vue 2
  if (vnode?.elm instanceof HTMLElement) {
    return vnode.elm
  }

  // Instance.$el
  if (instance?.$el instanceof HTMLElement) {
    return instance.$el
  }

  return undefined
}

// ============================================================================
// VNode Traversal (Structure Only)
// ============================================================================

function processVue3Component(
  vnode: any,
  state: TraversalState,
  currentUids: Set<number>
): { mounted: number; updated: number } {
  let mounted = 0
  let updated = 0

  const instance = vnode.component
  if (!instance) return { mounted, updated }

  const store = getMetaStore()
  const existingMeta = store.getByInstance(instance)

  const name = getComponentName(instance)
  const label = getComponentLabel(instance, vnode)
  const rootEl = getComponentRootEl(instance, vnode)

  if (existingMeta) {
    // Update existing
    const result = store.registerComponent(instance, {
      uid: existingMeta.uid,
      name,
      label,
      vnode,
      rootEl
    })
    currentUids.add(result.uid)
    updated++
  } else {
    // Register new
    const meta = store.registerComponent(instance, {
      name,
      label,
      vnode,
      rootEl
    })
    currentUids.add(meta.uid)
    mounted++
  }

  // Process subtree
  if (instance.subTree) {
    const result = scanVNodeTree(instance.subTree, state, currentUids, 3)
    mounted += result.mounted
    updated += result.updated
  }

  return { mounted, updated }
}

function processVue2Component(
  vnode: any,
  state: TraversalState,
  currentUids: Set<number>
): { mounted: number; updated: number } {
  let mounted = 0
  let updated = 0

  const instance = vnode.componentInstance || vnode.context
  if (!instance) return { mounted, updated }

  const store = getMetaStore()
  const existingMeta = store.getByInstance(instance)

  const name = getComponentName(instance)
  const label = getComponentLabel(instance, vnode)
  const rootEl = getComponentRootEl(instance, vnode)

  if (existingMeta) {
    // Update existing
    const result = store.registerComponent(instance, {
      uid: existingMeta.uid,
      name,
      label,
      vnode,
      rootEl
    })
    currentUids.add(result.uid)
    updated++
  } else {
    // Register new
    const meta = store.registerComponent(instance, {
      name,
      label,
      vnode,
      rootEl
    })
    currentUids.add(meta.uid)
    mounted++
  }

  // Process children
  if (instance.$children && Array.isArray(instance.$children)) {
    for (const child of instance.$children) {
      if (child.$vnode && state.visit(child.$vnode)) {
        const result = scanVNodeTree(child.$vnode, state, currentUids, 2)
        mounted += result.mounted
        updated += result.updated
      }
    }
  }

  return { mounted, updated }
}

function scanVNodeTree(
  vnode: any,
  state: TraversalState,
  currentUids: Set<number>,
  vueVersion: 2 | 3,
  depth = 0
): { mounted: number; updated: number } {
  let mounted = 0
  let updated = 0

  if (!vnode || depth > DEFAULT_CONFIG.maxDepth || state.isLimitReached()) {
    return { mounted, updated }
  }

  // Process component
  if (vueVersion === 3 && vnode.component) {
    const result = processVue3Component(vnode, state, currentUids)
    mounted += result.mounted
    updated += result.updated
  } else if (vueVersion === 2 && (vnode.componentInstance || vnode.context)) {
    const result = processVue2Component(vnode, state, currentUids)
    mounted += result.mounted
    updated += result.updated
  }

  // Process children
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (child && state.visit(child)) {
        const result = scanVNodeTree(child, state, currentUids, vueVersion, depth + 1)
        mounted += result.mounted
        updated += result.updated
      }
    }
  } else if (vnode.children && typeof vnode.children === 'object') {
    if (state.visit(vnode.children)) {
      const result = scanVNodeTree(vnode.children, state, currentUids, vueVersion, depth + 1)
      mounted += result.mounted
      updated += result.updated
    }
  }

  return { mounted, updated }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Scan component structure (NO props reading).
 * Used for auto-refresh to detect mount/unmount and update metadata.
 * 
 * @param options.minIntervalMs - Minimum interval between scans (default: 100ms)
 * @param options.force - Force scan even if paused or throttled
 */
export function scanStructure(options: { minIntervalMs?: number; force?: boolean } = {}): ScanResult {
  const { minIntervalMs = 100, force = false } = options
  
  // Check visibility-aware throttling (unless forced)
  if (!force && shouldSkipScan(minIntervalMs)) {
    return stats.lastScanResult ?? {
      total: 0,
      mounted: 0,
      unmounted: 0,
      updated: 0,
      duration: 0
    }
  }
  
  const startTime = performance.now()
  const store = getMetaStore()
  const vueRoots = findVueRoots()
  
  let total = 0
  let mounted = 0
  let updated = 0
  
  const currentUids = new Set<number>()

  if (vueRoots.length > 0) {
    for (const root of vueRoots) {
      const rootVNode = extractRootVNode(root)
      if (!rootVNode) continue

      const isVue2 = root.__vue__ && !root.__vue_app__
      const vueVersion = isVue2 ? 2 : 3

      const state = new TraversalState(DEFAULT_CONFIG.maxComponents)
      state.visit(rootVNode)

      const result = scanVNodeTree(rootVNode, state, currentUids, vueVersion)
      mounted += result.mounted
      updated += result.updated
    }
  }

  // Detect unmounted components
  let unmounted = 0
  for (const uid of lastSeenUids) {
    if (!currentUids.has(uid)) {
      const meta = store.getByUid(uid)
      if (meta) {
        store.unregisterComponent(meta.instance)
        unmounted++
      }
    }
  }

  // Update last seen
  lastSeenUids = currentUids
  total = currentUids.size

  // Update stats
  const duration = performance.now() - startTime
  stats.totalScans++
  stats.lastScanDuration = duration
  lastScanTime = Date.now()

  const result: ScanResult = {
    total,
    mounted,
    unmounted,
    updated,
    duration
  }

  stats.lastScanResult = result
  return result
}

/**
 * Get lightweight component list (structure only, no props).
 * Use this for rendering the component tree.
 */
export function getComponentList(): Array<{
  uid: number
  name: string
  label?: string
  hasRootEl: boolean
  isExpanded: boolean
}> {
  const store = getMetaStore()
  return store.getAllComponents().map(meta => ({
    uid: meta.uid,
    name: meta.name ?? 'Anonymous',
    label: meta.label,
    hasRootEl: !!meta.rootEl,
    isExpanded: meta.isExpanded
  }))
}

/**
 * Get scanner statistics
 */
export function getScannerStats(): {
  totalScans: number
  lastScanDuration: number
  lastScanResult: ScanResult | null
  lastScanTime: number
  skippedDueToVisibility: number
  isPaused: boolean
  throttleMultiplier: number
} {
  return {
    ...stats,
    lastScanTime,
    isPaused: scanningPaused,
    throttleMultiplier: visibilityThrottleMultiplier
  }
}

/**
 * Reset scanner state (for testing or refresh)
 */
export function resetScanner(): void {
  lastSeenUids.clear()
  lastScanTime = 0
  stats.totalScans = 0
  stats.lastScanDuration = 0
  stats.lastScanResult = null
}
