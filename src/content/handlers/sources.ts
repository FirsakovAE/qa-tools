/**
 * Page sources for the AI assistant: the scripts the page loaded and their text.
 * Runs in the page origin, so same-origin scripts are fetched with the page cookies.
 */

import type { RuntimeHandler } from '../types'

const MAX_SCRIPT_BYTES = 8 * 1024 * 1024
const SCRIPT_PATH = /\.(m?js|cjs)(\?|#|$)/i

/** Scripts of Vue Inspector itself (standalone build) are not part of the page */
function isOwnScript(url: string): boolean {
  const base = (window as any).__VUE_INSPECTOR_CONFIG__?.baseURL
  return typeof base === 'string' && !!base && url.startsWith(base.replace(/\/$/, ''))
}

function isPageScriptUrl(url: string): boolean {
  return /^https?:/i.test(url) && !isOwnScript(url)
}

function inlineScripts(): HTMLScriptElement[] {
  return Array.from(document.scripts).filter(s => !s.src && (s.textContent?.trim().length ?? 0) > 0 && !/json|template/i.test(s.type))
}

export const handleAiSourcesList: RuntimeHandler = (_message, _sender, sendResponse) => {
  const urls = new Set<string>()
  for (const script of Array.from(document.scripts)) {
    if (script.src && isPageScriptUrl(script.src)) urls.add(script.src)
  }
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]'))) {
    if (isPageScriptUrl(link.href)) urls.add(link.href)
  }
  try {
    for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
      if (!isPageScriptUrl(entry.name)) continue
      if (entry.initiatorType === 'script' || SCRIPT_PATH.test(new URL(entry.name).pathname)) urls.add(entry.name)
    }
  } catch { /* resource timing unavailable */ }

  sendResponse({
    page: { url: location.href, title: document.title },
    scripts: Array.from(urls),
    inline: inlineScripts().map((s, index) => ({ index, size: s.textContent?.length ?? 0 })),
  })
  return true
}

export const handleAiSourceFetch: RuntimeHandler = (message, _sender, sendResponse) => {
  if (typeof message.inlineIndex === 'number') {
    const script = inlineScripts()[message.inlineIndex]
    sendResponse(script ? { text: script.textContent ?? '' } : { error: 'Inline script not found' })
    return true
  }
  const url = String(message.url || '')
  if (!/^https?:/i.test(url)) {
    sendResponse({ error: 'Only http(s) URLs can be fetched' })
    return true
  }
  ;(async () => {
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'force-cache' })
      if (!res.ok) {
        sendResponse({ error: `HTTP ${res.status}` })
        return
      }
      const size = Number(res.headers.get('content-length')) || 0
      if (size > MAX_SCRIPT_BYTES) {
        sendResponse({ error: `File is too large (${Math.round(size / 1024)} KB)` })
        return
      }
      const text = await res.text()
      sendResponse({
        text: text.length > MAX_SCRIPT_BYTES ? text.slice(0, MAX_SCRIPT_BYTES) : text,
        sourceMap: res.headers.get('SourceMap') || res.headers.get('X-SourceMap') || undefined,
      })
    } catch (e) {
      sendResponse({ error: String((e as Error)?.message || e) })
    }
  })()
  return true
}
