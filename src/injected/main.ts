/**
 * Main entry point for injected script
 * Performs detection and loads modules
 * 
 * Detection strategy:
 * - Vue: __VUE_DEVTOOLS_GLOBAL_HOOK__ with app:init event listener
 * - Pinia: app.use() interception + app:init fallback
 * 
 * This ensures detection works even if the inspector loads before Vue/Pinia
 */

import { 
  detect, 
  setupReactiveDetection, 
  getDetectionState,
  type DetectionResult 
} from './detector'
import { initPropsModule, cleanupPropsModule } from './props/index'
import { initPiniaModule } from './pinia/index'
import { initNetworkModule, cleanupNetworkModule } from './network/index'

// Module state
let propsModuleLoaded = false
let piniaModuleLoaded = false
let networkModuleLoaded = false
let cleanupDetection: (() => void) | null = null

/**
 * Send detection result to content script
 */
function sendDetectionResult(result: DetectionResult) {
  window.postMessage({
    type: 'VUE_INSPECTOR_DETECTION_RESULT',
    __FROM_VUE_INSPECTOR__: true,
    ...result
  }, '*')
  
  // Also send legacy format for compatibility
  window.postMessage({
    type: 'VUE_INSPECTOR_VUE_DETECTED',
    __FROM_VUE_INSPECTOR__: true,
    detected: result.hasVue,
    url: window.location.href,
    hasDevToolsHook: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
    hasVue2: result.vueVersion === 2
  }, '*')
}

/**
 * Initialize props module when Vue is detected
 */
function loadPropsModule() {
  if (propsModuleLoaded) return
  propsModuleLoaded = true
  initPropsModule()
  
  // Notify that props module is ready
  window.postMessage({
    type: 'VUE_INSPECTOR_PROPS_READY',
    __FROM_VUE_INSPECTOR__: true
  }, '*')
}

/**
 * Initialize pinia module when Pinia is detected
 */
function loadPiniaModule() {
  if (piniaModuleLoaded) return
  piniaModuleLoaded = true
  initPiniaModule()
  
  // Notify that pinia module is ready
  window.postMessage({
    type: 'VUE_INSPECTOR_PINIA_READY',
    __FROM_VUE_INSPECTOR__: true
  }, '*')
}

/**
 * Handle Vue detection (immediate or reactive)
 */
function onVueDetected(version: 2 | 3) {
  loadPropsModule()
  
  // Send updated detection result
  sendDetectionResult(getDetectionState())
}

/**
 * Handle Pinia detection (immediate or reactive)
 */
function onPiniaDetected() {
  loadPiniaModule()
  
  // Send updated detection result
  sendDetectionResult(getDetectionState())
}

/**
 * Message handler for content script communication
 */
function handleMessage(event: MessageEvent) {
  if (event.source !== window || !event.data || typeof event.data !== 'object') {
    return
  }
  
  const { type } = event.data
  
  // Request to check Vue
  if (type === 'VUE_INSPECTOR_CHECK_VUE') {
    sendDetectionResult(getDetectionState())
    return
  }
  
  // Request to get flags (for UI)
  if (type === 'VUE_INSPECTOR_GET_FLAGS') {
    sendDetectionResult(getDetectionState())
    return
  }
  
  // Force re-detection request
  if (type === 'VUE_INSPECTOR_FORCE_DETECT') {
    const result = detect()
    
    if (result.hasVue && !propsModuleLoaded) {
      loadPropsModule()
    }
    
    if (result.hasPinia && !piniaModuleLoaded) {
      loadPiniaModule()
    }
    
    sendDetectionResult(result)
    return
  }
}

/**
 * Initialize the inspector
 */
function initialize() {
  // Register message handler
  window.addEventListener('message', handleMessage)
  
  // Initialize network module immediately (doesn't require Vue)
  loadNetworkModule()
  
  // Setup reactive detection with callbacks
  cleanupDetection = setupReactiveDetection({
    onVueDetected,
    onPiniaDetected
  })
  
  // Get initial detection state
  const initialResult = getDetectionState()
  
  // Send initial detection result
  sendDetectionResult(initialResult)
  
  // Send ready signal
  window.postMessage({
    type: 'VUE_INSPECTOR_READY',
    __FROM_VUE_INSPECTOR__: true
  }, '*')
}

/**
 * Initialize network module (always available)
 */
function loadNetworkModule() {
  if (networkModuleLoaded) return
  networkModuleLoaded = true
  initNetworkModule()
  
  // Notify that network module is ready
  window.postMessage({
    type: 'VUE_INSPECTOR_NETWORK_READY',
    __FROM_VUE_INSPECTOR__: true
  }, '*')
}

/**
 * Cleanup on page unload
 */
function cleanup() {
  window.removeEventListener('message', handleMessage)
  cleanupDetection?.()
  cleanupPropsModule()
  cleanupNetworkModule()
}

// Register cleanup
window.addEventListener('beforeunload', cleanup)
window.addEventListener('pagehide', cleanup)

// Initialize
initialize()

// Export for debugging
;(window as any).__VUE_INSPECTOR_DETECTION__ = () => getDetectionState()
;(window as any).__VUE_INSPECTOR_FORCE_DETECT__ = () => {
  const result = detect()
  sendDetectionResult(result)
  return result
}
