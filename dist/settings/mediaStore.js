import { reactive } from 'vue';
// ── Standalone storage client (set at init) ─────────
let _storageClient = null;
export function setMediaStorageClient(client) {
    _storageClient = client;
}
// ── Extension-only: direct IndexedDB (vue-inspector-media) ──
const DB_NAME = 'vue-inspector-media';
const DB_VERSION = 2;
const STORE_NAME = 'blobs';
const WALLPAPERS_STORE = 'wallpapers';
let dbPromise = null;
function openDB() {
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        function tryOpen(useExistingVersion = false) {
            const req = indexedDB.open(DB_NAME, useExistingVersion ? undefined : DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
                if (!db.objectStoreNames.contains(WALLPAPERS_STORE)) {
                    db.createObjectStore(WALLPAPERS_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                const err = req.error;
                if (err?.name === 'VersionError' && !useExistingVersion) {
                    dbPromise = null;
                    tryOpen(true);
                }
                else {
                    console.error('[settings/mediaStore] openDB failed:', err);
                    reject(err);
                }
            };
        }
        tryOpen(false);
    });
    return dbPromise;
}
export const mediaUrls = reactive({});
export async function saveMediaBlob(id, blob) {
    try {
        if (_storageClient) {
            return _storageClient.setMedia(id, blob);
        }
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => {
                console.error('[settings/mediaStore] saveMediaBlob tx failed:', id, tx.error);
                reject(tx.error);
            };
        });
    }
    catch (e) {
        console.error('[settings/mediaStore] saveMediaBlob failed:', id, e);
        throw e;
    }
}
export async function getMediaBlob(id) {
    try {
        if (_storageClient) {
            return _storageClient.getMedia(id);
        }
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => {
                console.error('[settings/mediaStore] getMediaBlob failed:', id, req.error);
                reject(req.error);
            };
        });
    }
    catch (e) {
        console.error('[settings/mediaStore] getMediaBlob failed:', id, e);
        return null;
    }
}
export async function removeMediaBlob(id) {
    try {
        if (_storageClient) {
            await _storageClient.removeMedia(id);
        }
        else {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => {
                    console.error('[settings/mediaStore] removeMediaBlob tx failed:', id, tx.error);
                    reject(tx.error);
                };
            });
        }
        if (mediaUrls[id]) {
            URL.revokeObjectURL(mediaUrls[id]);
            delete mediaUrls[id];
        }
    }
    catch (e) {
        console.error('[settings/mediaStore] removeMediaBlob failed:', id, e);
        throw e;
    }
}
export function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => {
            console.error('[settings/mediaStore] blobToDataUri failed:', r.error);
            reject(r.error);
        };
        r.readAsDataURL(blob);
    });
}
export function dataUriToBlob(dataUri) {
    const [header, base64] = dataUri.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}
/**
 * Migrate inline dataUri → IndexedDB blob, then load object URLs for all files.
 */
export async function initMediaStore(files) {
    try {
        for (const file of files) {
            if (file.dataUri) {
                const blob = dataUriToBlob(file.dataUri);
                await saveMediaBlob(file.id, blob);
                delete file.dataUri;
            }
        }
        for (const file of files) {
            if (mediaUrls[file.id])
                continue;
            const blob = await getMediaBlob(file.id);
            if (blob) {
                mediaUrls[file.id] = URL.createObjectURL(blob);
            }
        }
    }
    catch (e) {
        console.error('[settings/mediaStore] initMediaStore failed:', e);
    }
}
export async function addMedia(id, blob) {
    try {
        await saveMediaBlob(id, blob);
        mediaUrls[id] = URL.createObjectURL(blob);
    }
    catch (e) {
        console.error('[settings/mediaStore] addMedia failed:', id, e);
        throw e;
    }
}
export async function removeMedia(id) {
    await removeMediaBlob(id);
}
/**
 * Clear all blobs from the media store and revoke all object URLs.
 * Used during settings reset to free storage quota.
 */
export async function clearAllMedia() {
    for (const [id, url] of Object.entries(mediaUrls)) {
        URL.revokeObjectURL(url);
        delete mediaUrls[id];
    }
    if (_storageClient) {
        await _storageClient.clearAllMedia();
        return;
    }
    try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME, WALLPAPERS_STORE], 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.objectStore(WALLPAPERS_STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    catch (e) {
        console.error('[settings/mediaStore] clearAllMedia failed:', e);
    }
}
// --- Wallpapers (standalone: unified media store via StorageClient, extension: wallpapers store) ---
export async function getWallpaperBlob(id) {
    try {
        if (_storageClient) {
            return _storageClient.getMedia(id);
        }
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(WALLPAPERS_STORE, 'readonly');
            const req = tx.objectStore(WALLPAPERS_STORE).get(id);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => {
                console.error('[settings/mediaStore] getWallpaperBlob failed:', id, req.error);
                reject(req.error);
            };
        });
    }
    catch (e) {
        console.error('[settings/mediaStore] getWallpaperBlob failed:', id, e);
        return null;
    }
}
export async function putWallpaperBlob(id, blob) {
    try {
        if (_storageClient) {
            return _storageClient.setMedia(id, blob);
        }
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(WALLPAPERS_STORE, 'readwrite');
            tx.objectStore(WALLPAPERS_STORE).put(blob, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => {
                console.error('[settings/mediaStore] putWallpaperBlob tx failed:', id, tx.error);
                reject(tx.error);
            };
        });
    }
    catch (e) {
        console.error('[settings/mediaStore] putWallpaperBlob failed:', id, e);
        throw e;
    }
}
export async function removeWallpaperBlob(id) {
    try {
        if (_storageClient) {
            await _storageClient.removeMedia(id);
        }
        else {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(WALLPAPERS_STORE, 'readwrite');
                tx.objectStore(WALLPAPERS_STORE).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => {
                    console.error('[settings/mediaStore] removeWallpaperBlob tx failed:', id, tx.error);
                    reject(tx.error);
                };
            });
        }
        if (mediaUrls[id]) {
            URL.revokeObjectURL(mediaUrls[id]);
            delete mediaUrls[id];
        }
    }
    catch (e) {
        console.error('[settings/mediaStore] removeWallpaperBlob failed:', id, e);
        throw e;
    }
}
/**
 * Load wallpapers into mediaUrls as object URLs.
 * Standalone: reads from central-store media via StorageClient.
 * Extension: reads from vue-inspector-media wallpapers store.
 */
export async function initWallpapersStore(ids) {
    try {
        for (const id of ids) {
            if (mediaUrls[id])
                continue;
            const blob = await getWallpaperBlob(id);
            if (blob) {
                mediaUrls[id] = URL.createObjectURL(blob);
            }
        }
    }
    catch (e) {
        console.error('[settings/mediaStore] initWallpapersStore failed:', e);
    }
}
//# sourceMappingURL=mediaStore.js.map