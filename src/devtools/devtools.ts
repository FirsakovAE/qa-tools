/**
 * DevTools page entry point.
 * Runs in the devtools context and creates the Vue Inspector panel
 * only when displayMode is 'devtools' and the site is not a static site.
 *
 * Connects panel.onSearch (Ctrl+F) to the panel content via background relay,
 * so the built-in DevTools search bar finds and highlights text in the panel.
 */

const tabId = chrome.devtools.inspectedWindow.tabId

chrome.runtime.sendMessage({ type: 'GET_DISPLAY_MODE' }, (modeResp) => {
  if (chrome.runtime.lastError || modeResp?.displayMode !== 'devtools') return

  chrome.runtime.sendMessage({ type: 'IS_STATIC_SITE', tabId }, (staticResp) => {
    if (chrome.runtime.lastError || staticResp?.isStatic) return

    chrome.devtools.panels.create(
      'Vue Inspector',
      'icons/icon32.png',
      `injected_ui/index.html?devtools=1&tabId=${tabId}`,
      (panel) => {
        panel.onSearch.addListener((action: string, queryString?: string) => {
          chrome.runtime.sendMessage({
            type: 'RELAY_DEVTOOLS_SEARCH',
            action,
            query: queryString ?? ''
          }).catch(() => {})
        })
      }
    )
  })
})
