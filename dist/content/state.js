/**
 * Centralized mutable state for the content script
 */
// Detection state
export let vueCheckInProgress = false;
export let detectionCompleted = false;
export let detectionAttempts = 0;
export let detectionStopped = false;
// Detection limits
export const MAX_DETECTION_ATTEMPTS = 3;
// Feature flags
export let featureFlags = {
    hasVue: false,
    hasPinia: false,
    vueVersion: null
};
// Initialization flags
export let injectedScriptLoaded = false;
export let uiInjected = false;
export let messageListenerAdded = false;
// Static site detection result
export let staticSiteDetection = null;
// Highlight state
export let currentHighlightedElement = null;
export let highlightOverlay = null;
export let highlightRafId = null;
// Element lookup attribute (set by injected script on elements)
export const ELEMENT_UID_ATTRIBUTE = 'data-vue-inspector-uid';
// Timeout reference
export let checkTimeout = null;
// UI bridge state
export let uiBridgeInitialized = false;
// === State Setters ===
export function setVueCheckInProgress(value) {
    vueCheckInProgress = value;
}
export function setDetectionCompleted(value) {
    detectionCompleted = value;
}
export function setDetectionAttempts(value) {
    detectionAttempts = value;
}
export function incrementDetectionAttempts() {
    detectionAttempts++;
}
export function setDetectionStopped(value) {
    detectionStopped = value;
}
export function setFeatureFlags(flags) {
    featureFlags = flags;
}
export function setInjectedScriptLoaded(value) {
    injectedScriptLoaded = value;
}
export function setUiInjected(value) {
    uiInjected = value;
}
export function setMessageListenerAdded(value) {
    messageListenerAdded = value;
}
export function setStaticSiteDetection(result) {
    staticSiteDetection = result;
}
export function setCurrentHighlightedElement(element) {
    currentHighlightedElement = element;
}
export function setHighlightOverlay(overlay) {
    highlightOverlay = overlay;
}
export function setHighlightRafId(id) {
    highlightRafId = id;
}
/**
 * Get element by UID using data attribute lookup
 * This is deterministic - not heuristic searching
 *
 * The injected script marks elements with data-vue-inspector-uid attribute,
 * and we look them up by that exact attribute.
 */
export function getElementByUid(uid) {
    const element = document.querySelector(`[${ELEMENT_UID_ATTRIBUTE}="${uid}"]`);
    if (element instanceof HTMLElement && element.isConnected) {
        return element;
    }
    return null;
}
export function setCheckTimeout(timeout) {
    checkTimeout = timeout;
}
export function setUiBridgeInitialized(value) {
    uiBridgeInitialized = value;
}
/**
 * Reset detection state for a fresh detection cycle
 */
export function resetDetectionState() {
    detectionStopped = false;
    detectionCompleted = false;
    detectionAttempts = 0;
}
//# sourceMappingURL=state.js.map