/**
 * Page tracker: SPA navigation (History API, popstate, hashchange), uncaught errors and
 * `console.error` of the page (see console-tracker.ts). Errors raised by Vue Inspector itself
 * or by browser extensions are not logged; stacks are kept compact.
 *
 * Observers are installed by an inline page script (page-error-bridge.ts). Listeners that live
 * in this extension script would make Chrome list the site's errors as errors of the extension.
 */

import { onLogsReset, recordLog } from './core'
import { emitAppConsoleError, installConsoleErrorFallback, observeConsoleError, prepareConsoleLogs } from './console-tracker'
import { errorInfoOf, locationOf, recordError } from './errors'
import { installPageErrorBridge, PAGE_ERROR_API, type PageErrorApi, type PageErrorDetail } from './page-error-bridge'
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

function recordNavigation(navType: string, from = lastHref): void {
  const to = location.href
  if (navType !== 'snapshot' && to === lastHref) return
  lastHref = to
  recordLog({
    kind: 'navigation',
    key: pathOf(to),
    level: 'info',
    data: { navType, from, to },
  })
}

/** Current page, recorded when logging starts and after the log is cleared, the same way store snapshots are */
function recordCurrentPage(): void {
  recordNavigation('snapshot', '')
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

function handleUncaught(detail: PageErrorDetail): void {
  const err = { message: detail.message, name: detail.name, stack: detail.stack }
  // Where the error was thrown: an error re-reported by the network interceptor keeps the app frame
  const origin = parseFrames(err.stack ?? '')[0]?.url || detail.filename || ''
  if (origin && isForeignUrl(origin)) return
  recordError('Uncaught error', err, {
    filename: detail.filename,
    lineno: detail.lineno,
    colno: detail.colno,
  })
}

function handleRejection(detail: PageErrorDetail): void {
  const err = { message: detail.message, name: detail.name, stack: detail.stack }
  const frames = parseFrames(err.stack ?? '')
  // Produced entirely by Vue Inspector / an extension; a page call through the fetch wrapper stays
  if (frames.length > 0 && frames.every(f => isForeignUrl(f.url))) return
  recordError('Unhandled rejection', err, locationOf(err.stack))
}

function installFallbackListeners(): void {
  window.addEventListener('error', (event: ErrorEvent) => {
    if (!(event instanceof ErrorEvent)) return
    const err = event.error ? errorInfoOf(event.error) : { message: event.message }
    handleUncaught({ ...err, filename: event.filename, lineno: event.lineno, colno: event.colno })
  })
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    handleRejection(errorInfoOf(event.reason))
  })
  installConsoleErrorFallback()
}

export function initPageLogs(): void {
  if (initialized) return
  initialized = true

  patchHistory('pushState')
  patchHistory('replaceState')
  window.addEventListener('popstate', () => recordNavigation('popstate'))
  window.addEventListener('hashchange', () => recordNavigation('hashchange'))

  onLogsReset(recordCurrentPage)
  recordCurrentPage()

  prepareConsoleLogs()
  const api: PageErrorApi = {
    console: observeConsoleError,
    emit: emitAppConsoleError,
    error: handleUncaught,
    rejection: handleRejection,
  }
  Object.defineProperty(window, PAGE_ERROR_API, { value: api, configurable: true })
  if (!installPageErrorBridge()) installFallbackListeners()
}
