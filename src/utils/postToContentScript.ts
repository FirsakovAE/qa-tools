/**
 * Universal utility to send messages from UI to the content script.
 * Routes through the port in DevTools mode, or via window.parent.postMessage in overlay mode.
 */

import { getRuntimeAdapter } from '@/runtime'

export function postToContentScript(message: any): void {
  const adapter = getRuntimeAdapter()

  if (adapter?.id === 'devtools') {
    adapter.sendMessage(message).catch(() => {})
    return
  }

  window.parent?.postMessage({
    __VUE_INSPECTOR__: true,
    message
  }, '*')
}
