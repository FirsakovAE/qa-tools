<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { marked } from 'marked'
import '@/assets/markdown.css'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { BreakpointItem, MockRule, FavoriteItem, PiniaFavoriteItem, SavedFile, SiteListEntry, HeaderLinkRuleRowDraft } from '@/types/inspector'
import { replaceHeaderLinkRulesForHeaderName } from '@/utils/networkHeaderLinks'
import type { ReleaseDisplayInfo } from '@/services/githubReleaseService'
import { mediaUrls, getMediaBlob, getWallpaperBlob } from '@/settings/mediaStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Download,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  Pencil,
  FileSpreadsheet,
  FileText,
  Edit,
  X,
  Save,
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import HeaderLinkGroupBody from '@/features/settings/components/HeaderLinkGroupBody.vue'

marked.setOptions({ breaks: true, gfm: true })

const renderedBody = computed(() => {
  const body = props.releaseInfo?.body
  if (!body) return ''
  try {
    return marked.parse(body) as string
  } catch (error) {
    console.error('[settings/SettingsDetails] marked.parse failed:', error)
    return body
  }
})

const props = defineProps<{
  settings: InspectorSettings
  selectedItem: { type: 'breakpoint' | 'mock' | 'header-link' | 'blacklist' | 'favorite' | 'pinia-favorite' | 'saved-file' | 'site-blacklist' | 'site-whitelist'; id: string } | null
  releaseInfo?: ReleaseDisplayInfo | null
  piniaFavoriteEditMode?: boolean
  siteListEditMode?: boolean
  headerLinkEditMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'close-release'): void
  (e: 'ignore-version', version: string): void
  (e: 'download-update', url: string): void
  (e: 'edit'): void
  (e: 'pinia-favorite-edit-done', newId?: string): void
  (e: 'site-list-edit-done'): void
  (e: 'header-link-edit-done'): void
}>()

const detailsTitle = computed(() => {
  const t = props.selectedItem?.type
  if (!t) return 'Details'
  switch (t) {
    case 'saved-file':
      return 'File Preview'
    case 'pinia-favorite':
      return 'Favorite Store Details'
    case 'header-link':
      return 'Header Link Details'
    case 'site-blacklist':
      return 'Site Blacklist Details'
    case 'site-whitelist':
      return 'Site Whitelist Details'
    default:
      return t.charAt(0).toUpperCase() + t.slice(1) + ' Details'
  }
})

useEscapeClose(
  computed(() => !!(props.selectedItem || props.releaseInfo)),
  () => {
    if (props.selectedItem) emit('close')
    else if (props.releaseInfo) emit('close-release')
  },
)

// -------------------- LOOKUP DATA --------------------
const breakpointData = computed<(BreakpointItem & { active: boolean }) | null>(() => {
  if (props.selectedItem?.type !== 'breakpoint') return null
  const id = props.selectedItem.id
  const active = props.settings.breakpoints.active.find(bp => bp.id === id)
  if (active) return { ...active, active: true }
  const inactive = props.settings.breakpoints.inactive.find(bp => bp.id === id)
  if (inactive) return { ...inactive, active: false }
  return null
})

const mockData = computed<(MockRule & { active: boolean }) | null>(() => {
  if (props.selectedItem?.type !== 'mock') return null
  const id = props.selectedItem.id
  const active = props.settings.mocks.active.find(m => m.id === id)
  if (active) return { ...active, active: true }
  const inactive = props.settings.mocks.inactive.find(m => m.id === id)
  if (inactive) return { ...inactive, active: false }
  return null
})

const blacklistData = computed<{ name: string; active: boolean } | null>(() => {
  if (props.selectedItem?.type !== 'blacklist') return null
  const name = props.selectedItem.id
  if (props.settings.blacklist.active.includes(name)) return { name, active: true }
  if (props.settings.blacklist.inactive.includes(name)) return { name, active: false }
  return null
})

const favoriteData = computed<FavoriteItem | null>(() => {
  if (props.selectedItem?.type !== 'favorite') return null
  return props.settings.favorites.find(f => f.id === props.selectedItem!.id) || null
})

