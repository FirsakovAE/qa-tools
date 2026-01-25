import type { FeatureFlags, StaticDetectionResult } from './types'

/**
 * Centralized mutable state for the content script
 */

// Detection state
export let vueCheckInProgress = false
export let detectionCompleted = false
export let detectionAttempts = 0
export let detectionStopped = false

// Detection limits
export const MAX_DETECTION_ATTEMPTS = 3

// Feature flags
export let featureFlags: FeatureFlags = {
  hasVue: false,
  hasPinia: false,
  vueVersion: null
}

// Initialization flags
export let injectedScriptLoaded = false
export let uiInjected = false
export let messageListenerAdded = false

// Static site detection result
export let staticSiteDetection: StaticDetectionResult | null = null

// Highlight state
export let currentHighlightedElement: HTMLElement | null = null
export let highlightOverlay: HTMLElement | null = null
export let highlightRafId: number | null = null

// Element lookup attribute (set by injected script on elements)
export const ELEMENT_UID_ATTRIBUTE = 'data-vue-inspector-uid'

// Timeout reference
export let checkTimeout: number | null = null

// UI bridge state
export let uiBridgeInitialized = false

// === State Setters ===

export function setVueCheckInProgress(value: boolean): void {
  vueCheckInProgress = value
}

export function setDetectionCompleted(value: boolean): void {
  detectionCompleted = value
}

export function setDetectionAttempts(value: number): void {
  detectionAttempts = value
}

export function incrementDetectionAttempts(): void {
  detectionAttempts++
}

export function setDetectionStopped(value: boolean): void {
  detectionStopped = value
}

export function setFeatureFlags(flags: FeatureFlags): void {
  featureFlags = flags
}

export function updateFeatureFlags(flags: Partial<FeatureFlags>): void {
  featureFlags = { ...featureFlags, ...flags }
}

export function setInjectedScriptLoaded(value: boolean): void {
  injectedScriptLoaded = value
}

export function setUiInjected(value: boolean): void {
  uiInjected = value
}

export function setMessageListenerAdded(value: boolean): void {
  messageListenerAdded = value
}

export function setStaticSiteDetection(result: StaticDetectionResult | null): void {
  staticSiteDetection = result
}

export function setCurrentHighlightedElement(element: HTMLElement | null): void {
  currentHighlightedElement = element
}

export function setHighlightOverlay(overlay: HTMLElement | null): void {
  highlightOverlay = overlay
}

export function setHighlightRafId(id: number | null): void {
  highlightRafId = id
}

/**
 * Get element by UID using data attribute lookup
 * This is deterministic - not heuristic searching
 * 
 * The injected script marks elements with data-vue-inspector-uid attribute,
 * and we look them up by that exact attribute.
 */
export function getElementByUid(uid: number): HTMLElement | null {
  const element = document.querySelector(`[${ELEMENT_UID_ATTRIBUTE}="${uid}"]`)
  
  if (element instanceof HTMLElement && element.isConnected) {
    return element
  }
  
  return null
}

export function setCheckTimeout(timeout: number | null): void {
  checkTimeout = timeout
}

export function setUiBridgeInitialized(value: boolean): void {
  uiBridgeInitialized = value
}

/**
 * Reset detection state for a fresh detection cycle
 */
export function resetDetectionState(): void {
  detectionStopped = false
  detectionCompleted = false
  detectionAttempts = 0
}

/**
 * Reset all state to initial values
 */
export function resetAllState(): void {
  vueCheckInProgress = false
  detectionCompleted = false
  detectionAttempts = 0
  detectionStopped = false
  featureFlags = { hasVue: false, hasPinia: false, vueVersion: null }
  injectedScriptLoaded = false
  uiInjected = false
  messageListenerAdded = false
  staticSiteDetection = null
  currentHighlightedElement = null
  highlightOverlay = null
  highlightRafId = null
  checkTimeout = null
  uiBridgeInitialized = false
  // Note: Element marks (data attributes) are managed by injected script
}
