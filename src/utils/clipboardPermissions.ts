/**
 * Clipboard API + Permissions-Policy in embedded inspector UI.
 */

export type ClipboardPolicyFeature = 'clipboard-read' | 'clipboard-write'

export function allowsClipboardPolicyFeature(
  feature: ClipboardPolicyFeature,
): boolean {
  try {
    const doc = document as Document & {
      permissionsPolicy?: { allowsFeature: (feature: string) => boolean }
    }
    const pp = doc.permissionsPolicy
    if (pp && typeof pp.allowsFeature === 'function') {
      return pp.allowsFeature(feature)
    }
  } catch {
    /* allowsFeature throws for unknown tokens in some browsers */
  }
  return true
}

/**
 * When true, code may safely call native `navigator.clipboard`.
 *
 * Chrome DevTools **panel** frames (`devtools://…`, our `data-devtools` UI) apply a strict
 * Permissions-Policy on clipboard — any `readText`/`writeText` logs a violation and often fails.
 * Use shims (`execCommand` / reject) instead.
 *
 * Overlay (`data-injected` in a child frame): host pages can fence clipboard so Chrome logs
 * a "Permissions policy violation" on **every native call** before the Promise settles, even when
 * `allowsFeature()` reports incorrectly; never touch `navigator.clipboard` in that mode.
 *
 * Readers that must surface vanilla-jsoneditor’s clipboard-help flow should **reject** with
 * `notAllowedClipboardError()` — resolving `undefined` skips the generator `catch` and hides UX.
 */
export function shouldUseNavigatorClipboardApis(): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return true

    if (document.documentElement?.hasAttribute('data-devtools')) return false

    let framed = false
    try {
      framed = window.self !== window.top
    } catch {
      framed = true
    }

    if (document.documentElement?.hasAttribute('data-injected') && framed) return false

    if (
      !allowsClipboardPolicyFeature('clipboard-read')
      || !allowsClipboardPolicyFeature('clipboard-write')
    ) {
      return false
    }
  } catch {
    return true
  }
  return true
}

export function notAllowedClipboardError(): DOMException {
  return new DOMException(
    'The Clipboard API has been blocked for this frame.',
    'NotAllowedError',
  )
}
