// === STATIC SITE DETECTION (HUGO / MPA SAFE MODE) ===

export type StaticDetectionResult = {
  isLikelyStatic: boolean
  reasons: string[]
}

export function detectStaticSite(): StaticDetectionResult {
  const reasons: string[] = []

  // 1. Нет признаков SPA router
  const hasHistoryListeners =
    history.pushState.toString().includes('[native code]') === false ||
    history.replaceState.toString().includes('[native code]') === false

  if (!hasHistoryListeners) {
    reasons.push('history API not patched')
  }

  // 2. Нет SPA фреймворков
  const hasSPAFramework =
    (window as any).__VUE__ ||
    (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__ ||
    (window as any).React ||
    (window as any).ng ||
    (window as any).angular

  if (!hasSPAFramework) {
    reasons.push('no SPA framework globals')
  }

  // 3. Навигация типа "navigate"
  try {
    const navEntries = performance.getEntriesByType('navigation') as any[]
    if (navEntries?.[0]?.type === 'navigate') {
      reasons.push('navigation type = navigate')
    }
  } catch {}

  // 4. Ссылки выглядят как MPA
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 20)
  const mpaLinks = links.filter(a =>
    a.getAttribute('href')?.match(/\.html$|\/[^/]+\/$/)
  )

  if (mpaLinks.length > 5) {
    reasons.push('MPA-style links detected')
  }

  // 5. DOM меняется целиком (наблюдение)
  let fullDomReplaced = false
  const root = document.documentElement

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (
        m.type === 'childList' &&
        m.target === root &&
        m.addedNodes.length > 5 &&
        m.removedNodes.length > 5
      ) {
        fullDomReplaced = true
        reasons.push('full DOM replacement detected')
        observer.disconnect()
        break
      }
    }
  })

  observer.observe(root, { childList: true })

  // Останавливаем наблюдение через 2 сек
  setTimeout(() => observer.disconnect(), 2000)

  // === итоговая эвристика ===
  const isLikelyStatic =
    reasons.length >= 2 // 2+ признака = static-safe-mode

  return { isLikelyStatic, reasons }
}