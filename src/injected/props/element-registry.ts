/**
 * Element Registry Bridge
 * 
 * Architecture:
 * - Injected script MARKS elements with data-vue-inspector-uid attribute
 * - Content script FINDS elements by this attribute
 * - This is NOT heuristic searching - it's deterministic lookup by exact attribute
 * 
 * Why data attributes instead of postMessage?
 * - postMessage cannot pass HTMLElement references (different JS contexts)
 * - Data attributes are accessible from both contexts via the shared DOM
 * - This approach is deterministic and reliable
 */

import { getMetaStore } from './meta-store'

const ATTRIBUTE_NAME = 'data-vue-inspector-uid'

/**
 * Mark element with component UID
 */
export function markElementWithUid(uid: number, element: HTMLElement): void {
  if (!element || !(element instanceof HTMLElement)) return
  if (!element.isConnected) return

  element.setAttribute(ATTRIBUTE_NAME, String(uid))
}

/**
 * Remove UID mark from element
 */
export function unmarkElement(element: HTMLElement): void {
  if (!element || !(element instanceof HTMLElement)) return
  element.removeAttribute(ATTRIBUTE_NAME)
}

/**
 * Remove UID mark by UID (find element first)
 */
export function unmarkElementByUid(uid: number): void {
  const element = document.querySelector(`[${ATTRIBUTE_NAME}="${uid}"]`)
  if (element instanceof HTMLElement) {
    element.removeAttribute(ATTRIBUTE_NAME)
  }
}

/**
 * Clear all UID marks
 */
export function clearAllMarks(): void {
  const elements = document.querySelectorAll(`[${ATTRIBUTE_NAME}]`)
  elements.forEach(el => {
    el.removeAttribute(ATTRIBUTE_NAME)
  })
}

/**
 * Sync all known elements with marks
 * Called after structure scan to ensure all visible components have marked elements
 */
export function syncElementMarks(): void {
  const store = getMetaStore()
  const components = store.getAllComponents()

  for (const meta of components) {
    if (meta.rootEl && meta.rootEl.isConnected) {
      markElementWithUid(meta.uid, meta.rootEl)
    }
  }
}

/**
 * Notify content script about element registry update
 * This is a signal, not data transfer (elements are accessed via DOM)
 */
export function notifyElementRegistryUpdate(): void {
  window.postMessage({
    __FROM_VUE_INSPECTOR__: true,
    type: 'VUE_INSPECTOR_ELEMENT_REGISTRY_UPDATED'
  }, '*')
}

// Legacy exports for backward compatibility
export const registerElementWithContent = markElementWithUid
export const unregisterElementFromContent = unmarkElementByUid
export const clearElementRegistrations = clearAllMarks
export const syncElementRegistry = syncElementMarks
export const registerMetaElement = (meta: { uid: number; rootEl?: HTMLElement }) => {
  if (meta.rootEl && meta.rootEl.isConnected) {
    markElementWithUid(meta.uid, meta.rootEl)
  }
}
export const unregisterMetaElement = (meta: { uid: number }) => {
  unmarkElementByUid(meta.uid)
}
