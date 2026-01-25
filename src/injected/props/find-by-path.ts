// src/injected/props/find-by-path.ts

import { findVueRoots, extractRootVNode, detectVueContext } from './vue-detect'
import { getVueComponents as getAllVueComponents } from './collect-all'
import { resolveAsyncComponent } from './async-wrapper'

// Define interfaces locally to avoid import issues
interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}

interface ComponentInfo {
  name: string
  props: Record<string, any>
  path: string
  element: ElementInfo | null
  hasProps: boolean
  propsCount: number
  rootElement: ElementInfo | null
}

interface ElementInfo {
  tagName?: string
  id?: string
  className?: string
  testId?: string
}

/**
 * Unified contract for resolved components
 */
export interface ResolvedComponent {
  /** Original vnode */
  vnode: any
  /** Component instance (for Vue 3) or instance (for Vue 2) */
  instance: any | null
  /** Target for writing props */
  propsTarget: Record<string, any> | null
  /** Vue 2 flag */
  isVue2: boolean
}

/**
 * Cache for recently found components (WeakMap to allow GC)
 */
const vnodeByElementCache = new WeakMap<HTMLElement, any>()

/**
 * Cache for path lookups with TTL
 */
interface PathCacheEntry {
  vnode: any
  timestamp: number
}

const pathCache = new Map<string, PathCacheEntry>()
const PATH_CACHE_TTL = 500 // 500ms TTL
const PATH_CACHE_MAX_SIZE = 100
const PATH_CACHE_CLEANUP_INTERVAL = 30000 // 30 seconds

// Periodic cleanup timer
let pathCacheCleanupTimer: ReturnType<typeof setInterval> | null = null

/**
 * Start periodic cleanup of pathCache
 */
function startPathCacheCleanup(): void {
  if (pathCacheCleanupTimer) return
  
  pathCacheCleanupTimer = setInterval(() => {
    cleanupPathCacheInternal()
  }, PATH_CACHE_CLEANUP_INTERVAL)
}

/**
 * Stop periodic cleanup of pathCache
 */
function stopPathCacheCleanup(): void {
  if (pathCacheCleanupTimer) {
    clearInterval(pathCacheCleanupTimer)
    pathCacheCleanupTimer = null
  }
}

/**
 * Internal cleanup function for pathCache
 */
function cleanupPathCacheInternal(): void {
  const now = Date.now()
  const toDelete: string[] = []
  
  for (const [key, entry] of pathCache) {
    if (now - entry.timestamp > PATH_CACHE_TTL) {
      toDelete.push(key)
    }
  }
  
  for (const key of toDelete) {
    pathCache.delete(key)
  }
  
  // If still over max size, remove oldest entries
  if (pathCache.size > PATH_CACHE_MAX_SIZE) {
    const entries = Array.from(pathCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    const toRemove = entries.slice(0, entries.length - PATH_CACHE_MAX_SIZE)
    for (const [key] of toRemove) {
      pathCache.delete(key)
    }
  }
}

// Start cleanup timer on module load
startPathCacheCleanup()

/**
 * Get from path cache with TTL check
 */
function getFromPathCache(key: string): any | null {
  const entry = pathCache.get(key)
  if (!entry) return null
  
  if (Date.now() - entry.timestamp > PATH_CACHE_TTL) {
    pathCache.delete(key)
    return null
  }
  
  return entry.vnode
}

/**
 * Set in path cache with size management
 */
function setInPathCache(key: string, vnode: any): void {
  if (pathCache.size >= PATH_CACHE_MAX_SIZE) {
    cleanupPathCacheInternal()
  }
  
  pathCache.set(key, {
    vnode,
    timestamp: Date.now()
  })
}

/**
 * Finds a Vue component associated with a given DOM element.
 * Uses caching to avoid repeated traversals.
 * 
 * @param element - DOM element to search for
 * @returns Found VNode component or null
 */
export function findVueComponentByElement(element: HTMLElement): any {
  // Check cache first
  if (vnodeByElementCache.has(element)) {
    return vnodeByElementCache.get(element)
  }
  
  const vueRoots = findVueRoots()
  
  for (const root of vueRoots) {
    const rootVNode = extractRootVNode(root)
    if (!rootVNode) continue

    const found = findVNodeByElement(rootVNode, element, new WeakSet())
    if (found) {
      vnodeByElementCache.set(element, found)
      return found
    }
  }

  return null
}

/**
 * Internal recursive vnode finder with cycle detection
 */
function findVNodeByElement(vnode: any, element: HTMLElement, visited: WeakSet<object>): any {
  if (!vnode || visited.has(vnode)) return null
  visited.add(vnode)

  // Check current vnode
  if (vnode.el === element || (vnode.component?.subTree?.el === element)) {
    return vnode
  }

  // Search in children
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (child && typeof child === 'object') {
        const found = findVNodeByElement(child, element, visited)
        if (found) return found
      }
    }
  }

  // Search in component's subTree
  if (vnode.component?.subTree) {
    const found = findVNodeByElement(vnode.component.subTree, element, visited)
    if (found) return found
  }

  return null
}

