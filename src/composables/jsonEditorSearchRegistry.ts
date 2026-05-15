/**
 * Global registry of mounted `ui/JsonEditor` instances and a thin
 * remote-control API for each one's built-in `vanilla-jsoneditor`
 * search panel.
 *
 * Why this exists:
 *
 * 1. In DevTools-panel mode Chrome intercepts `Ctrl+F` itself and
 *    exposes the typed query via `panel.onSearch` — the page's
 *    JavaScript never receives the keystroke, so we cannot block
 *    Chrome's panel search bar. Instead, when `useDevtoolsSearch`
 *    receives a `performSearch` relay, it consults this registry: if
 *    a JSON editor is currently focused / visible, the query is fed
 *    directly into that editor's own search input (so the user sees
 *    the widget's coloured matches), otherwise we fall back to the
 *    previous `window.find()` behaviour for non-JSON content.
 *
 * 2. Outside DevTools panel (popup, standalone, regular pages) the
 *    browser opens its native "Find in page" bar when Ctrl+F isn't
 *    captured. vanilla-jsoneditor binds its own Ctrl+F listener to
 *    `.jse-tree-mode` / `.jse-hidden-input` / `.cm-content`, which
 *    requires focus to actually be inside one of those elements. In
 *    tree mode focus often wanders to `<body>` (after toolbar clicks
 *    or tab switches), so the widget never sees Ctrl+F. We install a
 *    single window-level capture listener here that finds the
 *    "active" editor (focused, last clicked, only, or first visible)
 *    and routes Ctrl+F to its built-in search.
 *
 *    Additionally, `HTMLElement.contains()` ignores nodes inside nested
 *    shadow roots; `deepContains()` + `composedPath()` lets routing
 *    still resolve when focus lands inside shadow-attached subtrees.
 *
 * Physical-key (layout-safe) Mod+F and clipboard shortcut helpers live in
 * `@/utils/keyboardLayoutShortcuts` — this module wires them into the editor.
 * Clipboard rewrite runs only when the key event belongs to a registered
 * JsonEditor (not when focus is in other Details UI), so Network / Props /
 * Pinia fields keep native Mod+C/V/X on RU layouts.
 */

import { consumeEscapeIfClipboardHelpOpen } from '@/utils/clipboardHelpEscGate'
import { dispatchRuLayoutClipboardInJsonEditor, dispatchRuLayoutUndoRedoInJsonEditor } from '@/utils/jsonEditorRuClipboard'
import {
  clipboardLatinKeyForRewrite,
  isPhysicalModFind,
  nonLatinUndoRedoKind,
} from '@/utils/keyboardLayoutShortcuts'

export interface JsonEditorSearchHandle {
  /** Outer wrapper element of the editor (used for focus relevance checks). */
  wrapperEl: HTMLElement
  /** Open the editor's built-in search panel. Safe to call repeatedly. */
  openSearch: () => void
  /** Set / replace the current search query. Auto-opens the panel. */
  setQuery: (query: string) => void
  /** Close the search panel. */
  closeSearch: () => void
  /** Jump to next match (equivalent to pressing Enter inside the panel). */
  findNext: () => void
  /** Jump to previous match (equivalent to Shift+Enter inside the panel). */
  findPrevious: () => void
  /** Whether the editor's built-in search panel is currently visible. */
  isSearchOpen: () => boolean
}

const editors = new Set<JsonEditorSearchHandle>()

/**
 * Most-recently pointer-pressed editor. Promoted ahead of generic
 * visibility fallbacks so that when several JSON editors are on
 * screen at once, Ctrl+F goes to the one the user just clicked into.
 */
let lastInteractedHandle: JsonEditorSearchHandle | null = null

/** Editor most recently focused via focusin (helps Ctrl+F routing when DevTools relays search without a key event). */
let lastFocusedHandle: JsonEditorSearchHandle | null = null

export function registerJsonEditor(handle: JsonEditorSearchHandle): () => void {
  editors.add(handle)
  ensureGlobalListeners()
  return () => {
    editors.delete(handle)
    if (lastInteractedHandle === handle) lastInteractedHandle = null
    if (lastFocusedHandle === handle) lastFocusedHandle = null
    releaseGlobalListeners()
  }
}

/**
 * Walks parent chain including shadow-document boundaries (`ShadowRoot → host`).
 * `HTMLElement.contains()` alone misses nodes inside shadow trees attached under the wrapper.
 */
function deepContains(ancestor: HTMLElement, node: Node | null): boolean {
  let cur: Node | null = node
  while (cur) {
    if (cur === ancestor) return true
    if (cur instanceof ShadowRoot) {
      cur = cur.host
      continue
    }
    cur = cur.parentNode
  }
  return false
}

