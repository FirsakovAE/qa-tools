// src/injected/props/collect.ts

/**
 * Component collection with delta updates and lazy serialization.
 * 
 * Key optimizations:
 * - Uses WeakMap-based store to prevent memory leaks
 * - Delta updates: only processes changed components
 * - Lazy serialization: props are serialized only when requested
 * - Reuses existing ComponentRef objects when unchanged
 */

import { serializeProps } from './serialize'
import { getElementInfo, findComponentRootEl, generateUniqueSelector } from './dom-mapping'
import { 
  TraversalState, 
  getComponentStore, 
  generatePropsHash, 
  havePropsChanged,
  type ComponentRef,
  type ComponentInfo,
  type ElementInfo
} from './cache'

// ============================================================================
// Types
// ============================================================================

interface VueInstance {
  _uid?: number
  uid?: number
  $options?: { name?: string }
  type?: { name?: string; __name?: string; displayName?: string }
  props?: Record<string, any>
  $props?: Record<string, any>
  propsData?: Record<string, any>
  _props?: Record<string, any>
  subTree?: any
  root?: any
  _instance?: any
  _container?: any
  setupState?: any
}

interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}

// ============================================================================
// Constants
// ============================================================================

const MAX_DEPTH = 100

// ============================================================================
// UID Cache (WeakMap for automatic GC)
// ============================================================================

const uidCache = new WeakMap<object, string>()

function getComponentUid(instance: any): string {
  if (!instance) return `anon_${Math.random().toString(36).substr(2, 9)}`
  
  if (uidCache.has(instance)) {
    return uidCache.get(instance)!
  }
  
  const uid = instance.uid ?? instance._uid ?? `anon_${Math.random().toString(36).substr(2, 9)}`
  const uidStr = String(uid)
  uidCache.set(instance, uidStr)
  return uidStr
}

function getComponentName(instance: any): string {
  if (!instance) return 'Anonymous'
  
  return instance.type?.name ||
    instance.type?.__name ||
    instance.type?.displayName ||
    instance.$options?.name ||
    'Anonymous'
}

// ============================================================================
// Raw Props Extraction (no serialization)
// ============================================================================

/**
 * Get raw props reference without serialization
 */
function getRawProps(instance: any): object | null {
  if (!instance) return null
  return instance.props || instance.$props || instance.propsData || instance._props || null
}

// ============================================================================
// Component Reference Creation (with delta detection)
// ============================================================================

/**
 * Create or update a ComponentRef with delta detection.
 * Returns the existing ref if unchanged, new ref if changed.
 */
function createOrUpdateComponentRef(
  instance: any,
  vnode: any,
  compPath: string,
  rootElement: HTMLElement
): ComponentRef | null {
  if (!instance) return null
  
  const store = getComponentStore()
  const uid = getComponentUid(instance)
  const name = getComponentName(instance)
  const el = vnode?.el || vnode?.elm
  
  // Generate component ID with selector
  let componentId = uid
  if (el instanceof HTMLElement) {
    const uniqueSelector = generateUniqueSelector(el)
    if (uniqueSelector) {
      componentId = `${componentId}::${uniqueSelector}`
    }
    const textContent = el.textContent
    if (textContent && textContent.length > 0 && textContent.length < 50) {
      const trimmedText = textContent.trim().replace(/\s+/g, ' ')
      if (trimmedText.length > 0) {
        componentId = `${componentId}::text:${trimmedText}`
      }
    }
  }
  
  const path = `${compPath}::${name}::${componentId}`
  
  // Check if component already exists and props haven't changed
  const existing = store.getByInstance(instance)
  const rawProps = getRawProps(instance)
  const newPropsHash = generatePropsHash(rawProps)
  
  if (existing && existing.propsHash === newPropsHash) {
    // No change - update timestamp and return existing
    existing.lastUpdated = Date.now()
    return existing
  }
  
  // Create element info (lightweight, always computed)
  const elementInfo = getElementInfo(el)
  const rootEl = findComponentRootEl(el)
  const rootElementInfo = rootEl ? getElementInfo(rootEl) : elementInfo
  
  // Create new ComponentRef with lazy props
  const ref: ComponentRef = {
    uid,
    name,
    path,
    instance,
    vnode,
    element: elementInfo,
    rootElement: rootElementInfo,
    lastUpdated: Date.now(),
    propsHash: newPropsHash,
    _serializedProps: null, // Lazy - serialized on demand
    _rawPropsRef: rawProps ? new WeakRef(rawProps as object) : null
  }
  
  // Store in WeakMap-based store
  store.set(instance, ref)
  
  return ref
}

