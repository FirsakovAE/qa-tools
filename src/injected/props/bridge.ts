// src/injected/props/bridge.ts

/**
 * 📐 Props Bridge - Communication between injected script and content script
 * 
 * New Architecture:
 * - Uses scanStructure() for auto-refresh (no props)
 * - Uses readProps() for lazy props loading
 * - Supports fast and lazy search
 */

import { findComponentByPath } from './find-by-path'
import { updateComponentProps } from './update-props'
import { isVueDetected, findVueRoots, detectVueContext } from './vue-detect'
import { serializeProps } from './serialize'
import { disposeMetaStore, getMetaStore } from './meta-store'
import { scanStructure, getComponentList, getScannerStats } from './structure-scanner'
import { 
  readPropsByUid, 
  expandAndReadProps, 
  collapseAndClearProps,
  readExpandedComponentsProps,
  extractRawProps
} from './props-reader'
import { search, fastSearch, lazySearch, type SearchOptions } from './search'

// ============================================================================
// Message Types
// ============================================================================

const MESSAGE_TYPES = {
  // Existing types
  UPDATE_PROPS: 'VUE_INSPECTOR_UPDATE_PROPS',
  UPDATE_PROPS_RESULT: 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
  GET_COMPONENT_PROPS: 'VUE_INSPECTOR_GET_COMPONENT_PROPS',
  COMPONENT_PROPS_DATA: 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
  GET_COMPONENTS: 'VUE_INSPECTOR_GET_COMPONENTS',
  COMPONENTS_DATA: 'VUE_INSPECTOR_COMPONENTS_DATA',
  CHECK_VUE: 'VUE_INSPECTOR_CHECK_VUE',
  VUE_DETECTED: 'VUE_INSPECTOR_VUE_DETECTED',
  READY: 'VUE_INSPECTOR_READY',
  CLEANUP: 'VUE_INSPECTOR_CLEANUP',
  
  // New types for new architecture
  SCAN_STRUCTURE: 'VUE_INSPECTOR_SCAN_STRUCTURE',
  STRUCTURE_DATA: 'VUE_INSPECTOR_STRUCTURE_DATA',
  GET_COMPONENT_LIST: 'VUE_INSPECTOR_GET_COMPONENT_LIST',
  COMPONENT_LIST_DATA: 'VUE_INSPECTOR_COMPONENT_LIST_DATA',
  EXPAND_COMPONENT: 'VUE_INSPECTOR_EXPAND_COMPONENT',
  COLLAPSE_COMPONENT: 'VUE_INSPECTOR_COLLAPSE_COMPONENT',
  SEARCH_COMPONENTS: 'VUE_INSPECTOR_SEARCH_COMPONENTS',
  SEARCH_RESULTS: 'VUE_INSPECTOR_SEARCH_RESULTS',
  GET_EXPANDED_PROPS: 'VUE_INSPECTOR_GET_EXPANDED_PROPS',
  EXPANDED_PROPS_DATA: 'VUE_INSPECTOR_EXPANDED_PROPS_DATA'
} as const

// ============================================================================
// Module State
// ============================================================================

let initialized = false
let messageHandler: ((event: MessageEvent) => void) | null = null

// Throttle state for structure scan
let lastScanRequest = 0
const SCAN_REQUEST_THROTTLE = 100 // ms

// ============================================================================
// Legacy Support - Convert to new format
// ============================================================================

/**
 * Build element info string for stable identifier
 */
function buildElementInfo(el: HTMLElement | null): string {
  if (!el) return 'div'
  
  const tag = el.tagName?.toLowerCase() || 'div'
  const cls = el.className ? '.' + el.className.trim().replace(/\s+/g, '.') : ''
  const id = el.id ? `#${el.id}` : ''
  
  return tag + cls + id
}

/**
 * Convert ComponentMeta to legacy ComponentInfo format
 */
