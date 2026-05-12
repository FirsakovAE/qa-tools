/**
 * Connects DevTools panel Ctrl+F search to the panel content.
 *
 * Chrome captures `Ctrl+F` inside DevTools panels at the browser level
 * and exposes the typed query via `panel.onSearch` — the page's JS
 * never sees the actual keydown. We relay those queries here.
 *
 * Routing:
 *   1. If the user is currently working inside a `ui/JsonEditor`
 *      instance (focused or visible), forward the query to that
 *      editor's own built-in search panel so they see the JSON-aware
 *      highlighting / find-next / find-previous flow.
 *   2. Otherwise fall back to `window.find()` for everything else
 *      (Network table rows, Pinia state values, plain text, …).
 *
 * Chrome API actions: performSearch, nextSearchResult, previousSearchResult, cancelSearch
 */
import { isExpectedExtensionError } from '@/utils/expectedErrors'
import { resolveJsonEditorForBuiltInSearch } from './jsonEditorSearchRegistry'

const SEARCH_PORT_NAME = 'vue-inspector-devtools-search'

function setupSearchListener(port: chrome.runtime.Port) {
  let lastQuery = ''
  /** True while the active JSON editor is handling the current search session. */
  let routedToJsonEditor = false

  function clearSearchHighlight() {
    lastQuery = ''
    window.getSelection()?.removeAllRanges()
  }

  port.onMessage.addListener((msg: { type?: string; action?: string; query?: string }) => {
    if (msg.type !== 'DEVTOOLS_SEARCH') return

    const action = msg.action ?? ''
    const query = (msg.query ?? '').trim()

    // ── Route to JSON editor when one is currently active / visibly in tree mode. ──
    const jsonEditor = resolveJsonEditorForBuiltInSearch()
    if (jsonEditor) {
      if (action === 'cancelSearch') {
        if (routedToJsonEditor) jsonEditor.closeSearch()
        routedToJsonEditor = false
        clearSearchHighlight()
        return
      }
      if (action === 'performSearch') {
        // Chrome fires performSearch with an empty query when the user opens Find (Ctrl+F).
        // Still open vanilla-jsoneditor's panel — previously we returned early and JSON search never appeared.
        if (!query) {
          clearSearchHighlight()
          routedToJsonEditor = true
          jsonEditor.openSearch()
          return
        }
        lastQuery = query
        routedToJsonEditor = true
        jsonEditor.setQuery(query)
        return
      }
      if (action === 'nextSearchResult') {
        if (!routedToJsonEditor && lastQuery) {
          routedToJsonEditor = true
          jsonEditor.setQuery(lastQuery)
        }
        jsonEditor.findNext()
        return
      }
      if (action === 'previousSearchResult') {
        if (!routedToJsonEditor && lastQuery) {
          routedToJsonEditor = true
          jsonEditor.setQuery(lastQuery)
        }
        jsonEditor.findPrevious()
        return
      }
    }

    // ── Default: native window.find() for the rest of the panel. ──
    if (routedToJsonEditor) {
      // Re-entering the generic flow after the user left the editor —
      // make sure we don't reuse stale routing state.
      routedToJsonEditor = false
    }

    if (action === 'cancelSearch') {
      clearSearchHighlight()
      return
    }

    if (action === 'performSearch') {
      if (!query) {
        clearSearchHighlight()
        return
      }
      lastQuery = query
    }

    const searchQuery = action === 'performSearch' ? query : lastQuery
    if (!searchQuery) return

    const sel = window.getSelection()
    if (!sel) return

    const w = window as unknown as { find?: (s: string, c?: boolean, b?: boolean, w?: boolean) => boolean }
    const find = (backwards: boolean) => w.find?.(searchQuery, false, backwards, true)

    function scrollSelectionIntoView() {
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const container = range.commonAncestorContainer
      const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }

    if (action === 'performSearch') {
      sel.removeAllRanges()
      const range = document.createRange()
      range.setStart(document.body, 0)
      range.collapse(true)
      sel.addRange(range)
      if (find(false)) scrollSelectionIntoView()
    } else if (action === 'nextSearchResult') {
      if (find(false)) scrollSelectionIntoView()
    } else if (action === 'previousSearchResult') {
      if (find(true)) scrollSelectionIntoView()
    }
  })
}

export function useDevtoolsSearch() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.connect) return

  function connect() {
    try {
      const port = chrome.runtime.connect({ name: SEARCH_PORT_NAME })
      setupSearchListener(port)
      port.onDisconnect.addListener(() => {
        // Service worker may have restarted; reconnect when user searches again
        setTimeout(connect, 100)
      })
    } catch (error) {
      if (isExpectedExtensionError(error)) return
      console.error('[useDevtoolsSearch] Failed to connect to extension:', error)
    }
  }
  connect()
}
