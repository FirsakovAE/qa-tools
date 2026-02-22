/**
 * DevTools page entry point.
 * Runs in the devtools context and creates the Vue Inspector panel
 * only when displayMode is set to 'devtools'.
 */

const tabId = chrome.devtools.inspectedWindow.tabId

chrome.runtime.sendMessage({ type: 'GET_DISPLAY_MODE' }, (response) => {
  if (response?.displayMode === 'devtools') {
    chrome.devtools.panels.create(
      'Vue Inspector',
      'icons/icon32.png',
      `injected_ui/index.html?devtools=1&tabId=${tabId}`
    )
  }
})
