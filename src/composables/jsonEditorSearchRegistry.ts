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
 */

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
 *   3. Editor last focused (`focusin`) — helps DevTools relay (`panel.onSearch`)
 *      where no key event reaches the page.
 *   4. Editor last interacted via pointer (`pointerdown`).
 *   5. The only registered editor (if there's just one).
 *   6. The first editor whose wrapper is visible (non-zero bounding box).
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

  if (
    lastFocusedHandle
    && lastFocusedHandle.wrapperEl.isConnected
    && isWrapperVisible(lastFocusedHandle.wrapperEl)
  ) {
    return lastFocusedHandle
  }

  if (lastInteractedHandle && lastInteractedHandle.wrapperEl.isConnected) {
    if (isWrapperVisible(lastInteractedHandle.wrapperEl)) {
      return lastInteractedHandle
    }
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
  let candidate: JsonEditorSearchHandle | null = null
  for (const editor of editors) {
    if (!editor.wrapperEl.isConnected || !isWrapperVisible(editor.wrapperEl)) continue
    const root = editor.wrapperEl
    const hasTree = !!root.querySelector('.jse-tree-mode')
    const btn = root.querySelector('button.jse-search')
    const hasLiveSearchBtn =
      btn instanceof HTMLButtonElement && !btn.disabled && btn.offsetParent !== null
    if (!hasTree && !hasLiveSearchBtn) continue
    if (candidate) return null
    candidate = editor
  }
  return candidate
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
  return pickSingleVisibleJsonEditorWithSearchUi()
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

function isCtrlOrCmdF(e: KeyboardEvent): boolean {
  return (
    (e.ctrlKey || e.metaKey)
    && !e.shiftKey
    && !e.altKey
    && (e.key === 'f' || e.key === 'F')
  )
}

function onGlobalKeydownCapture(e: KeyboardEvent) {
  // Our own synthetic Ctrl+F (dispatched into the widget below) must
  // not be intercepted again here — let it bubble to the editor's
  // internal handler.
  if (isDispatchingCtrlF) return

  if (isCtrlOrCmdF(e)) {
    const handle = resolveJsonEditorForBuiltInSearch(e)
    if (!handle) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    if (!handle.isSearchOpen()) {
      isDispatchingCtrlF = true
      try {
        handle.openSearch()
      } finally {
        isDispatchingCtrlF = false
      }
    }
    return
  }

  if (e.key === 'Escape') {
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
  if (e.key !== 'Escape') return
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