/**
 * Finds a Vue component by its path in the component tree.
 * Uses caching to improve performance.
 * 
 * @param componentUid - Unique component identifier (path)
 * @returns Found VNode component or null
 */
export function findComponentByPath(componentUid: string): any {
  // Check cache first
  const cached = getFromPathCache(componentUid)
  if (cached) return cached
  
  const vueRoots = findVueRoots()
  if (vueRoots.length === 0) {
    return null
  }

  // Parse path format: path::name::componentId[::selector][::text:content]
  const parts = componentUid.split('::')
  const actualPath = parts[0]
  const expectedName = parts[1]
  const expectedUidWithSelector = parts[2]
  const expectedUid = expectedUidWithSelector ? expectedUidWithSelector.split('::')[0] : null

  // If componentUid contains a DOM selector, use it for lookup
  const selectorIndex = parts.findIndex((part, index) => {
    return (part.startsWith('#') || part.includes(' > ') || (part.includes('.') && index > 2))
  })

  if (selectorIndex !== -1) {
    let selector = parts.slice(selectorIndex).join('::').replace(/^::/, '')

    // Remove text part for selector lookup
    if (selector.includes('::text:')) {
      selector = selector.split('::text:')[0]
    }

    try {
      const element = document.querySelector(selector)
      if (element instanceof HTMLElement) {
        const component = findVueComponentByElement(element)
        if (component) {
          setInPathCache(componentUid, component)
          return component
        }
      }
    } catch {
      // Ignore invalid selector errors
    }
  }

  // Fallback: navigate by path
  const result = navigateByPath(vueRoots, actualPath, expectedName, expectedUid)
  if (result) {
    setInPathCache(componentUid, result)
  }
  
  return result
}

/**
 * Navigate the component tree by path
 */
