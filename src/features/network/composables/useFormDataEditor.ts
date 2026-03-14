import { ref, computed, watch } from 'vue'
import type { FormDataEntry, NetworkEntry } from '@/types/network'
import type { BaseInspectorSettings } from '@/types/inspector'
import { copyToClipboard } from '@/utils/networkUtils'
import { addMedia, dataUriToBlob } from '@/settings/mediaStore'

const FILE_ID_PREFIX = '__fileId:'
type BodyFormatMode = 'raw' | 'form-data'

export interface FileOption {
  id: string
  label: string
}

interface UseFormDataEditorOptions {
  entry: () => NetworkEntry
  emitUpdateDraft: (updates: Record<string, unknown>) => void
  editableRequestBody: () => string
  settings: () => BaseInspectorSettings | null
}

export function useFormDataEditor(options: UseFormDataEditorOptions) {
  const { entry, emitUpdateDraft, editableRequestBody, settings } = options

  const bodyFormatMode = ref<BodyFormatMode>('raw')
  const editableFormData = ref<FormDataEntry[]>([])
  const copiedFormDataIndex = ref<number | null>(null)

  const originalFileInfoByKey = ref<Record<string, {
    fileName: string
    fileSize?: number
    fileType?: string
  }>>({})

  watch(editableFormData, (entries) => {
    const newOriginals: Record<string, { fileName: string; fileSize?: number; fileType?: string }> = {}
    for (const fd of entries) {
      if (fd.type === 'file' && fd.value === '(binary)' && fd.fileName) {
        newOriginals[fd.key] = {
          fileName: fd.fileName,
          fileSize: fd.fileSize,
          fileType: fd.fileType,
        }
      }
    }
    if (Object.keys(newOriginals).length > 0) {
      originalFileInfoByKey.value = newOriginals
    }
  })

  // ---------- serialization ----------

  function serializeFormDataToDraft(): string {
    return JSON.stringify({ __formData: true, entries: editableFormData.value })
  }

  function syncFormDataToDraft() {
    emitUpdateDraft({ requestBody: serializeFormDataToDraft() })
  }

  // ---------- field mutations ----------

  function updateFormDataField(index: number, field: keyof FormDataEntry, value: string) {
    if (!editableFormData.value[index]) return
    ;(editableFormData.value[index] as any)[field] = value
    if (field === 'type') {
      editableFormData.value[index].value = ''
      editableFormData.value[index].fileName = undefined
      editableFormData.value[index].fileSize = undefined
      editableFormData.value[index].fileType = undefined
    }
    syncFormDataToDraft()
  }

  function addFormDataEntry() {
    editableFormData.value.push({ key: '', type: 'text', value: '' })
    syncFormDataToDraft()
  }

  function removeFormDataEntry(index: number) {
    editableFormData.value.splice(index, 1)
    syncFormDataToDraft()
  }

  function removeAllFormDataEntries() {
    editableFormData.value = []
    syncFormDataToDraft()
  }

  async function copyFormDataValue(fdEntry: FormDataEntry, index: number) {
    const text = fdEntry.type === 'file'
      ? fdEntry.fileName || fdEntry.value
      : fdEntry.value
    const ok = await copyToClipboard(text)
    if (ok) {
      copiedFormDataIndex.value = index
      setTimeout(() => { copiedFormDataIndex.value = null }, 2000)
    }
  }

  function handleBodyFormatChange(mode: BodyFormatMode) {
    bodyFormatMode.value = mode
    if (mode === 'form-data') {
      if (editableFormData.value.length === 0) {
        editableFormData.value = [{ key: '', type: 'text', value: '' }]
      }
      syncFormDataToDraft()
    } else {
      emitUpdateDraft({ requestBody: editableRequestBody() })
    }
  }

  // ---------- file handling ----------

  function handleFileSelected(event: Event, index: number) {
    const input = event.target as HTMLInputElement
    const file = input?.files?.[0]
    if (!file || !editableFormData.value[index]) return

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUri = reader.result as string
      const fd = editableFormData.value[index]
      if (!fd) return
      fd.value = dataUri
      fd.fileName = file.name
      fd.fileType = file.type || 'application/octet-stream'
      fd.fileSize = file.size
      syncFormDataToDraft()

      const s = settings()
      if (s?.autoSaveFiles) {
        const allFiles = getAllAvailableFiles()
        const alreadySaved = allFiles.some(f => f.name === file.name && f.size === file.size)
        if (!alreadySaved) {
          const fileId = generateId()
          const blob = dataUriToBlob(dataUri)
          await addMedia(fileId, blob)
          s.savedFiles.push({
            id: fileId,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
          })
        }
      }
    }
    reader.readAsDataURL(file)
    input.value = ''
  }

  function getFileDisplayLabel(fd: FormDataEntry): string {
    if (!fd.value || fd.value === '') return 'Choose file'
    if (fd.value.startsWith(FILE_ID_PREFIX) && fd.fileName) {
      const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?'
      return `${fd.fileName} (${sizeKb} KB)`
    }
    if (fd.value.startsWith('data:') && fd.fileName) {
      const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?'
      return `${fd.fileName} (${sizeKb} KB)`
    }
    if (fd.value === '(binary)' && fd.fileName) {
      const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?'
      return `${fd.fileName} (${sizeKb} KB) — original`
    }
    if (fd.value && fd.value !== '(binary)') {
      return fd.value.replace(/\\/g, '/').split('/').pop() || fd.value
    }
    return '(binary)'
  }

  // ---------- dropdown options ----------
  // All available files: savedFiles + wallpapers (standalone stores image/video in wallpapers)
  function getAllAvailableFiles(): Array<{ id: string; name: string; size: number; mimeType: string }> {
    const s = settings()
    const saved = s?.savedFiles ?? []
    const wallpapers = s?.customize?.image?.wallpapers ?? []
    return [...saved, ...wallpapers]
  }

  function getFileOptions(fd: FormDataEntry): FileOption[] {
    const opts: FileOption[] = []

    const original = originalFileInfoByKey.value[fd.key]
    if (original) {
      const sizeKb = original.fileSize ? (original.fileSize / 1024).toFixed(1) : '?'
      opts.push({
        id: '__original__',
        label: `${original.fileName} (${sizeKb} KB) — original`,
      })
    }

    const allFiles = getAllAvailableFiles()
    for (const f of allFiles) {
      opts.push({
        id: f.id,
        label: `${f.name} (${((f.size || 0) / 1024).toFixed(1)} KB)`,
      })
    }

    if (fd.value.startsWith(FILE_ID_PREFIX)) {
      const fileId = fd.value.slice(FILE_ID_PREFIX.length)
      if (!allFiles.some(f => f.id === fileId)) {
        const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?'
        opts.push({
          id: '__custom__',
          label: `${fd.fileName || 'file'} (${sizeKb} KB) — current`,
        })
      }
    }
    if (fd.value.startsWith('data:') && fd.fileName) {
      const isSaved = allFiles.some(f => f.name === fd.fileName && f.size === fd.fileSize)
      if (!isSaved) {
        const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?'
        opts.push({
          id: '__custom__',
          label: `${fd.fileName} (${sizeKb} KB) — current`,
        })
      }
    }

    return opts
  }

  function getSelectedFileOption(fd: FormDataEntry): string {
    if (fd.value === '(binary)') return '__original__'
    if (fd.value.startsWith(FILE_ID_PREFIX)) {
      const fileId = fd.value.slice(FILE_ID_PREFIX.length)
      const allFiles = getAllAvailableFiles()
      return allFiles.some(f => f.id === fileId) ? fileId : '__custom__'
    }
    if (fd.value.startsWith('data:') && fd.fileName) {
      const allFiles = getAllAvailableFiles()
      const match = allFiles.find(f => f.name === fd.fileName && f.size === fd.fileSize)
      if (match) return match.id
      return '__custom__'
    }
    return ''
  }

  function selectFileOption(index: number, optionId: string) {
    const fd = editableFormData.value[index]
    if (!fd) return

    if (optionId === '__original__') {
      const original = originalFileInfoByKey.value[fd.key]
      if (original) {
        fd.value = '(binary)'
        fd.fileName = original.fileName
        fd.fileSize = original.fileSize
        fd.fileType = original.fileType
      }
      syncFormDataToDraft()
      return
    }

    if (optionId === '__custom__') {
      syncFormDataToDraft()
      return
    }

    const allFiles = getAllAvailableFiles()
    const file = allFiles.find(f => f.id === optionId)

    if (!file) {
      const s = settings()
      if (s) {
        s.savedFiles = s.savedFiles.filter(sf => sf.id !== optionId)
      }
      const original = originalFileInfoByKey.value[fd.key]
      if (original) {
        fd.value = '(binary)'
        fd.fileName = original.fileName
        fd.fileSize = original.fileSize
        fd.fileType = original.fileType
      } else {
        fd.value = ''
        fd.fileName = undefined
        fd.fileSize = undefined
        fd.fileType = undefined
      }
      syncFormDataToDraft()
      return
    }

    fd.value = FILE_ID_PREFIX + file.id
    fd.fileName = file.name
    fd.fileSize = file.size
    fd.fileType = file.mimeType
    syncFormDataToDraft()
  }

  const hasFileOptions = computed(() => {
    const allFiles = getAllAvailableFiles()
    return allFiles.length > 0
  })

  // ---------- computed ----------

  const isFormDataBody = computed(() => {
    return !!entry().requestBody?.formData && entry().requestBody!.formData!.length > 0
  })

  const readonlyFormData = computed<FormDataEntry[]>(() => {
    return entry().requestBody?.formData || []
  })

  return {
    bodyFormatMode,
    editableFormData,
    copiedFormDataIndex,
    isFormDataBody,
    readonlyFormData,
    hasFileOptions,
    serializeFormDataToDraft,
    syncFormDataToDraft,
    updateFormDataField,
    addFormDataEntry,
    removeFormDataEntry,
    removeAllFormDataEntries,
    copyFormDataValue,
    handleBodyFormatChange,
    handleFileSelected,
    getFileDisplayLabel,
    getFileOptions,
    getSelectedFileOption,
    selectFileOption,
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
