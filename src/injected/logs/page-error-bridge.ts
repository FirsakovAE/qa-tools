/**
 * Page-side observers for JS errors.
 *
 * Listeners and the `console.error` wrapper installed from `injected.js` (a
 * `chrome-extension://` script) make Chrome list the inspected page's errors as errors of
 * the extension. This bridge is inserted as an inline classic script, so it belongs to the
 * page: site errors stay in the page console and in Logs, and the extension error list keeps
 * only failures of Vue Inspector itself.
 *
 * The bridge calls back into `__VUE_INSPECTOR_PAGE_ERRORS__`, which the extension script
 * installs on `window` before inserting the bridge. It has no imports: `toString()` is evaluated
 * as a standalone script.
 */

export interface PageErrorDetail {
  message: string
  name?: string
  stack?: string
  filename?: string
  lineno?: number
  colno?: number
}

export interface PageErrorApi {
  /** Returns true when the call is Vue Inspector's own and must be emitted from the extension script */
  console: (args: unknown[], callSite: string) => boolean
  emit: (args: unknown[]) => void
  error: (detail: PageErrorDetail) => void
  rejection: (detail: PageErrorDetail) => void
  /** Set by the bridge: re-report a page handler error without attributing it to the extension */
  report?: (error: unknown) => void
  ready?: boolean
}

export const PAGE_ERROR_API = '__VUE_INSPECTOR_PAGE_ERRORS__'

type BridgeWindow = Window & {
  __VUE_INSPECTOR_PAGE_ERRORS__?: PageErrorApi
}

/** Standalone page script. Do not reference module bindings from here. */
function pageErrorBridge(): void {
  const api = (window as BridgeWindow).__VUE_INSPECTOR_PAGE_ERRORS__
  if (!api || api.ready) return
  api.ready = true

  function describe(value: unknown, fallback: string): PageErrorDetail {
    if (value instanceof Error) {
      return { message: value.message || fallback || '', name: value.name, stack: value.stack || '' }
    }
    if (typeof value === 'string') return { message: value }
    if (value == null) return { message: fallback || '' }
    try {
      const text = JSON.stringify(value)
      return { message: text == null ? (fallback || '') : text }
    } catch {
      return { message: String(value) }
    }
  }

  window.addEventListener('error', (event: Event) => {
    if (!(event instanceof ErrorEvent)) return
    const detail = describe(event.error, event.message)
    if (event.filename) detail.filename = event.filename
    if (typeof event.lineno === 'number') detail.lineno = event.lineno
    if (typeof event.colno === 'number') detail.colno = event.colno
    // After the browser has reported the error, so the extension script is not on its stack
    setTimeout(() => {
      try { api.error(detail) } catch { /* keep the page's error reporting intact */ }
    }, 0)
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const detail = describe(event.reason, '')
    setTimeout(() => {
      try { api.rejection(detail) } catch { /* keep the page's error reporting intact */ }
    }, 0)
  })

  const original = console.error
  let reporting = false
  console.error = function (this: unknown, ...args: unknown[]) {
    if (!reporting) {
      reporting = true
      let fromApp = false
      try {
        fromApp = api.console(args, new Error().stack || '') === true
      } catch { /* never break the page's console */ } finally {
        reporting = false
      }
      if (fromApp) {
        try { return api.emit(args) } catch { /* fall through to the native console */ }
      }
    }
    return original.apply(this, args)
  }

  api.report = (error: unknown) => {
    const report = (globalThis as { reportError?: (error: unknown) => void }).reportError
    if (typeof report === 'function') report(error)
    else setTimeout(() => { throw error }, 0)
  }
}

function pageNonce(): string {
  const el = document.querySelector('script[nonce]')
  if (!(el instanceof HTMLScriptElement)) return ''
  return el.nonce || el.getAttribute('nonce') || ''
}

/** Inserts the bridge. Returns false when the page CSP refuses the inline script. */
export function installPageErrorBridge(): boolean {
  const api = (window as BridgeWindow)[PAGE_ERROR_API]
  if (!api || api.ready) return api?.ready === true
  try {
    const script = document.createElement('script')
    const nonce = pageNonce()
    if (nonce) script.setAttribute('nonce', nonce)
    script.textContent = `(${pageErrorBridge.toString()})()`
    ;(document.documentElement || document.head).appendChild(script)
    script.remove()
  } catch {
    return false
  }
  // The inline script sets `ready` on the same object; re-read it after it runs
  return (window as BridgeWindow)[PAGE_ERROR_API]?.ready === true
}
