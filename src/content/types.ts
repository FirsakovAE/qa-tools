/**
 * Feature flags indicating what Vue ecosystem features are available
 */
export interface FeatureFlags {
  hasVue: boolean
  hasPinia: boolean
  vueVersion: 2 | 3 | null
}

/**
 * Result of static site detection heuristics
 */
export interface StaticDetectionResult {
  isLikelyStatic: boolean
  reasons: string[]
}

/**
 * Type for runtime message handlers
 */
export type RuntimeHandler = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void

/**
 * Strategy function for finding elements to highlight
 */
export type HighlightStrategy = (componentPath: string) => HTMLElement | null

/**
 * Extended HTMLElement with Vue internals
 */
export interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}
