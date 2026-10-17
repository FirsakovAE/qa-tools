/**
 * Page-context WebSocket capture.
 * Wraps `window.WebSocket`, records the connection and each sent/received message,
 * and leaves the real socket behavior unchanged.
 *
 * `send` and `close` are replaced by functions the page bridge creates. A throw from the
 * native call (a socket already CLOSING or CLOSED) then stays a page exception.
 */

import { PAGE_ERROR_API, type PageErrorApi } from '../logs/page-error-bridge'

export interface WebSocketFrame {
  id: string
  time: number
  direction: 'sent' | 'received'
  kind: 'text' | 'binary'
  /** Text payload, or a short hex preview for binary */
  data: string
  size: number
  truncated: boolean
  /** The page received this text from a mock rule instead of the server */
  mocked?: boolean
}

export interface WebSocketSnapshot {
  id: string
  url: string
  startTime: number
  version: number
  protocols: string[]
  protocol: string
  state: 'connecting' | 'open' | 'closed'
  closeCode?: number
  closeReason?: string
  error?: string
  frames: WebSocketFrame[]
  droppedFrames: number
  size: number
  duration: number
  pending: boolean
  /** Negotiated Sec-WebSocket-Extensions, from the live socket */
  extensions: string
  binaryType: string
}

interface CaptureOptions {
  isPaused: () => boolean
  onUpdate: (snapshot: WebSocketSnapshot, isNew: boolean) => void
}

interface Connection {
  id: string
  url: string
  startTime: number
  version: number
  protocols: string[]
  protocol: string
  extensions: string
  binaryType: string
  state: 'connecting' | 'open' | 'closed'
  closeCode?: number
  closeReason?: string
  error?: string
  frames: WebSocketFrame[]
  droppedFrames: number
  size: number
  announced: boolean
  seq: number
  socket: WebSocket
}

interface EarlySocketRecord {
  socket: WebSocket
  protocols?: string[]
}

type EarlyWindow = Window & {
  __VUE_INSPECTOR_NATIVE_WS__?: typeof WebSocket
  __VUE_INSPECTOR_WS_SOCKETS__?: Array<WebSocket | EarlySocketRecord>
}

const MAX_FRAMES = 200
const MAX_FRAME_CHARS = 64 * 1024
const FLUSH_MS = 80

let nativeWebSocket: typeof WebSocket | null = null
let patched = false
let options: CaptureOptions | null = null
let seq = 0
let flushTimer = 0
let tickTimer = 0
const connections = new Map<string, Connection>()
const dirty = new Set<string>()
const socketActions = new Map<string, { send: (text: string) => void; receive: (text: string) => void }>()

function protocolList(protocols?: string | string[]): string[] {
  if (protocols == null) return []
  return (Array.isArray(protocols) ? protocols : [protocols]).filter((p) => typeof p === 'string' && p.length > 0)
}

function isExtensionUrl(url: string): boolean {
  return /^(?:chrome|moz|safari-web)-extension:|^chrome-extension:|^moz-extension:/i.test(url)
}

function stringSize(text: string): number {
  if (text.length > 256 * 1024) return text.length
  return new TextEncoder().encode(text).byteLength
}

function hexPreview(bytes: Uint8Array): string {
  const n = Math.min(24, bytes.length)
  const parts: string[] = []
  for (let i = 0; i < n; i++) parts.push(bytes[i].toString(16).padStart(2, '0'))
  const suffix = bytes.length > n ? ' …' : ''
  return parts.join(' ') + suffix
}

function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 1024)
  for (let i = 0; i < n; i++) {
    const b = bytes[i]
    if (b === 0) return false
    if (b < 9 || (b > 13 && b < 32)) return false
  }
  return true
}

function clip(text: string): { data: string; truncated: boolean } {
  if (text.length <= MAX_FRAME_CHARS) return { data: text, truncated: false }
  return { data: text.slice(0, MAX_FRAME_CHARS), truncated: true }
}

