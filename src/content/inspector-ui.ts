/**
 * Inspector panel UI injection
 */

import {
  featureFlags,
  injectedScriptLoaded,
  setInjectedScriptLoaded,
  resetDetectionState,
  uiBridgeInitialized
} from './state'
import { injectScript } from './script-injector'
import { setupUIMessageBridge, removeUIMessageBridge, sendFlagsToUI, broadcastToUI, UI_MESSAGE_PREFIX } from './ui-bridge'
import { addMessageListenerIfNeeded } from './detection'

/** Overlay iframe: collapse while Props pick mode is active; restore after (Esc / select). Set by injectInspectorUI. */
let propsInspectOverlayHooks: {
  onSessionStart: () => void
  onSessionEnd: () => void
} | null = null

/** Called from propsInspector when overlay exists; no-op if DevTools-only (no overlay host). */
export function onPropsInspectOverlaySessionStart(): void {
  propsInspectOverlayHooks?.onSessionStart()
}

export function onPropsInspectOverlaySessionEnd(): void {
  propsInspectOverlayHooks?.onSessionEnd()
}

/**
 * Injects the Vue Inspector UI panel into the page
 */
export function injectInspectorUI(): void {
  if (document.getElementById('vue-inspector-host')) return

  // State and constants
  let isCollapsed = true
  let height = 360
  const MIN_HEIGHT = 120
  const MAX_OFFSET = 80
  let iframeLoaded = false // IMPORTANT: iframe is loaded lazily!
  const pendingNetworkMessages: any[] = []

  // Create root wrapper
  const root = document.createElement('div')
  root.id = 'vue-inspector-root'
  root.style.cssText = `
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100vw;
    z-index: 2147483647;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  `

  // Create host container (only for iframe)
  const host = document.createElement('div')
  host.id = 'vue-inspector-host'
  host.style.cssText = `
    position: relative;
    width: 100%;
    height: 0px;
    overflow: hidden;
    pointer-events: none;
    overscroll-behavior: contain;
  `

  // Create iframe WITHOUT src - will load later on open
  const iframe = document.createElement('iframe')
  iframe.id = 'vue-inspector-ui'
  // DON'T set src immediately! This saves ~1GB memory on sites without Vue

  iframe.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    pointer-events: auto;
    display: none;
    user-select: none;
    -webkit-user-select: none;
  `

  // Function for lazy loading resources
  const loadResourcesIfNeeded = () => {
    if (iframeLoaded) return
    iframeLoaded = true
    
    // Reset detection so overlay gets fresh Vue/Pinia flags (init() sets detectionCompleted=true)
    resetDetectionState()
    
    // Initialize bridge for UI (only when iframe is created)
    setupUIMessageBridge()
    
    // Add global message listener (handles detection + sendFlagsToUI)
    addMessageListenerIfNeeded()
    
    // 1. Load injected script (for detection)
    if (!injectedScriptLoaded) {
      injectScript()
      setInjectedScriptLoaded(true)
    }
    
    // 2. Load iframe with UI (always - tabs will hide themselves)
    iframe.src = chrome.runtime.getURL('injected_ui/index.html')
    iframe.style.display = 'block'
    
    iframe.onload = () => {
      // Request detection (reset already done at start of loadResourcesIfNeeded)
      window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')
      
      // Replay queued network messages (breakpoint hits received while iframe was unloaded)
      if (pendingNetworkMessages.length > 0) {
        let replayed = false
        const doReplay = () => {
          if (replayed) return
          replayed = true
          window.removeEventListener('message', readyListener)
          const messages = pendingNetworkMessages.splice(0)
          for (const msg of messages) {
            broadcastToUI(msg)
          }
        }
        // Wait for first message from iframe (signals Vue app is mounted)
        const readyListener = (event: MessageEvent) => {
          if (event.data?.[UI_MESSAGE_PREFIX] && event.source === iframe.contentWindow) {
            setTimeout(doReplay, 100)
          }
        }
        window.addEventListener('message', readyListener)
        // Fallback: replay after 1s even if no signal received
        setTimeout(doReplay, 1000)
      }
    }
  }
  
  // Create collapse button (sibling, not child) — premium SaaS style
  const toggle = document.createElement('button')
  toggle.id = 'vue-inspector-toggle'
  toggle.style.cssText = `
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 28px;
    border-radius: 14px 14px 0 0;
    background: rgba(15, 15, 15, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom: none;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.25), 0 1px 0 rgba(255, 255, 255, 0.06) inset;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  `
  toggle.addEventListener('mouseenter', () => {
    toggle.style.background = 'rgba(25, 25, 25, 0.92)'
    toggle.style.boxShadow = '0 -2px 16px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.08) inset'
  })
  toggle.addEventListener('mouseleave', () => {
    toggle.style.background = 'rgba(15, 15, 15, 0.85)'
    toggle.style.boxShadow = '0 -2px 12px rgba(0, 0, 0, 0.25), 0 1px 0 rgba(255, 255, 255, 0.06) inset'
  })

  // Premium SVG chevron (stroke-based, crisp at any size)
  const chevron = document.createElement('div')
  chevron.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 15l6-6 6 6"/>
    </svg>
  `
  chevron.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(0deg);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  `
  toggle.appendChild(chevron)

  const updateCollapsedState = () => {
    if (isCollapsed) {
      host.style.height = '0px'
      iframe.style.display = 'none'
      toggle.style.bottom = '0px'
    } else {
      host.style.height = `${height}px`
      iframe.style.display = 'block'
      toggle.style.bottom = `${height}px`
    }
  }

  const applyCollapsed = (nextCollapsed: boolean) => {
    if (isCollapsed === nextCollapsed) return
    isCollapsed = nextCollapsed
    chevron.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'

    // LAZY LOADING: load ALL resources only on first open
    if (!isCollapsed) {
      loadResourcesIfNeeded()

      // When expanding with iframe already loaded: request fresh detection.
      // Fixes Vue/Pinia not being detected when switching from DevTools to Overlay mode.
      if (iframeLoaded && uiBridgeInitialized) {
        resetDetectionState()
        if (!injectedScriptLoaded) {
          injectScript()
          setInjectedScriptLoaded(true)
        }
        addMessageListenerIfNeeded()
        window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')
      }
    }

    updateCollapsedState()

    // Notify iframe about visibility state (for auto-refresh pause)
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        [UI_MESSAGE_PREFIX]: true,
        broadcast: true,
        message: {
          type: 'VUE_INSPECTOR_VISIBILITY_CHANGED',
          visible: !isCollapsed
        }
      }, '*')
      // Send flags when expanding — overlay may have mounted late (e.g. after media load)
      if (!isCollapsed) sendFlagsToUI()
    }

    // RESOURCE SAVING: if Vue not found and panel collapsed - unload iframe
    // This frees ~300-500MB RAM on sites without Vue
    if (isCollapsed && !featureFlags.hasVue && iframeLoaded) {
      iframe.src = 'about:blank'
      iframeLoaded = false
      removeUIMessageBridge()
    }
  }

  toggle.onclick = () => applyCollapsed(!isCollapsed)

  let collapsedBeforePropsInspect: boolean | null = null
  propsInspectOverlayHooks = {
    onSessionStart() {
      collapsedBeforePropsInspect = isCollapsed
      if (!isCollapsed) applyCollapsed(true)
    },
    onSessionEnd() {
      if (collapsedBeforePropsInspect === null) return
      const wasCollapsed = collapsedBeforePropsInspect
      collapsedBeforePropsInspect = null
      if (!wasCollapsed) applyCollapsed(false)
    }
  }

  // Create resize handle
  const resizeHandle = document.createElement('div')
  resizeHandle.id = 'vue-inspector-resize-handle'
  resizeHandle.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 6px;
    cursor: ns-resize;
    pointer-events: auto;
  `

  // Resize logic via pointer events
  let dragging = false
  let startY = 0
  let startHeight = 0

  resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault()
    dragging = true
    startY = e.clientY
    startHeight = height

    document.body.style.userSelect = 'none'
    host.classList.add('dragging')

    // Capture all pointer events for resizeHandle
    resizeHandle.setPointerCapture(e.pointerId)

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return
      height = Math.min(
        window.innerHeight - MAX_OFFSET,
        Math.max(MIN_HEIGHT, startHeight + (startY - ev.clientY))
      )
      host.style.height = `${height}px`
      toggle.style.bottom = `${height}px`
    }

    const onPointerUp = (ev: PointerEvent) => {
      dragging = false
      document.body.style.userSelect = ''
      host.classList.remove('dragging')

      resizeHandle.releasePointerCapture(ev.pointerId)
      resizeHandle.removeEventListener('pointermove', onPointerMove)
      resizeHandle.removeEventListener('pointerup', onPointerUp)
    }

    resizeHandle.addEventListener('pointermove', onPointerMove)
    resizeHandle.addEventListener('pointerup', onPointerUp)
  })

  // Disable focus outline (matches index.css behavior for iframe content)
  const toggleStyles = document.createElement('style')
  toggleStyles.textContent = `
    #vue-inspector-toggle:focus,
    #vue-inspector-toggle:focus-visible {
      outline: none;
    }
  `
  root.appendChild(toggleStyles)

  // Assemble structure
  host.appendChild(iframe)
  host.appendChild(resizeHandle)
  root.appendChild(host)
  root.appendChild(toggle)
  document.documentElement.appendChild(root)

  // Persistent sentinel: handles breakpoint hits when iframe is unloaded,
  // and EXPAND_INSPECTOR requests from the iframe when collapsed
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data
    if (!data) return

    // Handle EXPAND_INSPECTOR from iframe (Vue site, iframe loaded but collapsed)
    if (data[UI_MESSAGE_PREFIX] && data.message?.type === 'EXPAND_INSPECTOR' &&
        event.source === iframe.contentWindow) {
      if (isCollapsed) applyCollapsed(false)
      return
    }
    
    // Handle network breakpoint hit when bridge is inactive (iframe unloaded on non-Vue sites)
    if (data.__FROM_VUE_INSPECTOR__ && data.__NETWORK__ && !uiBridgeInitialized) {
      if (data.type === 'NETWORK_BREAKPOINT_HIT') {
        pendingNetworkMessages.push(data)
        
        // Auto-expand and reload iframe so user can interact with the breakpoint
        applyCollapsed(false)
      }
    }
  })
}