function navigateByPath(
  vueRoots: VueHTMLElement[],
  actualPath: string,
  expectedName: string | undefined,
  expectedUid: string | null
): any {
  const pathParts = actualPath.split('.')

  // Handle simple root case
  if (pathParts.length === 1 && pathParts[0] === 'root') {
    const root = vueRoots[0]
    const rootVNode = extractRootVNode(root)
    if (rootVNode?.component) {
      return rootVNode
    }
    return null
  }

  // Validate path
  if (pathParts.length === 0 || !pathParts[0].startsWith('root')) {
    return null
  }

  // Parse root index
  let rootIndex = 0
  if (pathParts[0].startsWith('root[')) {
    const rootIndexMatch = pathParts[0].match(/root\[(\d+)\]/)
    if (!rootIndexMatch) return null
    rootIndex = parseInt(rootIndexMatch[1], 10)
  }

  if (rootIndex >= vueRoots.length) return null

  const root = vueRoots[rootIndex]
  const rootVNode = extractRootVNode(root)
  if (!rootVNode) return null

  if (pathParts.length === 1) return rootVNode

  // Navigate the path
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2
  let current: any = rootVNode

  for (let i = 1; i < pathParts.length; i++) {
    const part = pathParts[i]

    if (part === 'subTree') {
      current = navigateSubTree(current, isVue2)
    } else if (part.startsWith('children[')) {
      current = navigateChildren(current, part, isVue2)
    } else if (part.startsWith('vnodeChildren[')) {
      current = navigateVNodeChildren(current, part)
    } else {
      return null
    }

    if (!current) return null
  }

  // Verify name and uid if specified
  if (expectedName && current) {
    const currentName = getVNodeName(current, isVue2)
    
    if (currentName === expectedName) {
      if (expectedUid && expectedUid !== 'undefined' && expectedUid !== 'null') {
        const currentUid = current.component?.uid || current._uid
        if (currentUid && String(currentUid) !== expectedUid && !expectedUid.startsWith('anon_')) {
          return null
        }
      }
      return current
    }
  }

  return current
}

/**
 * Navigate to subTree
 */
function navigateSubTree(current: any, isVue2: boolean): any {
  if (current.component?.subTree) {
    return current.component.subTree
  }
  
  if (isVue2) {
    if (current.child?.component?.subTree) return current.child.component.subTree
    if (current.child) return current.child
    if (current.componentInstance?.$vnode) return current.componentInstance.$vnode
  }
  
  return null
}

/**
 * Navigate to children by index
 */
function navigateChildren(current: any, part: string, isVue2: boolean): any {
  const indexMatch = part.match(/children\[(\d+)\]/)
  if (!indexMatch) return null
  
  const index = parseInt(indexMatch[1], 10)

  if (Array.isArray(current.children)) {
    return index < current.children.length ? current.children[index] : null
  }

  if (isVue2) {
    // Try different Vue 2 child accessors
    const childSources = [
      current.componentInstance?.$children,
      current.context?.$children,
      current.$children,
      current.children
    ]

    for (const source of childSources) {
      if (Array.isArray(source) && index < source.length) {
        const child = source[index]
        return child.$vnode || child
      }
    }
  }

  return null
}

/**
 * Navigate to vnode children
 */
function navigateVNodeChildren(current: any, part: string): any {
  const indexMatch = part.match(/vnodeChildren\[(\d+)\]/)
  if (!indexMatch || !Array.isArray(current.children)) return null
  
  const index = parseInt(indexMatch[1], 10)
  return index < current.children.length ? current.children[index] : null
}

/**
 * Get component name from vnode
 */
function getVNodeName(vnode: any, isVue2: boolean): string {
  return vnode.component?.type?.name ||
    vnode.component?.type?.__name ||
    vnode.component?.type?.displayName ||
    vnode.component?.type?.__file?.split('/').pop()?.replace(/\.vue$/, '') ||
    (isVue2 ? vnode.$options?.name : null) ||
    'Anonymous'
}

/**
 * Check if an object is writable
 */
function canWrite(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false

  try {
    const testKey = Symbol('test')
    obj[testKey] = true
    delete obj[testKey]
    return true
  } catch {
    return false
  }
}

/**
 * Finds and normalizes a component to the unified ResolvedComponent contract
 * 
 * @param componentUid - Unique component identifier (path)
 * @returns ResolvedComponent or null
 */
export function resolveComponent(componentUid: string): ResolvedComponent | null {
  // First try to find the actual vnode
  const componentVNode = findComponentByPath(componentUid)

  if (!componentVNode) {
    // Fallback: search by name among all components
    return resolveByNameFallback(componentUid)
  }

  // Handle artificial objects from name search
  if (componentVNode.component && componentVNode.el && componentVNode.props && !componentVNode.vnode) {
    return {
      vnode: componentVNode,
      instance: componentVNode.component,
      propsTarget: componentVNode.props,
      isVue2: false
    }
  }

  // Handle actual vnodes
  return resolveActualVNode(componentVNode)
}

