/**
 * Connects DevTools panel Ctrl+F search to the panel content.
 * Uses only system APIs: panel.onSearch + window.find().
 * Highlight styling is provided by the browser natively.
 *
 * Chrome API actions: performSearch, nextSearchResult, previousSearchResult, cancelSearch
 */
import { isExpectedExtensionError } from '@/utils/expectedErrors'

const SEARCH_PORT_NAME = 'vue-inspector-devtools-search'

function setupSearchListener(port: chrome.runtime.Port) {
  let lastQuery = ''

  function clearSearchHighlight() {
    lastQuery = ''
    window.getSelection()?.removeAllRanges()
  }

  port.onMessage.addListener((msg: { type?: string; action?: string; query?: string }) => {
    if (msg.type !== 'DEVTOOLS_SEARCH') return

    const action = msg.action ?? ''
    const query = (msg.query ?? '').trim()

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
