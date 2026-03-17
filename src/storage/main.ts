/**
 * Central Storage Manager
 *
 * Runs inside a hidden iframe (same origin as the UI iframe).
 * Manages a single IndexedDB "central-store" with two object stores:
 *   - settings  (key-value JSON, e.g. "inspector-settings")
 *   - media     (Blob objects for images, GIFs, and MP4 wallpapers)
 *
 * Uses Storage Access API to bypass third-party storage partitioning,
 * so all websites share the same IndexedDB regardless of top-level site.
 *
 * On first load, migrates data from the legacy databases
 * (vue-inspector-standalone, vue-inspector-media) into central-store.
 */

import {
  STORAGE_PREFIX,
  STORAGE_RESPONSE_PREFIX,
  DB_NAME,
  DB_VERSION,
  SETTINGS_STORE,
  MEDIA_STORE,
  MEDIA_LIMIT_BYTES,
} from './storage-protocol'

// ────────────────────────────────────────
// Storage Access API — bypass partitioning
// ────────────────────────────────────────

let idbFactory: IDBFactory = indexedDB
let storageAccessGranted = false

/**
 * Request unpartitioned (first-party) IndexedDB access.
 *
 * Chrome 125+: requestStorageAccess({indexedDB:true}) returns a handle
 *              whose .indexedDB is an unpartitioned IDBFactory.
 * Firefox:     requestStorageAccess() unlocks window.indexedDB for the frame.
 * Safari:      similar to Firefox for ITP-affected origins.
 *
 * Auto-grants if the user has visited this origin as a top-level site
 * (e.g. the GitHub Pages URL used to install the bookmarklet).
 */
async function requestUnpartitionedStorage(): Promise<void> {
  if (typeof document.requestStorageAccess !== 'function') return

  // Chrome 125+: handle-based API
  try {
    const handle: any = await (document as any).requestStorageAccess({ indexedDB: true })
    if (handle?.indexedDB) {
      idbFactory = handle.indexedDB as IDBFactory
      storageAccessGranted = true
      return
    }
  } catch (e) {
    console.error('[storage/main] requestStorageAccess (Chrome handle) failed:', e)
  }

  // Firefox / Safari: unlocks window.indexedDB directly
  try {
    await document.requestStorageAccess()
    storageAccessGranted = true
  } catch (e) {
    console.error('[storage/main] requestStorageAccess failed:', e)
  }
}

// ────────────────────────────────────────
// IndexedDB helpers
// ────────────────────────────────────────

let db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const req = idbFactory.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE)
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE)
      }
    }
    req.onsuccess = () => {
      db = req.result
      resolve(db)
    }
    req.onerror = () => {
      console.error('[storage/main] openDB failed:', req.error)
      reject(req.error)
    }
  })
}

// ── Settings ────────────────────────────

async function getSettings(key: string): Promise<unknown> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SETTINGS_STORE, 'readonly')
    const req = tx.objectStore(SETTINGS_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => {
      console.error('[storage/main] getSettings failed:', key, req.error)
      reject(req.error)
    }
  })
}

async function setSettings(key: string, data: unknown): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SETTINGS_STORE, 'readwrite')
    tx.objectStore(SETTINGS_STORE).put(data, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      console.error('[storage/main] setSettings failed:', key, tx.error)
      reject(tx.error)
    }
  })
}

async function removeSettings(key: string): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SETTINGS_STORE, 'readwrite')
    tx.objectStore(SETTINGS_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      console.error('[storage/main] removeSettings failed:', key, tx.error)
      reject(tx.error)
    }
  })
}

// ── Media ───────────────────────────────

async function getMedia(id: string): Promise<Blob | null> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(MEDIA_STORE, 'readonly')
    const req = tx.objectStore(MEDIA_STORE).get(id)
    req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null)
    req.onerror = () => {
      console.error('[storage/main] getMedia failed:', id, req.error)
      reject(req.error)
    }
  })
}

async function setMedia(id: string, blob: Blob): Promise<void> {
  const totalSize = await getTotalMediaSize()
  const existing = await getMedia(id)
  const newTotal = totalSize - (existing?.size ?? 0) + blob.size
  if (newTotal > MEDIA_LIMIT_BYTES) {
    throw new Error(
      `Media limit exceeded: ${(newTotal / 1024 / 1024).toFixed(1)} MB / ${MEDIA_LIMIT_BYTES / 1024 / 1024} MB`,
    )
  }
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(MEDIA_STORE, 'readwrite')
    tx.objectStore(MEDIA_STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      console.error('[storage/main] setMedia failed:', id, tx.error)
      reject(tx.error)
    }
  })
}

