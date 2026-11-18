<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import type { InspectorSettings, DisplayMode, ThemeMode, SiteListEntry } from '@/settings/inspectorSettings'
import { isUiLanguage, LANGUAGE_LABELS, UI_LANGUAGES, useI18n } from '@/i18n'
import { addMedia, removeMedia, putWallpaperBlob, removeWallpaperBlob, initWallpapersStore } from '@/settings/mediaStore'
import { getStorageClient } from '@/storage/storage-client'
import { MEDIA_LIMIT_BYTES } from '@/storage/storage-protocol'
import { Progress } from '@/components/ui/Progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import RadioGroup from '@/components/ui/RadioGroup/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/RadioGroup/RadioGroupItem.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { OptionsItemActionsMenuContent, type MenuAction } from '@/components/OptionsItemActionsMenu'
import { Info, Download, Upload, RotateCcw, Plus, MoreHorizontal, Pencil, Trash, Moon, Sun, AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { getRuntimeAdapter } from '@/runtime'
import ImagePickerDrawer from '@/features/settings/components/ImagePickerDrawer.vue'
import { wallpapers, defaultWallpaperName } from '@/assets/wallpapers'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
  /** Selected Auto Run site list row (extension only) */
  selectedSiteList?: { kind: 'blacklist' | 'whitelist'; id: string } | null
}>()

const emit = defineEmits<{
  (e: 'import'): void
  (e: 'export'): void
  (e: 'reset'): void
  (e: 'select', item: { type: 'saved-file' | 'site-blacklist' | 'site-whitelist'; id: string }): void
  (e: 'edit', item: { type: 'site-blacklist' | 'site-whitelist'; id: string }): void
}>()

const { t, seconds, locale } = useI18n()

function setLanguage(value: unknown) {
  props.settings.language = isUiLanguage(value) ? value : 'en'
}

const runtime = getRuntimeAdapter()
const isRunningInDevtools = runtime?.id === 'devtools'
const isStandalone = runtime?.capabilities.mode === 'standalone'

// -------------------- STORAGE USAGE (standalone) --------------------

const mediaUsedBytes = ref(0)
const storageClient = isStandalone ? getStorageClient() : null

async function refreshMediaUsage() {
  if (!storageClient) return
  try { mediaUsedBytes.value = await storageClient.getTotalMediaSize() } catch (error) {
    console.error('[settings/GeneralSection] refreshMediaUsage failed:', error)
  }
}

const mediaUsagePercent = computed(() =>
  Math.min(100, Math.round((mediaUsedBytes.value / MEDIA_LIMIT_BYTES) * 100))
)

const mediaUsageLabel = computed(() => {
  const used = (mediaUsedBytes.value / 1024 / 1024).toFixed(1)
  const limit = (MEDIA_LIMIT_BYTES / 1024 / 1024).toFixed(0)
  return `${used} MB / ${limit} MB`
})

if (isStandalone) onMounted(refreshMediaUsage)

/** Standalone: media files for background picker (from wallpapers store). Extension: from savedFiles. */
const mediaFilesForPicker = computed(() => {
  if (isStandalone) {
    const wallpapers = props.settings.customize?.image?.wallpapers ?? []
    return wallpapers
      .filter(w => w.mimeType.startsWith('image/') || w.mimeType.startsWith('video/'))
      .map(w => ({ id: w.id, name: w.name, size: w.size ?? 0, mimeType: w.mimeType }))
  }
  return (props.settings.savedFiles ?? []).filter(f =>
    f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')
  )
})

/** Saved Files table: standalone = wallpapers + savedFiles, extension = savedFiles only */
const savedFilesForTable = computed(() => {
  if (isStandalone) {
    const wallpapers = (props.settings.customize?.image?.wallpapers ?? []).map(w => ({
      id: w.id,
      name: w.name,
      size: w.size ?? 0,
      mimeType: w.mimeType,
      _isWallpaper: true as const,
    }))
    const breakpointFiles = (props.settings.savedFiles ?? []).map(f => ({
      ...f,
      _isWallpaper: false as const,
    }))
    return [...wallpapers, ...breakpointFiles]
  }
  return (props.settings.savedFiles ?? []).map(f => ({ ...f, _isWallpaper: false as const }))
})

const displayMode = computed({
  get: () => props.settings.displayMode ?? 'overlay',
  set: (val: DisplayMode) => { props.settings.displayMode = val }
})

const theme = computed({
  get: () => props.settings.theme ?? 'dark',
  set: (val: ThemeMode) => { props.settings.theme = val }
})

const showDevtoolsHint = computed(
  () => displayMode.value === 'devtools' && !isRunningInDevtools
)
const showOverlayHint = computed(
  () => displayMode.value === 'overlay' && isRunningInDevtools
)

const debounceValue = ref(props.settings.searchParams.debounce ?? 300)
const minLengthValue = ref(props.settings.searchParams.minLength ?? 2)

