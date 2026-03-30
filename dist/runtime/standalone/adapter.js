/**
 * Standalone Runtime Adapter
 *
 * Реализация RuntimeAdapter для standalone режима (без расширения).
 * Использует postMessage для коммуникации.
 *
 * Storage:
 *   StorageClient   — communicates with hidden storage iframe (central-store IndexedDB)
 *   sessionStorage  — synchronous preload cache (survives F5)
 */
const STORAGE_KEY = '__vue_inspector_storage__';
const MESSAGE_PREFIX = '__VUE_INSPECTOR__';
function sessionGet(key) {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const data = stored ? JSON.parse(stored) : {};
        return data[key] ?? null;
    }
    catch (e) {
        console.error('[runtime/standalone] sessionGet failed:', key, e);
        return null;
    }
}
function sessionSet(key, value) {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const data = stored ? JSON.parse(stored) : {};
        data[key] = value;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    catch (e) {
        console.error('[runtime/standalone] sessionSet failed:', key, e);
    }
}
function sessionRemove(key) {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const data = stored ? JSON.parse(stored) : {};
        delete data[key];
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    catch (e) {
        console.error('[runtime/standalone] sessionRemove failed:', key, e);
    }
}
class StandaloneStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    async get(key) {
        try {
            const value = await this.client.getSettings(key);
            if (value !== null) {
                sessionSet(key, value);
            }
            return value;
        }
        catch (e) {
            console.error('[runtime/standalone] StandaloneStorage.get failed:', key, e);
            return sessionGet(key);
        }
    }
    async set(key, value) {
        try {
            sessionSet(key, value);
            await this.client.setSettings(value, key);
        }
        catch (e) {
            console.error('[runtime/standalone] StandaloneStorage.set failed:', key, e);
            throw e;
        }
    }
    async remove(key) {
        try {
            sessionRemove(key);
            await this.client.removeSettings(key);
        }
        catch (e) {
            console.error('[runtime/standalone] StandaloneStorage.remove failed:', key, e);
            throw e;
        }
    }
}
export class StandaloneAdapter {
    id = 'standalone';
    capabilities = {
        hasBackgroundScript: false,
        hasPopup: false,
        canInspectOtherTabs: false,
        hasPersistentStorage: true,
        mode: 'standalone'
    };
    storage;
    config;
    messageListeners = new Set();
    windowListener = null;
    pendingRequests = new Map();
    requestCounter = 0;
    constructor(config) {
        this.config = {
            targetOrigin: '*',
            ...config
        };
        this.storage = new StandaloneStorage(config.storageClient);
    }
    getResourceURL(path) {
        const base = this.config.baseURL.replace(/\/$/, '');
        return `${base}/${path}`;
    }
    getManifest() {
        // Mock manifest for standalone mode
        return {
            manifest_version: 3,
            name: 'Vue Inspector (Standalone)',
            version: '1.0.0',
            description: 'Standalone version of Vue Inspector',
            action: {
                default_title: 'Vue Inspector'
            }
        };
    }
    async sendMessage(message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            try {
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
                // Ensure listener is active
                this.ensureWindowListener();
                // Send to target window (content script listens on main window)
                const target = this.config.targetWindow || window.parent;
                target.postMessage({
                    [MESSAGE_PREFIX]: true,
                    requestId,
                    message
                }, this.config.targetOrigin);
            }
            catch (err) {
                console.error('[runtime/standalone] sendMessage failed:', err);
                reject(err);
            }
        });
    }
    onMessage(handler) {
        this.messageListeners.add(handler);
        this.ensureWindowListener();
        return () => {
            this.messageListeners.delete(handler);
            if (this.messageListeners.size === 0 && this.pendingRequests.size === 0) {
                this.removeWindowListener();
            }
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
        this.removeWindowListener();
        for (const { timeout, reject } of this.pendingRequests.values()) {
            clearTimeout(timeout);
            reject(new Error('Adapter destroyed'));
        }
        this.pendingRequests.clear();
        this.messageListeners.clear();
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
            // Incoming message (broadcast)
            if (data.broadcast) {
                for (const handler of this.messageListeners) {
                    try {
                        handler(data.message, () => {
                            // Broadcasts don't expect response
                        });
                    }
                    catch (e) {
                        console.error('[runtime/standalone] broadcast handler failed:', e);
                    }
                }
                return;
            }
            // Incoming request (needs response)
            if (data.requestId && data.message) {
                const sendResponse = (response) => {
                    const source = event.source;
                    if (source) {
                        source.postMessage({
                            [MESSAGE_PREFIX]: true,
                            responseId: data.requestId,
                            response
                        }, this.config.targetOrigin);
                    }
                };
                for (const handler of this.messageListeners) {
                    try {
                        const result = handler(data.message, sendResponse);
                        if (result === true) {
                            // Async response - handler will call sendResponse
                            return;
                        }
                    }
                    catch (e) {
                        console.error('[runtime/standalone] request handler failed:', e);
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
}
export function createStandaloneAdapter(config) {
    return new StandaloneAdapter(config);
}
//# sourceMappingURL=adapter.js.map