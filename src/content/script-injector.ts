/**
 * Script injection logic for the Vue Inspector injected script
 */

import { injectedScriptLoaded, setInjectedScriptLoaded } from './state'

/**
 * Injects the Vue Inspector script into the page context
 */
export function injectScript(): void {
  // Check if script already loaded
  if (document.getElementById('vue-inspector-injected-script')) {
    setInjectedScriptLoaded(true)
    return
  }

  // Check if injected script already available via window
  if ((window as any).__VUE_INSPECTOR_INJECTED__) {
    setInjectedScriptLoaded(true)
    return
  }

  // Create and inject script tag
  const script = document.createElement('script')
  script.id = 'vue-inspector-injected-script'
  script.src = chrome.runtime.getURL('js/injected.js')
  
  script.onload = function() {
    setInjectedScriptLoaded(true)
  }
  
  script.onerror = function() {
    // Remove script tag on error to allow retry
    const scriptEl = document.getElementById('vue-inspector-injected-script')
    if (scriptEl?.parentNode) {
      scriptEl.parentNode.removeChild(scriptEl)
    }
    setInjectedScriptLoaded(false)
  }
  
  ;(document.head || document.documentElement).appendChild(script)
}

/**
 * Check if the injected script is ready
 */
export function isInjectedScriptReady(): boolean {
  return injectedScriptLoaded || !!(window as any).__VUE_INSPECTOR_INJECTED__
}
