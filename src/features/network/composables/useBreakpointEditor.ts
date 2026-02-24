import { ref, computed, watch, type Ref } from 'vue'
import type { HeaderEntry, UrlParam, NetworkEntry, FormDataEntry } from '@/types/network'

export interface BreakpointEditData {
  entryId: string
  method: string
  scheme: string
  host: string
  path: string
  params: UrlParam[]
  requestHeaders: HeaderEntry[]
  requestBody: string | null
  responseHeaders: HeaderEntry[]
  responseBody: string | null
}

export interface BreakpointDraftShape {
  entryId: string
  trigger: 'request' | 'response'
  method: string
  scheme: string
  host: string
  path: string
  params: Array<{ key: string; value: string }>
  requestHeaders: Array<{ name: string; value: string }>
  responseHeaders: Array<{ name: string; value: string }>
  requestBody: string
  responseBody: string
}

interface UseBreakpointEditorOptions {
  entry: () => NetworkEntry
  breakpointMode: () => boolean | undefined
  breakpointTrigger: () => 'request' | 'response' | undefined
  breakpointDraft: () => BreakpointDraftShape | null | undefined
  emitUpdateDraft: (updates: Partial<BreakpointDraftShape>) => void
  bodyFormatMode: Ref<'raw' | 'form-data'>
  editableFormData: Ref<FormDataEntry[]>
  serializeFormDataToDraft: () => string
}

function formatJsonForEdit(text: string | undefined | null): string {
  if (!text) return ''
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return text
  }
}

