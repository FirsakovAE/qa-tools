/**
 * Layout-safe keyboard shortcuts (Ctrl/Cmd + letter).
 *
 * With Russian and other non‑Latin layouts, `KeyboardEvent.key` often carries the
 * mapped character (e.g. `а` where a QWERTY user expects `f`), while
 * `KeyboardEvent.code` stays tied to the physical key (`KeyF`). Detection of
 * “Find” / clipboard shortcuts must use `code` (and treat `key` only as a
 * fallback for Latin layouts).
 *
 * Some embedded editors (vanilla-jsoneditor / CodeMirror) still match
 * `e.key === 'v'` etc. In that case we cancel the original `keydown` and
 * dispatch a **synthetic** event with a Latin `key`. That path must **never**
 * run for native `<input>` / `<textarea>` paste/copy — untrusted keydown does
 * not perform the default clipboard action (see callers).
 */

/** `KeyboardEvent.code` values we rely on for layout‑stable matching. */
export const PhysicalKey = {
  A: 'KeyA',
  C: 'KeyC',
  F: 'KeyF',
  V: 'KeyV',
  X: 'KeyX',
  Y: 'KeyY',
  Z: 'KeyZ',
} as const

export function primaryShortcutModifiers(): Pick<
  KeyboardEventInit,
  'ctrlKey' | 'metaKey'
> {
  if (typeof navigator === 'undefined')
    return { ctrlKey: true, metaKey: false }
  const ua = navigator.userAgent ?? ''
  const ud = navigator.userAgentData
  const platform =
    (typeof ud?.platform === 'string' ? ud.platform : '')
    || navigator.platform
    || ''
  const apple =
    /Mac|iPhone|iPod|iPad/i.test(platform)
    || ua.includes('Mac OS')
  return apple ? { ctrlKey: false, metaKey: true } : { ctrlKey: true, metaKey: false }
}

export function isPrimaryModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey
}

/** Ctrl/Cmd held, without Shift or Alt — typical “primary” shortcuts. */
export function isPrimaryModPlain(e: KeyboardEvent): boolean {
  return isPrimaryModifier(e) && !e.shiftKey && !e.altKey
}

/**
 * Physical QWERTY `F` + primary modifier (Find). Accepts `e.key === 'f' | 'F'`
 * so Latin layouts still work if `code` is missing in exotic environments.
 */
export function isPhysicalModFind(e: KeyboardEvent): boolean {
  return (
    isPrimaryModPlain(e)
    && (e.code === PhysicalKey.F || e.key === 'f' || e.key === 'F')
  )
}

/** Maps physical C/V/X to the Latin `key` vanilla-jsoneditor expects. */
export const CLIPBOARD_SHORTCUT_LATIN_KEY: Readonly<
  Record<'KeyC' | 'KeyV' | 'KeyX', 'c' | 'v' | 'x'>
> = {
  KeyC: 'c',
  KeyV: 'v',
  KeyX: 'x',
}

export type ClipboardLatinKey = (typeof CLIPBOARD_SHORTCUT_LATIN_KEY)[keyof typeof CLIPBOARD_SHORTCUT_LATIN_KEY]

/**
 * If this is Ctrl/Cmd+C/V/X and `key` is not already the Latin letter, returns
 * that letter for a synthetic `keydown`. Otherwise `null` (no rewrite).
 */
export function clipboardLatinKeyForRewrite(
  e: KeyboardEvent,
): ClipboardLatinKey | null {
  if (!isPrimaryModPlain(e))
    return null

  const latin =
    CLIPBOARD_SHORTCUT_LATIN_KEY[e.code as keyof typeof CLIPBOARD_SHORTCUT_LATIN_KEY]
  if (!latin)
    return null
  if (e.key === latin || e.key === latin.toUpperCase())
    return null
  return latin
}

/**
 * Synthetic `keydown` that mirrors mod keys from `source` but fixes `key`/`code`
 * for listeners that only understand Latin letters.
 */
export function createSyntheticLayoutFixedKeydown(
  source: KeyboardEvent,
  key: string,
  code: string,
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    code,
    ctrlKey: source.ctrlKey,
    metaKey: source.metaKey,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: source.view
      ?? (typeof globalThis.window !== 'undefined' ? globalThis.window : undefined),
  })
}

export function createSyntheticClipboardKeydown(
  source: KeyboardEvent,
  letter: ClipboardLatinKey,
): KeyboardEvent {
  return createSyntheticLayoutFixedKeydown(source, letter, source.code)
}

/** Tree/table mode compares `keyComboFromEvent` to `"Ctrl+Z"` / `"Ctrl+Shift+Z"` (latin Z). */
export function nonLatinUndoRedoKind(e: KeyboardEvent): 'undo' | 'redo' | null {
  if (!isPrimaryModifier(e) || e.altKey) return null
  if (e.code !== PhysicalKey.Z) return null
  if (e.shiftKey) {
    if (e.key === 'z' || e.key === 'Z') return null
    return 'redo'
  }
  if (e.key === 'z') return null
  return 'undo'
}

export function createSyntheticUndoRedoKeydown(
  source: KeyboardEvent,
  kind: 'undo' | 'redo',
): KeyboardEvent {
  const shift = kind === 'redo'
  return new KeyboardEvent('keydown', {
    key: shift ? 'Z' : 'z',
    code: PhysicalKey.Z,
    ctrlKey: source.ctrlKey,
    metaKey: source.metaKey,
    shiftKey: shift,
    altKey: false,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: source.view
      ?? (typeof globalThis.window !== 'undefined' ? globalThis.window : undefined),
  })
}

/** Matches Mod+F delivered to vanilla-jsoneditor surfaces (Latin `key` + `KeyF`). */
export function createSyntheticFindKeydown(view?: Window): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    ...primaryShortcutModifiers(),
    key: 'f',
    code: PhysicalKey.F,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: view ?? (typeof globalThis.window !== 'undefined' ? globalThis.window : undefined),
  })
}
