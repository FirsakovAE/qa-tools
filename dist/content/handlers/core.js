/**
 * Core runtime message handlers (PING, FLAGS, COMPONENTS)
 */
import { requestWindow } from '../ipc';
import { featureFlags, detectionCompleted } from '../state';
import { collectVueComponentsFromDOM } from '../utils';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
/**
 * PING handler - responds with ready status
 */
export const handlePing = (message, sender, sendResponse) => {
    sendResponse({ pong: true, ready: true });
    return true;
};
/**
 * GET_FLAGS / VUE_INSPECTOR_GET_FLAGS handler
 */
export const handleGetFlags = (message, sender, sendResponse) => {
    // If flags already obtained - return immediately
    if (detectionCompleted) {
        sendResponse({
            type: 'VUE_INSPECTOR_FEATURE_FLAGS',
            flags: featureFlags
        });
        return true;
    }
    // Otherwise request from injected script and respond later
    window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*');
    // Wait for detection result
    const checkInterval = setInterval(() => {
        if (detectionCompleted) {
            clearInterval(checkInterval);
            sendResponse({
                type: 'VUE_INSPECTOR_FEATURE_FLAGS',
                flags: featureFlags
            });
        }
    }, 100);
    // Timeout after 3 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!detectionCompleted) {
            sendResponse({
                type: 'VUE_INSPECTOR_FEATURE_FLAGS',
                flags: { hasVue: false, hasPinia: false, vueVersion: null }
            });
        }
    }, 3000);
    return true; // Async response
};
/**
 * GET_COMPONENTS handler
 */
export const handleGetComponents = (message, sender, sendResponse) => {
    const inspector = window.__VUE_INSPECTOR__;
    sendResponse({ components: inspector?.getComponents?.() || [] });
    return true;
};
/**
 * COLLECT_VUE_COMPONENTS handler
 * Uses lightweight format (no serialized props) to avoid 64MB port.postMessage limit.
 * Props loaded on-demand via GET_COMPONENT_PROPS when user selects a component.
 */
export const handleCollectVueComponents = (message, sender, sendResponse) => {
    const forceRefresh = !!message.forceRefresh;
    const blacklist = message.blacklist;
    const rootElementUid = message.rootElementUid;
    requestWindow({ type: 'VUE_INSPECTOR_GET_COMPONENTS', forceRefresh, blacklist, rootElementUid }, 'VUE_INSPECTOR_COMPONENTS_DATA', 3000)
        .then((response) => {
        sendResponse({ components: response.components || [] });
    })
        .catch((err) => {
        if (!isExpectedExtensionError(err)) {
            console.error('[content/handlers/core] requestWindow for components failed:', err);
        }
        // Try to get components directly from DOM as fallback
        try {
            const components = collectVueComponentsFromDOM();
            sendResponse({ components });
        }
        catch (error) {
            console.error('[content/handlers/core] collectVueComponentsFromDOM fallback failed:', error);
            sendResponse({ components: [], error: String(error) });
        }
    });
    return true; // Async response
};
//# sourceMappingURL=core.js.map