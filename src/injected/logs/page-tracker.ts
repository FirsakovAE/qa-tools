/**
 * Page tracker: SPA navigation (History API, popstate, hashchange) and uncaught errors.
 */

import { recordLog } from './core'

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
  const path = pathOf(to)
  recordLog({
    kind: 'navigation',
    key: path,
    level: 'info',
    title: path,
    subtitle: navType,
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

function errorMessageOf(value: unknown): { message: string; name?: string; stack?: string } {
  if (value instanceof Error) return { message: value.message, name: value.name, stack: value.stack }
  if (typeof value === 'string') return { message: value }
  try {
    return { message: JSON.stringify(value) ?? String(value) }
  } catch {
    return { message: String(value) }
  }
}

function recordError(source: string, err: { message: string; name?: string; stack?: string }, extra: Record<string, unknown> = {}): void {
  const message = err.message || 'Unknown error'
  recordLog({
    kind: 'error',
    key: message.slice(0, 300),
    level: 'error',
    title: message.slice(0, 300),
    subtitle: source,
    data: { source, ...err, message, ...extra },
  })
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
    const err = event.error ? errorMessageOf(event.error) : { message: event.message }
    recordError('Uncaught error', err, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    recordError('Unhandled rejection', errorMessageOf(event.reason))
  })
}
