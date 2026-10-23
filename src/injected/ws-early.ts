/**
 * Runs at document_start in the page world, before the site opens sockets.
 * Keeps the live WebSocket objects so the inspector can attach after it starts.
 */
;(() => {
  // The default buffer keeps 250 resources: on a busy page API calls push out the lazy chunks the assistant reads
  try {
    performance.setResourceTimingBufferSize(5000)
  } catch {
    /* not supported */
  }
})()

;(() => {
  const page = window as Window & {
    __VUE_INSPECTOR_NATIVE_WS__?: typeof WebSocket
    __VUE_INSPECTOR_WS_SOCKETS__?: Array<{ socket: WebSocket; protocols: string[] }>
  }
  if (page.__VUE_INSPECTOR_NATIVE_WS__ || typeof window.WebSocket !== 'function') return
  const Native = window.WebSocket
  const list: Array<{ socket: WebSocket; protocols: string[] }> = []
  page.__VUE_INSPECTOR_NATIVE_WS__ = Native
  page.__VUE_INSPECTOR_WS_SOCKETS__ = list

  function offered(protocols?: string | string[]): string[] {
    if (typeof protocols === 'string') return protocols ? [protocols] : []
    if (!protocols || !protocols.length) return []
    return Array.prototype.slice.call(protocols)
  }

  function Patched(this: unknown, url: string | URL, protocols?: string | string[]): WebSocket {
    if (!new.target) {
      throw new TypeError("Failed to construct 'WebSocket': Please use the 'new' operator, this DOM object constructor cannot be called as a function.")
    }
    const socket = protocols === undefined ? new Native(url) : new Native(url, protocols)
    const record = { socket, protocols: offered(protocols) }
    list.push(record)
    socket.addEventListener('close', () => {
      const index = list.indexOf(record)
      if (index !== -1) list.splice(index, 1)
    })
    return socket
  }

  Patched.prototype = Native.prototype
  Object.setPrototypeOf(Patched, Native)
  try {
    Object.defineProperty(Native.prototype, 'constructor', {
      value: Patched,
      configurable: true,
      writable: true,
    })
  } catch {
    /* the inspector install replaces this constructor again */
  }
  window.WebSocket = Patched as unknown as typeof WebSocket
})()
