/**
 * Storage Client
 *
 * Runs inside the UI iframe. Creates a hidden child iframe pointing at
 * the storage page (same origin) and communicates with it via postMessage.
 *
 * All operations queue until the storage iframe reports "ready".
 */

import {
  STORAGE_PREFIX,
  STORAGE_RESPONSE_PREFIX,
} from './storage-protocol'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const REQUEST_TIMEOUT_MS = 10_000

export class StorageClient {
  private iframe: HTMLIFrameElement | null = null
  private pending = new Map<string, PendingRequest>()
  private counter = 0
  private readyResolve!: () => void
  private readyPromise: Promise<void>
  private origin: string
  private listener: ((e: MessageEvent) => void) | null = null
  private _storageAccessGranted = false

  constructor(storageUrl: string) {
    this.origin = new URL(storageUrl).origin
    this.readyPromise = new Promise((r) => { this.readyResolve = r })
    this.setupListener()
    this.createIframe(storageUrl)
  }

  /** Resolves when the storage iframe has initialized IndexedDB and is ready. */
  get ready(): Promise<void> {
    return this.readyPromise
  }

  /**
   * Whether the Storage Access API granted unpartitioned storage.
   * If false, each top-level site gets its own isolated IndexedDB.
   */
  get isSharedAcrossSites(): boolean {
    return this._storageAccessGranted
  }

  // ── Settings ──────────────────────────

  async getSettings(key = 'inspector-settings'): Promise<unknown> {
    return this.send('getSettings', { key })
  }

  async setSettings(data: unknown, key = 'inspector-settings'): Promise<void> {
    await this.send('setSettings', { key, data })
  }

  async removeSettings(key = 'inspector-settings'): Promise<void> {
    await this.send('removeSettings', { key })
  }

  // ── Media ─────────────────────────────

  async getMedia(id: string): Promise<Blob | null> {
    const result = await this.send('getMedia', { id })
    return result instanceof Blob ? result : null
  }

  async setMedia(id: string, blob: Blob): Promise<void> {
    await this.send('setMedia', { id, blob })
  }

  async removeMedia(id: string): Promise<void> {
    await this.send('removeMedia', { id })
  }

  async getAllMediaIds(): Promise<string[]> {
    return (await this.send('getAllMediaIds')) as string[]
  }

  async getTotalMediaSize(): Promise<number> {
    return (await this.send('getTotalMediaSize')) as number
  }

  async clearAllMedia(): Promise<void> {
    await this.send('clearAllMedia')
  }

  // ── Lifecycle ─────────────────────────

  destroy(): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
    if (this.iframe) {
      this.iframe.remove()
      this.iframe = null
    }
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer)
      reject(new Error('StorageClient destroyed'))
    }
    this.pending.clear()
  }

  // ── Internal ──────────────────────────

  private createIframe(url: string): void {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = url
    document.body.appendChild(iframe)
    this.iframe = iframe
  }

  private setupListener(): void {
    this.listener = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return

      // "ready" signal from storage iframe
      if (data[STORAGE_PREFIX] && data.action === 'ready') {
        this._storageAccessGranted = !!data.storageAccessGranted
        this.readyResolve()
        return
      }

      // Response to a pending request
      if (data[STORAGE_RESPONSE_PREFIX] && data.requestId) {
        const entry = this.pending.get(data.requestId)
        if (!entry) return
        this.pending.delete(data.requestId)
        clearTimeout(entry.timer)

        if (data.error) {
          entry.reject(new Error(data.error))
        } else {
          entry.resolve(data.result)
        }
      }
    }

    window.addEventListener('message', this.listener)
  }

  private async send(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    await this.readyPromise

    const requestId = `s_${++this.counter}_${Date.now()}`

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`Storage timeout: ${action}`))
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(requestId, { resolve, reject, timer })

      this.iframe!.contentWindow!.postMessage(
        { [STORAGE_PREFIX]: true, requestId, action, ...payload },
        this.origin,
      )
    })
  }
}

// ── Singleton management ────────────────

let _client: StorageClient | null = null

export function createStorageClient(storageUrl: string): StorageClient {
  if (_client) _client.destroy()
  _client = new StorageClient(storageUrl)
  return _client
}

export function getStorageClient(): StorageClient | null {
  return _client
}
