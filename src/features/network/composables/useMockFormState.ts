import { ref, computed, watch } from 'vue'
import type { NetworkEntry } from '@/types/network'
import type { MockRule, MockHeaderEntry, BaseInspectorSettings } from '@/types/inspector'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { parseUrl, buildUrlPreview, getStatusClass, formatJson, generateId } from '../utils'

export const HTTP_STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

interface UseMockFormStateOptions {
  entry: () => NetworkEntry
  existingMock: () => MockRule | undefined
  emitConfirm: (mock: MockRule) => void
}

export function useMockFormState(options: UseMockFormStateOptions) {
  const { entry, existingMock, emitConfirm } = options

  type SectionId = 'matching' | 'response' | 'headers'
  const activeSection = ref<SectionId>('response')

  const settings = ref<BaseInspectorSettings | null>(null)
  const jsonMode = ref<'text' | 'tree'>('text')

  const isRewrite = computed(() => !!existingMock())

  watch(
    () => entry(),
    async () => {
      try {
        settings.value = await useInspectorSettings()
        jsonMode.value = settings.value?.json?.mode ?? 'text'
      } catch { /* use defaults */ }
    },
    { immediate: true }
  )

  // URL Matching fields
  const scheme = ref('')
  const host = ref('')
  const port = ref('')
  const path = ref('')
  const query = ref('')
  const method = ref('')

  // Response fields
  const status = ref(200)
  const statusText = ref('')
  const statusTextManuallyEdited = ref(false)
  const responseBody = ref('')
  const responseHeaders = ref<MockHeaderEntry[]>([])
  const delay = ref(0)
  const description = ref('')

  const statusTextPlaceholder = computed(() => HTTP_STATUS_TEXT[status.value] || 'OK')

  const effectiveStatusText = computed(() => {
    if (statusText.value.trim()) return statusText.value
    return statusTextPlaceholder.value
  })

  function handleStatusTextChange(value: string | number | undefined) {
    const strValue = String(value ?? '')
    statusText.value = strValue
    if (strValue.trim()) statusTextManuallyEdited.value = true
  }

  function handleStatusCodeChange(value: string | number | undefined) {
    const strValue = String(value ?? '')
    const numValue = parseInt(strValue, 10)
    if (!isNaN(numValue) && numValue >= 100 && numValue <= 599) {
      status.value = numValue
    } else if (strValue === '') {
      status.value = 200
    }
  }

  function fillFromEntry(e: NetworkEntry) {
    const parsed = parseUrl(e.url)
    scheme.value = parsed.scheme
    host.value = parsed.host
    port.value = parsed.port
    path.value = parsed.path
    query.value = parsed.query
    method.value = e.method

    status.value = e.status || 200
    const expectedText = HTTP_STATUS_TEXT[e.status || 200]
    if (e.statusText && e.statusText !== expectedText) {
      statusText.value = e.statusText
      statusTextManuallyEdited.value = true
    } else {
      statusText.value = ''
      statusTextManuallyEdited.value = false
    }

    responseBody.value = e.responseBody?.text ? formatJson(e.responseBody.text) : ''
    responseHeaders.value = e.responseHeaders.map(h => ({ name: h.name, value: h.value }))
    const hasContentType = responseHeaders.value.some(h => h.name.toLowerCase() === 'content-type')
    if (!hasContentType) {
      responseHeaders.value.unshift({ name: 'Content-Type', value: 'application/json' })
    }

    delay.value = 0
    description.value = `Mock for ${e.method} ${e.path}`
  }

  function fillFromExisting(mock: MockRule) {
    scheme.value = mock.scheme || ''
    host.value = mock.host || ''
    port.value = mock.port || ''
    path.value = mock.path || ''
    query.value = mock.query || ''
    method.value = mock.method || ''

    status.value = mock.status || 200
    const expectedText = HTTP_STATUS_TEXT[mock.status || 200]
    if (mock.statusText && mock.statusText !== expectedText) {
      statusText.value = mock.statusText
      statusTextManuallyEdited.value = true
    } else {
      statusText.value = ''
      statusTextManuallyEdited.value = false
    }

    responseBody.value = mock.body !== undefined ? formatJson(mock.body) : ''
    responseHeaders.value = (mock.headers || []).map(h => ({ name: h.name, value: h.value }))

    delay.value = mock.delay || 0
    description.value = mock.description || ''
  }

  // Initialize when entry/existingMock changes
  watch(
    [() => entry(), () => existingMock()],
    ([e, existing]) => {
      if (existing) {
        fillFromExisting(existing)
      } else if (e) {
        fillFromEntry(e)
      }
      activeSection.value = 'response'
    },
    { immediate: true }
  )

  // Header operations
  function addHeader() {
    responseHeaders.value.push({ name: '', value: '' })
  }

  function removeHeader(index: number) {
    responseHeaders.value.splice(index, 1)
  }

  function removeAllHeaders() {
    responseHeaders.value = []
  }

  // Validation & computed
  const isValid = computed(() => {
    return host.value.trim() !== '' && status.value >= 100 && status.value < 600
  })

  const urlPreview = computed(() => {
    return buildUrlPreview(scheme.value, host.value, port.value, path.value, query.value)
  })

  const statusClass = computed(() => {
    return getStatusClass(entry().status, entry().pending)
  })

  const sections: Array<{ id: SectionId; label: string }> = [
    { id: 'matching', label: 'URL Matching' },
    { id: 'response', label: 'Response' },
    { id: 'headers', label: 'Headers' },
  ]

  function handleConfirm() {
    if (!entry() || !isValid.value) return

    const trimmedBody = responseBody.value.trim()
    const hasBody = trimmedBody !== ''
    const bodyValue = hasBody ? responseBody.value : undefined

    const filteredHeaders = responseHeaders.value.filter(h => {
      if (h.name.trim() === '') return false
      if (!hasBody && h.name.toLowerCase() === 'content-type') return false
      return true
    })

    const mock: MockRule = {
      id: existingMock()?.id ?? generateId('mock'),
      enabled: existingMock()?.enabled ?? true,
      scheme: scheme.value || undefined,
      host: host.value || undefined,
      port: port.value || undefined,
      path: path.value || undefined,
      query: query.value || undefined,
      method: method.value || undefined,
      status: status.value,
      statusText: effectiveStatusText.value,
      headers: filteredHeaders,
      body: bodyValue,
      delay: delay.value > 0 ? delay.value : undefined,
      timestamp: new Date().toISOString(),
      description: description.value || undefined,
    }

    emitConfirm(mock)
  }

  return {
    activeSection,
    jsonMode,
    isRewrite,
    // URL fields
    scheme,
    host,
    port,
    path,
    query,
    method,
    // Response fields
    status,
    statusText,
    statusTextPlaceholder,
    effectiveStatusText,
    responseBody,
    responseHeaders,
    delay,
    description,
    // Computed
    isValid,
    urlPreview,
    statusClass,
    sections,
    // Methods
    handleStatusTextChange,
    handleStatusCodeChange,
    addHeader,
    removeHeader,
    removeAllHeaders,
    handleConfirm,
  }
}
