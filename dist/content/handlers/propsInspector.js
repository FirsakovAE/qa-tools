/**
 * Props Inspector - Element picker mode (like Chrome DevTools Elements tab)
 *
 * Uses a CAPTURE OVERLAY to handle blocked clicks (disabled, pointer-events: none).
 * Selection is done via elementFromPoint(x,y) + closest('[data-vue-inspector-uid]'),
 * not via page's native click — so it works on disabled elements.
 *
 * PROPS_INSPECTOR_START: adds capture overlay, mousemove/pointerdown listeners.
 * PROPS_INSPECTOR_STOP: removes overlay, listeners, unhighlights, hides panel.
 * Escape: exits pick mode and notifies panel/UI (PROPS_INSPECTOR_CANCELLED).
 *
 * Overlay (iframe): capture-слой ниже #vue-inspector-root; движение/клики по шеврону и панели
 * не в режиме прицела; глобальный crosshair в CSS исключён для chrome инспектора.
 * В режиме overlay панель сворачивается на время pick и восстанавливается после выбора/Esc.
 */
import { highlightByUid, unhighlightElement } from '../highlight';
import { ELEMENT_UID_ATTRIBUTE, getElementByUid } from '../state';
import { sendBroadcastToPanel, registerOnDisconnectCleanup } from '../devtools-bridge';
import { broadcastToUI } from '../ui-bridge';
import { requestWindow } from '../ipc';
import { onPropsInspectOverlaySessionEnd, onPropsInspectOverlaySessionStart } from '../inspector-ui';
const HIGHLIGHT_OVERLAY_ID = 'vue-inspector-highlight-overlay';
const INFO_PANEL_ID = 'vue-inspector-info-panel';
const CAPTURE_OVERLAY_ID = 'vue-inspector-capture-overlay';
/** Ниже плашки Props overlay (#vue-inspector-root), чтобы шеврон/iframe были поверх и имели обычный курсор */
const CAPTURE_OVERLAY_Z_INDEX = 2147483645;
let isInspectorActive = false;
/** When true, overlay iframe collapse/restore is tied to this pick session (from settings). */
let overlayCollapseSyncForSession = false;
let captureOverlay = null;
let lastHoveredUid = null;
let infoPanel = null;
let pendingInfoRequest = null;
let infoPanelTheme = 'dark';
const PANEL_THEMES = {
    dark: {
        bg: 'rgba(15, 15, 15, 0.95)',
        border: 'rgba(139, 92, 246, 0.5)',
        color: 'rgba(255, 255, 255, 0.95)',
        secondary: 'rgba(255, 255, 255, 0.7)',
        accent: 'rgba(197, 173, 250, 0.95)',
        shadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    },
    light: {
        bg: 'rgba(255, 255, 255, 0.95)',
        border: 'rgba(139, 92, 246, 0.4)',
        color: 'rgba(30, 30, 30, 0.95)',
        secondary: 'rgba(60, 60, 60, 0.8)',
        accent: 'rgba(99, 70, 180, 0.85)',
        shadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    }
};
function applyPanelTheme(panel, theme) {
    const t = PANEL_THEMES[theme];
    panel.style.background = t.bg;
    panel.style.borderColor = t.border;
    panel.style.color = t.color;
    panel.style.boxShadow = t.shadow;
}
/**
 * Get element at coordinates by temporarily excluding our overlays from hit-test.
 * This allows selection of disabled elements (browser suppresses their events).
 */
function getElementAtPoint(x, y) {
    const overlays = [
        document.getElementById(CAPTURE_OVERLAY_ID),
        document.getElementById(HIGHLIGHT_OVERLAY_ID),
        document.getElementById(INFO_PANEL_ID)
    ].filter(Boolean);
    overlays.forEach(el => { el.style.pointerEvents = 'none'; });
    const target = document.elementFromPoint(x, y);
    overlays.forEach(el => { el.style.pointerEvents = ''; });
    return target;
}
/**
 * Get Vue component UID from element (self or closest ancestor).
 */