function pickEditorContainingNode(node: Node | null): JsonEditorSearchHandle | null {
  if (!node) return null
  for (const editor of editors) {
    if (!editor.wrapperEl.isConnected) continue
    if (deepContains(editor.wrapperEl, node)) return editor
  }
  return null
}

/** Tree/CodeMirror may keep the selection inside the editor while `activeElement` is elsewhere. */
function pickEditorContainingCaret(): JsonEditorSearchHandle | null {
  if (typeof document === 'undefined') return null
  try {
    const sel = document.getSelection?.()
    if (!sel || sel.rangeCount <= 0) return null
    const anchor = sel.anchorNode
    return anchor ? pickEditorContainingNode(anchor) : null
  } catch {
    return null
  }
}

function editorFromComposedPath(event: Event): JsonEditorSearchHandle | null {
  const path =
    typeof event.composedPath === 'function' ? event.composedPath() : []
  for (const raw of path) {
    if (!(raw instanceof Node)) continue
    const hit = pickEditorContainingNode(raw)
    if (hit) return hit
  }
  return null
}

/**
 * Pick the JSON editor that should receive the next search command.
 * Preference order:
 *   1. Editor enclosing a node from `event.composedPath()` / `event.target`
 *      (keyboard handlers).
 *   2. Editor enclosing `document.activeElement`.
 *   3. Editor enclosing the current selection anchor (caret).
 *   4. Editor last focused (`focusin`) — helps DevTools relay (`panel.onSearch`)
 *      where no key event reaches the page.
 *   5. Editor last interacted via pointer (`pointerdown`).
 *   6. The only registered editor (if there's just one).
 *   7. The first editor whose wrapper is visible (non-zero bounding box).
 */
export function findActiveJsonEditor(
  event?: Event,
): JsonEditorSearchHandle | null {
  if (editors.size === 0) return null

  if (event) {
    const fromPath = editorFromComposedPath(event)
    if (fromPath) return fromPath
    const target = event.target as Node | null
    const fromTarget = pickEditorContainingNode(target)
    if (fromTarget) return fromTarget
  }

  const active = document.activeElement
  const fromActive =
    active instanceof Node ? pickEditorContainingNode(active) : null
  if (fromActive) return fromActive

  const fromCaret = pickEditorContainingCaret()
  if (fromCaret) return fromCaret

  if (lastFocusedHandle && lastFocusedHandle.wrapperEl.isConnected) {
    return lastFocusedHandle
  }

  if (lastInteractedHandle && lastInteractedHandle.wrapperEl.isConnected) {
    return lastInteractedHandle
  }

  if (editors.size === 1) {
    const only = editors.values().next().value
    return only && only.wrapperEl.isConnected ? only : null
  }

  for (const editor of editors) {
    if (!editor.wrapperEl.isConnected) continue
    if (isWrapperVisible(editor.wrapperEl)) return editor
  }

  return null
}

function isWrapperVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function pickSingleVisibleJsonEditorWithSearchUi(): JsonEditorSearchHandle | null {
  const candidates: JsonEditorSearchHandle[] = []
  for (const editor of editors) {
    if (!editor.wrapperEl.isConnected || !isWrapperVisible(editor.wrapperEl)) continue
    const root = editor.wrapperEl
    const hasTree = !!root.querySelector('.jse-tree-mode')
    const btn = root.querySelector('button.jse-search')
    const hasLiveSearchBtn =
      btn instanceof HTMLButtonElement && !btn.disabled && btn.offsetParent !== null
    if (!hasTree && !hasLiveSearchBtn) continue
    candidates.push(editor)
  }
  if (candidates.length <= 1) return candidates[0] ?? null
  return (
    candidates.find(e => lastFocusedHandle === e)
    ?? candidates.find(e => lastInteractedHandle === e)
    ?? candidates[0]
    ?? null
  )
}

function pickFallbackAnyVisibleEditor(): JsonEditorSearchHandle | null {
  const vis: JsonEditorSearchHandle[] = []
  for (const ed of editors) {
    if (!ed.wrapperEl.isConnected || !isWrapperVisible(ed.wrapperEl)) continue
    vis.push(ed)
  }
  if (vis.length === 0) return null
  if (vis.length === 1) return vis[0]!
  const prefer =
    (lastFocusedHandle && vis.includes(lastFocusedHandle)) ? lastFocusedHandle
      : (lastInteractedHandle && vis.includes(lastInteractedHandle)) ? lastInteractedHandle
      : vis[0]
  return prefer ?? vis[0]!
}

/**
 * JsonEditor that should receive RU/ non‑Latin Mod+C/V/X rewrite.
 *
 * Unlike {@link resolveJsonEditorForBuiltInSearch}, this must **not** fall back
 * to “last focused” or “first visible” editor: Details panels (Network, Props,
 * Pinia) mount their own inputs; a visible JsonEditor elsewhere would steal
 * clipboard shortcuts and break native copy/paste there.
 */
