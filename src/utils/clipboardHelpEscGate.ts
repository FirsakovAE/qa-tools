/**
 * While a modal `AlertDialog` from `JsonEditor` is open (clipboard help, …),
 * Escape must close that dialog without reaching vanilla-jsoneditor (edit/search) below.
 *
 * Dismissal is mirrored on globalThis — async chunks sometimes embed a second copy
 * of this module; consume runs from the registry bundle while Vue activates from another.
 */

const DISMISS_CLIPBOARD_GLOBAL_KEY = '__vueInspectorClipboardHelpEscDismiss'

let dismissClipboardHelpDialog: null | (() => void) = null

function attachClipboardGlobalDismiss(cb: null | (() => void)): void {
  if (typeof globalThis === 'undefined') return
  const g = globalThis as Record<string, unknown>
  if (cb == null)
    delete g[DISMISS_CLIPBOARD_GLOBAL_KEY]
  else
    g[DISMISS_CLIPBOARD_GLOBAL_KEY] = cb
}

function readGlobalClipboardDismiss(): null | (() => void) {
  if (typeof globalThis === 'undefined') return null
  const raw = (globalThis as Record<string, unknown>)[DISMISS_CLIPBOARD_GLOBAL_KEY]
  return typeof raw === 'function' ? (raw as () => void) : null
}

let captureInstalled = false

/**
 * Registers a window capture listener ASAP (bootstrap), before vue-jsoneditor attaches
 * its own Escape handlers — paired with {@link activateClipboardHelpEscDismiss}.
 */
export function installClipboardHelpEscCaptureOnce(): void {
  if (captureInstalled || typeof window === 'undefined')
    return
  captureInstalled = true
  window.addEventListener('keydown', modalEscWindowCapture as EventListener, true)
}

function modalEscWindowCapture(ev: Event): void {
  if (!(ev instanceof KeyboardEvent))
    return
  if (ev.code !== 'Escape' && ev.key !== 'Escape')
    return
  if (consumeEscapeIfClipboardHelpOpen(ev))
    return
}

/** Register dismissal for the clipboard-help dialog session. */
export function activateClipboardHelpEscDismiss(cb: () => void): void {
  dismissClipboardHelpDialog = cb
  attachClipboardGlobalDismiss(cb)
}

export function deactivateClipboardHelpEscDismiss(): void {
  dismissClipboardHelpDialog = null
  attachClipboardGlobalDismiss(null)
}

/**
 * @returns whether the key event was consumed (caller should bail out).
 */
export function consumeEscapeIfClipboardHelpOpen(e: KeyboardEvent): boolean {
  const dismiss = dismissClipboardHelpDialog ?? readGlobalClipboardDismiss()
  const isEscape = e.code === 'Escape' || e.key === 'Escape'
  if (
    dismiss !== null
    && isEscape
    && !e.repeat
  ) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    dismiss()
    return true
  }
  return false
}
