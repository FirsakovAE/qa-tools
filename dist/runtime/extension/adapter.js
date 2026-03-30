/**
 * Extension Runtime Adapter
 *
 * Реализация RuntimeAdapter для Chrome Extension.
 * Использует реальные chrome.* APIs.
 */
import { isExpectedExtensionError } from '@/utils/expectedErrors';
class ExtensionStorage {
    async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] ?? null;
        }
        catch (e) {
            console.error('[runtime/extension] ExtensionStorage.get failed:', key, e);
            return null;
        }
    }
    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
        }
        catch (e) {
            console.error('[runtime/extension] ExtensionStorage.set failed:', key, e);
        }
    }
    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
        }
        catch (e) {
            console.error('[runtime/extension] ExtensionStorage.remove failed:', key, e);
        }
    }
}
const MESSAGE_PREFIX = '__VUE_INSPECTOR__';
export class ExtensionAdapter {
    id = 'extension';
    capabilities = {
        hasBackgroundScript: true,
        hasPopup: true,
        canInspectOtherTabs: true,
        hasPersistentStorage: true,
        mode: 'extension'
    };
    storage = new ExtensionStorage();
    messageListeners = new Set();
    windowListener = null;
    pendingRequests = new Map();
    requestCounter = 0;
    // Определяем, работаем ли мы в iframe (injected UI) или в popup/devtools
    isIframe;
    constructor() {
        this.isIframe = window !== window.parent;
    }
    getResourceURL(path) {
        return chrome.runtime.getURL(path);
    }
    getManifest() {
        return chrome.runtime.getManifest();
    }
    async sendMessage(message, timeout = 5000) {
        // Если мы в iframe - используем postMessage к parent (content script)
        if (this.isIframe) {
            return this.sendViaPostMessage(message, timeout);
        }
        // Иначе (popup/devtools) - используем chrome.tabs.sendMessage
        return this.sendViaChrome(message, timeout);
    }
    async sendViaPostMessage(message, timeout) {
        return new Promise((resolve, reject) => {
            const requestId = `req_${++this.requestCounter}_${Date.now()}`;
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Message timeout'));
            }, timeout);
            this.pendingRequests.set(requestId, {
                resolve: resolve,
                reject,
                timeout: timeoutId
            });
            this.ensureWindowListener();
            // Отправляем в parent window (content script)
            window.parent.postMessage({
                [MESSAGE_PREFIX]: true,
                requestId,
                message
            }, '*');
        });
    }
    async sendViaChrome(message, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, timeout);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                try {
                    if (!tabs[0]?.id) {
                        clearTimeout(timeoutId);
                        reject(new Error('No active tab'));
                        return;
                    }
                    chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        }
                        else {
                            resolve(response);
                        }
                    });
                }
                catch (e) {
                    clearTimeout(timeoutId);
                    if (!isExpectedExtensionError(e))
                        console.error('[runtime/extension] sendViaChrome failed:', e);
                    reject(e);
                }
            });
        });
    }
    onMessage(handler) {
        this.messageListeners.add(handler);
        if (this.isIframe) {
            this.ensureWindowListener();
        }
        else {
            this.ensureChromeListener();
        }
        return () => {
            this.messageListeners.delete(handler);
            if (this.messageListeners.size === 0 && this.pendingRequests.size === 0) {
                this.removeWindowListener();
                this.removeChromeListener();
            }
        };
    }
    ensureWindowListener() {
        if (this.windowListener)
            return;
        this.windowListener = (event) => {
            const data = event.data;
            if (!data || typeof data !== 'object')
                return;
            if (!data[MESSAGE_PREFIX])
                return;
            // Response to our request
            if (data.responseId && this.pendingRequests.has(data.responseId)) {
                const pending = this.pendingRequests.get(data.responseId);
                this.pendingRequests.delete(data.responseId);
                clearTimeout(pending.timeout);
                if (data.error) {
                    pending.reject(new Error(data.error));
                }
                else {
                    pending.resolve(data.response);
                }
                return;
            }
            // Incoming broadcast message
            if (data.broadcast && data.message) {
                for (const handler of this.messageListeners) {
                    try {
                        handler(data.message, () => { });
                    }
                    catch (e) {
                        console.error('[runtime/extension] message handler failed:', e);
                    }
                }
            }
        };
        window.addEventListener('message', this.windowListener);
    }
    removeWindowListener() {
        if (this.windowListener) {
            window.removeEventListener('message', this.windowListener);
            this.windowListener = null;
        }
    }
    chromeListener = null;
    ensureChromeListener() {
        if (this.chromeListener)
            return;
        this.chromeListener = (message, _sender, sendResponse) => {
            let handled = false;
            for (const h of this.messageListeners) {
                const result = h(message, sendResponse);
                if (result === true) {
                    handled = true;
                }
            }
            return handled;
        };
        chrome.runtime.onMessage.addListener(this.chromeListener);
    }
    removeChromeListener() {
        if (this.chromeListener) {
            chrome.runtime.onMessage.removeListener(this.chromeListener);
            this.chromeListener = null;
        }
    }
    onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        }
        else {
            callback();
        }
    }
    destroy() {
        this.removeWindowListener();
        this.removeChromeListener();
        for (const { timeout, reject } of this.pendingRequests.values()) {
            clearTimeout(timeout);
            reject(new Error('Adapter destroyed'));
        }
        this.pendingRequests.clear();
        this.messageListeners.clear();
    }
}
export function createExtensionAdapter() {
    return new ExtensionAdapter();
}
//# sourceMappingURL=adapter.js.map