async function removeMedia(id: string): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(MEDIA_STORE, 'readwrite')
    tx.objectStore(MEDIA_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      console.error('[storage/main] removeMedia failed:', id, tx.error)
      reject(tx.error)
    }
  })
}

async function clearAllMedia(): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(MEDIA_STORE, 'readwrite')
    tx.objectStore(MEDIA_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      console.error('[storage/main] clearAllMedia failed:', tx.error)
      reject(tx.error)
    }
  })
}

async function getAllMediaIds(): Promise<string[]> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(MEDIA_STORE, 'readonly')
    const req = tx.objectStore(MEDIA_STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result as string[])
    req.onerror = () => {
      console.error('[storage/main] getAllMediaIds failed:', req.error)
      reject(req.error)
    }
  })
}

async function getTotalMediaSize(): Promise<number> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(MEDIA_STORE, 'readonly')
    const req = tx.objectStore(MEDIA_STORE).openCursor()
    let total = 0
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        if (cursor.value instanceof Blob) total += cursor.value.size
        cursor.continue()
      } else {
        resolve(total)
      }
    }
    req.onerror = () => {
      console.error('[storage/main] getTotalMediaSize failed:', req.error)
      reject(req.error)
    }
  })
}

// ────────────────────────────────────────
// Migration from legacy databases
// ────────────────────────────────────────

function tryOpenLegacyDB(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      // Legacy DBs may live in the partitioned partition — try both factories
      const req = idbFactory.open(name)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        if (idbFactory !== indexedDB) {
          try {
            const fallback = indexedDB.open(name)
            fallback.onsuccess = () => resolve(fallback.result)
            fallback.onerror = () => {
              console.error('[storage/main] tryOpenLegacyDB fallback failed:', name, fallback.error)
              resolve(null)
            }
          } catch (e) {
            console.error('[storage/main] tryOpenLegacyDB fallback open failed:', name, e)
            resolve(null)
          }
        } else {
          console.error('[storage/main] tryOpenLegacyDB failed:', name, req.error)
          resolve(null)
        }
      }
    } catch (e) {
      console.error('[storage/main] tryOpenLegacyDB failed:', name, e)
      resolve(null)
    }
  })
}

async function migrateFromLegacyDatabases(): Promise<void> {
  const existing = await getSettings('inspector-settings')
  if (existing) return

  // ── vue-inspector-standalone → settings store ──
  const oldSettingsDb = await tryOpenLegacyDB('vue-inspector-standalone')
  if (oldSettingsDb) {
    try {
      if (oldSettingsDb.objectStoreNames.contains('kv')) {
        const settings = await new Promise<unknown>((resolve, reject) => {
          const tx = oldSettingsDb.transaction('kv', 'readonly')
          const req = tx.objectStore('kv').get('inspector-settings')
          req.onsuccess = () => resolve(req.result ?? null)
          req.onerror = () => reject(req.error)
        })
        if (settings) await setSettings('inspector-settings', settings)
      }
    } catch (e) {
      console.error('[storage/main] migrateFromLegacyDatabases settings failed:', e)
    }
    oldSettingsDb.close()
  }

  // ── vue-inspector-media → media store ──
  const oldMediaDb = await tryOpenLegacyDB('vue-inspector-media')
  if (!oldMediaDb) return

  try {
    // Migrate blobs store (form-data saved files)
    if (oldMediaDb.objectStoreNames.contains('blobs')) {
      const entries = await new Promise<{ key: string; blob: Blob }[]>((resolve, reject) => {
        const list: { key: string; blob: Blob }[] = []
        const tx = oldMediaDb.transaction('blobs', 'readonly')
        const req = tx.objectStore('blobs').openCursor()
        req.onsuccess = () => {
          const cursor = req.result
          if (cursor) {
            if (cursor.value instanceof Blob) {
              list.push({ key: cursor.key as string, blob: cursor.value })
            }
            cursor.continue()
          } else {
            resolve(list)
          }
        }
        req.onerror = () => reject(req.error)
      })

      const database = await openDB()
      for (const { key, blob } of entries) {
        try {
          await new Promise<void>((res, rej) => {
            const tx = database.transaction(MEDIA_STORE, 'readwrite')
            tx.objectStore(MEDIA_STORE).put(blob, key)
            tx.oncomplete = () => res()
            tx.onerror = () => rej(tx.error)
          })
        } catch (e) {
          console.error('[storage/main] migrateFromLegacyDatabases blob entry failed:', key, e)
        }
      }
    }

    // Migrate wallpapers store — only referenced entries (skip orphans)
    if (oldMediaDb.objectStoreNames.contains('wallpapers')) {
      const settingsData = (await getSettings('inspector-settings')) as Record<string, any> | null
      const referencedIds = new Set<string>()

      if (settingsData?.customize?.image?.wallpapers) {
        for (const wp of settingsData.customize.image.wallpapers) {
          if (wp.id) referencedIds.add(wp.id)
        }
      }
      if (settingsData?.customize?.image?.wallpaperId) {
        referencedIds.add(settingsData.customize.image.wallpaperId)
      }
      if (settingsData?.customize?.image?.savedFileId?.startsWith('wallpaper_')) {
        referencedIds.add(settingsData.customize.image.savedFileId)
      }

      const database = await openDB()
      for (const id of referencedIds) {
        try {
          const blob = await new Promise<Blob | null>((resolve, reject) => {
            const tx = oldMediaDb.transaction('wallpapers', 'readonly')
            const req = tx.objectStore('wallpapers').get(id)
            req.onsuccess = () =>
              resolve(req.result instanceof Blob ? req.result : null)
            req.onerror = () => reject(req.error)
          })
          if (blob) {
            await new Promise<void>((res, rej) => {
              const tx = database.transaction(MEDIA_STORE, 'readwrite')
              tx.objectStore(MEDIA_STORE).put(blob, id)
              tx.oncomplete = () => res()
              tx.onerror = () => rej(tx.error)
            })
          }
        } catch (e) {
          console.error('[storage/main] migrateFromLegacyDatabases wallpaper failed:', id, e)
        }
      }
    }
  } catch (e) {
    console.error('[storage/main] migrateFromLegacyDatabases failed:', e)
  }

  oldMediaDb.close()
}