const piniaFavoriteData = computed<PiniaFavoriteItem | null>(() => {
  if (props.selectedItem?.type !== 'pinia-favorite') return null
  return props.settings.piniaFavorites?.find(f => f.id === props.selectedItem!.id) || null
})

const headerLinkGroup = computed(() => {
  if (props.selectedItem?.type !== 'header-link') return null
  const selKey = props.selectedItem.id
  const list = props.settings.networkHeaderLinks
  if (!Array.isArray(list)) return null
  const rules = list.filter((r) => r.headerName.toLowerCase() === selKey.toLowerCase())
  if (!rules.length) return null
  return {
    headerKey: selKey.toLowerCase(),
    displayHeader: rules[0]!.headerName,
    rules,
  }
})

const headerLinkLatestAdded = computed(() => {
  const g = headerLinkGroup.value
  if (!g?.rules.length) return null
  return g.rules.reduce((latest, r) => (r.addedAt > latest ? r.addedAt : latest), g.rules[0]!.addedAt)
})

const editedHeaderLinkRows = ref<HeaderLinkRuleRowDraft[]>([])
watch(
  () => [props.headerLinkEditMode, headerLinkGroup.value] as const,
  ([editMode, group]) => {
    if (editMode && group) {
      editedHeaderLinkRows.value = group.rules.map((r) => ({
        id: r.id,
        host: r.host,
        urlTemplate: r.urlTemplate,
        addedAt: r.addedAt,
      }))
    }
  },
  { immediate: true },
)

function saveHeaderLinkEdit() {
  const group = headerLinkGroup.value
  if (!group) return
  if (!Array.isArray(props.settings.networkHeaderLinks)) {
    props.settings.networkHeaderLinks = []
  }
  replaceHeaderLinkRulesForHeaderName(
    props.settings.networkHeaderLinks,
    group.displayHeader,
    editedHeaderLinkRows.value,
  )
  emit('header-link-edit-done')
}

function cancelHeaderLinkEdit() {
  emit('header-link-edit-done')
}

// Pinia favorite edit state
const editedPiniaFavoriteName = ref('')
watch(
  () => [props.piniaFavoriteEditMode, piniaFavoriteData.value] as const,
  ([editMode, data]) => {
    if (editMode && data) {
      editedPiniaFavoriteName.value = data.name
    }
  },
  { immediate: true }
)

function savePiniaFavoriteEdit() {
  const fav = piniaFavoriteData.value
  if (!fav || !props.settings.piniaFavorites) return
  const newName = editedPiniaFavoriteName.value.trim()
  if (!newName) return
  const idx = props.settings.piniaFavorites.findIndex(f => f.id === fav.id)
  if (idx === -1) return
  const updated = { ...fav, id: newName, name: newName }
  props.settings.piniaFavorites[idx] = updated
  emit('pinia-favorite-edit-done', newName)
}

function cancelPiniaFavoriteEdit() {
  emit('pinia-favorite-edit-done')
}

const siteListDetailData = computed<SiteListEntry | null>(() => {
  const sel = props.selectedItem
  if (!sel || (sel.type !== 'site-blacklist' && sel.type !== 'site-whitelist')) return null
  const ar = props.settings.autoRun
  if (!ar) return null
  const id = sel.id
  if (sel.type === 'site-blacklist') {
    return ar.siteBlacklist.find(e => e.id === id) ?? null
  }
  return ar.siteWhitelist.find(e => e.id === id) ?? null
})

const editedSiteListPattern = ref('')
watch(
  () => [props.siteListEditMode, siteListDetailData.value] as const,
  ([editMode, data]) => {
    if (editMode && data) {
      editedSiteListPattern.value = data.pattern
    }
  },
  { immediate: true }
)

