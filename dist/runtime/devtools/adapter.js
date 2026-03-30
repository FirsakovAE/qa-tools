/**
 * DevTools Panel Runtime Adapter
 *
 * Communicates with the content script via chrome.tabs.connect port.
 * Automatically reconnects when the inspected page reloads.
 */
import { isExpectedExtensionError } from '@/utils/expectedErrors';
class DevtoolsStorage {
    async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] ?? null;
        }
        catch (e) {
            console.error('[runtime/devtools] DevtoolsStorage.get failed:', key, e);
            return null;
        }
    }
    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
        }
        catch (e) {
            console.error('[runtime/devtools] DevtoolsStorage.set failed:', key, e);
        }
    }
    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
        }
        catch (e) {
            console.error('[runtime/devtools] DevtoolsStorage.remove failed:', key, e);
        }
    }
}
export class DevtoolsAdapter {
    tabId;
    id = 'devtools';
    capabilities = {
        hasBackgroundScript: true,
        hasPopup: false,
        canInspectOtherTabs: false,
        hasPersistentStorage: true,
        mode: 'extension'
    };
    storage = new DevtoolsStorage();
    port;
    portMessageHandler;
    pendingRequests = new Map();
    messageListeners = new Set();
    requestCounter = 0;
    destroyed = false;
    reconnectTimer = null;
    hasConnectedOnce = false;
    portDisconnected = false;
    constructor(tabId) {
        this.tabId = tabId;
        this.portMessageHandler = this.handlePortMessage.bind(this);
        this.connect();
    }
    connect() {
        this.portDisconnected = false;
        try {
            this.port = chrome.tabs.connect(this.tabId, { name: 'devtools' });
        }
        catch (e) {
            if (!isExpectedExtensionError(e))
                console.error('[runtime/devtools] connect failed:', this.tabId, e);
            this.scheduleReconnect();
            return;
        }
        const isReconnect = this.hasConnectedOnce;
        this.hasConnectedOnce = true;
        this.port.onMessage.addListener(this.portMessageHandler);
        this.port.onDisconnect.addListener(() => {
            void chrome.runtime.lastError;
            this.portDisconnected = true;
            for (const { timeout, reject } of this.pendingRequests.values()) {
                clearTimeout(timeout);
                reject(new Error('Port disconnected'));
            }
            this.pendingRequests.clear();
            this.scheduleReconnect();
        });
        // On reconnect, notify UI so components can re-fetch data.
        // Delayed so the devtools-bridge has time to inject scripts and run detection.
        if (isReconnect) {
            setTimeout(() => {
                if (this.destroyed)
                    return;
                window.postMessage({
                    __VUE_INSPECTOR__: true,
                    broadcast: true,
                    message: { type: 'DEVTOOLS_RECONNECTED' }
                }, '*');
            }, 1500);
        }
    }
    scheduleReconnect() {
        if (this.destroyed || this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.destroyed)
                return;
            this.connect();
        }, 500);
    }
    handlePortMessage(data) {
        if (this.destroyed)
            return;
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
        if (data.broadcast && data.message) {
            const msg = data.message;
            for (const handler of this.messageListeners) {
                try {
                    handler(msg, () => { });
                }
                catch (e) {
                    console.error('[runtime/devtools] message handler failed:', e);
                }
            }
            // Broadcast format for window.addEventListener handlers
            window.postMessage({
                __VUE_INSPECTOR__: true,
                broadcast: true,
                message: msg
            }, '*');
            // Direct format for __FROM_VUE_INSPECTOR__ handlers
            if (msg.__FROM_VUE_INSPECTOR__) {
                window.postMessage(msg, '*');
            }
        }
    }
    getResourceURL(path) {
        return chrome.runtime.getURL(path);
    }
    getManifest() {
        return chrome.runtime.getManifest();
    }
    async sendMessage(message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this.destroyed) {
                reject(new Error('Adapter destroyed'));
                return;
            }
            if (this.portDisconnected) {
                reject(new Error('Port disconnected'));
                return;
            }
            const requestId = `devtools_${++this.requestCounter}_${Date.now()}`;
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Message timeout'));
            }, timeout);
            this.pendingRequests.set(requestId, {
                resolve: resolve,
                reject,
                timeout: timeoutId
            });
            try {
                this.port.postMessage({ requestId, message });
            }
            catch (err) {
                this.pendingRequests.delete(requestId);
                clearTimeout(timeoutId);
                reject(err);
            }
        });
    }
    onMessage(handler) {
        this.messageListeners.add(handler);
        return () => {
            this.messageListeners.delete(handler);
        };
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
        this.destroyed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        try {
            this.port.disconnect();
        }
        catch (e) {
            if (!isExpectedExtensionError(e))
                console.error('[runtime/devtools] port.disconnect failed:', e);
        }
        for (const { timeout, reject } of this.pendingRequests.values()) {
            clearTimeout(timeout);
            reject(new Error('Adapter destroyed'));
        }
        this.pendingRequests.clear();
        this.messageListeners.clear();
    }
}
export function createDevtoolsAdapter(tabId) {
    return new DevtoolsAdapter(tabId);
}
//# sourceMappingURL=adapter.js.map