import { isExpectedExtensionError } from './expectedErrors';
// Safe guards for extension context
export function safeRuntime() {
    try {
        if (!chrome?.runtime?.id)
            return null;
        return chrome.runtime;
    }
    catch (e) {
        if (!isExpectedExtensionError(e))
            console.error('[utils/extensionBridge] safeRuntime failed:', e);
        return null;
    }
}
export function safeStorage() {
    try {
        if (!chrome?.storage?.local)
            return null;
        return chrome.storage.local;
    }
    catch (e) {
        if (!isExpectedExtensionError(e))
            console.error('[utils/extensionBridge] safeStorage failed:', e);
        return null;
    }
}
export function safeTabs() {
    try {
        if (!chrome?.tabs)
            return null;
        return chrome.tabs;
    }
    catch (e) {
        if (!isExpectedExtensionError(e))
            console.error('[utils/extensionBridge] safeTabs failed:', e);
        return null;
    }
}
export async function safeSendMessage(message) {
    try {
        const runtime = safeRuntime();
        if (!runtime)
            return null;
        return await runtime.sendMessage(message);
    }
    catch (e) {
        if (!isExpectedExtensionError(e))
            console.error('[utils/extensionBridge] safeSendMessage failed:', message?.type, e);
        return null;
    }
}
//# sourceMappingURL=extensionBridge.js.map