/**
 * UI iframe message bridge
 * Handles communication between content script and UI iframe
 */
import { routeRequest, forwardInjectedBroadcast } from './message-router';
import { uiBridgeInitialized, setUiBridgeInitialized, featureFlags } from './state';
export const UI_MESSAGE_PREFIX = '__VUE_INSPECTOR__';
/**
 * Message handler for UI iframe communication
 */
function uiBridgeMessageHandler(event) {
    const data = event.data;
    if (!data || typeof data !== 'object')
        return;
    // Handle messages from injected script (network events) — detection/props/pinia handled by detection.ts
    if (data.__FROM_VUE_INSPECTOR__) {
        forwardInjectedBroadcast(data, (msg) => broadcastToUI(msg.message), { onlyNetwork: true });
        return;
    }
    if (!data[UI_MESSAGE_PREFIX])
        return;
    // Check that message is from our iframe (get fresh reference)
    const currentIframe = document.getElementById('vue-inspector-ui');
    if (!currentIframe?.contentWindow)
        return;
    if (event.source !== currentIframe.contentWindow)
        return;
    const requestId = data.requestId;
    const message = data.message;
    if (!message || !message.type)
        return;
    const sendResponse = (response) => {
        if (currentIframe?.contentWindow) {
            currentIframe.contentWindow.postMessage({
                [UI_MESSAGE_PREFIX]: true,
                responseId: requestId,
                response
            }, '*');
        }
    };
    routeRequest(message, sendResponse, '[content/ui-bridge]');
}
/**
 * Setup UI message bridge
 */
export function setupUIMessageBridge() {
    if (uiBridgeInitialized)
        return;
    setUiBridgeInitialized(true);
    window.addEventListener('message', uiBridgeMessageHandler);
}
/**
 * Remove UI message bridge
 */
export function removeUIMessageBridge() {
    if (!uiBridgeInitialized)
        return;
    setUiBridgeInitialized(false);
    window.removeEventListener('message', uiBridgeMessageHandler);
}
/**
 * Send feature flags to UI iframe
 */
export function sendFlagsToUI() {
    const iframe = document.getElementById('vue-inspector-ui');
    if (iframe?.contentWindow) {
        // Use new format with __VUE_INSPECTOR__ prefix
        iframe.contentWindow.postMessage({
            [UI_MESSAGE_PREFIX]: true,
            broadcast: true,
            message: {
                type: 'VUE_INSPECTOR_FEATURE_FLAGS',
                flags: featureFlags
            }
        }, '*');
    }
}
/**
 * Send broadcast message to UI iframe
 */
export function broadcastToUI(message) {
    const iframe = document.getElementById('vue-inspector-ui');
    if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({
            [UI_MESSAGE_PREFIX]: true,
            broadcast: true,
            message
        }, '*');
    }
}
//# sourceMappingURL=ui-bridge.js.map