watch(debounceValue, (val) => { props.settings.searchParams.debounce = val })
watch(minLengthValue, (val) => { props.settings.searchParams.minLength = val })

const jsonEditorImplementation = computed({
  get: () => props.settings.json?.editor ?? 'jsoneditor',
  set: (val: 'classic' | 'jsoneditor') => {
    if (!props.settings.json) props.settings.json = { editor: val, mode: 'text' }
    else props.settings.json.editor = val
  }
})

const refreshIntervals = computed(() =>
  [1, 2, 5, 10, 30].map(secondsCount => ({ value: secondsCount * 1000, label: seconds(secondsCount) })),
)

// -------------------- CUSTOMIZE --------------------

const customize = computed(() => props.settings.customize)
const imagePickerOpen = ref(false)

const currentImageLabel = computed(() => {
  if (customize.value.image.url) return customize.value.image.url
  const savedFileId = customize.value.image.savedFileId
  const fileName = customize.value.image.fileName
  if (savedFileId && fileName) {
    const exists =
      (savedFileId.startsWith('wallpaper:') && wallpapers.some(w => w.id === savedFileId)) ||
      (props.settings.customize?.image?.wallpapers ?? []).some(w => w.id === savedFileId) ||
      (props.settings.savedFiles ?? []).some(f => f.id === savedFileId)
    if (exists) return fileName
  }
  return defaultWallpaperName
})

function handlePickerSelectFile(id: string, name: string) {
  customize.value.image.sourceType = 'file'
  customize.value.image.savedFileId = id
  customize.value.image.fileName = name
  customize.value.image.url = ''
  if (isStandalone) customize.value.image.wallpaperId = id
}

function handlePickerAddUrl(url: string) {
  const urls = customize.value.image.urls ?? []
  if (urls.includes(url)) return
  customize.value.image.urls = [...urls, url]
  customize.value.image.sourceType = 'link'
  customize.value.image.url = url
  customize.value.image.savedFileId = ''
  customize.value.image.fileName = ''
  if (isStandalone) customize.value.image.wallpaperId = ''
}

function handlePickerSelectUrl(url: string) {
  customize.value.image.sourceType = 'link'
  customize.value.image.url = url
  customize.value.image.savedFileId = ''
  customize.value.image.fileName = ''
  if (isStandalone) customize.value.image.wallpaperId = ''
}

function handlePickerRemoveUrl(url: string) {
  const urls = customize.value.image.urls ?? []
  customize.value.image.urls = urls.filter(u => u !== url)
  if (customize.value.image.url === url) {
    customize.value.image.url = ''
    customize.value.image.sourceType = 'file'
    customize.value.image.savedFileId = ''
    customize.value.image.fileName = ''
    if (isStandalone) customize.value.image.wallpaperId = ''
  }
}

async function handlePickerAddFile(file: File) {
  if (isStandalone) {
    const wallpapers = customize.value.image.wallpapers ?? []
    const nums = wallpapers.map(w => {
      const m = w.id.match(/^wallpaper_(\d+)$/)
      return m ? parseInt(m[1], 10) : 0
    })
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
    const fileId = `wallpaper_${nextNum}`
    await putWallpaperBlob(fileId, file)
    customize.value.image.wallpapers = [...wallpapers, {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }]
    customize.value.image.sourceType = 'file'
    customize.value.image.savedFileId = fileId
    customize.value.image.fileName = file.name
    customize.value.image.wallpaperId = fileId
    customize.value.image.url = ''
    await initWallpapersStore([fileId])
    refreshMediaUsage()
    return
  }
  const existing = props.settings.savedFiles.find(
    sf => sf.name === file.name && sf.size === file.size,
  )
  let fileId: string
  if (existing) {
    fileId = existing.id
  } else {
    fileId = generateId()
    await addMedia(fileId, file)
    props.settings.savedFiles.push({
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    })
  }
  customize.value.image.sourceType = 'file'
  customize.value.image.savedFileId = fileId
  customize.value.image.fileName = file.name
  customize.value.image.url = ''
}

async function handlePickerRemoveFile(id: string) {
  if (isStandalone) {
    const wallpapers = customize.value.image.wallpapers ?? []
    customize.value.image.wallpapers = wallpapers.filter(w => w.id !== id)
    await removeWallpaperBlob(id)
    if (customize.value.image.savedFileId === id || customize.value.image.wallpaperId === id) {
      customize.value.image.savedFileId = ''
      customize.value.image.fileName = ''
      customize.value.image.wallpaperId = ''
    }
    refreshMediaUsage()
    return
  }
  if (!props.settings.savedFiles) return
  props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== id)
  await removeMedia(id)
  if (customize.value.image.savedFileId === id) {
    customize.value.image.savedFileId = ''
    customize.value.image.fileName = ''
  }
}