/**
 * Get serialized props from ComponentRef (lazy serialization)
 */
export function getSerializedProps(ref: ComponentRef): Record<string, any> {
  // Return cached if available
  if (ref._serializedProps) {
    return ref._serializedProps
  }
  
  // Try to get raw props from WeakRef
  const rawProps = ref._rawPropsRef?.deref()
  if (!rawProps) {
    return {}
  }
  
  // Serialize and cache
  const serialized = serializeProps(rawProps)
  ref._serializedProps = serialized
  return serialized
}

/**
 * Convert ComponentRef to public ComponentInfo (with lazy props)
 */
export function componentRefToInfo(ref: ComponentRef): ComponentInfo {
  const props = getSerializedProps(ref)
  const propsCount = Object.keys(props).length
  
  return {
    name: ref.name,
    props,
    path: ref.path,
    element: ref.element,
    hasProps: propsCount > 0,
    propsCount,
    rootElement: ref.rootElement
  }
}

/**
 * Convert ComponentRef to lightweight info (without serializing props)
 * Use this for listing components when props aren't needed
 */
export function componentRefToLightInfo(ref: ComponentRef): ComponentInfo {
  // Count props without serializing
  const rawProps = ref._rawPropsRef?.deref()
  const propsCount = rawProps ? Object.keys(rawProps).length : 0
  
  return {
    name: ref.name,
    props: {}, // Empty - will be loaded lazily if needed
    path: ref.path,
    element: ref.element,
    hasProps: propsCount > 0,
    propsCount,
    rootElement: ref.rootElement
  }
}

// ============================================================================
// Vue Version Detection
// ============================================================================

function isVue3Component(vnode: any, vueContext: VueContext): boolean {
  return vueContext.version === 3 && !!vnode.component
}

function isVue2Component(vnode: any, vueContext: VueContext): boolean {
  return vueContext.version === 2 && !!(vnode.componentInstance || vnode.context)
}

// ============================================================================
// Component Processing (Delta-aware)
// ============================================================================

function processVue3Component(
  vnode: any,
  path: string,
  rootElement: HTMLElement,
  depth: number,
  state: TraversalState,
  vueContext: VueContext,
  results: ComponentRef[]
): void {
  const ref = createOrUpdateComponentRef(vnode.component, vnode, path || 'root', rootElement)
  if (ref) {
    results.push(ref)
  }

  if (vnode.component.subTree) {
    collectComponentsIterative(
      vnode.component.subTree,
      `${path || 'root'}.subTree`,
      depth + 1,
      rootElement,
      state,
      vueContext,
      results
    )
  }
}

function processVue2Component(
  vnode: any,
  path: string,
  rootElement: HTMLElement,
  depth: number,
  state: TraversalState,
  vueContext: VueContext,
  results: ComponentRef[]
): void {
  const instance = vnode.componentInstance || vnode.context
  if (!instance) return

  const ref = createOrUpdateComponentRef(instance, vnode, path || 'root', rootElement)
  if (ref) {
    results.push(ref)
  }

  if (instance.$children && Array.isArray(instance.$children)) {
    for (let i = 0; i < instance.$children.length; i++) {
      const child = instance.$children[i]
      if (child.$vnode && state.visit(child.$vnode)) {
        collectComponentsIterative(
          child.$vnode,
          `${path || 'root'}.children[${i}]`,
          depth + 1,
          rootElement,
          state,
          vueContext,
          results
        )
      }
    }
  }
}