async function readData(data: unknown): Promise<{ kind: 'text' | 'binary'; data: string; size: number; truncated: boolean }> {
  if (typeof data === 'string') {
    const clipped = clip(data)
    return { kind: 'text', data: clipped.data, size: stringSize(data), truncated: clipped.truncated }
  }

  let bytes: Uint8Array | null = null
  let size = 0
  let truncated = false

  if (data instanceof ArrayBuffer) {
    size = data.byteLength
    bytes = new Uint8Array(data.byteLength > MAX_FRAME_CHARS ? data.slice(0, MAX_FRAME_CHARS) : data)
    truncated = data.byteLength > MAX_FRAME_CHARS
  } else if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    size = view.byteLength
    const slice = new Uint8Array(view.buffer, view.byteOffset, Math.min(view.byteLength, MAX_FRAME_CHARS))
    bytes = slice
    truncated = view.byteLength > MAX_FRAME_CHARS
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    size = data.size
    truncated = data.size > MAX_FRAME_CHARS
    const buf = await data.slice(0, MAX_FRAME_CHARS).arrayBuffer()
    bytes = new Uint8Array(buf)
  }

  if (!bytes) {
    const text = String(data)
    const clipped = clip(text)
    return { kind: 'text', data: clipped.data, size: text.length, truncated: clipped.truncated }
  }

  if (looksLikeText(bytes)) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    return { kind: 'text', data: text, size, truncated }
  }
  return { kind: 'binary', data: hexPreview(bytes), size, truncated }
}

function snapshotOf(conn: Connection): WebSocketSnapshot {
  const now = Date.now()
  return {
    id: conn.id,
    url: conn.url,
    startTime: conn.startTime,
    version: conn.version,
    protocols: conn.protocols.slice(),
    protocol: conn.protocol,
    state: conn.state,
    closeCode: conn.closeCode,
    closeReason: conn.closeReason,
    error: conn.error,
    frames: conn.frames.map((frame) => ({ ...frame })),
    droppedFrames: conn.droppedFrames,
    size: conn.size,
    duration: Math.max(0, now - conn.startTime),
    pending: conn.state === 'connecting',
    extensions: conn.socket.extensions || conn.extensions || '',
    binaryType: conn.socket.binaryType || conn.binaryType || '',
  }
}

function flush(): void {
  flushTimer = 0
  if (!options || options.isPaused()) {
    dirty.clear()
    return
  }
  for (const id of dirty) {
    const conn = connections.get(id)
    if (!conn) continue
    conn.version += 1
    const isNew = !conn.announced
    try {
      options.onUpdate(snapshotOf(conn), isNew)
      conn.announced = true
    } catch (err) {
      console.error('[injected/network] WebSocket update failed:', err)
    }
    if (conn.state === 'closed') connections.delete(id)
  }
  dirty.clear()
}

function schedule(id: string, immediate = false): void {
  dirty.add(id)
  if (immediate) {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = 0
    }
    flush()
    return
  }
  if (flushTimer) return
  flushTimer = window.setTimeout(flush, FLUSH_MS)
}

function ensureTick(): void {
  if (tickTimer) return
  tickTimer = window.setInterval(() => {
    if (!options || options.isPaused()) return
    let open = 0
    for (const conn of connections.values()) {
      if (conn.state !== 'open') continue
      open += 1
      dirty.add(conn.id)
    }
    if (!open) {
      clearInterval(tickTimer)
      tickTimer = 0
      return
    }
    flush()
  }, 1000)
}

