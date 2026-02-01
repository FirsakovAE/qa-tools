// src/injected/props/props-reader.ts

/**
 * 📐 Props Reader - Lazy props loading with delta detection
 * 
 * CRITICAL RULES:
 * 1. For DISPLAY: use serializeProps() which handles depth limits safely
 * 2. For SNAPSHOT/HASH: use lightweight key-based hash (no deep copy)
 * 3. Props read only for: expanded, logged, or explicit request
 * 4. Editing requires access to LIVE props reference
 */

import { getMetaStore, type ComponentMeta, type PropsSnapshot } from './meta-store'
import { serializeProps } from './serialize'

// ============================================================================
// Types
// ============================================================================

export interface SerializedProps {
  /** Serialized props for display */
  props: Record<string, any>
  /** Props count */
  count: number
  /** Whether props were actually loaded */
  loaded: boolean
  /** Last update time */
  lastUpdated: number
}

export interface ComponentWithProps {
  uid: number
  name: string
  label?: string
  hasRootEl: boolean
  isExpanded: boolean
  props: SerializedProps
}

export interface PropsDiff {
  uid: number
  timestamp: number
  changes: Record<string, { old: any; new: any }>
}

// ============================================================================
// Raw Props Extraction
// ============================================================================

/**
 * Get LIVE props reference from Vue instance.
 * Used for:
 * - Full serialization (serializeProps handles depth limits)
 * - Props editing (needs live reference)
 * 
 * NOTE: Do NOT store this reference long-term. Use for immediate operations only.
 */
export function extractRawProps(instance: any): Record<string, any> | null {
  if (!instance) return null

  // Vue 3
  if (instance.props) {
    return instance.props
  }
  // Vue 2
  if (instance.$props) {
    return instance.$props
  }
  if (instance.propsData) {
    return instance.propsData
  }
  if (instance._props) {
    return instance._props
  }

  return null
}

/**
 * Get LIVE props reference for editing purposes.
 * Returns the actual reactive props object.
 */
export function getLivePropsForEditing(instance: any): Record<string, any> | null {
  return extractRawProps(instance)
}

/**
 * Get Vue instance from ComponentMeta
 */
function getVueInstance(meta: ComponentMeta): any {
  return meta.instance
}

// ============================================================================
// Props Hash (lightweight, for change detection)
// ============================================================================

/**
 * Create a lightweight hash for change detection.
 * Does NOT serialize full props - just checks structure.
 */
function createPropsHash(props: Record<string, any>): string {
  if (!props || typeof props !== 'object') return 'empty'

  try {
    const keys = Object.keys(props)
    if (keys.length === 0) return 'empty'

    const parts: string[] = [`k${keys.length}`]
    
    // Check first 20 keys for basic type info
    for (const key of keys.slice(0, 20)) {
      const value = props[key]
      const type = typeof value
      
      if (value === null) {
        parts.push(`${key}:null`)
      } else if (value === undefined) {
        parts.push(`${key}:undef`)
      } else if (type === 'string') {
        // Include first 20 chars for better change detection
        parts.push(`${key}:s${value.length}:${value.substring(0, 20)}`)
      } else if (type === 'number') {
        parts.push(`${key}:n${value}`)
      } else if (type === 'boolean') {
        parts.push(`${key}:b${value}`)
      } else if (Array.isArray(value)) {
        parts.push(`${key}:a${value.length}`)
      } else if (type === 'object') {
        parts.push(`${key}:o${Object.keys(value).length}`)
      } else {
        parts.push(`${key}:${type}`)
      }
    }

    return parts.join('|')
  } catch {
    return 'error'
  }
}

// ============================================================================
// Props Reading (Lazy) - WITH SCOPE CHECK
// ============================================================================

/**
 * Check if component should have props read
 */
function shouldReadProps(meta: ComponentMeta): boolean {
  // Only read props for:
  // 1. Expanded components
  // 2. Logged components
  return meta.isExpanded || loggedComponents.has(meta.uid)
}

/**
 * Read and serialize props for a component (lazy loading with caching).
 * Uses serializeProps() which handles depth limits safely.
 * 
 * CRITICAL: Only reads if component is expanded or logged
 */