// ────────────────────────────────────────
// postMessage handler
// ────────────────────────────────────────

async function handleAction(data: Record<string, any>): Promise<{ result?: unknown; error?: string }> {
  try {
    switch (data.action) {
      case 'getSettings':
        return { result: await getSettings(data.key ?? 'inspector-settings') }

      case 'setSettings':
        await setSettings(data.key ?? 'inspector-settings', data.data)
        return { result: true }

      case 'removeSettings':
        await removeSettings(data.key ?? 'inspector-settings')
        return { result: true }

      case 'getMedia':
        return { result: await getMedia(data.id) }

      case 'setMedia':
        await setMedia(data.id, data.blob)
        return { result: true }

      case 'removeMedia':
        await removeMedia(data.id)
        return { result: true }

      case 'getAllMediaIds':
        return { result: await getAllMediaIds() }

      case 'getTotalMediaSize':
        return { result: await getTotalMediaSize() }

      case 'clearAllMedia':
        await clearAllMedia()
        return { result: true }

      default:
        return { error: `Unknown action: ${data.action}` }
    }
  } catch (err) {
    console.error('[storage/main] handleAction failed:', data.action, err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

window.addEventListener('message', async (event) => {
  const data = event.data
  if (!data || typeof data !== 'object' || !data[STORAGE_PREFIX]) return
  if (!data.requestId || !data.action) return

  try {
    const { result, error } = await handleAction(data)

    window.parent.postMessage(
      {
        [STORAGE_RESPONSE_PREFIX]: true,
        requestId: data.requestId,
        ...(error !== undefined ? { error } : { result }),
      },
      event.origin || '*',
    )
  } catch (e) {
    console.error('[storage/main] message handler failed:', data?.action, e)
    window.parent.postMessage(
      {
        [STORAGE_RESPONSE_PREFIX]: true,
        requestId: data.requestId,
        error: e instanceof Error ? e.message : String(e),
      },
      event.origin || '*',
    )
  }
})

// ────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────

;(async () => {
  try {
    await requestUnpartitionedStorage()
    await openDB()
    await migrateFromLegacyDatabases()

    window.parent.postMessage(
      {
        [STORAGE_PREFIX]: true,
        action: 'ready',
        storageAccessGranted,
      },
      '*',
    )
  } catch (e) {
    console.error('[storage/main] bootstrap failed:', e)
    window.parent.postMessage(
      {
        [STORAGE_PREFIX]: true,
        action: 'ready',
        storageAccessGranted: false,
        error: e instanceof Error ? e.message : String(e),
      },
      '*',
    )
  }
})()