function setSlider(setter: (v: number) => void, val: number[] | undefined) {
  if (val && val.length > 0) setter(val[0])
}

// -------------------- SAVED FILES --------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

async function removeSavedFile(fileId: string, isWallpaper = false) {
  if (isWallpaper) {
    const wallpapers = customize.value.image.wallpapers ?? []
    customize.value.image.wallpapers = wallpapers.filter(w => w.id !== fileId)
    await removeWallpaperBlob(fileId)
    if (customize.value.image.savedFileId === fileId || customize.value.image.wallpaperId === fileId) {
      customize.value.image.savedFileId = ''
      customize.value.image.fileName = ''
      customize.value.image.wallpaperId = ''
    }
    refreshMediaUsage()
    return
  }
  if (!props.settings.savedFiles) return
  props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== fileId)
  await removeMedia(fileId)
  if (customize.value.image.savedFileId === fileId) {
    customize.value.image.savedFileId = ''
    customize.value.image.fileName = ''
  }
  refreshMediaUsage()
}

async function handleAddNewFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input?.files
  if (!files) return
  if (isStandalone) {
    for (const file of Array.from(files)) {
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/')
      if (isMedia) {
        const wallpapers = customize.value.image.wallpapers ?? []
        const alreadySaved = wallpapers.some(w => w.name === file.name && w.size === file.size)
        if (!alreadySaved) {
          const nums = wallpapers.map(w => {
            const m = w.id.match(/^wallpaper_(\d+)$/)
            return m ? parseInt(m[1], 10) : 0
          })
          const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
          const fileId = `wallpaper_${nextNum}`
          await putWallpaperBlob(fileId, file)
          customize.value.image.wallpapers = [...wallpapers, {
            id: fileId,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
          }]
          await initWallpapersStore([fileId])
        }
      } else {
        if (!props.settings.savedFiles) props.settings.savedFiles = []
        const alreadySaved = props.settings.savedFiles.some(sf => sf.name === file.name && sf.size === file.size)
        if (!alreadySaved) {
          const id = generateId()
          await addMedia(id, file)
          props.settings.savedFiles.push({
            id,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
          })
        }
      }
    }
    input.value = ''
    refreshMediaUsage()
    return
  }
  if (!props.settings.savedFiles) return
  for (const file of Array.from(files)) {
    const alreadySaved = props.settings.savedFiles.some(
      sf => sf.name === file.name && sf.size === file.size,
    )
    if (!alreadySaved) {
      const id = generateId()
      await addMedia(id, file)
      props.settings.savedFiles.push({
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      })
    }
  }
  input.value = ''
  refreshMediaUsage()
}

async function handleEditFileChange(event: Event, fileId: string, isWallpaper = false) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  if (isWallpaper) {
    await putWallpaperBlob(fileId, file)
    const wp = customize.value.image.wallpapers?.find(w => w.id === fileId)
    if (wp) {
      wp.name = file.name
      wp.size = file.size
      wp.mimeType = file.type || 'application/octet-stream'
    }
    await initWallpapersStore([fileId])
    input.value = ''
    refreshMediaUsage()
    return
  }
  await addMedia(fileId, file)
  const sf = props.settings.savedFiles?.find(f => f.id === fileId)
  if (sf) {
    sf.name = file.name
    sf.size = file.size
    sf.mimeType = file.type || 'application/octet-stream'
  }
  input.value = ''
  refreshMediaUsage()
}

const savedFilesTableHeight = computed(() => {
  const rowCount = savedFilesForTable.value.length + 1
  return Math.min(rowCount * 41, 205)
})

const savedFilesNeedsScroll = computed(() => savedFilesForTable.value.length > 4)

type SavedFileRow = { id: string; name: string; size: number; mimeType: string; _isWallpaper: boolean }
function getSavedFileActions(file: SavedFileRow): MenuAction[] {
  return [
    { label: t('general.edit'), icon: Pencil, slot: 'edit' },
    { label: t('general.delete'), icon: Trash, onClick: () => removeSavedFile(file.id, file._isWallpaper), destructiveText: true },
  ]
}

// -------------------- AUTO RUN --------------------

function ensureAutoRun() {
  if (!props.settings.autoRun) {
    props.settings.autoRun = { advancedMode: false, siteBlacklist: [], siteWhitelist: [] }
  }
  return props.settings.autoRun
}

const autoRun = computed(() => ensureAutoRun())

const blacklistUrl = ref('')
const whitelistUrl = ref('')

function addToBlacklist() {
  const pattern = blacklistUrl.value.trim()
  if (!pattern) return
  const ar = ensureAutoRun()
  if (ar.siteBlacklist.some(e => e.pattern === pattern)) return
  ar.siteBlacklist.push({ id: generateId(), pattern, addedAt: new Date().toISOString() })
  blacklistUrl.value = ''
}

