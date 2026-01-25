/**
 * Element highlighting system for Vue Inspector
 */

import type { HighlightStrategy } from './types'
import {
  currentHighlightedElement,
  highlightOverlay,
  highlightRafId,
  setCurrentHighlightedElement,
  setHighlightOverlay,
  setHighlightRafId
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
 */
export function highlightElement(element: HTMLElement): void {
  if (!element) return

  createHighlightOverlay()
  setCurrentHighlightedElement(element)
  updateHighlightPosition()
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

// === Highlight Strategies ===

/**
 * Try highlighting using a chain of strategies
 */
export function tryHighlight(
  componentPath: string,
  strategies: HighlightStrategy[]
): HTMLElement | null {
  for (const strategy of strategies) {
    try {
      const el = strategy(componentPath)
      if (el instanceof HTMLElement) {
        return el
      }
    } catch {
      // Strategy can fail - that's normal
    }
  }
  return null
}

/**
 * Find element via Vue VNode
 */
export function highlightByVueVNode(componentPath: string): HTMLElement | null {
  const inspector = (window as any).__VUE_INSPECTOR__
  if (!inspector?.findComponentByPath) return null

  const vnode = inspector.findComponentByPath(componentPath)
  if (!vnode) return null

  // Handle real vnode
  if (vnode.el instanceof HTMLElement) return vnode.el
  if (vnode.component?.subTree?.el instanceof HTMLElement) {
    return vnode.component.subTree.el
  }

  // Handle artificial object from name search
  if (vnode.component?.element) {
    const elementInfo = vnode.component.element
    if (elementInfo.tagName && elementInfo.id) {
      const el = document.getElementById(elementInfo.id)
      if (el instanceof HTMLElement) return el
    }
    if (elementInfo.tagName && elementInfo.className) {
      const selector = elementInfo.className.trim().split(/\s+/).map((cls: string) => `.${cls}`).join('')
      const el = document.querySelector(`${elementInfo.tagName}${selector}`)
      if (el instanceof HTMLElement) return el
    }
    if (elementInfo.testId) {
      const el = document.querySelector(`[data-test-id="${elementInfo.testId}"]`)
      if (el instanceof HTMLElement) return el
    }
  }

  const walk = (children: any[]): HTMLElement | null => {
    for (const child of children) {
      if (child?.el instanceof HTMLElement) return child.el
      if (child?.component?.subTree?.el instanceof HTMLElement) {
        return child.component.subTree.el
      }
      if (Array.isArray(child?.children)) {
        const found = walk(child.children)
        if (found) return found
      }
    }
    return null
  }

  if (Array.isArray(vnode.component?.subTree?.children)) {
    return walk(vnode.component.subTree.children)
  }

  return null
}

/**
 * Find element via DOM selector extracted from componentPath
 */
export function highlightBySelector(componentPath: string): HTMLElement | null {
  const parts = componentPath.split('::')
  const selectorIndex = parts.findIndex(
    (p, i) => p.startsWith('#') || p.includes(' > ') || (p.includes('.') && i > 2)
  )

  if (selectorIndex === -1) return null

  let selector = parts.slice(selectorIndex).join('::').replace(/^::/, '')
  if (selector.includes('::text:')) {
    selector = selector.split('::text:')[0]
  }

  try {
    let el = document.querySelector(selector)
    if (el instanceof HTMLElement) return el

    // Simplify selector by removing unstable classes
    const blacklist = ['animate-', 'transition-', 'backdrop-']
    let simplified = selector
    blacklist.forEach(cls => {
      simplified = simplified.replace(new RegExp(`\\.${cls}[a-zA-Z0-9_-]+`, 'g'), '')
    })

    if (simplified !== selector) {
      el = document.querySelector(simplified.trim())
      if (el instanceof HTMLElement) return el
    }
  } catch {
    // Invalid selector
  }

  return null
}

/**
 * Find element by text content
 */
export function highlightByText(componentPath: string): HTMLElement | null {
  const expectedText = componentPath
    .split('::')
    .find(p => p.startsWith('text:'))
    ?.replace('text:', '')

  if (!expectedText || expectedText.length < 3) return null

  const candidates = Array.from(
    document.querySelectorAll('[data-test-id], span, a, p')
  ).filter(el => el.textContent?.trim() === expectedText)

  return candidates.length === 1 ? (candidates[0] as HTMLElement) : null
}

/**
 * Find element via components list (async fallback)
 * Returns true to indicate async handling
 */
export function highlightByComponentsList(
  componentPath: string,
  sendResponse: (r: any) => void
): boolean {
  let finished = false

  const finish = (payload: any) => {
    if (finished) return
    finished = true
    sendResponse(payload)
  }

  window.postMessage({ type: 'VUE_INSPECTOR_GET_COMPONENTS' }, '*')

  const handler = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'VUE_INSPECTOR_COMPONENTS_DATA') {
      return
    }

    window.removeEventListener('message', handler)

    const components = event.data.components || []
    const name = componentPath.split('::')[1]

    const match = components.find((c: any) => c.name === name)
    const el = match?.rootElement || match?.element

    if (el instanceof HTMLElement) {
      highlightElement(el)
      finish({ success: true })
    } else {
      finish({ success: false })
    }
  }

  window.addEventListener('message', handler)

  setTimeout(() => {
    window.removeEventListener('message', handler)
    if (!finished) {
      finish({ success: false, timeout: true })
    }
  }, 1500)

  return true
}
