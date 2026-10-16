/**
 * Binary response summary for Network and Logs.
 * Previewable images keep a data URL for the live UI. The HTML report drops that URL.
 */

export interface MediaInfo {
  /** Short label shown in the UI: PNG, JPEG, PDF */
  format: string
  width?: number
  height?: number
  /** Live preview only. Omitted from the HTML report. */
  dataUrl?: string
}

const PREVIEW_MAX_BYTES = 8 * 1024 * 1024

const BINARY_PREFIXES = [
  'image/',
  'audio/',
  'video/',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
]

const PREVIEWABLE = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/x-ms-bmp',
  'image/svg+xml',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

const FORMAT_LABELS: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
  'image/svg+xml': 'SVG',
  'image/bmp': 'BMP',
  'image/x-ms-bmp': 'BMP',
  'image/avif': 'AVIF',
  'image/x-icon': 'ICO',
  'image/vnd.microsoft.icon': 'ICO',
  'image/tiff': 'TIFF',
  'audio/mpeg': 'MP3',
  'audio/mp3': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/ogg': 'OGG',
  'audio/webm': 'WEBM',
  'video/mp4': 'MP4',
  'video/webm': 'WEBM',
  'video/ogg': 'OGV',
  'application/pdf': 'PDF',
  'application/zip': 'ZIP',
  'application/gzip': 'GZIP',
  'application/x-gzip': 'GZIP',
  'application/x-tar': 'TAR',
  'application/octet-stream': 'BIN',
}

export function isBinaryContentType(contentType: string): boolean {
  const mime = mimeOf(contentType)
  return BINARY_PREFIXES.some(type => mime.startsWith(type))
}

export function isPreviewableImage(mime: string): boolean {
  return PREVIEWABLE.has(mime)
}

export function mediaFormatLabel(contentType: string): string {
  const mime = mimeOf(contentType)
  if (FORMAT_LABELS[mime]) return FORMAT_LABELS[mime]
  const sub = mime.split('/')[1] || ''
  const clean = sub.replace(/^x-/, '').replace(/^vnd\./, '').split('+')[0]
  return (clean || 'FILE').toUpperCase()
}

function mimeOf(contentType: string): string {
  const mime = contentType.split(';')[0].trim().toLowerCase()
  return mime === 'image/jpg' ? 'image/jpeg' : mime
}

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 256))).trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml'
  return null
}

export function resolveMime(contentType: string, bytes?: Uint8Array): string {
  const mime = mimeOf(contentType)
  if (mime.startsWith('image/')) return mime
  if (bytes && (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream')) {
    return sniffImageMime(bytes) || mime
  }
  return mime
}

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

export function imageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png' && bytes.length >= 24 && bytes[0] === 0x89) {
    const width = u32be(bytes, 16)
    const height = u32be(bytes, 20)
    return width && height ? { width, height } : null
  }
  if (mime === 'image/gif' && bytes.length >= 10 && bytes[0] === 0x47) {
    const width = u16le(bytes, 6)
    const height = u16le(bytes, 8)
    return width && height ? { width, height } : null
  }
  if (mime === 'image/bmp' || mime === 'image/x-ms-bmp') {
    if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null
    let width = (bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24)) | 0
    let height = (bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24)) | 0
    if (width < 0) width = -width
    if (height < 0) height = -height
    return width && height ? { width, height } : null
  }
  if (mime === 'image/jpeg') return jpegSize(bytes)
  if (mime === 'image/webp') return webpSize(bytes)
  if (mime === 'image/svg+xml') return svgSize(bytes)
  return null
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xff) {
      offset++
      continue
    }
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = u16be(bytes, offset + 5)
      const width = u16be(bytes, offset + 7)
      return width && height ? { width, height } : null
    }
    if (offset + 3 >= bytes.length) break
    const length = u16be(bytes, offset + 2)
    if (length < 2) break
    offset += 2 + length
  }
  return null
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || sniffImageMime(bytes) !== 'image/webp') return null
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return { width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) }
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    const start = 23
    if (bytes[start] === 0x9d && bytes[start + 1] === 0x01 && bytes[start + 2] === 0x2a) {
      const width = u16le(bytes, start + 3) & 0x3fff
      const height = u16le(bytes, start + 5) & 0x3fff
      return width && height ? { width, height } : null
    }
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  return null
}

function svgSize(bytes: Uint8Array): { width: number; height: number } | null {
  const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
  const width = text.match(/\bwidth=["']\s*([\d.]+)/i)
  const height = text.match(/\bheight=["']\s*([\d.]+)/i)
  if (width && height) {
    const w = Math.round(parseFloat(width[1]))
    const h = Math.round(parseFloat(height[1]))
    if (w && h) return { width: w, height: h }
  }
  const viewBox = text.match(/\bviewBox=["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.]+)\s+([\d.]+)/i)
  if (!viewBox) return null
  const w = Math.round(parseFloat(viewBox[1]))
  const h = Math.round(parseFloat(viewBox[2]))
  return w && h ? { width: w, height: h } : null
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  const step = 0x2000
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, i + step)
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  return `data:${mime};base64,${btoa(binary)}`
}

async function measureBlob(blob: Blob): Promise<{ width: number; height: number } | null> {
  const create = (globalThis as { createImageBitmap?: (blob: Blob) => Promise<{ width: number; height: number; close?: () => void }> }).createImageBitmap
  if (typeof create !== 'function') return null
  try {
    const bitmap = await create(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return size.width && size.height ? size : null
  } catch {
    return null
  }
}

/** Format, pixel size and, for a supported image that fits the cap, a data URL. */
export async function captureResponseMedia(blob: Blob, contentType: string): Promise<{ media: MediaInfo; byteLength: number }> {
  const byteLength = blob.size
  const headLen = Math.min(byteLength, 512 * 1024)
  const head = new Uint8Array(await blob.slice(0, headLen).arrayBuffer())
  const mime = resolveMime(contentType, head)
  const format = mediaFormatLabel(mime)
  if (!isPreviewableImage(mime)) return { media: { format }, byteLength }

  const dims = imageDimensions(head, mime)
  let width = dims?.width
  let height = dims?.height
  if (byteLength > PREVIEW_MAX_BYTES || byteLength === 0) {
    return { media: { format, width, height }, byteLength }
  }

  const bytes = headLen === byteLength ? head : new Uint8Array(await blob.arrayBuffer())
  if (!width || !height) {
    const measured = await measureBlob(blob)
    width = measured?.width
    height = measured?.height
  }
  return { media: { format, width, height, dataUrl: bytesToDataUrl(bytes, mime) }, byteLength }
}
