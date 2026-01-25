/**
 * Static site detection (Hugo / MPA safe mode)
 * Detects if the current page is likely a static/MPA site to avoid unnecessary resource loading
 */

import type { StaticDetectionResult } from './types'

/**
 * Detect if current site is likely a static/MPA site
 */
export function detectStaticSite(): StaticDetectionResult {
  const reasons: string[] = []

  // === MAIN RULE: IF VUE INDICATORS PRESENT - NOT STATIC ===
  // Check for Vue presence through various indicators
  const hasVueIndicators =
    (window as any).__VUE__ ||
    (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__ ||
    !!document.querySelector('[data-v-]') || // Vue scoped styles
    !!document.querySelector('[v-]') || // Vue directives
    !!document.querySelector('.vue-app, #app, #root') || // Common Vue app containers
    Array.from(document.querySelectorAll('script')).some(s =>
      s.src?.includes('vue') || s.textContent?.includes('Vue.')
    )

  if (hasVueIndicators) {
    // If Vue indicators present - definitely not static
    return { isLikelyStatic: false, reasons: [] }
  }

  // === CHECKS ONLY FOR SITES WITHOUT VUE INDICATORS ===

  // 1. MPA navigation patterns (only if many such links)
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 30)
  const mpaLinks = links.filter(a => {
    const href = a.getAttribute('href')
    return href && (
      href.match(/\.html$/) || // .html files
      (href.match(/\/[^/]+\/$/) && !href.includes('#') && !href.includes('?')) // directories without params
    )
  })

  if (mpaLinks.length > Math.min(links.length * 0.6, 10)) { // 60% of links or at least 10
    reasons.push(`MPA-style links: ${mpaLinks.length}/${links.length}`)
  }

  // 2. Navigation type "navigate" + absence of other types
  try {
    const navEntries = performance.getEntriesByType('navigation') as any[]
    const navType = navEntries?.[0]?.type
    if (navType === 'navigate') {
      reasons.push('navigation type = navigate')
    }
  } catch {}

  // 3. Absence of SPA router indicators (less strict criterion)
  const hasRouterIndicators =
    window.history?.state?._isRouter || // Vue Router state
    window.location.hash.includes('#/') || // Hash routing
    document.querySelector('[data-router-view], [data-router-link]') // Router elements

  if (!hasRouterIndicators) {
    reasons.push('no router indicators')
  }

  // 4. Check for static site generators (Hugo, Jekyll, etc.)
  const hasStaticGeneratorIndicators =
    !!document.querySelector('meta[name="generator"][content*="Hugo"]') ||
    !!document.querySelector('meta[name="generator"][content*="Jekyll"]') ||
    !!document.querySelector('meta[name="generator"][content*="Gatsby"]') ||
    !!document.querySelector('meta[name="generator"][content*="Next.js"]') ||
    document.documentElement.classList.contains('hugo-site') ||
    document.body.classList.contains('jekyll-site')

  if (hasStaticGeneratorIndicators) {
    reasons.push('static site generator detected')
  }

  // 5. DOM observation - only significant changes
  let significantDomChanges = 0
  const root = document.documentElement

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList' && m.target === root) {
        if (m.addedNodes.length > 3 || m.removedNodes.length > 3) {
          significantDomChanges++
        }
      }
    }
  })

  observer.observe(root, { childList: true, subtree: false })

  // Stop observation after 3 sec
  setTimeout(() => {
    observer.disconnect()
    if (significantDomChanges > 2) {
      reasons.push(`significant DOM changes: ${significantDomChanges}`)
    }
  }, 3000)

  // === FINAL HEURISTIC ===
  // Require more indicators for confidence + explicit static indicators
  const hasStrongStaticIndicators =
    hasStaticGeneratorIndicators ||
    (mpaLinks.length > Math.min(links.length * 0.8, 15)) // 80% of links MPA-style

  const isLikelyStatic =
    hasStrongStaticIndicators ||
    (reasons.length >= 3 && !hasVueIndicators) // At least 3 indicators + no Vue

  return { isLikelyStatic, reasons }
}
