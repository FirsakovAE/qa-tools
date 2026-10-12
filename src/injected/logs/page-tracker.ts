/**
 * Page tracker: SPA navigation (History API, popstate, hashchange), uncaught errors and
 * `console.error` of the page (see console-tracker.ts). Errors raised by Vue Inspector itself
 * or by browser extensions are not logged; stacks are kept compact.
 */

import { recordLog } from './core'
import { initConsoleLogs } from './console-tracker'
import { errorInfoOf, locationOf, recordError } from './errors'
import { isForeignUrl, parseFrames } from './stack'

let lastHref = ''
let initialized = false

function pathOf(href: string): string {
  try {
    const url = new URL(href)
    return url.pathname + url.hash
  } catch {
    return href
  }
}

function recordNavigation(navType: string): void {
  const to = location.href
  if (to === lastHref) return
  const from = lastHref
  lastHref = to
  recordLog({
    kind: 'navigation',
    key: pathOf(to),
    level: 'info',
    data: { navType, from, to },
  })
}

function patchHistory(method: 'pushState' | 'replaceState'): void {
  const original = history[method]
  if (typeof original !== 'function') return
  history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
    const result = original.apply(this, args)
    try {
      recordNavigation(method)
    } catch (e) {
      console.error('[injected/logs/page] recordNavigation failed:', e)
    }
    return result
  } as History['pushState']
}

export function initPageLogs(): void {
  if (initialized) return
  initialized = true
  lastHref = location.href

  patchHistory('pushState')
  patchHistory('replaceState')
  window.addEventListener('popstate', () => recordNavigation('popstate'))
  window.addEventListener('hashchange', () => recordNavigation('hashchange'))

  window.addEventListener('error', (event: ErrorEvent) => {
    if (!(event instanceof ErrorEvent)) return
    const err = event.error ? errorInfoOf(event.error) : { message: event.message }
    // Where the error was thrown: an error re-reported by the network interceptor keeps the app frame
    const origin = parseFrames(err.stack ?? '')[0]?.url || event.filename || ''
    if (origin && isForeignUrl(origin)) return
    recordError('Uncaught error', err, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const err = errorInfoOf(event.reason)
    const frames = parseFrames(err.stack ?? '')
    // Produced entirely by Vue Inspector / an extension; a page call through the fetch wrapper stays
    if (frames.length > 0 && frames.every(f => isForeignUrl(f.url))) return
    recordError('Unhandled rejection', err, locationOf(err.stack))
  })

  initConsoleLogs()
}