export function readComponentProps(meta: ComponentMeta): SerializedProps {
  const store = getMetaStore()
  
  // Check if we should read props at all
  if (!shouldReadProps(meta)) {
    // Return empty if not in scope
    return {
      props: {},
      count: 0,
      loaded: false,
      lastUpdated: 0
    }
  }
  
  const instance = getVueInstance(meta)
  const rawProps = extractRawProps(instance)

  if (!rawProps) {
    return {
      props: {},
      count: 0,
      loaded: false,
      lastUpdated: 0
    }
  }

  // Update hash for change detection (lightweight)
  const newHash = createPropsHash(rawProps)
  const prevHash = meta.propsSnapshot?.hash
  
  if (prevHash !== newHash) {
    // Props changed - update snapshot
    meta.propsSnapshot = {
      raw: rawProps, // Store reference (will be GC'd with component)
      lastUpdated: Date.now(),
      hash: newHash
    }
    meta.propsUpdateCount++
  }

  // Serialize for display using serializeProps (handles depth limits)
  const serialized = serializeProps(rawProps)
  
  return {
    props: serialized,
    count: Object.keys(serialized).length,
    loaded: true,
    lastUpdated: meta.propsSnapshot?.lastUpdated ?? Date.now()
  }
}

/**
 * Read props by component UID.
 * This is an EXPLICIT request, so we always read props regardless of expanded state.
 */
export function readPropsByUid(uid: number): SerializedProps | null {
  const store = getMetaStore()
  const meta = store.getByUid(uid)

  if (!meta) return null

  // Explicit request - read props regardless of expanded state
  return readComponentPropsForce(meta)
}

/**
 * Force read props (bypasses shouldReadProps check).
 * Used for explicit user requests like viewing selected component.
 */
function readComponentPropsForce(meta: ComponentMeta): SerializedProps {
  const instance = getVueInstance(meta)
  const rawProps = extractRawProps(instance)

  if (!rawProps) {
    return {
      props: {},
      count: 0,
      loaded: false,
      lastUpdated: 0
    }
  }

  // Update hash for change detection (lightweight)
  const newHash = createPropsHash(rawProps)
  const prevHash = meta.propsSnapshot?.hash
  
  if (prevHash !== newHash) {
    // Props changed - update snapshot
    meta.propsSnapshot = {
      raw: rawProps,
      lastUpdated: Date.now(),
      hash: newHash
    }
    meta.propsUpdateCount++
  }

  // Serialize for display using serializeProps (handles depth limits)
  const serialized = serializeProps(rawProps)
  
  return {
    props: serialized,
    count: Object.keys(serialized).length,
    loaded: true,
    lastUpdated: meta.propsSnapshot?.lastUpdated ?? Date.now()
  }
}

/**
 * Read props for expanded components only.
 * This is the SAFE way to get props for UI.
 */
export function readExpandedComponentsProps(): ComponentWithProps[] {
  const store = getMetaStore()
  const expandedMetas = store.getExpandedComponents()

  return expandedMetas.map(meta => ({
    uid: meta.uid,
    name: meta.name ?? 'Anonymous',
    label: meta.label,
    hasRootEl: !!meta.rootEl,
    isExpanded: meta.isExpanded,
    props: readComponentProps(meta)
  }))
}

/**
 * Expand a component and read its props.
 * Use this when user clicks to expand.
 */
export function expandAndReadProps(uid: number): ComponentWithProps | null {
  const store = getMetaStore()
  const meta = store.getByUid(uid)

  if (!meta) return null

  // Mark as expanded FIRST (so readComponentProps works)
  store.setExpanded(uid, true)

  return {
    uid: meta.uid,
    name: meta.name ?? 'Anonymous',
    label: meta.label,
    hasRootEl: !!meta.rootEl,
    isExpanded: true,
    props: readComponentProps(meta)
  }
}

/**
 * Collapse a component and clear its props snapshot.
 * Use this when user collapses to free memory.
 */
export function collapseAndClearProps(uid: number): void {
  const store = getMetaStore()
  const meta = store.getByUid(uid)

  if (!meta) return

  // Mark as collapsed
  store.setExpanded(uid, false)

  // Clear props to free memory (unless logged)
  if (!loggedComponents.has(uid)) {
    store.clearPropsSnapshot(meta)
  }
}

// ============================================================================
// Batch Props Reading (for explicit requests only)
// ============================================================================

/**
 * Read props for multiple components - EXPLICIT CALL ONLY
 * Use sparingly, this bypasses scope checks
 */
export function batchReadPropsExplicit(uids: number[]): Map<number, SerializedProps> {
  const results = new Map<number, SerializedProps>()
  const store = getMetaStore()

  for (const uid of uids) {
    const meta = store.getByUid(uid)
    if (meta) {
      // Force read by temporarily marking as expanded
      const wasExpanded = meta.isExpanded
      meta.isExpanded = true
      results.set(uid, readComponentProps(meta))
      meta.isExpanded = wasExpanded
    }
  }

  return results
}

/**
 * Check if component props have changed since last read.
 */
