import type { NetworkEntry } from '@/types/network'

/**
 * Centrifuge / Centrifugo JSON protocol.
 * An empty object is a server ping or a client pong. A pong without a ping
 * makes the server close the socket with 3501 (bad request). Codes 3500–3999
 * and 4500–4999 are terminal: the client does not reconnect.
 */
/** `{}` is a Centrifuge ping or pong. Whitespace around it is the same frame. */
export function isEmptyJsonObject(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return false
  try {
    const value = JSON.parse(trimmed) as unknown
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0
  } catch {
    return false
  }
}

export function isCentrifugeEntry(entry: Pick<NetworkEntry, 'url' | 'websocket'>): boolean {
  const url = (entry.url || '').toLowerCase()
  if (url.includes('connection/websocket')) return true
  const frames = entry.websocket?.frames
  if (!frames) return false
  for (const frame of frames) {
    if (frame.kind !== 'text') continue
    const text = frame.data.trim()
    if (!text.startsWith('{')) continue
    try {
      const value = JSON.parse(text) as Record<string, unknown>
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      if ('connect' in value || 'push' in value || 'subscribe' in value || 'pub' in value) return true
    } catch {
      /* not JSON */
    }
  }
  return false
}

/** `false` when this Centrifuge close code does not reconnect. Otherwise unknown. */
export function centrifugeWillReconnect(entry: Pick<NetworkEntry, 'url' | 'websocket'>): boolean | undefined {
  if (!isCentrifugeEntry(entry)) return undefined
  const code = entry.websocket?.closeCode
  if (code == null || entry.websocket?.state !== 'closed') return undefined
  if ((code >= 3500 && code <= 3999) || (code >= 4500 && code <= 4999)) return false
  return undefined
}