async function pushFrame(conn: Connection, direction: 'sent' | 'received', data: unknown, mocked = false): Promise<void> {
  if (!options || options.isPaused() || conn.state === 'closed') return
  let payload: Awaited<ReturnType<typeof readData>>
  try {
    payload = await readData(data)
  } catch (err) {
    console.error('[injected/network] WebSocket payload read failed:', err)
    return
  }
  if (!options || options.isPaused() || conn.state !== 'connecting' && conn.state !== 'open') return
  conn.seq += 1
  conn.frames.push({
    id: `${conn.id}-${conn.seq}`,
    time: Date.now(),
    direction,
    kind: payload.kind,
    data: payload.data,
    size: payload.size,
    truncated: payload.truncated,
    mocked: mocked || undefined,
  })
  conn.size += payload.size
  while (conn.frames.length > MAX_FRAMES) {
    conn.frames.shift()
    conn.droppedFrames += 1
  }
  schedule(conn.id)
}

let protoPatched = false
let nativeSend: typeof WebSocket.prototype.send | null = null
let nativeAdd: typeof WebSocket.prototype.addEventListener | null = null
let nativeClose: typeof WebSocket.prototype.close | null = null
const tracked = new WeakSet<WebSocket>()
const connectionBySocket = new WeakMap<WebSocket, Connection>()

function stateOf(socket: WebSocket): Connection['state'] {
  if (socket.readyState === WebSocket.OPEN) return 'open'
  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) return 'closed'
  return 'connecting'
}

function observe(socket: WebSocket, protocols?: string | string[]): Connection | null {
  const existing = connectionBySocket.get(socket)
  if (existing) return existing
  if (tracked.has(socket) || !options) return null
  const url = socket.url || ''
  if (!url || isExtensionUrl(url)) {
    tracked.add(socket)
    return null
  }
  const state = stateOf(socket)
  if (state === 'closed') {
    tracked.add(socket)
    return null
  }
  tracked.add(socket)

  const conn: Connection = {
    id: `ws-${Date.now().toString(36)}-${++seq}`,
    url,
    startTime: Date.now(),
    version: 0,
    protocols: protocolList(protocols),
    protocol: socket.protocol || '',
    extensions: socket.extensions || '',
    binaryType: socket.binaryType || '',
    state,
    frames: [],
    droppedFrames: 0,
    size: 0,
    announced: false,
    seq: 0,
    socket,
  }
  connections.set(conn.id, conn)
  connectionBySocket.set(socket, conn)

  const add = nativeAdd ?? socket.addEventListener
  add.call(socket, 'open', () => {
    conn.state = 'open'
    conn.protocol = socket.protocol || ''
    conn.extensions = socket.extensions || ''
    conn.binaryType = socket.binaryType || ''
    conn.error = undefined
    ensureTick()
    schedule(conn.id, true)
  })
  add.call(socket, 'message', (event: Event) => {
    void pushFrame(conn, 'received', (event as MessageEvent).data)
  })
  add.call(socket, 'error', () => {
    if (conn.state === 'connecting') conn.error = 'WebSocket connection failed'
  })
  add.call(socket, 'close', (event: Event) => {
    const closeEvent = event as CloseEvent
    const neverOpened = conn.state === 'connecting'
    conn.state = 'closed'
    conn.closeCode = closeEvent.code
    conn.closeReason = closeEvent.reason || ''
    const clean = closeEvent.code === 1000 || closeEvent.code === 1001 || closeEvent.code === 1005
    if (neverOpened && !clean) conn.error = conn.error || `WebSocket closed (${closeEvent.code})`
    socketActions.delete(conn.id)
    schedule(conn.id, true)
  })

  socketActions.set(conn.id, {
    send: (text) => {
      try {
        socket.send(text)
      } catch (err) {
        // The socket refused the frame (already closing, still connecting). That is the page
        // connection, and the throw already happened in the page script.
        if (err instanceof DOMException) return
        console.error('[injected/network] WebSocket send failed:', err)
      }
    },
    receive: (text) => {
      socket.dispatchEvent(new MessageEvent('message', { data: text }))
    },
  })

  if (conn.state === 'open') ensureTick()
  schedule(conn.id, true)
  return conn
}