export function hasPropsChanged(uid: number): boolean {
  const store = getMetaStore()
  const meta = store.getByUid(uid)

  if (!meta) return false
  if (!meta.propsSnapshot) return true

  const instance = getVueInstance(meta)
  const rawProps = extractRawProps(instance)

  if (!rawProps) return false

  // Compare hash
  const currentHash = createPropsHash(rawProps)
  return currentHash !== meta.propsSnapshot.hash
}

// ============================================================================
// Logging Support - DIFF ONLY
// ============================================================================

let loggingEnabled = false
const loggedComponents = new Set<number>()
const logHistory = new Map<number, PropsDiff[]>()
const MAX_LOG_HISTORY = 50 // Per component

/**
 * Enable props logging for a component
 */
export function enablePropsLogging(uid: number): void {
  loggedComponents.add(uid)
  loggingEnabled = loggedComponents.size > 0
  
  // Initialize history
  if (!logHistory.has(uid)) {
    logHistory.set(uid, [])
  }
}

/**
 * Disable props logging for a component
 */
export function disablePropsLogging(uid: number): void {
  loggedComponents.delete(uid)
  loggingEnabled = loggedComponents.size > 0
  
  // Clear history
  logHistory.delete(uid)
  
  // Clear props snapshot if not expanded
  const store = getMetaStore()
  const meta = store.getByUid(uid)
  if (meta && !meta.isExpanded) {
    store.clearPropsSnapshot(meta)
  }
}

/**
 * Check if logging is enabled for any component
 */
export function isLoggingEnabled(): boolean {
  return loggingEnabled
}

/**
 * Get components being logged
 */
export function getLoggedComponents(): number[] {
  return Array.from(loggedComponents)
}

/**
 * Record props diff for a logged component - DIFF ONLY, not full props
 */
export function recordPropsDiff(uid: number, prevProps: Record<string, any> | null, nextProps: Record<string, any>): void {
  if (!loggedComponents.has(uid)) return
  
  const diff: Record<string, { old: any; new: any }> = {}
  
  // Compute diff (shallow)
  const prevKeys = prevProps ? Object.keys(prevProps) : []
  const nextKeys = Object.keys(nextProps)
  const allKeys = new Set([...prevKeys, ...nextKeys])
  
  for (const key of allKeys) {
    const oldVal = prevProps?.[key]
    const newVal = nextProps[key]
    
    if (oldVal !== newVal) {
      // Store only primitive representation, not live refs
      diff[key] = {
        old: toPrimitiveValue(oldVal),
        new: toPrimitiveValue(newVal)
      }
    }
  }
  
  if (Object.keys(diff).length === 0) return
  
  const history = logHistory.get(uid) ?? []
  history.push({
    uid,
    timestamp: Date.now(),
    changes: diff
  })
  
  // Limit history size
  if (history.length > MAX_LOG_HISTORY) {
    history.shift()
  }
  
  logHistory.set(uid, history)
}

/**
 * Get props change history for a logged component
 */
export function getPropsHistory(uid: number): PropsDiff[] {
  return logHistory.get(uid) ?? []
}

/**
 * Convert value to primitive representation for storage (logging only)
 */
function toPrimitiveValue(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'function') {
    return '[Function]'
  }
  if (Array.isArray(value)) {
    return `[Array(${value.length})]`
  }
  if (typeof value === 'object') {
    return `[Object(${Object.keys(value).length})]`
  }
  return String(value)
}

/**
 * Read props for logged components and record diff
 * Called during auto-refresh if logging enabled
 */
export function updateLoggedComponentsProps(): PropsDiff[] {
  if (!loggingEnabled) return []

  const store = getMetaStore()
  const diffs: PropsDiff[] = []

  for (const uid of loggedComponents) {
    const meta = store.getByUid(uid)
    if (!meta) continue

    const instance = getVueInstance(meta)
    const rawProps = extractRawProps(instance)
    if (!rawProps) continue

    // Get previous hash
    const prevHash = meta.propsSnapshot?.hash
    const newHash = createPropsHash(rawProps)
    
    if (prevHash !== newHash) {
      // Props changed
      const prevProps = meta.propsSnapshot?.raw as Record<string, any> | undefined
      
      // Update snapshot
      meta.propsSnapshot = {
        raw: rawProps,
        lastUpdated: Date.now(),
        hash: newHash
      }
      
      // Record diff
      if (prevProps) {
        recordPropsDiff(uid, prevProps, rawProps)
        
        const history = logHistory.get(uid)
        if (history && history.length > 0) {
          diffs.push(history[history.length - 1])
        }
      }
    }
  }

  return diffs
}
