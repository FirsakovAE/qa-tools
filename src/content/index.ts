/**
 * Content script main entry point
 * Coordinates between injected scripts and UI iframe
 */

import {
  setDetectionStopped,
  setDetectionCompleted,
  setFeatureFlags,
  uiInjected,
  setUiInjected,
  staticSiteDetection,
  setStaticSiteDetection,
  checkTimeout,
  setCheckTimeout
} from './state'

import {
  removeMessageListener
} from './detection'

import {
  cleanupHighlight,
  setupHighlightEventListeners,
  removeHighlightEventListeners
} from './highlight'

import { removeUIMessageBridge } from './ui-bridge'
import { setupRuntimeMessageListener } from './handlers'
import { detectStaticSite } from './static-detection'
import { injectInspectorUI } from './inspector-ui'

// === GLOBAL GUARD ===
if (!(window as any).__VUE_INSPECTOR_CONTENT_LOADED__) {
  ;(window as any).__VUE_INSPECTOR_CONTENT_LOADED__ = true

  // === URL GUARD ===
  function isForbiddenUrl(): boolean {
    const url = location.href
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('view-source:')
    )
  }

  if (!isForbiddenUrl()) {
    // === INITIALIZATION ===

    /**
     * Initialize content script
     * NOTHING is loaded automatically!
     * All heavy resources are loaded only on chevron click
     */
    function init(): void {
      // Stop any detection immediately - will be started when panel opens
      setDetectionStopped(true)
      setDetectionCompleted(true)

      // Default flags - unknown (will be determined when panel opens)
      setFeatureFlags({ hasVue: false, hasPinia: false, vueVersion: null })
    }

    /**
     * Cleanup on page unload
     */
    function cleanup(): void {
      cleanupHighlight()

      // Clear all timeouts
      if (checkTimeout) {
        clearTimeout(checkTimeout)
        setCheckTimeout(null)
      }

      // Remove all event listeners
      removeMessageListener()
      removeHighlightEventListeners()
      removeUIMessageBridge()

      // Stop detection
      setDetectionStopped(true)

      window.removeEventListener('beforeunload', cleanup)
    }

    /**
     * Main initialization function
     */
    function initializeContentScript(): void {
      init()

      // Detect static site before creating UI
      let detection = staticSiteDetection
      if (!detection) {
        detection = detectStaticSite()
        setStaticSiteDetection(detection)
      }

      // Show UI ONLY if site is not static
      // On static sites (Hugo/MPA) don't show chevron to prevent memory leaks
      if (!detection.isLikelyStatic && !uiInjected) {
        setUiInjected(true)
        injectInspectorUI()
      }

      setupHighlightEventListeners()
      setupRuntimeMessageListener()

      window.addEventListener('beforeunload', cleanup)
    }

    // Start initialization
    initializeContentScript()
  }
}
