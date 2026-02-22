/**
 * DevTools page entry point.
 * Runs in the devtools context and creates the Vue Inspector panel
 * only when displayMode is 'devtools' and the site is not a static site.
 */

const tabId = chrome.devtools.inspectedWindow.tabId

chrome.runtime.sendMessage({ type: 'GET_DISPLAY_MODE' }, (modeResp) => {
  if (modeResp?.displayMode !== 'devtools') return

  chrome.runtime.sendMessage({ type: 'IS_STATIC_SITE', tabId }, (staticResp) => {
    if (staticResp?.isStatic) return

    chrome.devtools.panels.create(
      'Vue Inspector',
      'icons/icon32.png',
      `injected_ui/index.html?devtools=1&tabId=${tabId}`
    )
  })
})