function rememberSocket(target: unknown[], value: unknown, depth: number, depthOf: WeakMap<object, number>): void {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return
  if (depthOf.has(value)) return
  depthOf.set(value, depth)
  target.push(value)
}

function findLiveSockets(): WebSocket[] {
  const found: WebSocket[] = []
  const seen = new WeakSet<object>()
  const depthOf = new WeakMap<object, number>()
  const queue: unknown[] = [window]
  depthOf.set(window, 0)
  try {
    const count = window.frames.length
    for (let i = 0; i < count; i++) {
      try {
        rememberSocket(queue, window.frames[i], 1, depthOf)
      } catch {
        /* cross-origin frame */
      }
    }
  } catch (err) {
    console.error('[injected/network] WebSocket frame walk failed:', err)
  }
  const roots = [document.documentElement, document.body, document.getElementById('app')]
  for (const node of roots) {
    if (!node) continue
    const holder = node as unknown as { __vue_app__?: unknown; __vueParentComponent?: unknown }
    rememberSocket(queue, holder.__vue_app__, 1, depthOf)
    rememberSocket(queue, holder.__vueParentComponent, 1, depthOf)
  }

  let visited = 0
  while (queue.length && visited < 4000) {
    const current = queue.shift()
    if (!current || (typeof current !== 'object' && typeof current !== 'function')) continue
    if (seen.has(current)) continue
    seen.add(current)
    visited += 1
    if (current instanceof WebSocket) {
      found.push(current)
      continue
    }
    if (typeof Node !== 'undefined' && current instanceof Node) continue
    const depth = depthOf.get(current) ?? 0
    if (depth >= 6) continue
    let names: string[] = []
    try {
      names = Object.keys(current as object)
    } catch (err) {
      console.error('[injected/network] WebSocket property walk failed:', err)
      continue
    }
    const limit = current === window ? names.length : Math.min(names.length, 40)
    for (let i = 0; i < limit; i++) {
      let value: unknown
      try {
        value = (current as Record<string, unknown>)[names[i]]
      } catch {
        continue
      }
      rememberSocket(queue, value, depth + 1, depthOf)
    }
  }
  return found
}

function adoptExisting(): void {
  const early = (window as EarlyWindow).__VUE_INSPECTOR_WS_SOCKETS__
  if (Array.isArray(early)) {
    for (const item of early) {
      const socket = item instanceof WebSocket ? item : item?.socket
      const protocols = item instanceof WebSocket ? undefined : item?.protocols
      if (socket instanceof WebSocket) observe(socket, protocols)
    }
  }
  for (const socket of findLiveSockets()) observe(socket)
}

function installPrototype(Native: typeof WebSocket): void {
  if (protoPatched) return
  nativeSend = Native.prototype.send
  nativeAdd = Native.prototype.addEventListener
  nativeClose = Native.prototype.close
  const send = nativeSend
  const add = nativeAdd
  const close = nativeClose

  const hooks: Parameters<NonNullable<PageErrorApi['bindWebSocket']>>[0] = {
    nativeSend: send,
    nativeClose: close,
    beforeSend(socket) {
      try {
        return observe(socket)
      } catch (err) {
        console.error('[injected/network] WebSocket observe failed:', err)
        return null
      }
    },
    afterSend(ctx, data) {
      void pushFrame(ctx as Connection, 'sent', data)
    },
    beforeClose(socket) {
      try {
        observe(socket)
      } catch (err) {
        console.error('[injected/network] WebSocket observe failed:', err)
      }
    },
  }
  const bridge = (window as Window & { [PAGE_ERROR_API]?: PageErrorApi })[PAGE_ERROR_API]
  if (typeof bridge?.bindWebSocket === 'function') {
    bridge.bindWebSocket(hooks)
  } else {
    Native.prototype.send = function (this: WebSocket, data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      const conn = hooks.beforeSend(this) as Connection | null
      send.call(this, data)
      if (conn) hooks.afterSend(conn, data)
    }
    Native.prototype.close = function (this: WebSocket, code?: number, reason?: string): void {
      hooks.beforeClose(this)
      close.call(this, code, reason)
    }
  }
  Native.prototype.addEventListener = function (this: WebSocket, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    try {
      if (this instanceof WebSocket) observe(this)
    } catch (err) {
      console.error('[injected/network] WebSocket observe failed:', err)
    }
    add.call(this, type, listener as EventListenerOrEventListenerObject, options)
  } as typeof Native.prototype.addEventListener

  protoPatched = true
}

