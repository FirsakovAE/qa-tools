/**
 * Inspector panel UI injection
 * Supports docking to all 4 edges + floating window mode with interact.js drag-and-drop.
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
import interact from 'interactjs'
import { loadDockState, saveDockState } from './inspector-window-state'
import type { DockPosition } from './inspector-window-state'

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

  // ═══════════════════════════════════════════════════════════
  // State & constants
  // ═══════════════════════════════════════════════════════════
  let isCollapsed = true
  let height = 360
  let dockWidth = 360
  const MIN_HEIGHT = 120
  const MIN_WIDTH = 200
  const MAX_OFFSET = 80
  const TITLEBAR_H = 28
  const PILL_GAP = 6
  let iframeLoaded = false
  const pendingNetworkMessages: any[] = []

  let dockPosition: DockPosition = 'bottom'
  let floatingX = Math.round(window.innerWidth / 2 - 300)
  let floatingY = Math.round(window.innerHeight / 2 - 200)
  let floatingWidth = 600
  let floatingHeight = 400
  const SNAP_THRESHOLD = 60
  let animateNext = false

  // ═══════════════════════════════════════════════════════════
  // DOM — root / host / iframe
  // ═══════════════════════════════════════════════════════════
  const root = document.createElement('div')
  root.id = 'vue-inspector-root'

  const host = document.createElement('div')
  host.id = 'vue-inspector-host'

  const iframe = document.createElement('iframe')
  iframe.id = 'vue-inspector-ui'
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

  // ═══════════════════════════════════════════════════════════
  // DOM — snap highlight overlay
  // ═══════════════════════════════════════════════════════════
  const snapHighlight = document.createElement('div')
  snapHighlight.id = 'vue-inspector-snap-highlight'
  snapHighlight.style.cssText = `
    position: fixed;
    z-index: 2147483646;
    pointer-events: none;
    background: rgba(99, 102, 241, 0.12);
    border: 2px solid rgba(99, 102, 241, 0.4);
    box-shadow: 0 0 24px rgba(99, 102, 241, 0.18);
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.2s ease, left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease;
    left: 0; top: 0; width: 0; height: 0;
  `

  // ═══════════════════════════════════════════════════════════
  // DOM — toggle bar (drag handle + chevron)
  // ═══════════════════════════════════════════════════════════
  const toggle = document.createElement('div')
  toggle.id = 'vue-inspector-toggle'

  const dragHandle = document.createElement('div')
  dragHandle.id = 'vue-inspector-drag-handle'
  dragHandle.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.55">
      <circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/>
      <circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/>
      <circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/>
    </svg>
  `
  dragHandle.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    cursor: grab; padding: 4px; border-radius: 4px;
    transition: background 0.15s ease;
  `
  dragHandle.addEventListener('mouseenter', () => { dragHandle.style.background = 'rgba(255,255,255,0.1)' })
  dragHandle.addEventListener('mouseleave', () => { dragHandle.style.background = 'transparent' })

  const chevronBtn = document.createElement('button')
  chevronBtn.id = 'vue-inspector-chevron-btn'
  chevronBtn.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; color: inherit;
    cursor: pointer; padding: 4px; border-radius: 4px;
    transition: background 0.15s ease;
  `
  const chevron = document.createElement('div')
  chevron.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 15l6-6 6 6"/>
    </svg>
  `
  chevron.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    transform: rotate(0deg);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  `
  chevronBtn.appendChild(chevron)
  chevronBtn.addEventListener('mouseenter', () => { chevronBtn.style.background = 'rgba(255,255,255,0.1)' })
  chevronBtn.addEventListener('mouseleave', () => { chevronBtn.style.background = 'transparent' })

  toggle.appendChild(dragHandle)
  toggle.appendChild(chevronBtn)

  // Dock-mode resize handle (single edge)
  const resizeHandle = document.createElement('div')
  resizeHandle.id = 'vue-inspector-resize-handle'

  // ═══════════════════════════════════════════════════════════
  // DOM — floating resize handles (8 directions)
  // ═══════════════════════════════════════════════════════════
  type FloatingResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  const RESIZE_CORNER = 14

  const floatingResizes = document.createElement('div')
  floatingResizes.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;'

  for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as FloatingResizeDir[]) {
    const h = document.createElement('div')
    const b = 'position:absolute;pointer-events:auto;'
    const C = RESIZE_CORNER
    switch (dir) {
      case 'n':  h.style.cssText = `${b}top:0;left:${C}px;right:${C}px;height:6px;cursor:ns-resize;`; break
      case 's':  h.style.cssText = `${b}bottom:0;left:${C}px;right:${C}px;height:6px;cursor:ns-resize;`; break
      case 'e':  h.style.cssText = `${b}top:${C}px;right:0;bottom:${C}px;width:6px;cursor:ew-resize;`; break
      case 'w':  h.style.cssText = `${b}top:${C}px;left:0;bottom:${C}px;width:6px;cursor:ew-resize;`; break
      case 'ne': h.style.cssText = `${b}top:0;right:0;width:${C}px;height:${C}px;cursor:ne-resize;`; break
      case 'nw': h.style.cssText = `${b}top:0;left:0;width:${C}px;height:${C}px;cursor:nw-resize;`; break
      case 'se': h.style.cssText = `${b}bottom:0;right:0;width:${C}px;height:${C}px;cursor:se-resize;`; break
      case 'sw': h.style.cssText = `${b}bottom:0;left:0;width:${C}px;height:${C}px;cursor:sw-resize;`; break
    }

    h.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      iframe.style.pointerEvents = 'none'
      document.body.style.userSelect = 'none'
      h.setPointerCapture(e.pointerId)
      const sx = e.clientX, sy = e.clientY
      const sfx = floatingX, sfy = floatingY, sfw = floatingWidth, sfh = floatingHeight
      const mw = MIN_WIDTH, mh = MIN_HEIGHT

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy
        let nw = sfw, nh = sfh, npx = sfx, npy = sfy
        if (dir.includes('e')) nw = Math.max(mw, sfw + dx)
        if (dir.includes('w')) nw = Math.max(mw, sfw - dx)
        if (dir.includes('s')) nh = Math.max(mh, sfh + dy)
        if (dir.includes('n')) { nh = Math.max(mh, sfh - dy); npy = sfy + (sfh - nh) }
        if (dir.includes('w') || dir.includes('e')) npx = sfx + (sfw - nw) / 2
        floatingX = npx; floatingY = npy; floatingWidth = nw; floatingHeight = nh
        root.style.left = floatingPanelLeft() + 'px'; root.style.top = floatingPanelTop() + 'px'
        root.style.width = nw + 'px'; root.style.height = nh + 'px'
      }
      const onUp = (ev: PointerEvent) => {
        iframe.style.pointerEvents = 'auto'
        document.body.style.userSelect = ''
        h.releasePointerCapture(ev.pointerId)
        h.removeEventListener('pointermove', onMove)
        h.removeEventListener('pointerup', onUp)
        persistDockState()
      }
      h.addEventListener('pointermove', onMove)
      h.addEventListener('pointerup', onUp)
    })

    floatingResizes.appendChild(h)
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════
  const clamp = (lo: number, hi: number, v: number) => Math.min(hi, Math.max(lo, v))

  function getChevronRotation(): string {
    const base: Record<DockPosition, number> = {
      bottom: 0, top: 180, left: 90, right: -90, floating: 0
    }
    return isCollapsed ? `rotate(${base[dockPosition]}deg)` : `rotate(${base[dockPosition] + 180}deg)`
  }

  function floatingPanelLeft(): number {
    return Math.round(floatingX - (floatingWidth - 72) / 2)
  }
  function floatingPanelTop(): number {
    return floatingY + TITLEBAR_H + PILL_GAP
  }

  // ───────────────────── layout engine ──────────────────────
  function applyLayout() {
    const isFloating = dockPosition === 'floating'
    const isVert = dockPosition === 'left' || dockPosition === 'right'
    const anim = animateNext
    animateNext = false
    const E = '0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    const rootTr = anim ? `transition: width ${E}, height ${E};` : ''
    const hostTr = anim ? `transition: width ${E}, height ${E};` : ''
    const togTr = anim ? `transition: bottom ${E}, top ${E}, left ${E}, right ${E};` : ''

    // --- root ---
    if (isFloating && isCollapsed) {
      root.style.cssText = `
        ${rootTr}
        position: fixed; left: ${floatingX}px; top: ${floatingY}px;
        z-index: 2147483647; pointer-events: auto;
        user-select: none; -webkit-user-select: none;
      `
    } else if (isFloating) {
      root.style.cssText = `
        ${rootTr}
        position: fixed; left: ${floatingPanelLeft()}px; top: ${floatingPanelTop()}px;
        width: ${floatingWidth}px; height: ${floatingHeight}px;
        z-index: 2147483647; pointer-events: auto;
        border-radius: 14px;
        background: #0f0f0f;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08);
        user-select: none; -webkit-user-select: none;
      `
    } else if (dockPosition === 'bottom') {
      root.style.cssText = `
        position: fixed; left: 0; bottom: 0; width: 100vw;
        z-index: 2147483647; pointer-events: none;
        user-select: none; -webkit-user-select: none;
      `
    } else if (dockPosition === 'top') {
      root.style.cssText = `
        position: fixed; left: 0; top: 0; width: 100vw;
        z-index: 2147483647; pointer-events: none;
        user-select: none; -webkit-user-select: none;
      `
    } else if (dockPosition === 'left') {
      root.style.cssText = `
        position: fixed; left: 0; top: 0; height: 100vh;
        z-index: 2147483647; pointer-events: none;
        user-select: none; -webkit-user-select: none;
      `
    } else {
      root.style.cssText = `
        position: fixed; right: 0; top: 0; height: 100vh;
        z-index: 2147483647; pointer-events: none;
        user-select: none; -webkit-user-select: none;
      `
    }

    // --- host ---
    if (isFloating) {
      host.style.cssText = `
        ${hostTr}
        position: relative; width: 100%;
        height: ${isCollapsed ? '0px' : '100%'};
        overflow: hidden; border-radius: 14px;
        pointer-events: auto; overscroll-behavior: contain;
      `
    } else if (isVert) {
      const w = isCollapsed ? 0 : dockWidth
      host.style.cssText = `
        ${hostTr}
        position: relative; height: 100%; width: ${w}px;
        overflow: hidden; pointer-events: ${isCollapsed ? 'none' : 'auto'};
        overscroll-behavior: contain;
      `
    } else {
      const h = isCollapsed ? 0 : height
      host.style.cssText = `
        ${hostTr}
        position: relative; width: 100%; height: ${h}px;
        overflow: hidden; pointer-events: ${isCollapsed ? 'none' : 'auto'};
        overscroll-behavior: contain;
      `
    }

    // --- iframe ---
    iframe.style.display = isCollapsed ? 'none' : 'block'

    // --- toggle ---
    const pill = `
      background: rgba(15,15,15,0.85);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      color: rgba(255,255,255,0.95);
      pointer-events: auto;
      display: flex; align-items: center; justify-content: center; gap: 2px;
    `

    if (isFloating && isCollapsed) {
      toggle.style.cssText = `
        ${togTr}
        width: 72px; height: ${TITLEBAR_H}px; border-radius: 14px;
        ${pill}
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset;
      `
    } else if (isFloating) {
      toggle.style.cssText = `
        ${togTr}
        position: absolute; top: ${-(TITLEBAR_H + PILL_GAP)}px;
        left: 50%; transform: translateX(-50%);
        width: 72px; height: ${TITLEBAR_H}px; border-radius: 14px;
        ${pill}
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset;
        cursor: grab;
      `
    } else if (dockPosition === 'bottom') {
      const ph = (isCollapsed ? 0 : height) + PILL_GAP
      toggle.style.cssText = `
        ${togTr}
        position: absolute; bottom: ${ph}px; left: 50%; transform: translateX(-50%);
        width: 72px; height: 28px; border-radius: 14px;
        ${pill}
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset;
      `
    } else if (dockPosition === 'top') {
      const ph = (isCollapsed ? 0 : height) + PILL_GAP
      toggle.style.cssText = `
        ${togTr}
        position: absolute; top: ${ph}px; left: 50%; transform: translateX(-50%);
        width: 72px; height: 28px; border-radius: 14px;
        ${pill}
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset;
      `
    } else if (dockPosition === 'left') {
      const pw = (isCollapsed ? 0 : dockWidth) + PILL_GAP
      toggle.style.cssText = `
        ${togTr}
        position: absolute; left: ${pw}px; top: 50%; transform: translateY(-50%);
        width: 28px; height: 72px; border-radius: 14px;
        ${pill}
        flex-direction: column;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset;
      `
    } else if (dockPosition === 'right') {
      const pw = (isCollapsed ? 0 : dockWidth) + PILL_GAP
      toggle.style.cssText = `
        ${togTr}
        position: absolute; right: ${pw}px; top: 50%; transform: translateY(-50%);
        width: 28px; height: 72px; border-radius: 14px;
        ${pill}
        flex-direction: column;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 2px 12px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset;
      `
    }

    toggle.dataset.dock = dockPosition

    // --- chevron ---
    chevron.style.transform = getChevronRotation()

    // --- dock resize handle (single edge, hidden in floating) ---
    if (isFloating || isCollapsed) {
      resizeHandle.style.cssText = 'display: none;'
    } else if (dockPosition === 'bottom') {
      resizeHandle.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:6px;cursor:ns-resize;pointer-events:auto;'
    } else if (dockPosition === 'top') {
      resizeHandle.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:6px;cursor:ns-resize;pointer-events:auto;'
    } else if (dockPosition === 'left') {
      resizeHandle.style.cssText = 'position:absolute;top:0;right:0;height:100%;width:6px;cursor:ew-resize;pointer-events:auto;'
    } else {
      resizeHandle.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:6px;cursor:ew-resize;pointer-events:auto;'
    }

    // --- floating resize handles (8-dir, only when floating & expanded) ---
    floatingResizes.style.display = (isFloating && !isCollapsed) ? 'block' : 'none'
  }

  // ───────────────────── snap zones ─────────────────────────
  function detectSnapZone(px: number, py: number): DockPosition | null {
    const vw = window.innerWidth, vh = window.innerHeight
    if (py >= vh - SNAP_THRESHOLD) return 'bottom'
    if (py <= SNAP_THRESHOLD) return 'top'
    if (px <= SNAP_THRESHOLD) return 'left'
    if (px >= vw - SNAP_THRESHOLD) return 'right'
    return null
  }

  function showSnapHighlight(zone: DockPosition) {
    const vw = window.innerWidth, vh = window.innerHeight
    const m = 4
    if (zone === 'bottom') {
      Object.assign(snapHighlight.style, { left: m + 'px', top: (vh - height - m) + 'px', width: (vw - m * 2) + 'px', height: height + 'px' })
    } else if (zone === 'top') {
      Object.assign(snapHighlight.style, { left: m + 'px', top: m + 'px', width: (vw - m * 2) + 'px', height: height + 'px' })
    } else if (zone === 'left') {
      Object.assign(snapHighlight.style, { left: m + 'px', top: m + 'px', width: dockWidth + 'px', height: (vh - m * 2) + 'px' })
    } else {
      Object.assign(snapHighlight.style, { left: (vw - dockWidth - m) + 'px', top: m + 'px', width: dockWidth + 'px', height: (vh - m * 2) + 'px' })
    }
    snapHighlight.style.opacity = '1'
  }

  function hideSnapHighlight() { snapHighlight.style.opacity = '0' }

  // ───────────────────── dock state persistence ─────────────
  function persistDockState() {
    saveDockState({ dockPosition, height, dockWidth, floatingX, floatingY, floatingWidth, floatingHeight })
  }

  // ═══════════════════════════════════════════════════════════
  // Lazy loading (unchanged logic)
  // ═══════════════════════════════════════════════════════════
  const loadResourcesIfNeeded = () => {
    if (iframeLoaded) return
    iframeLoaded = true

    resetDetectionState()
    setupUIMessageBridge()
    addMessageListenerIfNeeded()

    if (!injectedScriptLoaded) {
      injectScript()
      setInjectedScriptLoaded(true)
    }

    iframe.src = chrome.runtime.getURL('injected_ui/index.html')
    iframe.style.display = 'block'

    iframe.onload = () => {
      window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')

      if (pendingNetworkMessages.length > 0) {
        let replayed = false
        const doReplay = () => {
          if (replayed) return
          replayed = true
          window.removeEventListener('message', readyListener)
          const messages = pendingNetworkMessages.splice(0)
          for (const msg of messages) broadcastToUI(msg)
        }
        const readyListener = (event: MessageEvent) => {
          if (event.data?.[UI_MESSAGE_PREFIX] && event.source === iframe.contentWindow) {
            setTimeout(doReplay, 100)
          }
        }
        window.addEventListener('message', readyListener)
        setTimeout(doReplay, 1000)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Collapse / Expand
  // ═══════════════════════════════════════════════════════════
  const applyCollapsed = (nextCollapsed: boolean) => {
    if (isCollapsed === nextCollapsed) return
    isCollapsed = nextCollapsed
    animateNext = true

    if (!isCollapsed) {
      loadResourcesIfNeeded()

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

    applyLayout()

    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        [UI_MESSAGE_PREFIX]: true,
        broadcast: true,
        message: { type: 'VUE_INSPECTOR_VISIBILITY_CHANGED', visible: !isCollapsed }
      }, '*')
      if (!isCollapsed) sendFlagsToUI()
    }

    if (isCollapsed && !featureFlags.hasVue && iframeLoaded) {
      iframe.src = 'about:blank'
      iframeLoaded = false
      removeUIMessageBridge()
    }
  }

  chevronBtn.onclick = (e) => {
    e.stopPropagation()
    applyCollapsed(!isCollapsed)
  }

  // ═══════════════════════════════════════════════════════════
  // Props-inspect overlay hooks (unchanged)
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // Dock resize handle (single-edge, for docked modes only)
  // ═══════════════════════════════════════════════════════════
  let resizeDragging = false
  let rStartY = 0, rStartX = 0, rStartH = 0, rStartW = 0

  resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault()
    resizeDragging = true
    rStartY = e.clientY; rStartX = e.clientX
    rStartH = height; rStartW = dockWidth
    document.body.style.userSelect = 'none'
    iframe.style.pointerEvents = 'none'
    host.classList.add('dragging')
    resizeHandle.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      if (!resizeDragging) return
      if (dockPosition === 'bottom') {
        height = clamp(MIN_HEIGHT, window.innerHeight - MAX_OFFSET, rStartH + (rStartY - ev.clientY))
      } else if (dockPosition === 'top') {
        height = clamp(MIN_HEIGHT, window.innerHeight - MAX_OFFSET, rStartH + (ev.clientY - rStartY))
      } else if (dockPosition === 'left') {
        dockWidth = clamp(MIN_WIDTH, window.innerWidth - MAX_OFFSET, rStartW + (ev.clientX - rStartX))
      } else if (dockPosition === 'right') {
        dockWidth = clamp(MIN_WIDTH, window.innerWidth - MAX_OFFSET, rStartW + (rStartX - ev.clientX))
      }
      applyLayout()
    }

    const onUp = (ev: PointerEvent) => {
      resizeDragging = false
      document.body.style.userSelect = ''
      iframe.style.pointerEvents = 'auto'
      host.classList.remove('dragging')
      resizeHandle.releasePointerCapture(ev.pointerId)
      resizeHandle.removeEventListener('pointermove', onMove)
      resizeHandle.removeEventListener('pointerup', onUp)
      persistDockState()
    }

    resizeHandle.addEventListener('pointermove', onMove)
    resizeHandle.addEventListener('pointerup', onUp)
  })

  // ═══════════════════════════════════════════════════════════
  // interact.js — drag-to-float & snap-to-dock
  // ═══════════════════════════════════════════════════════════
  interact(toggle).draggable({
    inertia: {
      resistance: 16,
      minSpeed: 50,
      endSpeed: 10
    },
    listeners: {
      start(event: any) {
        iframe.style.pointerEvents = 'none'

        if (dockPosition !== 'floating') {
          const isVert = dockPosition === 'left' || dockPosition === 'right'
          floatingWidth = clamp(400, 800, Math.round(window.innerWidth * 0.5))
          floatingHeight = isVert
            ? clamp(300, 600, Math.round(window.innerHeight * 0.5))
            : Math.max(height, MIN_HEIGHT)
          floatingX = clamp(0, window.innerWidth - 72, event.clientX - 36)
          floatingY = clamp(0, window.innerHeight - TITLEBAR_H, event.clientY - 14)
          dockPosition = 'floating'
          applyLayout()
        }
        toggle.style.cursor = 'grabbing'
        dragHandle.style.cursor = 'grabbing'
      },
      move(event: any) {
        floatingX += event.dx
        floatingY += event.dy
        floatingX = clamp(0, window.innerWidth - 72, floatingX)
        floatingY = clamp(0, window.innerHeight - 40, floatingY)
        if (isCollapsed) {
          root.style.left = floatingX + 'px'
          root.style.top = floatingY + 'px'
        } else {
          root.style.left = floatingPanelLeft() + 'px'
          root.style.top = floatingPanelTop() + 'px'
        }

        const zone = detectSnapZone(event.client.x, event.client.y)
        zone ? showSnapHighlight(zone) : hideSnapHighlight()
      },
      end(event: any) {
        iframe.style.pointerEvents = 'auto'
        dragHandle.style.cursor = 'grab'
        toggle.style.cursor = ''
        hideSnapHighlight()

        const zone = detectSnapZone(event.client.x, event.client.y)
        if (zone) {
          dockPosition = zone
          animateNext = true
          applyLayout()
        }
        persistDockState()
      }
    }
  })

  window.addEventListener('resize', () => {
    if (dockPosition === 'floating') {
      floatingX = clamp(0, window.innerWidth - 72, floatingX)
      floatingY = clamp(0, window.innerHeight - 40, floatingY)
      if (isCollapsed) {
        root.style.left = floatingX + 'px'
        root.style.top = floatingY + 'px'
      } else {
        floatingWidth = Math.min(floatingWidth, window.innerWidth)
        root.style.left = floatingPanelLeft() + 'px'
        root.style.top = floatingPanelTop() + 'px'
        root.style.width = floatingWidth + 'px'
      }
    }
  })

  // ═══════════════════════════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════════════════════════
  const uiStyles = document.createElement('style')
  uiStyles.textContent = `
    #vue-inspector-toggle:focus,
    #vue-inspector-toggle:focus-visible,
    #vue-inspector-toggle button:focus,
    #vue-inspector-toggle button:focus-visible { outline: none; }
    #vue-inspector-toggle:not([data-dock="floating"]):hover {
      background: rgba(25,25,25,0.92) !important;
    }
  `
  root.appendChild(uiStyles)

  // ═══════════════════════════════════════════════════════════
  // Assemble & mount
  // Toggle BEFORE host so it renders at top in floating mode.
  // In docked modes toggle is position:absolute, so order is irrelevant.
  // ═══════════════════════════════════════════════════════════
  host.appendChild(iframe)
  host.appendChild(resizeHandle)
  root.appendChild(toggle)
  root.appendChild(host)
  root.appendChild(floatingResizes)
  document.documentElement.appendChild(root)
  document.documentElement.appendChild(snapHighlight)

  applyLayout()

  // ═══════════════════════════════════════════════════════════
  // Restore saved dock state (async, runs immediately after mount)
  // ═══════════════════════════════════════════════════════════
  loadDockState().then(saved => {
    if (!saved) return
    dockPosition = saved.dockPosition
    height = saved.height
    dockWidth = saved.dockWidth
    floatingX = saved.floatingX
    floatingY = saved.floatingY
    floatingWidth = saved.floatingWidth
    floatingHeight = saved.floatingHeight
    applyLayout()
  })

  // ═══════════════════════════════════════════════════════════
  // Persistent sentinel (breakpoint auto-expand + EXPAND_INSPECTOR)
  // ═══════════════════════════════════════════════════════════
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data
    if (!data) return

    if (data[UI_MESSAGE_PREFIX] && data.message?.type === 'EXPAND_INSPECTOR' &&
        event.source === iframe.contentWindow) {
      if (isCollapsed) applyCollapsed(false)
      return
    }

    if (data.__FROM_VUE_INSPECTOR__ && data.__NETWORK__ && !uiBridgeInitialized) {
      if (data.type === 'NETWORK_BREAKPOINT_HIT') {
        pendingNetworkMessages.push(data)
        applyCollapsed(false)
      }
    }
  })
}