function saveSiteListEdit() {
  const data = siteListDetailData.value
  const sel = props.selectedItem
  if (!data || !sel || (sel.type !== 'site-blacklist' && sel.type !== 'site-whitelist')) return
  const next = editedSiteListPattern.value.trim()
  if (!next) return
  const ar = props.settings.autoRun
  if (!ar) return
  const list = sel.type === 'site-blacklist' ? ar.siteBlacklist : ar.siteWhitelist
  if (list.some(e => e.pattern === next && e.id !== data.id)) return
  const idx = list.findIndex(e => e.id === data.id)
  if (idx === -1) return
  list[idx] = { ...data, pattern: next }
  emit('site-list-edit-done')
}

function cancelSiteListEdit() {
  emit('site-list-edit-done')
}

const savedFileData = computed<SavedFile | null>(() => {
  if (props.selectedItem?.type !== 'saved-file') return null
  const id = props.selectedItem!.id
  if (id.startsWith('wallpaper_')) {
    const wp = props.settings.customize?.image?.wallpapers?.find(w => w.id === id)
    return wp ? { id: wp.id, name: wp.name, size: wp.size, mimeType: wp.mimeType } : null
  }
  return props.settings.savedFiles?.find(f => f.id === id) || null
})

// -------------------- FILE PREVIEW HELPERS --------------------
async function getFileBlob(fileId: string): Promise<Blob | null> {
  if (fileId.startsWith('wallpaper_')) {
    return getWallpaperBlob(fileId)
  }
  return getMediaBlob(fileId)
}

function isImageFile(mime: string): boolean {
  return mime.startsWith('image/')
}

function isAudioFile(mime: string): boolean {
  return mime.startsWith('audio/')
}

function isVideoFile(mime: string): boolean {
  return mime.startsWith('video/')
}

function isTextFile(mime: string): boolean {
  const textPrefixes = [
    'text/', 'application/json', 'application/xml', 'application/javascript',
    'application/typescript', 'application/x-yaml', 'application/yaml',
    'application/csv', 'application/x-sh', 'application/sql',
  ]
  return textPrefixes.some(t => mime.startsWith(t))
}

const textPreviewContent = ref('(loading...)')

watch(savedFileData, async (file) => {
  textPreviewContent.value = '(loading...)'
  if (!file || !isTextFile(file.mimeType)) return
  try {
    const blob = await getFileBlob(file.id)
    if (blob) {
      textPreviewContent.value = await blob.text()
    } else {
      textPreviewContent.value = '(no data)'
    }
  } catch (error) {
    console.error('[settings/SettingsDetails] getFileBlob/text failed:', error)
    textPreviewContent.value = '(unable to decode)'
  }
}, { immediate: true })

function isOfficeFile(mime: string): boolean {
  const officeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
  ]
  return officeTypes.includes(mime)
}

