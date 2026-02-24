import type { NetworkEntry, FormDataEntry } from '@/types/network'

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
    try {
      const parsed = JSON.parse(entry.requestBody.text)
      formattedBody = JSON.stringify(parsed, null, 4)
    } catch {
      // Keep original if not valid JSON
    }
    const escapedBody = formattedBody.replace(/'/g, "'\\''")
    parts.push(`--data '${escapedBody}'`)
  }

  return parts.join(' \\\n')
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
        resolve(false)
      }
    }, 0)
  })
}