function metaToLegacyFormat(meta: any): any {
  const instance = meta.instance
  const rawProps = extractRawProps(instance)
  
  // Get element info
  let element = null
  let rootElement = null
  
  if (meta.rootEl) {
    element = {
      tagName: meta.rootEl.tagName?.toLowerCase(),
      id: meta.rootEl.id || undefined,
      className: meta.rootEl.className || undefined,
      testId: meta.rootEl.getAttribute?.('data-testid') || undefined
    }
    rootElement = element
  }
  
  // Serialize props
  const props = rawProps ? serializeProps(rawProps) : {}
  
  // Build stable componentUid: "ComponentName::element.class" format
  // This format is stable for favorites matching
  const name = meta.name || 'Anonymous'
  const elementInfo = buildElementInfo(meta.rootEl)
  const componentUid = `${name}::${elementInfo}`
  
  return {
    name,
    props,
    path: `uid:${meta.uid}`,
    // Use stable componentUid for favorites
    componentUid,
    // Keep numeric ID for internal use
    id: `uid:${meta.uid}`,
    element,
    hasProps: Object.keys(props).length > 0,
    propsCount: Object.keys(props).length,
    rootElement
  }
}

/**
 * Get components in legacy format (for backwards compatibility)
 */
function getLegacyComponents(): any[] {
  // First scan structure
  scanStructure()
  
  const store = getMetaStore()
  const metas = store.getAllComponents()
  
  return metas.map(metaToLegacyFormat)
}

// ============================================================================
// Component Getters
// ============================================================================

/**
 * Get component props by path (legacy) or UID
 */
function getComponentProps(componentPath: string): Record<string, any> {
  // Check if it's a UID-based path
  if (componentPath.startsWith('uid:')) {
    const uid = parseInt(componentPath.substring(4), 10)
    const result = readPropsByUid(uid)
    return result?.props ?? {}
  }
  
  // Legacy path-based lookup
  const vnode = findComponentByPath(componentPath)
  if (!vnode) return {}
  
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2
  
  let props: Record<string, any> = {}
  
  if (isVue2) {
    const instance = vnode.componentInstance || vnode.context
    if (instance) {
      props = serializeProps(instance.$props || instance.propsData || instance._props || {})
    }
  } else {
    const instance = vnode.component
    if (instance) {
      props = serializeProps(instance.props || {})
    }
  }
  
  return props
}

// ============================================================================
// Message Handler
// ============================================================================