function getUidFromElement(el) {
    if (!el)
        return null;
    const marked = el.hasAttribute?.(ELEMENT_UID_ATTRIBUTE) ? el : el.closest(`[${ELEMENT_UID_ATTRIBUTE}]`);
    if (!marked)
        return null;
    const uidStr = marked.getAttribute(ELEMENT_UID_ATTRIBUTE);
    if (!uidStr)
        return null;
    const uid = parseInt(uidStr, 10);
    return isNaN(uid) ? null : uid;
}
/** Overlay iframe/chevron и плавающая info-панель — не зона пикинга, обычный курсор и без подсветки. */
function isPointOverPickModeChrome(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el)
        return false;
    return (el.closest('#vue-inspector-root') != null ||
        el.closest(`#${INFO_PANEL_ID}`) != null);
}
function createInfoPanel() {
    if (infoPanel) {
        applyPanelTheme(infoPanel, infoPanelTheme);
        return infoPanel;
    }
    const panel = document.createElement('div');
    panel.id = INFO_PANEL_ID;
    panel.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    visibility: visible;
    opacity: 1;
    padding: 8px 12px;
    border: 1px solid;
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-size: 14px;
    line-height: 1.4;
    max-width: 360px;
    white-space: normal;
    overflow-wrap: anywhere;
  `;
    applyPanelTheme(panel, infoPanelTheme);
    document.documentElement.appendChild(panel);
    infoPanel = panel;
    return panel;
}
function hideInfoPanel() {
    if (infoPanel)
        infoPanel.style.display = 'none';
}
function positionInfoPanel(element, panel) {
    const rect = element.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + pad;
    let left = rect.left;
    if (vh - rect.bottom >= panelRect.height + pad) {
        top = rect.bottom + pad;
    }
    else if (rect.top >= panelRect.height + pad) {
        top = rect.top - panelRect.height - pad;
    }
    else if (vw - rect.right >= panelRect.width + pad) {
        top = rect.top;
        left = rect.right + pad;
    }
    else if (rect.left >= panelRect.width + pad) {
        top = rect.top;
        left = rect.left - panelRect.width - pad;
    }
    left = Math.max(pad, Math.min(left, vw - panelRect.width - pad));
    top = Math.max(pad, Math.min(top, vh - panelRect.height - pad));
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
}
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
function getDomElementInfo(el) {
    if (!el)
        return '—';
    const tag = el.tagName?.toLowerCase() || 'div';
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().replace(/\s+/g, '.').slice(0, 50)
        : '';
    return tag + id + cls;
}
function showInfoPanel(uid, data) {
    if (!isInspectorActive)
        return;
    const panel = createInfoPanel();
    const t = PANEL_THEMES[infoPanelTheme];
    panel.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 2px;">${escapeHtml(data.name)}</div>
    <div style="color: ${t.secondary}; font-size: 13px; margin-bottom: 2px;">${escapeHtml(data.rootEl)}</div>
    <div style="color: ${t.accent}; font-size: 13px;">Props: ${data.propsCount}</div>
    <div style="color: ${t.accent}; font-size: 13px;">Child elements: ${data.childCount}</div>
  `;
    panel.style.display = 'block';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!isInspectorActive || !infoPanel)
                return;
            if (lastHoveredUid !== uid)
                return;
            const el = getElementByUid(uid);
            if (!el)
                return;
            positionInfoPanel(el, infoPanel);
        });
    });
}
async function fetchAndShowInfo(uid) {
    if (pendingInfoRequest === uid)
        return;
    pendingInfoRequest = uid;
    showInfoPanel(uid, { name: 'Loading…', rootEl: '—', propsCount: 0, childCount: 0 });
    try {
        const response = await requestWindow({ type: 'VUE_INSPECTOR_GET_COMPONENT_INFO_BY_UID', uid }, 'VUE_INSPECTOR_COMPONENT_INFO_DATA', 1500);
        if (pendingInfoRequest !== uid || !isInspectorActive)
            return;
        showInfoPanel(uid, {
            name: response?.name ?? 'Anonymous',
            rootEl: response?.rootElementInfo ?? '—',
            propsCount: response?.propsCount ?? 0,
            childCount: response?.childCount ?? 0
        });
    }
    catch {
        if (pendingInfoRequest !== uid || !isInspectorActive)
            return;
        const el = getElementByUid(uid);
        showInfoPanel(uid, { name: 'Component', rootEl: getDomElementInfo(el), propsCount: 0, childCount: 0 });
    }
    finally {
        if (pendingInfoRequest === uid)
            pendingInfoRequest = null;
    }
}
let moveRafId = null;
let lastMoveCoords = null;
let fetchDebounceTimer = null;
const FETCH_DEBOUNCE_MS = 60;
function onPickPointerMove(e) {
    if (!isInspectorActive)
        return;
    const cx = e.clientX;
    const cy = e.clientY;
    if (isPointOverPickModeChrome(cx, cy)) {
        if (moveRafId) {
            cancelAnimationFrame(moveRafId);
            moveRafId = null;
        }
        lastMoveCoords = null;
        if (lastHoveredUid !== null) {
            lastHoveredUid = null;
            unhighlightElement();
        }
        hideInfoPanel();
        return;
    }
    lastMoveCoords = { x: cx, y: cy };
    if (moveRafId)
        return;
    moveRafId = requestAnimationFrame(() => {
        moveRafId = null;
        const coords = lastMoveCoords;
        if (!coords)
            return;
        const el = getElementAtPoint(coords.x, coords.y);
        const uid = getUidFromElement(el);
        if (uid !== null) {
            if (uid !== lastHoveredUid) {
                lastHoveredUid = uid;
                highlightByUid(uid);
                showInfoPanel(uid, { name: 'Loading…', rootEl: '—', propsCount: 0, childCount: 0 });
                if (fetchDebounceTimer)
                    clearTimeout(fetchDebounceTimer);
                fetchDebounceTimer = window.setTimeout(() => {
                    fetchDebounceTimer = null;
                    if (lastHoveredUid === uid && isInspectorActive)
                        void fetchAndShowInfo(uid);
                }, FETCH_DEBOUNCE_MS);
            }
        }
        else {
            lastHoveredUid = null;
            unhighlightElement();
            hideInfoPanel();
        }
    });
}
function onPickPointerDown(e) {
    if (!isInspectorActive)
        return;
    const x = e.clientX;
    const y = e.clientY;
    if (isPointOverPickModeChrome(x, y))
        return;
    e.preventDefault();
    e.stopPropagation();
    const el = getElementAtPoint(x, y);
    const uid = getUidFromElement(el);
    if (uid !== null) {
        stopPropsInspector();
        sendBroadcastToPanel({ type: 'PROPS_INSPECTOR_ELEMENT_SELECTED', uid });
        broadcastToUI({ type: 'PROPS_INSPECTOR_ELEMENT_SELECTED', uid });
    }
}
function onScrollResize() {
    if (lastHoveredUid !== null && infoPanel && infoPanel.style.display !== 'none') {
        const el = getElementByUid(lastHoveredUid);
        if (el)
            positionInfoPanel(el, infoPanel);
    }
}
function onInspectorKeyDown(e) {
    if (!isInspectorActive)
        return;
    if (e.key !== 'Escape')
        return;
    e.preventDefault();
    e.stopPropagation();
    stopPropsInspector();
    sendBroadcastToPanel({ type: 'PROPS_INSPECTOR_CANCELLED' });
    broadcastToUI({ type: 'PROPS_INSPECTOR_CANCELLED' });
}
function createCaptureOverlay() {
    if (captureOverlay)
        return captureOverlay;
    const overlay = document.createElement('div');
    overlay.id = CAPTURE_OVERLAY_ID;
    overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: ${CAPTURE_OVERLAY_Z_INDEX};
    pointer-events: auto;
    cursor: crosshair;
  `;
    window.addEventListener('scroll', onScrollResize, { passive: true });
    window.addEventListener('resize', onScrollResize);
    document.documentElement.appendChild(overlay);
    captureOverlay = overlay;
    return overlay;
}
function injectPickModeStyles() {
    if (document.getElementById('vue-inspector-pick-mode-styles'))
        return;
    const style = document.createElement('style');
    style.id = 'vue-inspector-pick-mode-styles';
    style.textContent = `
    body.vue-inspector-pick-mode,
    body.vue-inspector-pick-mode * {
      cursor: crosshair !important;
    }
    #vue-inspector-root,
    #vue-inspector-host,
    #vue-inspector-ui {
      cursor: auto !important;
    }
    #vue-inspector-toggle {
      cursor: pointer !important;
    }
    #vue-inspector-resize-handle {
      cursor: ns-resize !important;
    }
  `;
    document.head.appendChild(style);
}
export function stopPropsInspector() {
    if (!isInspectorActive)
        return;
    isInspectorActive = false;
    document.body.classList.remove('vue-inspector-pick-mode');
    unhighlightElement();
    hideInfoPanel();
    lastHoveredUid = null;
    pendingInfoRequest = null;
    if (fetchDebounceTimer) {
        clearTimeout(fetchDebounceTimer);
        fetchDebounceTimer = null;
    }
    if (moveRafId) {
        cancelAnimationFrame(moveRafId);
        moveRafId = null;
    }
    if (captureOverlay?.parentNode) {
        captureOverlay.parentNode.removeChild(captureOverlay);
        captureOverlay = null;
    }
    window.removeEventListener('scroll', onScrollResize, { passive: true });
    window.removeEventListener('resize', onScrollResize);
    window.removeEventListener('keydown', onInspectorKeyDown, true);
    window.removeEventListener('pointermove', onPickPointerMove, { capture: true });
    window.removeEventListener('pointerdown', onPickPointerDown, { capture: true });
    if (overlayCollapseSyncForSession) {
        onPropsInspectOverlaySessionEnd();
        overlayCollapseSyncForSession = false;
    }
}
function startInspector() {
    if (isInspectorActive)
        return;
    if (overlayCollapseSyncForSession) {
        onPropsInspectOverlaySessionStart();
    }
    isInspectorActive = true;
    injectPickModeStyles();
    document.body.classList.add('vue-inspector-pick-mode');
    createCaptureOverlay();
    window.addEventListener('keydown', onInspectorKeyDown, true);
    window.addEventListener('pointermove', onPickPointerMove, { passive: true, capture: true });
    window.addEventListener('pointerdown', onPickPointerDown, { capture: true });
}
export const handlePropsInspectorStart = (message, sender, sendResponse) => {
    const theme = message.theme === 'light' ? 'light' : 'dark';
    infoPanelTheme = theme;
    if (infoPanel)
        applyPanelTheme(infoPanel, theme);
    overlayCollapseSyncForSession = message.collapseOverlayOnPropsInspect !== false;
    registerOnDisconnectCleanup(stopPropsInspector);
    startInspector();
    sendResponse({ success: true });
    return true;
};
export const handlePropsInspectorStop = (message, sender, sendResponse) => {
    stopPropsInspector();
    sendResponse({ success: true });
    return true;
};
//# sourceMappingURL=propsInspector.js.map