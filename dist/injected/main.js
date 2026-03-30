/**
 * Main entry point for injected script
 * Performs detection and loads modules
 *
 * Detection strategy:
 * - Vue: __VUE_DEVTOOLS_GLOBAL_HOOK__ with app:init event listener
 * - Pinia: app.use() interception + app:init fallback
 *
 * This ensures detection works even if the inspector loads before Vue/Pinia
 */
import { detect, setupReactiveDetection, getDetectionState } from './detector';
import { initPropsModule, cleanupPropsModule } from './props/index';
import { initPiniaModule } from './pinia/index';
import { initNetworkModule, cleanupNetworkModule } from './network/index';
// Module state
let propsModuleLoaded = false;
let piniaModuleLoaded = false;
let networkModuleLoaded = false;
let cleanupDetection = null;
/**
 * Send detection result to content script
 */
function sendDetectionResult(result) {
    try {
        window.postMessage({
            type: 'VUE_INSPECTOR_DETECTION_RESULT',
            __FROM_VUE_INSPECTOR__: true,
            ...result
        }, '*');
        window.postMessage({
            type: 'VUE_INSPECTOR_VUE_DETECTED',
            __FROM_VUE_INSPECTOR__: true,
            detected: result.hasVue,
            url: window.location.href,
            hasDevToolsHook: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
            hasVue2: result.vueVersion === 2
        }, '*');
    }
    catch (e) {
        console.error('[injected/main] sendDetectionResult failed:', e);
    }
}
/**
 * Initialize props module when Vue is detected
 */
function loadPropsModule() {
    if (propsModuleLoaded)
        return;
    try {
        propsModuleLoaded = true;
        initPropsModule();
        window.postMessage({
            type: 'VUE_INSPECTOR_PROPS_READY',
            __FROM_VUE_INSPECTOR__: true
        }, '*');
    }
    catch (e) {
        console.error('[injected/main] loadPropsModule failed:', e);
        propsModuleLoaded = false;
    }
}
/**
 * Initialize pinia module when Pinia is detected
 */
function loadPiniaModule() {
    if (piniaModuleLoaded)
        return;
    try {
        piniaModuleLoaded = true;
        initPiniaModule();
        window.postMessage({
            type: 'VUE_INSPECTOR_PINIA_READY',
            __FROM_VUE_INSPECTOR__: true
        }, '*');
    }
    catch (e) {
        console.error('[injected/main] loadPiniaModule failed:', e);
        piniaModuleLoaded = false;
    }
}
/**
 * Handle Vue detection (immediate or reactive)
 */
function onVueDetected(version) {
    loadPropsModule();
    // Send updated detection result
    sendDetectionResult(getDetectionState());
}
/**
 * Handle Pinia detection (immediate or reactive)
 */
function onPiniaDetected() {
    loadPiniaModule();
    // Send updated detection result
    sendDetectionResult(getDetectionState());
}
/**
 * Message handler for content script communication
 */
function handleMessage(event) {
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
        return;
    }
    try {
        const { type } = event.data;
        // Request to check Vue
        if (type === 'VUE_INSPECTOR_CHECK_VUE') {
            sendDetectionResult(getDetectionState());
            return;
        }
        // Request to get flags (for UI)
        if (type === 'VUE_INSPECTOR_GET_FLAGS') {
            sendDetectionResult(getDetectionState());
            return;
        }
        // Force re-detection request
        if (type === 'VUE_INSPECTOR_FORCE_DETECT') {
            const result = detect();
            if (result.hasVue && !propsModuleLoaded) {
                loadPropsModule();
            }
            if (result.hasPinia && !piniaModuleLoaded) {
                loadPiniaModule();
            }
            sendDetectionResult(result);
            return;
        }
    }
    catch (e) {
        console.error('[injected/main] handleMessage failed:', event.data?.type, e);
    }
}
/**
 * Initialize the inspector
 */
function initialize() {
    try {
        window.addEventListener('message', handleMessage);
        loadNetworkModule();
        cleanupDetection = setupReactiveDetection({
            onVueDetected,
            onPiniaDetected
        });
        const initialResult = getDetectionState();
        sendDetectionResult(initialResult);
        window.postMessage({
            type: 'VUE_INSPECTOR_READY',
            __FROM_VUE_INSPECTOR__: true
        }, '*');
    }
    catch (e) {
        console.error('[injected/main] initialize failed:', e);
    }
}
/**
 * Initialize network module (always available)
 */
function loadNetworkModule() {
    if (networkModuleLoaded)
        return;
    try {
        networkModuleLoaded = true;
        initNetworkModule();
        window.postMessage({
            type: 'VUE_INSPECTOR_NETWORK_READY',
            __FROM_VUE_INSPECTOR__: true
        }, '*');
    }
    catch (e) {
        console.error('[injected/main] loadNetworkModule failed:', e);
        networkModuleLoaded = false;
    }
}
/**
 * Cleanup on page unload
 */
function cleanup() {
    try {
        window.removeEventListener('message', handleMessage);
        cleanupDetection?.();
        cleanupPropsModule();
        cleanupNetworkModule();
    }
    catch (e) {
        console.error('[injected/main] cleanup failed:', e);
    }
}
// Register cleanup
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
// Initialize
initialize();
window.__VUE_INSPECTOR_DETECTION__ = () => getDetectionState();
window.__VUE_INSPECTOR_FORCE_DETECT__ = () => {
    try {
        const result = detect();
        sendDetectionResult(result);
        return result;
    }
    catch (e) {
        console.error('[injected/main] __VUE_INSPECTOR_FORCE_DETECT__ failed:', e);
        return { hasVue: false, hasPinia: false, vueVersion: null };
    }
};
//# sourceMappingURL=main.js.map