function handleMessage(event: MessageEvent) {
  if (!event.data || typeof event.data !== 'object' || !event.data.type) {
    return
  }

  const { requestId } = event.data

  // Handle UPDATE_PROPS message
  if (event.data.type === MESSAGE_TYPES.UPDATE_PROPS) {
    try {
      const { componentPath, props } = event.data
      const success = updateComponentProps(componentPath, props)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.UPDATE_PROPS_RESULT,
        success: success,
        error: success ? undefined : 'Failed to update component props',
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.UPDATE_PROPS_RESULT,
        success: false,
        error: String(e),
        requestId
      }, '*')
    }
    return
  }

  // Handle GET_COMPONENT_PROPS message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENT_PROPS) {
    try {
      const { componentPath } = event.data
      const props = getComponentProps(componentPath)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        props,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        props: {},
        requestId
      }, '*')
    }
    return
  }

  // Handle GET_COMPONENTS message (legacy, with props)
  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENTS) {
    try {
      const components = getLegacyComponents()

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENTS_DATA,
        components,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENTS_DATA,
        components: [],
        requestId
      }, '*')
    }
    return
  }

  // Handle SCAN_STRUCTURE message (new - no props)
  if (event.source === window && event.data?.type === MESSAGE_TYPES.SCAN_STRUCTURE) {
    try {
      const now = Date.now()
      
      // Throttle scan requests
      if (now - lastScanRequest < SCAN_REQUEST_THROTTLE) {
        window.postMessage({
          __FROM_VUE_INSPECTOR__: true,
          type: MESSAGE_TYPES.STRUCTURE_DATA,
          result: getScannerStats().lastScanResult,
          throttled: true,
          requestId
        }, '*')
        return
      }
      
      lastScanRequest = now
      const result = scanStructure()

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.STRUCTURE_DATA,
        result,
        throttled: false,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.STRUCTURE_DATA,
        result: null,
        error: String(e),
        requestId
      }, '*')
    }
    return
  }

  // Handle GET_COMPONENT_LIST message (new - structure only)
  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENT_LIST) {
    try {
      const components = getComponentList()

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_LIST_DATA,
        components,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_LIST_DATA,
        components: [],
        requestId
      }, '*')
    }
    return
  }

  // Handle EXPAND_COMPONENT message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.EXPAND_COMPONENT) {
    try {
      const { uid } = event.data
      const result = expandAndReadProps(uid)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        component: result,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        component: null,
        requestId
      }, '*')
    }
    return
  }

  // Handle COLLAPSE_COMPONENT message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.COLLAPSE_COMPONENT) {
    try {
      const { uid } = event.data
      collapseAndClearProps(uid)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.UPDATE_PROPS_RESULT,
        success: true,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.UPDATE_PROPS_RESULT,
        success: false,
        requestId
      }, '*')
    }
    return
  }

  // Handle SEARCH_COMPONENTS message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.SEARCH_COMPONENTS) {
    try {
      const { query, options } = event.data
      const results = search(query, options as SearchOptions)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.SEARCH_RESULTS,
        results,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.SEARCH_RESULTS,
        results: [],
        requestId
      }, '*')
    }
    return
  }

  // Handle GET_EXPANDED_PROPS message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_EXPANDED_PROPS) {
    try {
      const components = readExpandedComponentsProps()

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.EXPANDED_PROPS_DATA,
        components,
        requestId
      }, '*')
    } catch (e) {
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.EXPANDED_PROPS_DATA,
        components: [],
        requestId
      }, '*')
    }
    return
  }

  // Handle CHECK_VUE message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.CHECK_VUE) {
    const detected = isVueDetected()
    const vueRoots = findVueRoots()

    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: MESSAGE_TYPES.VUE_DETECTED,
      detected: detected,
      url: window.location.href,
      appCount: vueRoots.length,
      hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
      hasVue2: !!(window as any).__VUE__
    }, '*')
    return
  }

  // Handle CLEANUP message
  if (event.source === window && event.data?.type === MESSAGE_TYPES.CLEANUP) {
    cleanupPropsBridge()
    return
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize props bridge - registers message handlers
 */
export function initPropsBridge() {
  if (initialized) return
  initialized = true

  messageHandler = handleMessage
  window.addEventListener('message', messageHandler)

  window.addEventListener('beforeunload', cleanupPropsBridge)
  window.addEventListener('pagehide', cleanupPropsBridge)

  if (isVueDetected()) {
    const vueRoots = findVueRoots()
    window.postMessage({
      __FROM_VUE_INSPECTOR__: true,
      type: MESSAGE_TYPES.VUE_DETECTED,
      detected: true,
      url: window.location.href,
      appCount: vueRoots.length,
      hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
      hasVue2: !!(window as any).__VUE__
    }, '*')
  }

  window.postMessage({
    __FROM_VUE_INSPECTOR__: true,
    type: MESSAGE_TYPES.READY
  }, '*')
}

/**
 * Cleanup props bridge
 */
export function cleanupPropsBridge() {
  if (!initialized) return

  if (messageHandler) {
    window.removeEventListener('message', messageHandler)
    messageHandler = null
  }

  window.removeEventListener('beforeunload', cleanupPropsBridge)
  window.removeEventListener('pagehide', cleanupPropsBridge)

  // Dispose meta store
  disposeMetaStore()

  initialized = false
}

/**
 * Check if bridge is initialized
 */
export function isBridgeInitialized(): boolean {
  return initialized
}