function processChildren(
  vnode: any,
  path: string,
  depth: number,
  rootElement: HTMLElement,
  state: TraversalState,
  vueContext: VueContext,
  results: ComponentRef[]
): void {
  if (Array.isArray(vnode.children)) {
    for (let i = 0; i < vnode.children.length; i++) {
      const child = vnode.children[i]
      if (child && state.visit(child)) {
        collectComponentsIterative(
          child,
          `${path || 'root'}.children[${i}]`,
          depth + 1,
          rootElement,
          state,
          vueContext,
          results
        )
      }
    }
  } else if (vnode.children && typeof vnode.children === 'object') {
    if (state.visit(vnode.children)) {
      collectComponentsIterative(
        vnode.children,
        `${path || 'root'}.children`,
        depth + 1,
        rootElement,
        state,
        vueContext,
        results
      )
    }
  }
}

function collectComponentsIterative(
  vnode: any,
  path: string,
  depth: number,
  rootElement: HTMLElement,
  state: TraversalState,
  vueContext: VueContext,
  results: ComponentRef[]
): void {
  if (!vnode || depth > MAX_DEPTH || state.isLimitReached()) {
    return
  }

  const isVue3 = isVue3Component(vnode, vueContext)
  const isVue2 = isVue2Component(vnode, vueContext)

  if (isVue3) {
    processVue3Component(vnode, path, rootElement, depth, state, vueContext, results)
  } else if (isVue2) {
    processVue2Component(vnode, path, rootElement, depth, state, vueContext, results)
  }

  processChildren(vnode, path, depth, rootElement, state, vueContext, results)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Collect component references from VNode tree.
 * Uses delta updates - only creates new refs for changed components.
 * Returns ComponentRef array (props are serialized lazily).
 */
export function collectComponentRefs(
  vnode: any,
  path = '',
  depth = 0,
  rootElement: HTMLElement,
  state: TraversalState,
  vueContext: VueContext
): ComponentRef[] {
  const results: ComponentRef[] = []
  
  if (!vnode || !state.visit(vnode)) {
    return results
  }

  collectComponentsIterative(vnode, path, depth, rootElement, state, vueContext, results)

  return results
}

/**
 * Legacy function - collects components and converts to ComponentInfo.
 * For backwards compatibility.
 */
export function collectComponentsRecursively(
  vnode: any,
  path = '',
  depth = 0,
  rootElement: HTMLElement,
  collected: Set<any> | TraversalState = new Set(),
  vueContext: VueContext
): ComponentInfo[] {
  let state: TraversalState
  if (collected instanceof TraversalState) {
    state = collected
  } else {
    state = new TraversalState()
  }

  const refs = collectComponentRefs(vnode, path, depth, rootElement, state, vueContext)
  
  // Convert refs to ComponentInfo with serialized props
  return refs.map(componentRefToInfo)
}

/**
 * Get all cached components without re-traversing the tree.
 * Returns components from the WeakMap store (automatically excludes GC'd components).
 */
export function getCachedComponents(): ComponentRef[] {
  const store = getComponentStore()
  return store.getAllComponents()
}

/**
 * Get all cached components as ComponentInfo (with lazy serialization)
 */
export function getCachedComponentsAsInfo(): ComponentInfo[] {
  return getCachedComponents().map(componentRefToInfo)
}

// Re-export for backwards compatibility
export function createComponentInfo(
  instance: any,
  vnodeNode: any,
  compPath: string,
  rootElement: HTMLElement
): ComponentInfo | null {
  const ref = createOrUpdateComponentRef(instance, vnodeNode, compPath, rootElement)
  return ref ? componentRefToInfo(ref) : null
}

export { createComponentInfo as addComponent }

// Re-export types from cache
export type { ComponentRef, ComponentInfo, ElementInfo } from './cache'
