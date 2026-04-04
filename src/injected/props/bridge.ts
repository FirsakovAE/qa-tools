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
import { serializeProps, serializeRawPropsForDeclared } from './serialize'

/** Inlined likeMatch - injected script must not use external imports (no type="module") */
function likeMatch(value: string, pattern: string): boolean {
  const v = value.toLowerCase()
  const p = pattern.toLowerCase()
  if (!p.includes('%') && !p.includes('*')) return v === p
  const escaped = p.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
  return new RegExp('^' + escaped.replace(/[%*]/g, '.*') + '$').test(v)
}
import { disposeMetaStore, getMetaStore } from './meta-store'
import { scanStructure, getComponentList, getScannerStats } from './structure-scanner'
import { 
  readPropsByUid, 
  readPropsByMeta,
  readPropsWithRawByUid,
  readPropsWithRawByMeta,
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
  EXPANDED_PROPS_DATA: 'VUE_INSPECTOR_EXPANDED_PROPS_DATA',
  GET_COMPONENT_INFO_BY_UID: 'VUE_INSPECTOR_GET_COMPONENT_INFO_BY_UID',
  COMPONENT_INFO_DATA: 'VUE_INSPECTOR_COMPONENT_INFO_DATA'
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

/** Get props counts without full serialization (for lightweight payload) */
function getPropsCountsLight(instance: any): { passed: number; declared: number } {
  const raw = extractRawProps(instance)
  if (!raw || typeof raw !== 'object') return { passed: 0, declared: 0 }
  const keys = Object.keys(raw)
  const declared = keys.length
  const passed = keys.filter(k => raw[k] !== undefined).length
  return { passed, declared }
}

/**
 * Lightweight format: structure only, NO serialized props.
 * Props loaded on-demand via GET_COMPONENT_PROPS. Keeps payload under 64MB.
 */
function metaToLegacyFormatLight(meta: any): any {
  const { passed: propsCountPassed, declared: propsCount } = getPropsCountsLight(meta.instance)
  const hasProps = propsCount > 0
  
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
  
  const name = meta.name || 'Anonymous'
  const elementInfo = buildElementInfo(meta.rootEl)
  const componentUid = `${name}::${elementInfo}`
  
  return {
    name,
    props: {},
    path: `uid:${meta.uid}`,
    componentUid,
    id: `uid:${meta.uid}`,
    element,
    hasProps,
    propsCount,
    propsCountPassed,
    rootElement
  }
}

/** Normalize blacklist from postMessage (may be corrupted by structured clone) */
function normalizeBlacklist(bl: unknown): { active: string[]; inactive: string[] } | undefined {
  if (!bl || typeof bl !== 'object' || !Array.isArray((bl as any).active)) return undefined
  const b = bl as { active: unknown[]; inactive?: unknown[] }
  return {
    active: b.active.filter((r): r is string => typeof r === 'string'),
    inactive: Array.isArray(b.inactive) ? b.inactive.filter((r): r is string => typeof r === 'string') : []
  }
}

/**
 * Check if component name is blacklisted (filter at source - no tree, no props, no serialization)
 */
function isBlacklisted(name: string, blacklist: { active: string[]; inactive: string[] } | undefined): boolean {
  if (!blacklist?.active?.length) return false
  const n = name || ''
  if (blacklist.inactive?.some((rule: string) => likeMatch(n, rule))) return false
  return blacklist.active.some((rule: string) => likeMatch(n, rule))
}

/** Lightweight format - no serialized props, safe for 64MB limit */
function getLegacyComponents(
  forceRefresh = false,
  blacklist?: { active: string[]; inactive: string[] },
  rootElementUid?: number
): any[] {
  scanStructure({ force: forceRefresh })
  const store = getMetaStore()
  let metas = store.getAllComponents()

  // Filter by root element: only components whose rootEl is inside the selected element
  if (rootElementUid != null) {
    const rootEl = document.querySelector(`[data-vue-inspector-uid="${rootElementUid}"]`)
    if (rootEl instanceof HTMLElement) {
      metas = metas.filter(meta => {
        if (!meta.rootEl || !meta.rootEl.isConnected) return false
        return rootEl === meta.rootEl || rootEl.contains(meta.rootEl)
      })
    } else {
      metas = []
    }
  }

  return metas
    .filter(meta => !isBlacklisted(meta.name ?? 'Anonymous', blacklist))
    .map(metaToLegacyFormatLight)
}


// ============================================================================
// Component Getters
// ============================================================================

/**
 * Find ComponentMeta by stable id (Name::elementInfo). Used when uid is stale after remount.
 */
function findMetaByStableId(stableId: string): { meta: any; uid: number } | null {
  if (!stableId || typeof stableId !== 'string') return null
  const store = getMetaStore()
  for (const meta of store.getAllComponents()) {
    const name = meta.name || 'Anonymous'
    const elementInfo = buildElementInfo(meta.rootEl ?? null)
    const componentUid = `${name}::${elementInfo}`
    if (componentUid === stableId) {
      return { meta, uid: meta.uid }
    }
  }
  return null
}

/**
 * Get component props by path (legacy) or UID.
 * When uid lookup fails (component remounted, new uid), falls back to stable id (Name::element).
 * Returns both props (passed) and rawProps (declared) for Passed/Declared sections.
 */
function getComponentProps(
  componentPath: string,
  componentPathFallback?: string
): { props: Record<string, any>; rawProps: Record<string, any>; newUid?: number } {
  // Check if it's a UID-based path
  if (componentPath.startsWith('uid:')) {
    const uid = parseInt(componentPath.substring(4), 10)
    const result = readPropsWithRawByUid(uid)
    if (result) {
      return { props: result.props ?? {}, rawProps: result.rawProps ?? {} }
    }
    // UID not found (component remounted) — fallback to stable id
    if (componentPathFallback) {
      const found = findMetaByStableId(componentPathFallback)
      if (found) {
        const { props, rawProps } = readPropsWithRawByMeta(found.meta)
        return { props, rawProps, newUid: found.uid }
      }
    }
    return { props: {}, rawProps: {} }
  }
  
  // Legacy path-based lookup
  const vnode = findComponentByPath(componentPath)
  if (!vnode) return { props: {}, rawProps: {} }
  
  const vueContext = detectVueContext()
  const isVue2 = vueContext.version === 2
  
  let raw: Record<string, any> = {}
  
  if (isVue2) {
    const instance = vnode.componentInstance || vnode.context
    if (instance) {
      raw = instance.$props || instance.propsData || instance._props || {}
    }
  } else {
    const instance = vnode.component
    if (instance) {
      raw = instance.props || {}
    }
  }
  
  const props = serializeProps(raw)
  const rawProps = raw && typeof raw === 'object' ? serializeRawPropsForDeclared(raw) : {}
  return { props: props as Record<string, any>, rawProps }
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
      console.error('[injected/props/bridge] UPDATE_PROPS failed:', e)
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
      const { componentPath, componentPathFallback } = event.data
      // Обновляем meta-store для актуальных ссылок на компоненты (иначе — закэшированные props)
      scanStructure({ force: true })
      const { props, rawProps, newUid } = getComponentProps(componentPath, componentPathFallback)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        props,
        rawProps,
        newUid,
        requestId
      }, '*')
    } catch (e) {
      console.error('[injected/props/bridge] GET_COMPONENT_PROPS failed:', e)
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_PROPS_DATA,
        props: {},
        rawProps: {},
        requestId
      }, '*')
    }
    return
  }

  // Handle GET_COMPONENTS message (always lightweight - no serialized props)
  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENTS) {
    try {
      const forceRefresh = !!(event.data?.forceRefresh)
      const blacklist = normalizeBlacklist(event.data?.blacklist)
      const rootElementUid = typeof event.data?.rootElementUid === 'number' ? event.data.rootElementUid : undefined
      const components = getLegacyComponents(forceRefresh, blacklist, rootElementUid)

      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENTS_DATA,
        components,
        requestId
      }, '*')
    } catch (e) {
      console.error('[injected/props/bridge] GET_COMPONENTS failed:', e)
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
      console.error('[injected/props/bridge] SCAN_STRUCTURE failed:', e)
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
      console.error('[injected/props/bridge] GET_COMPONENT_LIST failed:', e)
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_LIST_DATA,
        components: [],
        requestId
      }, '*')
    }
    return
  }

  // Handle GET_COMPONENT_INFO_BY_UID (for inspector hover panel)
  if (event.source === window && event.data?.type === MESSAGE_TYPES.GET_COMPONENT_INFO_BY_UID) {
    try {
      const uid = event.data.uid
      const store = getMetaStore()
      const meta = typeof uid === 'number' ? store.getByUid(uid) : null
      if (!meta) {
        window.postMessage({
          __FROM_VUE_INSPECTOR__: true,
          type: MESSAGE_TYPES.COMPONENT_INFO_DATA,
          name: null,
          rootElementInfo: null,
          propsCount: 0,
          childCount: 0,
          requestId
        }, '*')
        return
      }
      const { passed: propsCount } = getPropsCountsLight(meta.instance)
      const name = meta.name || 'Anonymous'
      const rootElementInfo = buildElementInfo(meta.rootEl ?? null)
      const rootEl = meta.rootEl
      let childCount = 0
      if (rootEl && rootEl.isConnected) {
        const allMetas = store.getAllComponents()
        const limit = 800
        if (allMetas.length <= limit) {
          for (const m of allMetas) {
            if (m.uid === uid) continue
            if (m.rootEl && m.rootEl.isConnected && rootEl.contains(m.rootEl)) {
              childCount++
            }
          }
        }
      }
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_INFO_DATA,
        name,
        rootElementInfo,
        propsCount,
        childCount,
        requestId
      }, '*')
    } catch (e) {
      console.error('[injected/props/bridge] GET_COMPONENT_INFO_BY_UID failed:', e)
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.COMPONENT_INFO_DATA,
        name: null,
        rootElementInfo: null,
        propsCount: 0,
        childCount: 0,
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
      console.error('[injected/props/bridge] EXPAND_COMPONENT failed:', e)
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
      console.error('[injected/props/bridge] COLLAPSE_COMPONENT failed:', e)
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
      console.error('[injected/props/bridge] SEARCH_COMPONENTS failed:', e)
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
      console.error('[injected/props/bridge] GET_EXPANDED_PROPS failed:', e)
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
    try {
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
    } catch (e) {
      console.error('[injected/props/bridge] CHECK_VUE failed:', e)
      window.postMessage({
        __FROM_VUE_INSPECTOR__: true,
        type: MESSAGE_TYPES.VUE_DETECTED,
        detected: false,
        url: window.location.href,
        appCount: 0,
        hasDevToolsHook: false,
        hasVue2: false,
        error: String(e)
      }, '*')
    }
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

  try {
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
  } catch (e) {
    console.error('[injected/props/bridge] initPropsBridge Vue detection failed:', e)
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
