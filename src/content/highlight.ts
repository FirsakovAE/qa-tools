/**
 * Element highlighting system for Vue Inspector
 * 
 * Architecture:
 * - Content script OWNS the highlight overlay
 * - Content script STORES element registry (uid → HTMLElement)
 * - Content script PERFORMS highlighting
 * - NO searching, NO strategies, NO fallbacks
 * 
 * If element doesn't exist → no highlighting. That's OK.
 */

import {
  currentHighlightedElement,
  highlightOverlay,
  highlightRafId,
  setCurrentHighlightedElement,
  setHighlightOverlay,
  setHighlightRafId,
  getElementByUid
} from './state'

/**
 * Creates the highlight overlay element if it doesn't exist
 */
export function createHighlightOverlay(): void {
  if (highlightOverlay) return

  const overlay = document.createElement('div')
  overlay.id = 'vue-inspector-highlight-overlay'
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 999998;
    border: 3px solid #8b5cf6;
    background-color: rgba(139, 92, 246, 0.1);
    box-shadow:
      0 0 0 1px rgba(139, 92, 246, 0.4),
      0 0 20px rgba(139, 92, 246, 0.3),
      inset 0 0 20px rgba(139, 92, 246, 0.1);
    transition: all 0.2s ease-in-out;
    border-radius: 4px;
  `
  document.body.appendChild(overlay)
  setHighlightOverlay(overlay)
}

/**
 * Updates the highlight overlay position to match the current element
 */
export function updateHighlightPosition(): void {
  if (!currentHighlightedElement || !highlightOverlay) return
  if (highlightRafId) return

  const rafId = requestAnimationFrame(() => {
    setHighlightRafId(null)

    if (!currentHighlightedElement || !highlightOverlay) return

    // Check if element is still in DOM
    if (!currentHighlightedElement.isConnected) {
      unhighlightElement()
      return
    }

    const rect = currentHighlightedElement.getBoundingClientRect()

    highlightOverlay.style.display = 'block'
    highlightOverlay.style.left = rect.left + 'px'
    highlightOverlay.style.top = rect.top + 'px'
    highlightOverlay.style.width = rect.width + 'px'
    highlightOverlay.style.height = rect.height + 'px'
  })

  setHighlightRafId(rafId)
}

/**
 * Highlights an element on the page
 * Only works with real HTMLElement - no searching, no guessing
 */
export function highlightElement(element: HTMLElement): void {
  if (!element || !(element instanceof HTMLElement)) return
  if (!element.isConnected) return

  createHighlightOverlay()
  setCurrentHighlightedElement(element)
  updateHighlightPosition()
}

/**
 * Highlights element by component UID
 * Looks up element in registry - if not found, silently exits
 */
export function highlightByUid(uid: number): boolean {
  const element = getElementByUid(uid)
  
  if (!element) {
    // Element not registered or no longer in DOM - that's OK
    return false
  }

  highlightElement(element)
  return true
}

/**
 * Removes the highlight from the current element
 */
export function unhighlightElement(): void {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none'
  }
  setCurrentHighlightedElement(null)
}

/**
 * Sets up event listeners for highlight position updates
 */
export function setupHighlightEventListeners(): void {
  window.addEventListener('scroll', updateHighlightPosition, { passive: true } as AddEventListenerOptions)
  window.addEventListener('resize', updateHighlightPosition)
}

/**
 * Removes event listeners for highlight position updates
 */
export function removeHighlightEventListeners(): void {
  window.removeEventListener('scroll', updateHighlightPosition, { passive: true } as AddEventListenerOptions)
  window.removeEventListener('resize', updateHighlightPosition)
}

/**
 * Cleans up highlight overlay
 */
export function cleanupHighlight(): void {
  unhighlightElement()
  if (highlightOverlay?.parentNode) {
    highlightOverlay.parentNode.removeChild(highlightOverlay)
    setHighlightOverlay(null)
  }
}
