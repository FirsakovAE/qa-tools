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
import { setupDevtoolsBridge } from './devtools-bridge'

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
    async function initializeContentScript(): Promise<void> {
      init()

      // Check display mode setting before injecting overlay
      let displayMode: string = 'overlay'
      try {
        if (chrome?.runtime?.id) {
          const response = await chrome.runtime.sendMessage({ type: 'GET_DISPLAY_MODE' })
          if (response?.displayMode) {
            displayMode = response.displayMode
          }
        }
      } catch {
        // Fallback to overlay
      }

      // Detect static site before creating UI
      let detection = staticSiteDetection
      if (!detection) {
        detection = detectStaticSite()
        setStaticSiteDetection(detection)
      }

      // Report static site status to background so DevTools can query it
      try {
        if (chrome?.runtime?.id) {
          chrome.runtime.sendMessage({
            type: 'SET_STATIC_SITE',
            isStatic: detection.isLikelyStatic
          }).catch(() => {})
        }
      } catch {}

      // Show overlay ONLY in overlay mode, on non-static sites
      if (displayMode === 'overlay' && !detection.isLikelyStatic && !uiInjected) {
        setUiInjected(true)
        injectInspectorUI()
      }

      setupHighlightEventListeners()
      setupRuntimeMessageListener()

      // Always set up DevTools bridge so the panel can connect when opened
      setupDevtoolsBridge()

      window.addEventListener('beforeunload', cleanup)
    }

    // Start initialization
    initializeContentScript()
  }
}
