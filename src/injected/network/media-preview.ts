/**
 * Binary response summary for Network and Logs.
 * The file itself is not kept. The record is the format label and, separately, the byte size.
 */

export interface MediaInfo {
  /** Short label: PNG, JPEG, PDF */
  format: string
}

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
