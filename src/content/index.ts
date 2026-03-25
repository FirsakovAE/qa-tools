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
     * Convert a wildcard pattern (e.g. *host*) to a RegExp.
     * Supports `*` as zero-or-more-of-any-char wildcard.
     */
    function wildcardToRegex(pattern: string): RegExp {
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return new RegExp(`^${escaped}$`, 'i')
    }

    /**
     * Check if the current page URL is allowed by the autoRun whitelist/blacklist.
     * Returns false if the pill should NOT be shown.
     */
    function isAutoRunAllowed(autoRun: { advancedMode?: boolean; siteBlacklist?: { pattern: string }[]; siteWhitelist?: { pattern: string }[] } | null | undefined): boolean {
      if (!autoRun) return true
      const url = location.href

      const whitelist = autoRun.advancedMode ? (autoRun.siteWhitelist ?? []) : []
      if (whitelist.length > 0) {
        const whitelisted = whitelist.some(e => wildcardToRegex(e.pattern).test(url))
        if (!whitelisted) return false
      }

      const blacklist = autoRun.siteBlacklist ?? []
      if (blacklist.length > 0) {
        const blacklisted = blacklist.some(e => wildcardToRegex(e.pattern).test(url))
        if (blacklisted) return false
      }

      return true
    }

    /**
     * Main initialization function
     */
    async function initializeContentScript(): Promise<void> {
      init()

      // Check display mode + autoRun settings before injecting overlay
      let displayMode: string = 'overlay'
      let autoRun: any = null
      try {
        if (chrome?.runtime?.id) {
          const response = await chrome.runtime.sendMessage({ type: 'GET_DISPLAY_MODE' })
          if (response?.displayMode) {
            displayMode = response.displayMode
          }
          if (response?.autoRun) {
            autoRun = response.autoRun
          }
        }
      } catch (error) {
        console.error('[content] Failed to get display mode:', error)
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
          }).catch((error) => {
            console.error('[content] Failed to send SET_STATIC_SITE:', error)
          })
        }
      } catch (error) {
        console.error('[content] chrome.runtime.sendMessage (SET_STATIC_SITE) error:', error)
      }

      // Show overlay ONLY in overlay mode, on non-static sites, and allowed by autoRun
      if (displayMode === 'overlay' && !detection.isLikelyStatic && !uiInjected && isAutoRunAllowed(autoRun)) {
        setUiInjected(true)
        injectInspectorUI()
      }

      setupHighlightEventListeners()
      setupRuntimeMessageListener()

      // Forced launch listener — bypasses static-site / autoRun guards
      try {
        if (chrome?.runtime?.id) {
          chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message?.type !== 'FORCE_INJECT_UI') return false
            if (!uiInjected) {
              setUiInjected(true)
              injectInspectorUI()
            }
            sendResponse({ success: true })
            return true
          })
        }
      } catch { /* extension context may be invalidated */ }

      // Always set up DevTools bridge so the panel can connect when opened
      setupDevtoolsBridge()

      window.addEventListener('beforeunload', cleanup)
    }

    // Start initialization
    initializeContentScript()
  }
}