function getOfficeFileLabel(mime: string): string {
  if (mime.includes('word') || mime.includes('document')) return 'Word Document'
  if (mime.includes('excel') || mime.includes('sheet')) return 'Excel Spreadsheet'
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PowerPoint Presentation'
  return 'Office Document'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

async function downloadSavedFile(file: SavedFile) {
  try {
    const blob = await getFileBlob(file.id)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('[settings/SettingsDetails] downloadSavedFile failed:', file.id, error)
  }
}

function getFileUrl(file: SavedFile): string {
  return mediaUrls[file.id] || ''
}

const officeBlobUrl = ref<string | null>(null)

watch(savedFileData, async (file) => {
  if (officeBlobUrl.value) {
    URL.revokeObjectURL(officeBlobUrl.value)
    officeBlobUrl.value = null
  }
  if (file && isOfficeFile(file.mimeType)) {
    try {
      const blob = await getFileBlob(file.id)
      if (blob) officeBlobUrl.value = URL.createObjectURL(blob)
    } catch (error) {
      console.error('[settings/SettingsDetails] officeBlobUrl getFileBlob failed:', file.id, error)
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (officeBlobUrl.value) {
    URL.revokeObjectURL(officeBlobUrl.value)
  }
})

// -------------------- FORMATTERS --------------------
function formatBreakpointUrl(bp: BreakpointItem): string {
  let url = `${bp.scheme}://${bp.host}`
  if (bp.port) url += `:${bp.port}`
  url += bp.path
  if (bp.query) url += `?${bp.query}`
  return url
}

function formatTrigger(trigger: string): string {
  if (trigger === 'both') return 'Request & Response'
  return trigger.charAt(0).toUpperCase() + trigger.slice(1)
}
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- ===== Release Info Panel ===== -->
    <template v-if="releaseInfo && !selectedItem">

      <!-- Header -->
      <div class="shrink-0 flex items-center gap-2 p-2 border-b">
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close-release')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <span v-if="releaseInfo.type === 'update-available'" class="text-sm font-semibold">
          Update Available
        </span>
        <span v-else-if="releaseInfo.type === 'up-to-date'" class="text-sm font-semibold">
          Up to Date
        </span>
        <span v-else class="text-sm font-semibold">
          Release Notes
        </span>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div class="p-4 space-y-4">

          <!-- Error -->
          <template v-if="releaseInfo.error">
            <div class="flex items-start gap-2 p-3 rounded-lg bg-destructive_text/10 text-destructive_text">
              <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />
              <p class="text-sm">{{ releaseInfo.error }}</p>
            </div>
          </template>

          <!-- Update Available -->
          <template v-else-if="releaseInfo.type === 'update-available'">
            <div class="space-y-4">
              <div class="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <ArrowUpCircle class="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p class="text-sm font-semibold">Update Available</p>
                  <p class="text-sm text-muted-foreground">
                    Download new version {{ releaseInfo.version }}
                  </p>
                </div>
              </div>

              <div>
                <span class="text-xs text-muted-foreground">What's New</span>
                <div class="mt-2 text-sm break-words font-sans leading-relaxed markdown-body" v-html="renderedBody" />
              </div>

              <div class="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-1.5"
                  @click="emit('ignore-version', releaseInfo!.version)"
                >
                  <EyeOff class="w-3.5 h-3.5" />
                  Ignore
                </Button>
                <Button
                  size="sm"
                  class="gap-1.5"
                  :disabled="!releaseInfo.downloadUrl"
                  @click="releaseInfo!.downloadUrl && emit('download-update', releaseInfo!.downloadUrl)"
                >
                  <Download class="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
            </div>
          </template>

          <!-- Up to Date -->
          <template v-else-if="releaseInfo.type === 'up-to-date'">
            <div class="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <CheckCircle2 class="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p class="text-sm font-semibold">You're up to date!</p>
                <p class="text-sm text-muted-foreground">
                  Version {{ releaseInfo.version }} is the latest.
                </p>
              </div>
            </div>

            <div v-if="releaseInfo.body">
              <span class="text-xs text-muted-foreground">Current Release Notes</span>
              <div class="mt-2 text-sm break-words font-sans leading-relaxed markdown-body" v-html="renderedBody" />
            </div>
          </template>

          <!-- Release Notes -->
          <template v-else>
            <div v-if="releaseInfo.version" class="text-xs text-muted-foreground">
              Version {{ releaseInfo.version }}
            </div>
            <div class="text-sm break-words font-sans leading-relaxed markdown-body" v-html="renderedBody" />
          </template>

        </div>
      </ScrollArea>
    </template>

    <!-- ===== Selected Item Details ===== -->
    <template v-else-if="selectedItem">
      <!-- Header -->
      <div class="shrink-0 flex items-center gap-2 p-2 border-b">
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm font-semibold">
          {{ detailsTitle }}
        </span>
        <div class="flex-1" />
        <Button
          v-if="selectedItem.type === 'breakpoint' || selectedItem.type === 'mock'"
          variant="outline"
          size="sm"
          class="h-7 text-xs gap-1.5"
          @click="emit('edit')"
        >
          <Pencil class="h-3.5 w-3.5" />
          Edit
        </Button>
        <!-- Pinia favorite: Edit/Cancel/Save icons -->
        <template v-else-if="selectedItem.type === 'pinia-favorite' && piniaFavoriteData">
          <template v-if="!piniaFavoriteEditMode">
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Edit" @click="emit('edit')">
              <Edit class="h-4 w-4" />
            </Button>
          </template>
          <template v-else>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Cancel" @click="cancelPiniaFavoriteEdit">
              <X class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Save" :disabled="!editedPiniaFavoriteName.trim()" @click="savePiniaFavoriteEdit">
              <Save class="h-4 w-4" />
            </Button>
          </template>
        </template>
        <template v-else-if="selectedItem.type === 'header-link' && headerLinkGroup">
          <template v-if="!headerLinkEditMode">
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Edit" @click="emit('edit')">
              <Edit class="h-4 w-4" />
            </Button>
          </template>
          <template v-else>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Cancel" @click="cancelHeaderLinkEdit">
              <X class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Save" @click="saveHeaderLinkEdit">
              <Save class="h-4 w-4" />
            </Button>
          </template>
        </template>
        <template v-else-if="(selectedItem.type === 'site-blacklist' || selectedItem.type === 'site-whitelist') && siteListDetailData">
          <template v-if="!siteListEditMode">
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Edit" @click="emit('edit')">
              <Edit class="h-4 w-4" />
            </Button>
          </template>
          <template v-else>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Cancel" @click="cancelSiteListEdit">
              <X class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-7 w-7" title="Save" :disabled="!editedSiteListPattern.trim()" @click="saveSiteListEdit">
              <Save class="h-4 w-4" />
            </Button>
          </template>
        </template>
      </div>

      <!-- Content -->
      <ScrollArea class="flex-1 min-h-0">
        <div class="p-4 space-y-4">

          <!-- Breakpoint Details -->
          <template v-if="selectedItem.type === 'breakpoint' && breakpointData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">URL Pattern</span>
                <p class="font-mono text-sm break-all mt-1">{{ formatBreakpointUrl(breakpointData) }}</p>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Method</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.method || 'All' }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Status</span>
                  <p class="text-sm mt-1">{{ breakpointData.active ? 'Active' : 'Disabled' }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Scheme</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.scheme }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Host</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.host }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div v-if="breakpointData.port">
                  <span class="text-xs text-muted-foreground">Port</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.port }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Path</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.path }}</p>
                </div>
              </div>

              <div v-if="breakpointData.query">
                <span class="text-xs text-muted-foreground">Query</span>
                <p class="text-sm font-mono mt-1">{{ breakpointData.query }}</p>
              </div>

              <div>
                <span class="text-xs text-muted-foreground">Created</span>
                <p class="text-sm mt-1">{{ new Date(breakpointData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Mock Details -->
          <template v-else-if="selectedItem.type === 'mock' && mockData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">URL Pattern</span>
                <p class="font-mono text-sm break-all mt-1">
                  {{ mockData.method ? mockData.method + ' ' : '' }}{{ mockData.scheme || '*' }}://{{ mockData.host || '*' }}{{ mockData.port ? ':' + mockData.port : '' }}{{ mockData.path || '/*' }}{{ mockData.query ? '?' + mockData.query : '' }}
                </p>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Status</span>
                  <p
                    class="text-sm font-mono mt-1"
                    :class="{
                      'text-green-500': mockData.status >= 200 && mockData.status < 300,
                      'text-orange-500': mockData.status >= 400 && mockData.status < 500,
                      'text-red-500': mockData.status >= 500
                    }"
                  >
                    {{ mockData.status }} {{ mockData.statusText || '' }}
                  </p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Delay</span>
                  <p class="text-sm mt-1">{{ mockData.delay ? mockData.delay + 'ms' : 'None' }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">State</span>
                  <p class="text-sm mt-1">{{ mockData.active ? 'Active' : 'Disabled' }}</p>
                </div>
              </div>

              <div v-if="mockData.headers?.length">
                <span class="text-xs text-muted-foreground">Headers</span>
                <div class="mt-1 space-y-1">
                  <div v-for="(h, i) in mockData.headers" :key="i" class="font-mono text-xs">
                    <span class="text-muted-foreground">{{ h.name }}:</span> {{ h.value }}
                  </div>
                </div>
              </div>

              <div v-if="mockData.body !== undefined">
                <span class="text-xs text-muted-foreground">Body</span>
                <ScrollArea class="mt-1 rounded bg-muted/50 mock-body-scroll">
                  <pre class="text-xs font-mono p-2 whitespace-pre-wrap break-all">{{ mockData.body || '(empty)' }}</pre>
                </ScrollArea>
              </div>

              <div v-if="mockData.description">
                <span class="text-xs text-muted-foreground">Description</span>
                <p class="text-sm mt-1">{{ mockData.description }}</p>
              </div>

              <div>
                <span class="text-xs text-muted-foreground">Created</span>
                <p class="text-sm mt-1">{{ new Date(mockData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Blacklist Details -->
          <template v-else-if="selectedItem.type === 'blacklist' && blacklistData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">Component Name</span>
                <p class="font-mono text-sm mt-1">{{ blacklistData.name }}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Status</span>
                <p class="text-sm mt-1">{{ blacklistData.active ? 'Blocked' : 'Allowed' }}</p>
              </div>
            </div>
          </template>

          <!-- Favorite Details -->
          <template v-else-if="selectedItem.type === 'favorite' && favoriteData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">Component Name</span>
                <p class="font-mono text-sm mt-1">{{ favoriteData.name }}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Element</span>
                <p class="font-mono text-sm mt-1">
                  {{ favoriteData.tagName }}{{ favoriteData.className ? '.' + favoriteData.className : '' }}
                </p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Added</span>
                <p class="text-sm mt-1">{{ new Date(favoriteData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Pinia Favorite Details -->
          <template v-else-if="selectedItem.type === 'pinia-favorite' && piniaFavoriteData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">Store Name</span>
                <Input
                  v-if="piniaFavoriteEditMode"
                  v-model="editedPiniaFavoriteName"
                  class="mt-1 font-mono"
                  placeholder="Store name"
                  @keydown.enter.prevent="savePiniaFavoriteEdit"
                />
                <p v-else class="font-mono text-sm mt-1">{{ piniaFavoriteData.name }}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Added</span>
                <p class="text-sm mt-1">{{ new Date(piniaFavoriteData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Network header link (grouped by header name; Host | Link table) -->
          <template v-else-if="selectedItem.type === 'header-link'">
            <HeaderLinkGroupBody
              v-if="headerLinkGroup"
              v-model="editedHeaderLinkRows"
              :display-header="headerLinkGroup.displayHeader"
              :edit-mode="!!headerLinkEditMode"
              :readonly-rules="headerLinkGroup.rules"
              :last-updated="headerLinkLatestAdded"
              @submit="saveHeaderLinkEdit"
            />
            <p v-else class="text-sm text-muted-foreground">This header link was removed.</p>
          </template>

          <!-- Site blacklist / whitelist entry -->
          <template v-else-if="(selectedItem.type === 'site-blacklist' || selectedItem.type === 'site-whitelist') && siteListDetailData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">Pattern</span>
                <Input
                  v-if="siteListEditMode"
                  v-model="editedSiteListPattern"
                  class="mt-1 font-mono"
                  placeholder="Origin pattern"
                  @keydown.enter.prevent="saveSiteListEdit"
                />
                <p v-else class="font-mono text-sm mt-1 break-all">{{ siteListDetailData.pattern }}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Added</span>
                <p class="text-sm mt-1">{{ new Date(siteListDetailData.addedAt).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Saved File Preview -->
          <template v-else-if="selectedItem.type === 'saved-file' && savedFileData">
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Name</span>
                  <p class="text-sm font-mono mt-1 break-all">{{ savedFileData.name }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Size</span>
                  <p class="text-sm mt-1">{{ formatFileSize(savedFileData.size) }}</p>
                </div>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Type</span>
                <p class="text-sm font-mono mt-1">{{ savedFileData.mimeType }}</p>
              </div>

              <!-- Image -->
              <div v-if="isImageFile(savedFileData.mimeType)">
                <span class="text-xs text-muted-foreground">Preview</span>
                <div class="mt-2 rounded-lg border overflow-hidden bg-muted/20 flex items-center justify-center p-2">
                  <img
                    :src="getFileUrl(savedFileData)"
                    :alt="savedFileData.name"
                    class="max-w-full max-h-[300px] object-contain rounded"
                  />
                </div>
              </div>

              <!-- Audio -->
              <div v-else-if="isAudioFile(savedFileData.mimeType)">
                <span class="text-xs text-muted-foreground">Preview</span>
                <audio :src="getFileUrl(savedFileData)" controls class="w-full mt-2" />
              </div>

              <!-- Video -->
              <div v-else-if="isVideoFile(savedFileData.mimeType)">
                <span class="text-xs text-muted-foreground">Preview</span>
                <video
                  :src="getFileUrl(savedFileData)"
                  controls
                  class="w-full mt-2 rounded-lg max-h-[300px]"
                />
              </div>

              <!-- Text / JSON / XML / Code -->
              <div v-else-if="isTextFile(savedFileData.mimeType)">
                <span class="text-xs text-muted-foreground">Preview</span>
                <ScrollArea class="mt-2 rounded bg-muted/50 saved-file-text-scroll">
                  <pre class="text-xs font-mono p-3 whitespace-pre-wrap break-all">{{ textPreviewContent }}</pre>
                </ScrollArea>
              </div>

              <!-- PDF -->
              <div v-else-if="savedFileData.mimeType === 'application/pdf'">
                <span class="text-xs text-muted-foreground">Preview</span>
                <iframe
                  :src="getFileUrl(savedFileData)"
                  class="w-full h-[300px] mt-2 rounded-lg border"
                />
              </div>

              <!-- Word / Excel / PowerPoint -->
              <div v-else-if="isOfficeFile(savedFileData.mimeType)">
                <span class="text-xs text-muted-foreground">Preview</span>
                <div class="mt-2 rounded-lg border bg-muted/20 overflow-hidden">
                  <div class="flex flex-col items-center justify-center py-8 px-4 gap-3">
                    <component
                      :is="savedFileData.mimeType.includes('sheet') || savedFileData.mimeType.includes('excel') ? FileSpreadsheet : FileText"
                      class="h-12 w-12 text-muted-foreground/60"
                    />
                    <div class="text-center">
                      <p class="text-sm font-medium">{{ getOfficeFileLabel(savedFileData.mimeType) }}</p>
                      <p class="text-xs text-muted-foreground mt-1">{{ savedFileData.name }}</p>
                    </div>
                    <div class="flex gap-2 mt-2">
                      <Button
                        v-if="officeBlobUrl"
                        variant="outline"
                        size="sm"
                        class="gap-1.5 text-xs"
                        as="a"
                        :href="officeBlobUrl"
                        target="_blank"
                      >
                        Open
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        class="gap-1.5 text-xs"
                        @click="downloadSavedFile(savedFileData!)"
                      >
                        <Download class="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SVG (may not start with image/) -->
              <div v-else-if="savedFileData.mimeType === 'image/svg+xml'">
                <span class="text-xs text-muted-foreground">Preview</span>
                <div class="mt-2 rounded-lg border overflow-hidden bg-muted/20 flex items-center justify-center p-2">
                  <img
                    :src="getFileUrl(savedFileData)"
                    :alt="savedFileData.name"
                    class="max-w-full max-h-[300px] object-contain"
                  />
                </div>
              </div>

              <!-- Unsupported type -->
              <div v-else class="mt-3 text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
                Preview not available for this file type
              </div>
            </div>
          </template>

          <!-- Item was deleted -->
          <template v-else>
            <div class="text-center py-8 text-muted-foreground">
              Item no longer exists
            </div>
          </template>

        </div>
      </ScrollArea>
    </template>

    <!-- No selection -->
    <div v-else class="h-full flex items-center justify-center text-muted-foreground">
      Select an item to see details
    </div>
  </div>
</template>

<style scoped>
.mock-body-scroll :deep([data-reka-scroll-area-viewport]) {
  max-height: 200px;
  height: auto !important;
}
.saved-file-text-scroll :deep([data-reka-scroll-area-viewport]) {
  max-height: 300px;
  height: auto !important;
}
</style>
