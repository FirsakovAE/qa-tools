/**
 * Inspector panel UI injection
 */

import {
  featureFlags,
  injectedScriptLoaded,
  setInjectedScriptLoaded,
  resetDetectionState
} from './state'
import { injectScript } from './script-injector'
import { setupUIMessageBridge, removeUIMessageBridge, sendFlagsToUI, UI_MESSAGE_PREFIX } from './ui-bridge'
import { addMessageListenerIfNeeded } from './detection'

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

  // Create root wrapper
  const root = document.createElement('div')
  root.id = 'vue-inspector-root'
  root.style.cssText = `
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100vw;
    z-index: 1000000;
    pointer-events: none;
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
  `

  let detectionDone = false
  
  // Detection result handler - keeps listening for updates
  const handleDetectionForUI = (event: MessageEvent) => {
    // Only process messages from injected script
    if (!event.data?.__FROM_VUE_INSPECTOR__) return
    
    if (event.data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
      // Mark first detection complete (don't remove listener - allow updates)
      if (!detectionDone) {
        detectionDone = true
      }
      
      // Always send flags to UI on detection result
      sendFlagsToUI()
    }
    
    // Also handle PROPS_READY and PINIA_READY for reactive detection
    if (event.data.type === 'VUE_INSPECTOR_PROPS_READY' || 
        event.data.type === 'VUE_INSPECTOR_PINIA_READY') {
      sendFlagsToUI()
    }
  }
  
  // Track if detection listener is active
  let detectionListenerActive = false
  
  // Function for lazy loading resources
  const loadResourcesIfNeeded = () => {
    if (iframeLoaded) return
    iframeLoaded = true
    
    // Initialize bridge for UI (only when iframe is created)
    setupUIMessageBridge()
    
    // Listen for detection results (keep active for reactive detection)
    if (!detectionListenerActive) {
      window.addEventListener('message', handleDetectionForUI)
      detectionListenerActive = true
    }
    
    // Add global message listener (if not added yet)
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
      // Reset detection flags
      resetDetectionState()
      
      // Request detection
      window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')
    }
  }
  
  // Cleanup detection listener
  const cleanupDetectionListener = () => {
    if (detectionListenerActive) {
      window.removeEventListener('message', handleDetectionForUI)
      detectionListenerActive = false
    }
  }

  // Create collapse button (sibling, not child)
  const toggle = document.createElement('button')
  toggle.style.cssText = `
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #111;
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  // CSS chevron instead of text symbol
  const chevron = document.createElement('div')
  chevron.style.cssText = `
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid white;
    transition: transform 0.2s ease;
    transform: rotate(180deg);
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

  toggle.onclick = () => {
    isCollapsed = !isCollapsed
    chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
    
    // LAZY LOADING: load ALL resources only on first open
    if (!isCollapsed) {
      loadResourcesIfNeeded()
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
    }
    
    // RESOURCE SAVING: if Vue not found and panel collapsed - unload iframe
    // This frees ~300-500MB RAM on sites without Vue
    if (isCollapsed && !featureFlags.hasVue && iframeLoaded) {
      // Fully unload iframe - remove src and clear
      iframe.src = 'about:blank'
      iframeLoaded = false
      detectionDone = false
      
      // Remove listeners (will be created again on next open)
      removeUIMessageBridge()
      cleanupDetectionListener()
    }
  }

  // Create resize handle
  const resizeHandle = document.createElement('div')
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

  // Assemble structure
  host.appendChild(iframe)
  host.appendChild(resizeHandle)
  root.appendChild(host)
  root.appendChild(toggle)
  document.documentElement.appendChild(root)
}