export function useBreakpointEditor(options: UseBreakpointEditorOptions) {
  const {
    entry,
    breakpointMode,
    breakpointTrigger,
    breakpointDraft,
    emitUpdateDraft,
    bodyFormatMode,
    editableFormData,
    serializeFormDataToDraft,
  } = options

  // Editable refs
  const editableMethod = ref<string>('')
  const editableScheme = ref<string>('')
  const editableHost = ref<string>('')
  const editablePath = ref<string>('')
  const editableParams = ref<UrlParam[]>([])
  const editableRequestHeaders = ref<HeaderEntry[]>([])
  const editableResponseHeaders = ref<HeaderEntry[]>([])
  const editableRequestBody = ref<string>('')
  const editableResponseBody = ref<string>('')

  const initializedEntryId = ref<string | null>(null)
  const activeSection = ref<'url' | 'params' | 'headers' | 'request' | 'response'>('headers')

  // Initialize editable data from DRAFT once when entering breakpoint mode
  watch(
    () => [breakpointMode(), entry()?.id, breakpointDraft()?.entryId],
    () => {
      const draft = breakpointDraft()
      if (breakpointMode() && draft && initializedEntryId.value !== entry()?.id) {
        initializedEntryId.value = entry()?.id || null

        editableMethod.value = draft.method || ''
        editableScheme.value = draft.scheme || ''
        editableHost.value = draft.host || ''
        editablePath.value = draft.path || ''

        editableParams.value = JSON.parse(JSON.stringify(draft.params || []))
        editableRequestHeaders.value = JSON.parse(JSON.stringify(draft.requestHeaders || []))
        editableResponseHeaders.value = JSON.parse(JSON.stringify(draft.responseHeaders || []))

        const hasFormData = entry().requestBody?.formData && entry().requestBody!.formData!.length > 0
        if (hasFormData) {
          bodyFormatMode.value = 'form-data'
          editableFormData.value = JSON.parse(JSON.stringify(entry().requestBody!.formData))
          editableRequestBody.value = ''
        } else {
          bodyFormatMode.value = 'raw'
          editableFormData.value = []
          editableRequestBody.value = formatJsonForEdit(draft.requestBody)
        }
        editableResponseBody.value = formatJsonForEdit(draft.responseBody)

        if (breakpointTrigger() === 'response') {
          activeSection.value = 'response'
        } else if (breakpointTrigger() === 'request') {
          activeSection.value = 'url'
        }
      }

      if (!breakpointMode()) {
        initializedEntryId.value = null
        bodyFormatMode.value = 'raw'
        editableFormData.value = []
      }
    },
    { immediate: true }
  )

  // Computed
  const canEditRequest = computed(() => {
    return breakpointMode() && (breakpointTrigger() === 'request' || breakpointTrigger() === undefined)
  })

  const methodAllowsBody = computed(() => {
    const method = (canEditRequest.value ? editableMethod.value : entry().method)?.toUpperCase()
    return method !== 'GET' && method !== 'HEAD'
  })

  const canEditResponse = computed(() => {
    return breakpointMode() && breakpointTrigger() === 'response'
  })

  const paramsQueryString = computed(() => {
    if (!editableParams.value || editableParams.value.length === 0) return ''
    const params = editableParams.value.filter(p => p.key)
    if (params.length === 0) return ''
    const searchParams = new URLSearchParams()
    params.forEach(p => searchParams.append(p.key, p.value))
    return '?' + searchParams.toString()
  })

  const fullUrlPreview = computed(() => {
    const scheme = editableScheme.value || 'https'
    const host = editableHost.value || ''
    let path = editablePath.value || '/'
    const idx = path.indexOf('?')
    if (idx !== -1) path = path.substring(0, idx)
    return `${scheme}://${host}${path}${paramsQueryString.value}`
  })

  const displayMethod = computed(() => {
    if (canEditRequest.value && editableMethod.value) return editableMethod.value
    return entry().method
  })

  const displayUrl = computed(() => {
    if (canEditRequest.value) return fullUrlPreview.value
    return entry().url
  })

  // Handlers
  function updateUrlField(field: 'method' | 'scheme' | 'host' | 'path', newValue: string) {
    const fieldRef: Record<string, Ref<string>> = {
      method: editableMethod,
      scheme: editableScheme,
      host: editableHost,
      path: editablePath,
    }
    fieldRef[field].value = newValue
    emitUpdateDraft({ [field]: newValue })
  }

  function updateRequestHeader(index: number, field: 'name' | 'value', newValue: string | number | undefined) {
    if (editableRequestHeaders.value[index]) {
      editableRequestHeaders.value[index][field] = String(newValue ?? '')
      emitUpdateDraft({ requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) })
    }
  }

  function updateResponseHeader(index: number, field: 'name' | 'value', newValue: string | number | undefined) {
    if (editableResponseHeaders.value[index]) {
      editableResponseHeaders.value[index][field] = String(newValue ?? '')
      emitUpdateDraft({ responseHeaders: JSON.parse(JSON.stringify(editableResponseHeaders.value)) })
    }
  }

  function updateParam(index: number, field: 'key' | 'value', newValue: string | number | undefined) {
    if (editableParams.value[index]) {
      editableParams.value[index][field] = String(newValue ?? '')
      emitUpdateDraft({ params: JSON.parse(JSON.stringify(editableParams.value)) })
    }
  }

  function addParam() {
    editableParams.value.push({ key: '', value: '' })
    emitUpdateDraft({ params: JSON.parse(JSON.stringify(editableParams.value)) })
  }

  function removeParam(index: number) {
    editableParams.value.splice(index, 1)
    emitUpdateDraft({ params: JSON.parse(JSON.stringify(editableParams.value)) })
  }

  function removeAllParams() {
    editableParams.value = []
    emitUpdateDraft({ params: [] })
  }

  function addRequestHeader() {
    editableRequestHeaders.value.push({ name: '', value: '' })
    emitUpdateDraft({ requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) })
  }

  function removeRequestHeader(index: number) {
    editableRequestHeaders.value.splice(index, 1)
    emitUpdateDraft({ requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) })
  }

  function removeAllRequestHeaders() {
    editableRequestHeaders.value = []
    emitUpdateDraft({ requestHeaders: [] })
  }

  function updateRequestBody(value: string) {
    editableRequestBody.value = value
    emitUpdateDraft({ requestBody: value })
  }

  function updateResponseBody(value: string) {
    editableResponseBody.value = value
    emitUpdateDraft({ responseBody: value })
  }

  function buildApplyData(): BreakpointEditData {
    const requestBody = bodyFormatMode.value === 'form-data'
      ? serializeFormDataToDraft()
      : (editableRequestBody.value || null)

    return {
      entryId: entry().id,
      method: editableMethod.value,
      scheme: editableScheme.value,
      host: editableHost.value,
      path: editablePath.value,
      params: editableParams.value,
      requestHeaders: editableRequestHeaders.value,
      requestBody,
      responseHeaders: editableResponseHeaders.value,
      responseBody: editableResponseBody.value || null,
    }
  }

  return {
    // Refs
    activeSection,
    editableMethod,
    editableScheme,
    editableHost,
    editablePath,
    editableParams,
    editableRequestHeaders,
    editableResponseHeaders,
    editableRequestBody,
    editableResponseBody,
    // Computed
    canEditRequest,
    canEditResponse,
    methodAllowsBody,
    displayMethod,
    displayUrl,
    fullUrlPreview,
    paramsQueryString,
    // Methods
    updateUrlField,
    updateRequestHeader,
    updateResponseHeader,
    updateParam,
    addParam,
    removeParam,
    removeAllParams,
    addRequestHeader,
    removeRequestHeader,
    removeAllRequestHeaders,
    updateRequestBody,
    updateResponseBody,
    buildApplyData,
  }
}