function removeFromBlacklist(id: string) {
  const ar = ensureAutoRun()
  ar.siteBlacklist = ar.siteBlacklist.filter(e => e.id !== id)
}

function addToWhitelist() {
  const pattern = whitelistUrl.value.trim()
  if (!pattern) return
  const ar = ensureAutoRun()
  if (ar.siteWhitelist.some(e => e.pattern === pattern)) return
  ar.siteWhitelist.push({ id: generateId(), pattern, addedAt: new Date().toISOString() })
  whitelistUrl.value = ''
}

function removeFromWhitelist(id: string) {
  const ar = ensureAutoRun()
  ar.siteWhitelist = ar.siteWhitelist.filter(e => e.id !== id)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function isBlacklistRowSelected(entry: SiteListEntry): boolean {
  return props.selectedSiteList?.kind === 'blacklist' && props.selectedSiteList.id === entry.id
}

function isWhitelistRowSelected(entry: SiteListEntry): boolean {
  return props.selectedSiteList?.kind === 'whitelist' && props.selectedSiteList.id === entry.id
}

function getSiteBlacklistActions(entry: SiteListEntry): MenuAction[] {
  return [
    { label: t('general.edit'), icon: Pencil, onClick: () => emit('edit', { type: 'site-blacklist', id: entry.id }) },
    { label: t('general.delete'), icon: Trash, onClick: () => removeFromBlacklist(entry.id), destructiveText: true },
  ]
}

function getSiteWhitelistActions(entry: SiteListEntry): MenuAction[] {
  return [
    { label: t('general.edit'), icon: Pencil, onClick: () => emit('edit', { type: 'site-whitelist', id: entry.id }) },
    { label: t('general.delete'), icon: Trash, onClick: () => removeFromWhitelist(entry.id), destructiveText: true },
  ]
}

const siteBlacklistNeedsScroll = computed(() => autoRun.value.siteBlacklist.length > 4)
const siteBlacklistTableHeight = computed(() =>
  Math.min(Math.max(autoRun.value.siteBlacklist.length, 1) * 41, 205),
)
const siteWhitelistNeedsScroll = computed(() => autoRun.value.siteWhitelist.length > 4)
const siteWhitelistTableHeight = computed(() =>
  Math.min(Math.max(autoRun.value.siteWhitelist.length, 1) * 41, 205),
)
</script>

<template>
  <div class="space-y-6 min-w-0">
    <!-- DISPLAY MODE -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold">{{ t('general.displayMode') }}</h4>

      <RadioGroup :key="locale" v-model="displayMode" :disabled="isStandalone" class="gap-3">
        <div class="flex items-center space-x-2">
          <RadioGroupItem value="overlay" id="mode-overlay" />
          <Label for="mode-overlay" class="text-sm font-normal" :class="isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
            {{ t('general.overlay') }}
          </Label>
        </div>
        <div class="flex items-center space-x-2">
          <RadioGroupItem value="devtools" id="mode-devtools" />
          <Label for="mode-devtools" class="text-sm font-normal" :class="isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
            {{ t('general.devtoolsTab') }}
          </Label>
        </div>
      </RadioGroup>

      <div
        v-if="isStandalone"
        class="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400"
      >
        <Info class="h-4 w-4 shrink-0 mt-0.5" />
        <p>{{ t('general.displayModeStandalone') }}</p>
      </div>

      <div
        v-if="showDevtoolsHint"
        class="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-400"
      >
        <Info class="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p>{{ t('general.reload') }}</p>
          <p class="mt-0.5">{{ t('general.openDevtools') }}</p>
        </div>
      </div>

      <div
        v-if="showOverlayHint"
        class="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-400"
      >
        <Info class="h-4 w-4 shrink-0 mt-0.5" />
        <p>{{ t('general.reload') }}</p>
      </div>
    </div>

    <!-- CUSTOMIZE -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.customize') }}</h4>

      <!-- Image -->
      <div class="space-y-2 min-w-0">
        <Label class="text-xs font-medium text-muted-foreground">{{ t('general.image') }}</Label>
        <div class="grid grid-cols-[minmax(0,_1fr)_auto_auto] items-center gap-2 min-w-0">
          <span class="text-xs text-muted-foreground truncate block min-w-0" :title="currentImageLabel">{{ currentImageLabel }}</span>
          <Button
            variant="outline"
            size="sm"
            class="h-8 w-8 p-0 shrink-0"
            :title="theme === 'dark' ? t('general.switchLight') : t('general.switchDark')"
            @click="theme = theme === 'dark' ? 'light' : 'dark'"
          >
            <Sun v-if="theme === 'dark'" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-3 text-xs shrink-0"
            @click="imagePickerOpen = true"
          >
            {{ t('general.changeBackground') }}
          </Button>
        </div>
      </div>

      <!-- Position X -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">{{ t('general.positionX') }}</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.positionX }}%</span>
        </div>
        <Slider
          :model-value="[customize.positionX]"
          @update:model-value="setSlider(v => customize.positionX = v, $event)"
          :min="0" :max="100" :step="1"
        />
      </div>

      <!-- Position Y -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">{{ t('general.positionY') }}</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.positionY }}%</span>
        </div>
        <Slider
          :model-value="[customize.positionY]"
          @update:model-value="setSlider(v => customize.positionY = v, $event)"
          :min="0" :max="100" :step="1"
        />
      </div>

      <!-- Scale -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">{{ t('general.scale') }}</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.scale }}%</span>
        </div>
        <Slider
          :model-value="[customize.scale]"
          @update:model-value="setSlider(v => customize.scale = v, $event)"
          :min="100" :max="200" :step="1"
        />
      </div>

      <!-- Image Opacity -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">{{ t('general.imageOpacity') }}</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.imageOpacity.toFixed(2) }}</span>
        </div>
        <Slider
          :model-value="[customize.imageOpacity]"
          @update:model-value="setSlider(v => customize.imageOpacity = v, $event)"
          :min="0" :max="0.5" :step="0.01"
        />
      </div>

      <!-- Blur -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">{{ t('general.blur') }}</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.blur }}px</span>
        </div>
        <Slider
          :model-value="[customize.blur]"
          @update:model-value="setSlider(v => customize.blur = v, $event)"
          :min="0" :max="200" :step="1"
        />
      </div>
    </div>

    <!-- SEARCH DEBOUNCE & MIN LENGTH -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.searchParameters') }}</h4>
      <div class="grid grid-cols-2 gap-x-6 gap-y-2">
        <Label for="search-debounce">{{ t('general.searchDebounce') }}</Label>
        <Label for="search-min-length">{{ t('general.minSearchLength') }}</Label>

        <Input
          id="search-debounce"
          v-model="debounceValue"
          type="number"
          class="w-24 h-8"
          :min="100"
          :max="1000"
        />

        <Input
          id="search-min-length"
          v-model="minLengthValue"
          type="number"
          class="w-24 h-8"
          :min="1"
          :max="10"
        />
      </div>
    </div>

    <!-- AUTO REFRESH -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.autoRefresh') }}</h4>

      <div class="flex items-center space-x-3">
        <Checkbox
          id="auto-refresh"
          v-model="settings.updates!.autoRefresh"
          :aria-label="t('general.enableAutoRefresh')"
        />
        <Label for="auto-refresh" class="text-sm">{{ t('general.enableAutoRefresh') }}</Label>
      </div>

      <div v-if="settings.updates?.autoRefresh" class="pt-2">
        <Label for="refresh-interval" class="block mb-2">{{ t('general.refreshInterval') }}</Label>
        <Select v-model="settings.updates!.autoRefreshInterval">
          <SelectTrigger class="w-full h-8">
            <SelectValue :placeholder="seconds((settings.updates?.autoRefreshInterval ?? 5000) / 1000)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="interval in refreshIntervals" :key="interval.value" :value="interval.value">
              {{ interval.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- AUTO RUN (extension only) — intro spacing matches Saved Files (title / description / checkbox) -->
    <div v-if="!isStandalone" class="space-y-4 border-t pt-4">
      <div class="space-y-2">
        <h4 class="text-sm font-semibold">{{ t('general.autoRun') }}</h4>
        <p class="text-xs text-muted-foreground">
          {{ t('general.enableAutoRun') }}
        </p>

        <!-- Advanced mode -->
        <div class="flex items-center space-x-3">
          <Checkbox
            id="auto-run-advanced"
            :model-value="autoRun.advancedMode"
            :aria-label="t('general.enableWhitelist')"
            @update:model-value="autoRun.advancedMode = $event as boolean"
          />
          <Label for="auto-run-advanced" class="text-sm">{{ t('general.enableWhitelist') }}</Label>
        </div>
      </div>

      <!-- SITE BLACKLIST -->
      <div class="space-y-2">
        <h4 class="text-sm font-semibold">{{ t('general.siteBlacklist') }}</h4>
        <div class="flex gap-2">
          <Input
            v-model="blacklistUrl"
            :placeholder="t('general.sitePlaceholder')"
            class="flex-1 h-8"
            @keydown.enter="addToBlacklist"
          />
          <Button size="sm" class="h-8" @click="addToBlacklist">
            {{ t('general.add') }}
          </Button>
        </div>

        <div class="flex flex-col border rounded-lg overflow-hidden">
          <div class="shrink-0 border-b bg-muted/30">
            <Table class="table-fixed">
              <TableHeader class="[&_th]:h-10">
                <TableRow class="hover:bg-transparent">
                  <TableHead class="text-xs font-semibold">{{ t('general.name') }}</TableHead>
                  <TableHead class="text-xs font-semibold w-[100px] text-center">{{ t('general.added') }}</TableHead>
                  <TableHead class="w-[48px] text-center p-0" />
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div class="min-h-0 max-h-[205px] overflow-hidden">
            <ScrollArea v-if="siteBlacklistNeedsScroll" :style="{ height: `${siteBlacklistTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="entry in autoRun.siteBlacklist" :key="entry.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="isBlacklistRowSelected(entry) ? 'bg-accent' : ''"
                        @click="emit('select', { type: 'site-blacklist', id: entry.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div class="text-sm truncate" :title="entry.pattern">{{ entry.pattern }}</div>
                        </TableCell>
                        <TableCell class="w-[100px] text-center !py-2">
                          <div class="text-xs text-muted-foreground">{{ formatDate(entry.addedAt) }}</div>
                        </TableCell>
                        <TableCell class="w-[48px] text-center p-0">
                          <div class="flex justify-center items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <OptionsItemActionsMenuContent
                                variant="dropdown"
                                :actions="getSiteBlacklistActions(entry)"
                              />
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getSiteBlacklistActions(entry)"
                    />
                  </ContextMenu>
                </TableBody>
              </Table>
            </ScrollArea>
            <Table v-else class="table-fixed">
              <TableBody>
                <ContextMenu v-for="entry in autoRun.siteBlacklist" :key="entry.id">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="isBlacklistRowSelected(entry) ? 'bg-accent' : ''"
                      @click="emit('select', { type: 'site-blacklist', id: entry.id })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div class="text-sm truncate" :title="entry.pattern">{{ entry.pattern }}</div>
                      </TableCell>
                      <TableCell class="w-[100px] text-center !py-2">
                        <div class="text-xs text-muted-foreground">{{ formatDate(entry.addedAt) }}</div>
                      </TableCell>
                      <TableCell class="w-[48px] text-center p-0">
                        <div class="flex justify-center items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                <MoreHorizontal class="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getSiteBlacklistActions(entry)"
                            />
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <OptionsItemActionsMenuContent
                    variant="context"
                    :actions="getSiteBlacklistActions(entry)"
                  />
                </ContextMenu>
                <TableRow v-if="!autoRun.siteBlacklist.length">
                  <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                    {{ t('general.noBlacklist') }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <!-- SITE WHITELIST (whitelist mode only) -->
      <div v-if="autoRun.advancedMode" class="space-y-2">
        <h4 class="text-sm font-semibold">{{ t('general.siteWhitelist') }}</h4>

        <div class="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" />
          <p>{{ t('general.whitelistHint') }}</p>
        </div>

        <div class="flex gap-2">
          <Input
            v-model="whitelistUrl"
            :placeholder="t('general.sitePlaceholder')"
            class="flex-1 h-8"
            @keydown.enter="addToWhitelist"
          />
          <Button size="sm" class="h-8" @click="addToWhitelist">
            {{ t('general.add') }}
          </Button>
        </div>

        <div class="flex flex-col border rounded-lg overflow-hidden">
          <div class="shrink-0 border-b bg-muted/30">
            <Table class="table-fixed">
              <TableHeader class="[&_th]:h-10">
                <TableRow class="hover:bg-transparent">
                  <TableHead class="text-xs font-semibold">{{ t('general.name') }}</TableHead>
                  <TableHead class="text-xs font-semibold w-[100px] text-center">{{ t('general.added') }}</TableHead>
                  <TableHead class="w-[48px] text-center p-0" />
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div class="min-h-0 max-h-[205px] overflow-hidden">
            <ScrollArea v-if="siteWhitelistNeedsScroll" :style="{ height: `${siteWhitelistTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="entry in autoRun.siteWhitelist" :key="entry.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="isWhitelistRowSelected(entry) ? 'bg-accent' : ''"
                        @click="emit('select', { type: 'site-whitelist', id: entry.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div class="text-sm truncate" :title="entry.pattern">{{ entry.pattern }}</div>
                        </TableCell>
                        <TableCell class="w-[100px] text-center !py-2">
                          <div class="text-xs text-muted-foreground">{{ formatDate(entry.addedAt) }}</div>
                        </TableCell>
                        <TableCell class="w-[48px] text-center p-0">
                          <div class="flex justify-center items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <OptionsItemActionsMenuContent
                                variant="dropdown"
                                :actions="getSiteWhitelistActions(entry)"
                              />
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getSiteWhitelistActions(entry)"
                    />
                  </ContextMenu>
                </TableBody>
              </Table>
            </ScrollArea>
            <Table v-else class="table-fixed">
              <TableBody>
                <ContextMenu v-for="entry in autoRun.siteWhitelist" :key="entry.id">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="isWhitelistRowSelected(entry) ? 'bg-accent' : ''"
                      @click="emit('select', { type: 'site-whitelist', id: entry.id })"
                    >
                      <TableCell class="overflow-hidden !py-2">
                        <div class="text-sm truncate" :title="entry.pattern">{{ entry.pattern }}</div>
                      </TableCell>
                      <TableCell class="w-[100px] text-center !py-2">
                        <div class="text-xs text-muted-foreground">{{ formatDate(entry.addedAt) }}</div>
                      </TableCell>
                      <TableCell class="w-[48px] text-center p-0">
                        <div class="flex justify-center items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                <MoreHorizontal class="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getSiteWhitelistActions(entry)"
                            />
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <OptionsItemActionsMenuContent
                    variant="context"
                    :actions="getSiteWhitelistActions(entry)"
                  />
                </ContextMenu>
                <TableRow v-if="!autoRun.siteWhitelist.length">
                  <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                    {{ t('general.noWhitelist') }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>

    <!-- JSON VIEWER IMPLEMENTATION -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.jsonMode') }}</h4>

      <Tabs v-model="jsonEditorImplementation">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="classic">{{ t('general.classic') }}</TabsTrigger>
          <TabsTrigger value="jsoneditor">{{ t('general.advanced') }}</TabsTrigger>
        </TabsList>

        <TabsContent value="classic" class="mt-4">
          <p class="text-xs text-muted-foreground">
            {{ t('general.classicHint') }}
          </p>
        </TabsContent>

        <TabsContent value="jsoneditor" class="mt-4">
          <p class="text-xs text-muted-foreground">
            {{ t('general.advancedHint') }}
          </p>
        </TabsContent>
      </Tabs>
    </div>

    <!-- SAVED FILES -->
    <div id="saved-files-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.savedFiles') }}</h4>
      <p class="text-xs text-muted-foreground">
        {{ t('general.savedFilesHint') }}
      </p>

      <div v-if="isStandalone" class="flex items-center gap-3">
        <Progress
          :model-value="mediaUsagePercent"
          class="h-2 flex-1"
          :class="mediaUsagePercent >= 90 ? '[&>*]:bg-destructive' : mediaUsagePercent >= 70 ? '[&>*]:bg-yellow-500' : ''"
        />
        <span class="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{{ mediaUsageLabel }}</span>
      </div>

      <div class="flex items-center space-x-3 mb-3">
        <Checkbox
          id="auto-save-files"
          :model-value="settings.autoSaveFiles"
          :aria-label="t('general.autoSaveFiles')"
          @update:model-value="settings.autoSaveFiles = $event as boolean"
        />
        <Label for="auto-save-files" class="text-sm">
          {{ t('general.autoSaveFiles') }}
        </Label>
      </div>

      <div class="flex flex-col border rounded-lg">
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader class="[&_th]:h-10">
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">{{ t('general.name') }}</TableHead>
                <TableHead class="text-xs font-semibold w-[80px] text-center">{{ t('general.size') }}</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <div class="min-h-0 max-h-[205px] overflow-hidden">
          <template v-if="savedFilesNeedsScroll">
            <ScrollArea :style="{ height: `${savedFilesTableHeight}px` }">
              <Table class="table-fixed">
                <TableBody>
                  <ContextMenu v-for="file in savedFilesForTable" :key="file.id">
                    <ContextMenuTrigger as-child>
                      <TableRow
                        class="h-[41px] cursor-pointer transition-colors"
                        :class="{ 'bg-muted': selectedItemId === file.id }"
                        @click="emit('select', { type: 'saved-file', id: file.id })"
                      >
                        <TableCell class="overflow-hidden !py-2">
                          <div class="text-sm truncate" :title="file.name">{{ file.name }}</div>
                        </TableCell>
                        <TableCell class="w-[80px] text-center !py-2">
                          <div class="text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</div>
                        </TableCell>
                        <TableCell class="w-[48px] text-center p-0">
                          <div class="flex justify-center items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button variant="ghost" class="h-6 w-6 p-0" @click.stop>
                                  <MoreHorizontal class="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <OptionsItemActionsMenuContent
                                variant="dropdown"
                                :actions="getSavedFileActions(file)"
                                :item="file"
                              >
                                <template #edit="{ item: f, variant }">
                                  <label
                                    class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full"
                                    :class="variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground'"
                                  >
                                    <Pencil class="h-4 w-4 mr-2" />
                                    Edit
                                    <input type="file" class="sr-only" @change="handleEditFileChange($event, (f as SavedFileRow).id, (f as SavedFileRow)._isWallpaper)" />
                                  </label>
                                </template>
                              </OptionsItemActionsMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                    </TableRow>
                    </ContextMenuTrigger>
                    <OptionsItemActionsMenuContent
                      variant="context"
                      :actions="getSavedFileActions(file)"
                      :item="file"
                    >
<template #edit="{ item: f, variant }">
                      <label
                        class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full"
                        :class="variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground'"
                      >
                        <Pencil class="h-4 w-4 mr-2" />
                        Edit
                        <input type="file" class="sr-only" @change="handleEditFileChange($event, (f as SavedFileRow).id, (f as SavedFileRow)._isWallpaper)" />
                      </label>
                    </template>
                    </OptionsItemActionsMenuContent>
                  </ContextMenu>

                  <TableRow class="h-[41px] hover:bg-muted/50 transition-colors">
                    <TableCell colspan="3" class="!p-0">
                      <label class="flex items-center justify-center gap-1.5 cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors w-full h-[41px]">
                        <Plus class="h-3.5 w-3.5" />
                        {{ t('general.addNewFile') }}
                        <input type="file" multiple class="sr-only" @change="handleAddNewFile" />
                      </label>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </template>
          <template v-else>
            <Table class="table-fixed">
              <TableBody>
              <ContextMenu v-for="file in savedFilesForTable" :key="file.id">
                <ContextMenuTrigger as-child>
                  <TableRow
                    class="h-[41px] cursor-pointer transition-colors"
                    :class="{ 'bg-muted': selectedItemId === file.id }"
                    @click="emit('select', { type: 'saved-file', id: file.id })"
                  >
                    <TableCell class="overflow-hidden !py-2">
                      <div class="text-sm truncate" :title="file.name">{{ file.name }}</div>
                    </TableCell>
                    <TableCell class="w-[80px] text-center !py-2">
                      <div class="text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</div>
                    </TableCell>
                    <TableCell class="w-[48px] text-center p-0">
                      <div class="flex justify-center items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger as-child>
                            <Button variant="ghost" class="h-6 w-6 p-0" @click.stop>
                              <MoreHorizontal class="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <OptionsItemActionsMenuContent
                            variant="dropdown"
                            :actions="getSavedFileActions(file)"
                            :item="file"
                          >
<template #edit="{ item: f, variant }">
                      <label
                        class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full"
                        :class="variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground'"
                      >
                        <Pencil class="h-4 w-4 mr-2" />
                        Edit
                        <input type="file" class="sr-only" @change="handleEditFileChange($event, (f as SavedFileRow).id, (f as SavedFileRow)._isWallpaper)" />
                      </label>
                    </template>
                          </OptionsItemActionsMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <OptionsItemActionsMenuContent
                  variant="context"
                  :actions="getSavedFileActions(file)"
                  :item="file"
                >
<template #edit="{ item: f, variant }">
                      <label
                        class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full"
                        :class="variant === 'dropdown' ? 'hover:bg-accent hover:text-accent-foreground' : 'hover:bg-secondary hover:text-secondary-foreground'"
                      >
                        <Pencil class="h-4 w-4 mr-2" />
                        Edit
                        <input type="file" class="sr-only" @change="handleEditFileChange($event, (f as SavedFileRow).id, (f as SavedFileRow)._isWallpaper)" />
                      </label>
                    </template>
                </OptionsItemActionsMenuContent>
              </ContextMenu>
              <TableRow class="h-[41px] hover:bg-muted/50 transition-colors">
                <TableCell colspan="3" class="!p-0">
                  <label class="flex items-center justify-center gap-1.5 cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors w-full h-[41px]">
                    <Plus class="h-3.5 w-3.5" />
                    {{ t('general.addNewFile') }}
                    <input type="file" multiple class="sr-only" @change="handleAddNewFile" />
                  </label>
                </TableCell>
              </TableRow>
              </TableBody>
            </Table>
          </template>
        </div>
      </div>
    </div>

    <div class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.language') }}</h4>
      <Select :model-value="settings.language || 'en'" @update:model-value="setLanguage">
        <SelectTrigger class="h-8 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent scrollbar>
          <SelectItem v-for="code in UI_LANGUAGES" :key="code" :value="code">{{ LANGUAGE_LABELS[code] }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- IMPORT / EXPORT / RESET -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">{{ t('general.settingsManagement') }}</h4>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="emit('import')">
          <Download class="w-3.5 h-3.5" />
          {{ t('general.import') }}
        </Button>
        <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="emit('export')">
          <Upload class="w-3.5 h-3.5" />
          {{ t('general.export') }}
        </Button>
        <Button size="sm" variant="destructive" class="h-8 gap-1.5" @click="emit('reset')">
          <RotateCcw class="w-3.5 h-3.5" />
          {{ t('general.reset') }}
        </Button>
      </div>
    </div>

    <ImagePickerDrawer
      v-model:open="imagePickerOpen"
      :saved-files="mediaFilesForPicker"
      :url-images="customize.image.urls"
      :selected-saved-file-id="customize.image.savedFileId"
      :selected-url="customize.image.url"
      @select-file="handlePickerSelectFile"
      @select-url="handlePickerSelectUrl"
      @add-url="handlePickerAddUrl"
      @remove-url="handlePickerRemoveUrl"
      @add-file="handlePickerAddFile"
      @remove-file="handlePickerRemoveFile"
    />
  </div>
</template>