function restorePrototype(Native: typeof WebSocket): void {
  if (!protoPatched || !nativeSend || !nativeAdd || !nativeClose) return
  Native.prototype.send = nativeSend
  Native.prototype.addEventListener = nativeAdd
  Native.prototype.close = nativeClose
  protoPatched = false
}

/**
 * Send a message on an open socket, or deliver one to the page as if the server sent it.
 */
export function pushWebSocketFrame(connectionId: string, direction: 'sent' | 'received', text: string): boolean {
  const action = socketActions.get(connectionId)
  if (!action) return false
  if (direction === 'sent') action.send(text)
  else action.receive(text)
  return true
}

/**
 * Install the page WebSocket wrapper. Safe to call again after {@link restoreWebSocketCapture}.
 * Also attaches to sockets opened before the inspector, including ones recorded at document start.
 */
export function installWebSocketCapture(next: CaptureOptions): void {
  options = next
  if (typeof window.WebSocket !== 'function') return
  const earlyNative = (window as EarlyWindow).__VUE_INSPECTOR_NATIVE_WS__
  const Native = nativeWebSocket || earlyNative || window.WebSocket
  nativeWebSocket = Native
  installPrototype(Native)

  if (!patched) {
    function PatchedWebSocket(this: unknown, url: string | URL, protocols?: string | string[]): WebSocket {
      if (!new.target) {
        throw new TypeError("Failed to construct 'WebSocket': Please use the 'new' operator, this DOM object constructor cannot be called as a function.")
      }
      const socket = protocols === undefined ? new Native(url) : new Native(url, protocols)
      try {
        observe(socket, protocols)
      } catch (err) {
        console.error('[injected/network] WebSocket track failed:', err)
      }
      return socket
    }

    PatchedWebSocket.prototype = Native.prototype
    Object.setPrototypeOf(PatchedWebSocket, Native)
    try {
      Object.defineProperty(Native.prototype, 'constructor', {
        value: PatchedWebSocket,
        configurable: true,
        writable: true,
      })
    } catch (err) {
      console.error('[injected/network] WebSocket constructor patch failed:', err)
    }

    window.WebSocket = PatchedWebSocket as unknown as typeof WebSocket
    patched = true
  }

  try {
    adoptExisting()
  } catch (err) {
    console.error('[injected/network] WebSocket adopt failed:', err)
  }
}

/** Restore the native constructor. Sockets already opened stay observed. */
export function restoreWebSocketCapture(): void {
  if (!nativeWebSocket) return
  const Native = nativeWebSocket
  restorePrototype(Native)
  if (!patched) return
  try {
    Object.defineProperty(Native.prototype, 'constructor', {
      value: Native,
      configurable: true,
      writable: true,
    })
  } catch (err) {
    console.error('[injected/network] WebSocket constructor restore failed:', err)
  }
  window.WebSocket = Native
  patched = false
}

/**
 * Drop stored messages and publish open sockets again.
 * Used when the Network list is cleared.
 */
export function resetWebSocketLog(): void {
  for (const conn of connections.values()) {
    conn.frames = []
    conn.droppedFrames = 0
    conn.size = 0
    conn.announced = false
    conn.version = 0
    if (conn.state === 'closed') connections.delete(conn.id)
    else dirty.add(conn.id)
  }
  if (dirty.size) schedule([...dirty][0], true)
}
