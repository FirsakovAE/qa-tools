import type { NetworkEntry } from '@/types/network'
import { looksLikeJsonValue } from '@/utils/jsonGuards'

/**
 * Generate cURL command from network entry
 */
export function buildCurlCommand(entry: NetworkEntry): string {
  const parts: string[] = ['curl']

  const isFormData = entry.requestBody?.formData && entry.requestBody.formData.length > 0

  // --location for form-data requests (Postman style)
  if (isFormData) {
    parts.push('--location')
  }

  // Method (skip for GET; for form-data POST is implied by --form)
  if (entry.method !== 'GET' && !(isFormData && entry.method === 'POST')) {
    parts.push(`-X ${entry.method}`)
  }

  // URL
  parts.push(`'${entry.url}'`)

  // Headers (skip content-type for form-data — curl sets it automatically)
  for (const header of entry.requestHeaders) {
    if (header.name.startsWith(':')) continue
    if (header.name.toLowerCase() === 'content-length') continue
    if (isFormData && header.name.toLowerCase() === 'content-type') continue

    const escapedValue = header.value.replace(/'/g, "'\\''")
    parts.push(`-H '${header.name}: ${escapedValue}'`)
  }

  // Body
  if (isFormData) {
    for (const fd of entry.requestBody!.formData!) {
      if (fd.type === 'file') {
        const name = fd.fileName || fd.value || 'file'
        parts.push(`--form '${fd.key}=@"${name}"'`)
      } else {
        const escaped = fd.value.replace(/'/g, "'\\''")
        parts.push(`--form '${fd.key}="${escaped}"'`)
      }
    }
  } else if (entry.requestBody?.text) {
    let formattedBody = entry.requestBody.text
    const ct = entry.requestBody.contentType?.toLowerCase() ?? ''
    const tryPrettify =
      entry.requestBody.text.trim().length > 0 &&
      (ct.includes('json') || looksLikeJsonValue(entry.requestBody.text))
    if (tryPrettify) {
      try {
        const parsed = JSON.parse(entry.requestBody.text)
        formattedBody = JSON.stringify(parsed, null, 4)
      } catch {
        /* plain text or invalid JSON — use raw body */
      }
    }
    const escapedBody = formattedBody.replace(/'/g, "'\\''")
    parts.push(`--data '${escapedBody}'`)
  }

  return parts.join(' \\\n')
}

/**
 * Copy text to clipboard with fallback for permission issues
 */
// ============================================================================
// Postman Collection Export
// ============================================================================

interface PostmanHeader {
  key: string
  value: string
}

interface PostmanUrl {
  raw: string
  protocol: string
  host: string[]
  path: string[]
  query?: { key: string; value: string }[]
}

interface PostmanFormDataEntry {
  type: 'text' | 'file'
  key: string
  value?: string
  src?: string
}

interface PostmanRawBody {
  mode: 'raw'
  raw: string
  options?: { raw: { language: string } }
}

interface PostmanFormDataBody {
  mode: 'formdata'
  formdata: PostmanFormDataEntry[]
}

type PostmanRequestBody = PostmanRawBody | PostmanFormDataBody

interface PostmanRequest {
  method: string
  header: PostmanHeader[]
  url: PostmanUrl
  body?: PostmanRequestBody
}

interface PostmanItem {
  name: string
  request: PostmanRequest
  response: never[]
}

interface PostmanCollection {
  info: {
    _postman_id: string
    name: string
    schema: string
  }
  item: PostmanItem[]
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function parseUrlForPostman(rawUrl: string): PostmanUrl {
  try {
    const urlObj = new URL(rawUrl)
    const host = urlObj.hostname.split('.')
    const path = urlObj.pathname.split('/').filter(Boolean)
    const result: PostmanUrl = {
      raw: rawUrl,
      protocol: urlObj.protocol.replace(':', ''),
      host,
      path,
    }
    if (urlObj.search) {
      result.query = []
      urlObj.searchParams.forEach((value, key) => {
        result.query!.push({ key, value })
      })
    }
    return result
  } catch (e) {
    console.error('[utils/networkUtils] parseUrlForPostman failed:', rawUrl, e)
    return { raw: rawUrl, protocol: 'https', host: [], path: [] }
  }
}

function entryToPostmanItem(entry: NetworkEntry): PostmanItem {
  const isFormData = entry.requestBody?.formData && entry.requestBody.formData.length > 0

  const headers: PostmanHeader[] = entry.requestHeaders
    .filter(h => !h.name.startsWith(':'))
    .filter(h => !(isFormData && h.name.toLowerCase() === 'content-type'))
    .map(h => ({ key: h.name, value: h.value }))

  const request: PostmanRequest = {
    method: entry.method,
    header: headers,
    url: parseUrlForPostman(entry.url),
  }

  if (isFormData) {
    request.body = {
      mode: 'formdata',
      formdata: entry.requestBody!.formData!.map((fd) => {
        if (fd.type === 'file') {
          return { type: 'file', key: fd.key, src: fd.fileName || fd.value || 'file' }
        }
        return { type: 'text', key: fd.key, value: fd.value }
      }),
    }
  } else if (entry.requestBody?.text) {
    const isJson = entry.requestBody.contentType?.toLowerCase().includes('json')
    let raw = entry.requestBody.text
    if (isJson && raw.trim()) {
      try {
        raw = JSON.stringify(JSON.parse(raw), null, 4).replace(/\n/g, '\r\n')
      } catch {
        /* declared JSON but malformed — keep raw string */
      }
    }
    request.body = {
      mode: 'raw',
      raw,
    }
    if (isJson) {
      request.body.options = { raw: { language: 'json' } }
    }
  }

  return {
    name: entry.name,
    request,
    response: [],
  }
}

export function buildPostmanCollection(entries: NetworkEntry[], name?: string): PostmanCollection {
  return {
    info: {
      _postman_id: generateUUID(),
      name: name ?? 'Exported Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: entries.map(entryToPostmanItem),
  }
}

export function downloadPostmanCollection(entries: NetworkEntry[], name?: string): void {
  try {
    const collection = buildPostmanCollection(entries, name)
    const json = JSON.stringify(collection, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collection.info.name.replace(/\s+/g, '_')}.postman_collection.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[utils/networkUtils] downloadPostmanCollection failed:', e)
  }
}

/**
 * Copy text to clipboard with fallback for permission issues
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Use setTimeout to break out of current execution context (important for portals/dropdowns)
  return new Promise((resolve) => {
    setTimeout(async () => {
      // Try execCommand first (works in iframes without permissions and dropdown contexts)
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        textArea.style.opacity = '0'
        // Ensure textarea is properly attached to document body
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textArea)
        resolve(success)
      } catch (error) {
        console.error('[utils/networkUtils] copyToClipboard failed:', error)
        resolve(false)
      }
    }, 0)
  })
}