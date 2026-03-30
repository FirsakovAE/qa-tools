/**
 * Storage Client
 *
 * Runs inside the UI iframe. Creates a hidden child iframe pointing at
 * the storage page (same origin) and communicates with it via postMessage.
 *
 * All operations queue until the storage iframe reports "ready".
 */
import { STORAGE_PREFIX, STORAGE_RESPONSE_PREFIX, } from './storage-protocol';
const REQUEST_TIMEOUT_MS = 10_000;
export class StorageClient {
    iframe = null;
    pending = new Map();
    counter = 0;
    readyResolve;
    readyPromise;
    origin;
    listener = null;
    _storageAccessGranted = false;
    constructor(storageUrl) {
        this.origin = new URL(storageUrl).origin;
        this.readyPromise = new Promise((r) => { this.readyResolve = r; });
        this.setupListener();
        this.createIframe(storageUrl);
    }
    /** Resolves when the storage iframe has initialized IndexedDB and is ready. */
    get ready() {
        return this.readyPromise;
    }
    /**
     * Whether the Storage Access API granted unpartitioned storage.
     * If false, each top-level site gets its own isolated IndexedDB.
     */
    get isSharedAcrossSites() {
        return this._storageAccessGranted;
    }
    // ── Settings ──────────────────────────
    async getSettings(key = 'inspector-settings') {
        return this.send('getSettings', { key });
    }
    async setSettings(data, key = 'inspector-settings') {
        await this.send('setSettings', { key, data });
    }
    async removeSettings(key = 'inspector-settings') {
        await this.send('removeSettings', { key });
    }
    // ── Media ─────────────────────────────
    async getMedia(id) {
        const result = await this.send('getMedia', { id });
        return result instanceof Blob ? result : null;
    }
    async setMedia(id, blob) {
        await this.send('setMedia', { id, blob });
    }
    async removeMedia(id) {
        await this.send('removeMedia', { id });
    }
    async getAllMediaIds() {
        return (await this.send('getAllMediaIds'));
    }
    async getTotalMediaSize() {
        return (await this.send('getTotalMediaSize'));
    }
    async clearAllMedia() {
        await this.send('clearAllMedia');
    }
    // ── Lifecycle ─────────────────────────
    destroy() {
        try {
            if (this.listener) {
                window.removeEventListener('message', this.listener);
                this.listener = null;
            }
            if (this.iframe) {
                this.iframe.remove();
                this.iframe = null;
            }
            for (const { reject, timer } of this.pending.values()) {
                clearTimeout(timer);
                reject(new Error('StorageClient destroyed'));
            }
            this.pending.clear();
        }
        catch (e) {
            console.error('[storage/storage-client] destroy failed:', e);
        }
    }
    // ── Internal ──────────────────────────
    createIframe(url) {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;
            document.body.appendChild(iframe);
            this.iframe = iframe;
        }
        catch (e) {
            console.error('[storage/storage-client] createIframe failed:', url, e);
            throw e;
        }
    }
    setupListener() {
        this.listener = (event) => {
            const data = event.data;
            if (!data || typeof data !== 'object')
                return;
            // "ready" signal from storage iframe
            if (data[STORAGE_PREFIX] && data.action === 'ready') {
                this._storageAccessGranted = !!data.storageAccessGranted;
                this.readyResolve();
                return;
            }
            // Response to a pending request
            if (data[STORAGE_RESPONSE_PREFIX] && data.requestId) {
                const entry = this.pending.get(data.requestId);
                if (!entry)
                    return;
                this.pending.delete(data.requestId);
                clearTimeout(entry.timer);
                if (data.error) {
                    entry.reject(new Error(data.error));
                }
                else {
                    entry.resolve(data.result);
                }
            }
        };
        window.addEventListener('message', this.listener);
    }
    async send(action, payload = {}) {
        await this.readyPromise;
        const requestId = `s_${++this.counter}_${Date.now()}`;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`Storage timeout: ${action}`));
            }, REQUEST_TIMEOUT_MS);
            this.pending.set(requestId, { resolve, reject, timer });
            try {
                const win = this.iframe?.contentWindow;
                if (!win) {
                    this.pending.delete(requestId);
                    clearTimeout(timer);
                    reject(new Error('Storage iframe not ready'));
                    return;
                }
                win.postMessage({ [STORAGE_PREFIX]: true, requestId, action, ...payload }, this.origin);
            }
            catch (e) {
                this.pending.delete(requestId);
                clearTimeout(timer);
                console.error('[storage/storage-client] send postMessage failed:', action, e);
                reject(e);
            }
        });
    }
}
// ── Singleton management ────────────────
let _client = null;
export function createStorageClient(storageUrl) {
    try {
        if (_client)
            _client.destroy();
        _client = new StorageClient(storageUrl);
        return _client;
    }
    catch (e) {
        console.error('[storage/storage-client] createStorageClient failed:', storageUrl, e);
        throw e;
    }
}
export function getStorageClient() {
    return _client;
}
//# sourceMappingURL=storage-client.js.map