function findJsonEditorForClipboardRewrite(
  event: KeyboardEvent,
): JsonEditorSearchHandle | null {
  if (editors.size === 0) return null

  const fromPath = editorFromComposedPath(event)
  if (fromPath) return fromPath

  const target = event.target as Node | null
  const fromTarget = pickEditorContainingNode(target)
  if (fromTarget) return fromTarget

  const active = document.activeElement
  const fromActive =
    active instanceof Node ? pickEditorContainingNode(active) : null
  if (fromActive) return fromActive

  return null
}

const NON_TEXTUAL_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'file',
  'button',
  'submit',
  'reset',
  'hidden',
  'image',
])

/** Any real `<input>` / `<textarea>` **outside** JsonEditor wrappers (Details, settings, …). */
function isNativeFormTextFieldOutsideAnyJsonEditor(el: Element | null): boolean {
  let field: HTMLInputElement | HTMLTextAreaElement | null = null
  if (el instanceof HTMLTextAreaElement) {
    field = el
  } else if (el instanceof HTMLInputElement) {
    if (NON_TEXTUAL_INPUT_TYPES.has(el.type)) return false
    field = el
  }
  if (!field) return false
  return pickEditorContainingNode(field) === null
}

/**
 * Resolve which editor should receive built-in JSON search (global Ctrl+F or DevTools relay).
 * Falls back to the lone visible editor that exposes tree UI or the embedded Search toolbar button.
 */
export function resolveJsonEditorForBuiltInSearch(
  event?: Event,
): JsonEditorSearchHandle | null {
  const primary = findActiveJsonEditor(event)
  if (primary) return primary
  const withSearchChrome = pickSingleVisibleJsonEditorWithSearchUi()
  if (withSearchChrome) return withSearchChrome
  return pickFallbackAnyVisibleEditor()
}

// ───────────────────── Global keyboard interception ─────────────────────
//
// All editors share window-level keydown listeners (capture + bubble for Esc).
// Each `registerJsonEditor` call increments a refcount; listeners tear down when
// the last editor unmounts.

let globalListenersRefCount = 0

/** True while we synthesise a Ctrl+F keydown ourselves; prevents recursion. */
let isDispatchingCtrlF = false

/**
 * Whether the most recent Esc closed the editor's built-in search
 * panel. Used to swallow the same Esc on its way back up so the
 * surrounding Details panel doesn't also close.
 */
let escWasForSearch = false

/**
 * `<input>` / `<textarea>` inside the editor (search box, inline keys, …) rely on
 * the browser for Ctrl+C/V/X; those shortcuts are layout‑independent at the OS
 * level. Our `maybeRewriteNonLatinCtrlClipboard` path calls `preventDefault`
 * and dispatches a synthetic keydown — untrusted events never run the default
 * paste action, so we must not intercept when a native text control is
 * focused.
 *
 * CodeMirror’s `.cm-editor` stack (including its helper `<textarea>`) uses a
 * Mod+letter keymap on `KeyboardEvent.key`, not OS default paste — exclude it
 * here so RU layout still gets the latin-key rewrite.
 */
function isJsonEditorNativeTextField(el: Element | null): boolean {
  if (!el) return false

  let field: HTMLInputElement | HTMLTextAreaElement | null = null
  if (el instanceof HTMLTextAreaElement) {
    field = el
  } else if (el instanceof HTMLInputElement) {
    // Tree/table mode keyboard sink (`<input class="jse-hidden-input">`) is still a
    // text input but vanilla-jsoneditor handles Mod+C/V/X by key — RU layout
    // needs the latin-key rewrite like CodeMirror, not OS-native paste on this node.
    if (el.classList.contains('jse-hidden-input'))
      return false

    if (NON_TEXTUAL_INPUT_TYPES.has(el.type))
      return false
    field = el
  }
  if (!field) return false

  if (field.closest('.cm-editor')) {
    for (const editor of editors) {
      if (!editor.wrapperEl.isConnected) continue
      if (deepContains(editor.wrapperEl, field))
        return false
    }
  }

  for (const editor of editors) {
    if (!editor.wrapperEl.isConnected) continue
    if (deepContains(editor.wrapperEl, field)) return true
  }
  return false
}

/**
 * When the OS layout maps Latin shortcuts to non‑Latin `e.key`, vanilla-jsoneditor
 * never matches its Ctrl+C/V/X handlers — same root cause as Ctrl+F. Re-dispatch a
 * Latin `key` to the active tree hidden input (or CodeMirror surface).
 */
