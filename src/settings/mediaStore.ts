import { reactive } from 'vue'
import type { SavedFile } from '@/settings/inspectorSettings'

const DB_NAME = 'vue-inspector-media'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
        function tryOpen(useExistingVersion = false) {
            const req = indexedDB.open(DB_NAME, useExistingVersion ? undefined : DB_VERSION)
            req.onupgradeneeded = () => {
                const db = req.result
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME)
                }
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => {
                const err = req.error
                if (err?.name === 'VersionError' && !useExistingVersion) {
                    dbPromise = null
                    tryOpen(true)
                } else {
                    reject(err)
                }
            }
        }
        tryOpen(false)
    })
    return dbPromise
}

export const mediaUrls = reactive<Record<string, string>>({})

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(blob, id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(id)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error)
    })
}

export async function removeMediaBlob(id: string): Promise<void> {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
    if (mediaUrls[id]) {
        URL.revokeObjectURL(mediaUrls[id])
        delete mediaUrls[id]
    }
}

export function dataUriToBlob(dataUri: string): Blob {
    const [header, base64] = dataUri.split(',')
    const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
}

/**
 * Migrate inline dataUri → IndexedDB blob, then load object URLs for all files.
 */
export async function initMediaStore(files: SavedFile[]): Promise<void> {
    try {
        for (const file of files) {
            if (file.dataUri) {
                const blob = dataUriToBlob(file.dataUri)
                await saveMediaBlob(file.id, blob)
                delete file.dataUri
            }
        }

        for (const file of files) {
            if (mediaUrls[file.id]) continue
            const blob = await getMediaBlob(file.id)
            if (blob) {
                mediaUrls[file.id] = URL.createObjectURL(blob)
            }
        }
    } catch {
        // IDB unavailable — fall back silently
    }
}

export async function addMedia(id: string, blob: Blob): Promise<void> {
    await saveMediaBlob(id, blob)
    mediaUrls[id] = URL.createObjectURL(blob)
}

export async function removeMedia(id: string): Promise<void> {
    await removeMediaBlob(id)
}