/**
 * Resolve from actual vnode
 */
function resolveActualVNode(componentVNode: any): ResolvedComponent {
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2

  let instance = null
  let propsTarget = null

  if (isVue2) {
    instance = componentVNode.componentInstance || componentVNode.context || componentVNode
    propsTarget = instance?.$props || instance?.propsData || instance?._props || null
  } else {
    instance = componentVNode.component

    if (instance) {
      const resolvedInstance = resolveAsyncComponent(instance) || instance

      const resolvedWritable = resolvedInstance.props && canWrite(resolvedInstance.props)
      const vnodeWritable = componentVNode.props && canWrite(componentVNode.props)

      if (resolvedWritable) {
        propsTarget = resolvedInstance.props
      } else if (vnodeWritable) {
        propsTarget = componentVNode.props
      } else {
        propsTarget = resolvedInstance.props || componentVNode.props || null
      }
    }
  }

  return {
    vnode: componentVNode,
    instance,
    propsTarget,
    isVue2
  }
}

/**
 * Fallback resolution by component name
 */
function resolveByNameFallback(componentUid: string): ResolvedComponent | null {
  const parts = componentUid.split('::')
  const expectedName = parts[1]

  if (!expectedName) return null

  const allComponents = getAllVueComponents()
  const foundComponent = allComponents.find(comp => comp.name === expectedName)

  if (!foundComponent) return null

  // Try to find real vnode for this component
  const realVNode = findComponentByRealVNode(expectedName)

  if (realVNode) {
    const vueContext = detectVueContext()
    const isVue2 = vueContext.version === 2

    let instance = realVNode.component
    let propsTarget = null

    if (!isVue2 && instance) {
      const resolvedInstance = resolveAsyncComponent(instance) || instance
      propsTarget = resolvedInstance.props && canWrite(resolvedInstance.props) ? resolvedInstance.props :
        realVNode.props && canWrite(realVNode.props) ? realVNode.props : null
    }

    return {
      vnode: realVNode,
      instance,
      propsTarget,
      isVue2
    }
  }

  // Use artificial object
  return {
    vnode: {
      component: foundComponent,
      el: foundComponent.element,
      props: foundComponent.props
    },
    instance: foundComponent,
    propsTarget: foundComponent.props,
    isVue2: false
  }
}

/**
 * Find real vnode for a component by name
 */
function findComponentByRealVNode(expectedName: string): any {
  const vueRoots = findVueRoots()

  for (const root of vueRoots) {
    const rootVNode = extractRootVNode(root)
    if (!rootVNode) continue

    const found = findInTree(rootVNode, expectedName, new WeakSet())
    if (found) return found
  }

  return null
}

/**
 * Recursive tree search with cycle detection
 */
function findInTree(vnode: any, expectedName: string, visited: WeakSet<object>): any {
  if (!vnode || visited.has(vnode)) return null
  visited.add(vnode)

  // Check current vnode
  const componentName = vnode.component?.type?.name ||
    vnode.component?.type?.__name ||
    vnode.component?.type?.displayName ||
    vnode.$options?.name

  if (componentName === expectedName) {
    return vnode
  }

  // Search children
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (child && typeof child === 'object') {
        const found = findInTree(child, expectedName, visited)
        if (found) return found
      }
    }
  }

  // Search subTree
  if (vnode.component?.subTree) {
    const found = findInTree(vnode.component.subTree, expectedName, visited)
    if (found) return found
  }

  return null
}

/**
 * Clear the path cache and stop cleanup timer
 * Call this when memory pressure is detected or on page unload
 */
export function clearPathCache(): void {
  pathCache.clear()
  stopPathCacheCleanup()
}

/**
 * Dispose path cache resources - call on page unload
 */
export function disposePathCache(): void {
  pathCache.clear()
  stopPathCacheCleanup()
}