function maybeRewriteNonLatinCtrlClipboard(e: KeyboardEvent): boolean {
  if (isNativeFormTextFieldOutsideAnyJsonEditor(document.activeElement))
    return false

  if (isJsonEditorNativeTextField(document.activeElement))
    return false

  const latin = clipboardLatinKeyForRewrite(e)
  if (!latin)
    return false

  const handle = findJsonEditorForClipboardRewrite(e)
  if (!handle)
    return false

  const sink = pickClipboardKeyboardSink(handle)
  if (!sink)
    return false

  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()

  dispatchRuLayoutClipboardInJsonEditor(e, sink, latin)
  return true
}

function maybeRewriteNonLatinUndoRedo(e: KeyboardEvent): boolean {
  const kind = nonLatinUndoRedoKind(e)
  if (!kind)
    return false

  if (isNativeFormTextFieldOutsideAnyJsonEditor(document.activeElement))
    return false

  if (isJsonEditorNativeTextField(document.activeElement))
    return false

  const handle = findJsonEditorForClipboardRewrite(e)
  if (!handle)
    return false

  const sink = pickClipboardKeyboardSink(handle)
  if (!sink)
    return false

  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()

  dispatchRuLayoutUndoRedoInJsonEditor(e, sink, kind)
  return true
}

function pickClipboardKeyboardSink(
  handle: JsonEditorSearchHandle,
): HTMLElement | null {
  const w = handle.wrapperEl
  const active = document.activeElement
  if (
    active instanceof HTMLElement
    && active !== document.body
    && deepContains(w, active)
  ) {
    return active
  }

  const hidden =
    w.querySelector<HTMLInputElement>('.jse-tree-mode .jse-hidden-input')
    ?? w.querySelector<HTMLInputElement>('.jse-table-mode .jse-hidden-input')
  if (hidden)
    return hidden

  const cm = w.querySelector<HTMLElement>('.cm-content')
  if (cm)
    return cm

  return null
}

function onGlobalKeydownCapture(e: KeyboardEvent) {
  // Our own synthetic Ctrl+F (dispatched into the widget below) must
  // not be intercepted again here — let it bubble to the editor's
  // internal handler.
  if (isDispatchingCtrlF) return

  if (maybeRewriteNonLatinCtrlClipboard(e))
    return

  if (maybeRewriteNonLatinUndoRedo(e))
    return

  if (consumeEscapeIfClipboardHelpOpen(e)) {
    escWasForSearch = false
    return
  }

  if (isPhysicalModFind(e)) {
    const handle = resolveJsonEditorForBuiltInSearch(e)
    if (!handle) return

    /* Only swallow Ctrl/Cmd+F when we're opening search — panel already visible must reach the widget. */
    if (!handle.isSearchOpen()) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      isDispatchingCtrlF = true
      try {
        handle.openSearch()
      } finally {
        isDispatchingCtrlF = false
      }
    }
    return
  }

  if (e.code === 'Escape' || e.key === 'Escape') {
    // Record the search-visibility BEFORE the editor's internal
    // handler closes it, so the bubble-phase handler can decide
    // whether to stop further propagation. Always overwrite the
    // flag (including resetting it to `false`) so a previous Esc
    // that was swallowed by an inner stopPropagation cannot leak
    // a stale `true` into the next keystroke.
    const handle = resolveJsonEditorForBuiltInSearch(e)
    escWasForSearch = handle ? handle.isSearchOpen() : false
  }
}

function onGlobalKeydownBubble(e: KeyboardEvent) {
  if (e.code !== 'Escape' && e.key !== 'Escape') return
  if (escWasForSearch) {
    // Search was just closed by the editor; prevent the same Esc
    // from also closing the wrapping Details panel.
    e.stopPropagation()
  }
  escWasForSearch = false
}

function onGlobalPointerDown(e: Event) {
  const target = e.target as Node | null
  lastInteractedHandle = pickEditorContainingNode(target)
}

function onGlobalFocusIn(e: FocusEvent) {
  const target = e.target as Node | null
  const hit = pickEditorContainingNode(target)
  lastFocusedHandle = hit
}

function ensureGlobalListeners() {
  if (globalListenersRefCount++ > 0) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  // Capture on `window` so Ctrl+F is handled before Chrome's Find UI in panels
  // where `document`-only listeners sometimes lose the race.
  window.addEventListener('keydown', onGlobalKeydownCapture, true)
  window.addEventListener('keydown', onGlobalKeydownBubble, false)
  document.addEventListener('pointerdown', onGlobalPointerDown, true)
  document.addEventListener('focusin', onGlobalFocusIn, true)
}

function releaseGlobalListeners() {
  if (globalListenersRefCount <= 0) return
  if (--globalListenersRefCount > 0) return
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onGlobalKeydownCapture, true)
    window.removeEventListener('keydown', onGlobalKeydownBubble, false)
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', onGlobalPointerDown, true)
    document.removeEventListener('focusin', onGlobalFocusIn, true)
  }
  lastInteractedHandle = null
  lastFocusedHandle = null
  escWasForSearch = false
}
