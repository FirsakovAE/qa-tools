<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useInspectorSettings, resetInspectorSettings, exportSettings, importSettings } from '@/settings/useInspectorSettings'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/Sheet'
import {
  Settings,
  Globe,
  Box,
  Database,
  Info,
  MenuIcon,
} from 'lucide-vue-next'

import GeneralSection from './sections/GeneralSection.vue'
import NetworkSection from './sections/NetworkSection.vue'
import PropsSection from './sections/PropsSection.vue'
import PiniaSection from './sections/PiniaSection.vue'
import AboutSection from './sections/AboutSection.vue'
import SettingsDetails from './SettingsDetails.vue'
import BreakpointForm from '@/features/network/BreakpointForm.vue'
import MockForm from '@/features/network/MockForm.vue'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import type { NetworkEntry } from '@/types/network'

import type { GitHubRelease, ReleaseDisplayInfo } from '@/services/githubReleaseService'
import { compareVersions } from '@/services/githubReleaseService'
import { ignoreVersion } from '@/composables/useUpdateChecker'
import { useRuntime } from '@/runtime'
import { postToContentScript } from '@/utils/postToContentScript'

// -------------------- PROPS --------------------
const props = defineProps<{
  scrollToAnchor?: string | null
  pendingAboutRelease?: GitHubRelease | null
}>()

const emit = defineEmits<{
  (e: 'clearScrollAnchor'): void
  (e: 'clearPendingAboutRelease'): void
}>()

// -------------------- RUNTIME --------------------
const runtime = useRuntime()

// -------------------- STATE --------------------
const settings = ref<InspectorSettings | null>(null)
const isLoading = ref(true)

// -------------------- SECTIONS --------------------
type SettingsSection = 'general' | 'network' | 'props' | 'pinia' | 'about'
const activeSection = ref<SettingsSection>('general')
const sheetOpen = ref(false)

function selectSection(id: SettingsSection) {
  activeSection.value = id
  sheetOpen.value = false
}

const sections = [
  { id: 'general' as const, label: 'General', icon: Settings },
  { id: 'network' as const, label: 'Network', icon: Globe },
  { id: 'props' as const, label: 'Props', icon: Box },
  { id: 'pinia' as const, label: 'Pinia Store', icon: Database },
  { id: 'about' as const, label: 'About', icon: Info },
]

// -------------------- SELECTED ITEM --------------------
type SelectedItemType = 'breakpoint' | 'mock' | 'blacklist' | 'favorite' | 'pinia-favorite' | 'saved-file'
const selectedItem = ref<{ type: SelectedItemType; id: string } | null>(null)

watch(activeSection, () => {
  selectedItem.value = null
  piniaFavoriteEditMode.value = false
  if (activeSection.value !== 'about') {
    releaseInfo.value = null
  }
})

function onSelectItem(item: { type: SelectedItemType; id: string }) {
  selectedItem.value = item
}

// -------------------- EDIT MODE --------------------
const editMode = ref<'breakpoint' | 'mock' | null>(null)
const editEntry = ref<NetworkEntry | null>(null)
const editExistingBreakpoint = ref<BreakpointItem | null>(null)
const editExistingMock = ref<MockRule | null>(null)

function buildEntryFromBreakpoint(bp: BreakpointItem): NetworkEntry {
  const url = `${bp.scheme}://${bp.host}${bp.port ? ':' + bp.port : ''}${bp.path}${bp.query ? '?' + bp.query : ''}`
  return {
    id: bp.id, version: 1, timestamp: bp.timestamp,
    method: bp.method || 'GET', url, path: bp.path,
    name: bp.path.split('/').pop() || bp.path,
    status: 0, statusText: '', duration: 0, size: 0,
    requestHeaders: [], responseHeaders: [], params: [],
    authorization: { type: 'None' },
    requestBody: null, responseBody: null,
    pending: false, initiator: 'fetch'
  }
}

function buildEntryFromMock(mock: MockRule): NetworkEntry {
  const url = `${mock.scheme || 'https'}://${mock.host || 'example.com'}${mock.port ? ':' + mock.port : ''}${mock.path || '/'}${mock.query ? '?' + mock.query : ''}`
  return {
    id: mock.id, version: 1, timestamp: mock.timestamp,
    method: mock.method || 'GET', url, path: mock.path || '/',
    name: (mock.path || '/').split('/').pop() || '/',
    status: mock.status, statusText: mock.statusText || '', duration: 0, size: 0,
    requestHeaders: [],
    responseHeaders: mock.headers.map(h => ({ name: h.name, value: h.value })),
    params: [], authorization: { type: 'None' },
    requestBody: null,
    responseBody: mock.body !== undefined ? { text: mock.body || '', contentType: 'application/json', originalSize: (mock.body || '').length, truncated: false, isBinary: false } : null,
    pending: false, initiator: 'fetch'
  }
}

function findBreakpointById(id: string): BreakpointItem | null {
  if (!settings.value?.breakpoints) return null
  return settings.value.breakpoints.active.find(bp => bp.id === id)
    || settings.value.breakpoints.inactive.find(bp => bp.id === id)
    || null
}

function findMockById(id: string): MockRule | null {
  if (!settings.value?.mocks) return null
  return settings.value.mocks.active.find(m => m.id === id)
    || settings.value.mocks.inactive.find(m => m.id === id)
    || null
}

function handleEditBreakpoint(id: string) {
  const bp = findBreakpointById(id)
  if (!bp) return
  editExistingBreakpoint.value = bp
  editEntry.value = buildEntryFromBreakpoint(bp)
  editMode.value = 'breakpoint'
}

function handleEditMock(id: string) {
  const mock = findMockById(id)
  if (!mock) return
  editExistingMock.value = mock
  editEntry.value = buildEntryFromMock(mock)
  editMode.value = 'mock'
}

function handleEditFromDetails() {
  if (!selectedItem.value) return
  if (selectedItem.value.type === 'breakpoint') {
    handleEditBreakpoint(selectedItem.value.id)
  } else if (selectedItem.value.type === 'mock') {
    handleEditMock(selectedItem.value.id)
  } else if (selectedItem.value.type === 'pinia-favorite') {
    piniaFavoriteEditMode.value = true
  }
}

function handleEditFormBack() {
  editMode.value = null
  editEntry.value = null
  editExistingBreakpoint.value = null
  editExistingMock.value = null
  piniaFavoriteEditMode.value = false
}

const piniaFavoriteEditMode = ref(false)

function handleEditPiniaFavorite(item: { type: 'pinia-favorite'; id: string }) {
  selectedItem.value = item
  piniaFavoriteEditMode.value = true
}

function handlePiniaFavoriteEditDone(newId?: string) {
  piniaFavoriteEditMode.value = false
  if (newId && selectedItem.value?.type === 'pinia-favorite') {
    selectedItem.value = { type: 'pinia-favorite', id: newId }
  }
}

function handleBreakpointEditConfirm(breakpoint: BreakpointItem) {
  if (!settings.value?.breakpoints) return
  const bps = settings.value.breakpoints

  // Update in active list
  const activeIdx = bps.active.findIndex(bp => bp.id === breakpoint.id)
  if (activeIdx !== -1) {
    bps.active[activeIdx] = breakpoint
  } else {
    // Update in inactive list
    const inactiveIdx = bps.inactive.findIndex(bp => bp.id === breakpoint.id)
    if (inactiveIdx !== -1) {
      bps.inactive[inactiveIdx] = breakpoint
    }
  }

  syncBreakpoints()
  handleEditFormBack()
}

function handleMockEditConfirm(mock: MockRule) {
  if (!settings.value?.mocks) return
  const mocks = settings.value.mocks

  // Update in active list
  const activeIdx = mocks.active.findIndex(m => m.id === mock.id)
  if (activeIdx !== -1) {
    mocks.active[activeIdx] = mock
  } else {
    // Update in inactive list
    const inactiveIdx = mocks.inactive.findIndex(m => m.id === mock.id)
    if (inactiveIdx !== -1) {
      mocks.inactive[inactiveIdx] = mock
    }
  }

  syncMocks()
  handleEditFormBack()
}

// -------------------- RELEASE INFO --------------------
const releaseInfo = ref<ReleaseDisplayInfo | null>(null)

function handleShowRelease(info: ReleaseDisplayInfo) {
  selectedItem.value = null
  releaseInfo.value = info
}

function handleCloseRelease() {
  releaseInfo.value = null
}

async function handleIgnoreVersion(version: string) {
  await ignoreVersion(version)
  releaseInfo.value = null
}

function handleDownloadUpdate(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const optionsDetailsActive = computed(() =>
  !!selectedItem.value || !!editMode.value || !!(releaseInfo.value && activeSection.value === 'about')
)

// Handle navigation from toast "Preview" button
watch(() => props.pendingAboutRelease, (release) => {
  if (!release) return

  activeSection.value = 'about'

  const localVersion = runtime.getManifest()?.version || '0.0.0'
  const remoteVersion = release.tag_name.replace(/^v/, '')
  const hasUpdate = compareVersions(remoteVersion, localVersion) > 0

  releaseInfo.value = {
    type: hasUpdate ? 'update-available' : 'release-notes',
    body: release.body || 'No release notes available.',
    version: remoteVersion,
    downloadUrl: release.assets?.[0]?.browser_download_url ?? null,
  }

  emit('clearPendingAboutRelease')
}, { immediate: true })

// -------------------- NETWORK SYNC --------------------
function sendNetworkCommand(type: string, data: Record<string, any> = {}): void {
  postToContentScript({
    type,
    __VUE_INSPECTOR__: true,
    __NETWORK_CMD__: true,
    ...data
  })
}

function syncBreakpoints() {
  if (!settings.value?.breakpoints) return
  const breakpointsToSync = settings.value.breakpoints.active.map(bp => ({
    id: bp.id,
    scheme: bp.scheme,
    host: bp.host,
    port: bp.port,
    path: bp.path,
    query: bp.query,
    trigger: bp.trigger,
    enabled: true
  }))
  sendNetworkCommand('NETWORK_BREAKPOINTS_SYNC', {
    breakpoints: JSON.parse(JSON.stringify(breakpointsToSync))
  })
}

function syncMocks() {
  if (!settings.value?.mocks) return
  const mocksToSync = settings.value.mocks.active.map(m => ({
    id: m.id,
    enabled: true,
    scheme: m.scheme,
    host: m.host,
    port: m.port,
    path: m.path,
    query: m.query,
    method: m.method,
    status: m.status || 200,
    statusText: m.statusText || 'OK',
    headers: m.headers || [],
    body: m.body === undefined ? undefined : (m.body || ''),
    delay: m.delay
  }))
  sendNetworkCommand('NETWORK_MOCKS_SYNC', {
    mocks: JSON.parse(JSON.stringify(mocksToSync))
  })
}

// Auto-sync when breakpoints/mocks change
watch(() => settings.value?.breakpoints, () => syncBreakpoints(), { deep: true })
watch(() => settings.value?.mocks, () => syncMocks(), { deep: true })

// -------------------- ALERT DIALOG --------------------
const alertDialog = ref({
  open: false,
  title: '',
  description: '',
  type: 'info' as 'info' | 'success' | 'error'
})

function showAlert(title: string, description: string, type: 'info' | 'success' | 'error' = 'info') {
  alertDialog.value = { open: true, title, description, type }
}

// -------------------- IMPORT / EXPORT --------------------
const importError = ref<string | null>(null)

async function handleExport() {
  if (!settings.value) return
  try {
    const settingsJson = await exportSettings()
    const blob = new Blob([settingsJson], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vue-inspector-settings-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showAlert('Export Complete', 'Settings have been exported to a file.', 'success')
  } catch (error) {
    showAlert('Export Failed', 'Failed to export settings. Please try again.', 'error')
  }
}

async function handleImport() {
  if (!settings.value) return
  importError.value = null
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.txt'
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      await importSettings(text)
      const newSettings = await useInspectorSettings()
      settings.value = newSettings
      syncBreakpoints()
      syncMocks()
      showAlert('Import Complete', 'Settings have been imported successfully.', 'success')
    } catch (error) {
      importError.value = error instanceof Error ? error.message : 'Invalid settings file'
      showAlert('Import Failed', error instanceof Error ? error.message : 'Invalid settings file', 'error')
    }
  }
  input.click()
}

async function handleReset() {
  try {
    await resetInspectorSettings()
    const newSettings = await useInspectorSettings()
    settings.value = newSettings
    syncBreakpoints()
    syncMocks()
    selectedItem.value = null
    showAlert('Reset Complete', 'All settings have been reset to defaults.', 'success')
  } catch (error) {
    showAlert('Reset Failed', 'Failed to reset settings. Please try again.', 'error')
  }
}

// -------------------- SCROLL TO ANCHOR --------------------
watch(() => props.scrollToAnchor, (anchor) => {
  if (!anchor) return
  // Switch section based on anchor
  if (anchor === 'saved-files-section') {
    activeSection.value = 'general'
  } else if (anchor === 'favorites-section') {
    activeSection.value = 'props'
  } else if (anchor === 'pinia-favorites-section') {
    activeSection.value = 'pinia'
  } else {
    activeSection.value = 'network'
  }
  nextTick(() => {
    // Small delay to ensure DOM is rendered after section switch
    setTimeout(() => {
      const el = document.getElementById(anchor)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      emit('clearScrollAnchor')
    }, 50)
  })
}, { immediate: true })

// -------------------- MOUNT --------------------
onMounted(async () => {
  try {
    const loadedSettings = await useInspectorSettings()
    settings.value = loadedSettings

    // Initialize breakpoints/mocks if missing
    if (loadedSettings && !loadedSettings.breakpoints) {
      loadedSettings.breakpoints = { active: [], inactive: [] }
    }
    if (loadedSettings && !loadedSettings.mocks) {
      loadedSettings.mocks = { active: [], inactive: [] }
    }
  } catch (error) {
  } finally {
    nextTick(() => {
      isLoading.value = false
    })
  }
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="shrink-0 flex items-center gap-2 p-2 border-b" :class="{ 'toolbar-hide-on-details': optionsDetailsActive }">
      <!-- Hamburger for narrow widths -->
      <Sheet v-model:open="sheetOpen">
        <SheetTrigger as-child>
          <Button variant="outline" size="icon" class="h-8 w-8 shrink-0 options-hamburger">
            <MenuIcon class="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" class="w-[240px] p-4 text-foreground bg-background">
          <nav class="flex flex-col gap-1 mt-4">
            <Button
              v-for="section in sections"
              :key="section.id"
              variant="ghost"
              size="sm"
              :class="[
                'w-full justify-start h-10 text-sm',
                activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
              ]"
              @click="selectSection(section.id)"
            >
              <component :is="section.icon" class="w-5 h-5 mr-2 shrink-0" />
              {{ section.label }}
            </Button>
          </nav>
        </SheetContent>
      </Sheet>

      <Settings class="h-5 w-5 text-muted-foreground" />
      <h3 class="text-lg font-semibold">Options</h3>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p class="mt-2 text-muted-foreground">Loading settings...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="!settings" class="flex-1 flex items-center justify-center text-destructive_text">
      Failed to load settings
    </div>

    <!-- Content: 2-panel grid -->
    <div v-else class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden responsive-panels">

      <!-- Left: Sidebar + Content -->
      <div class="h-full min-h-0 min-w-0 flex overflow-hidden gap-2">

        <!-- Sidebar Nav (hidden at ≤1200px) -->
        <div class="options-sidebar shrink-0 w-[240px] p-1 flex flex-col gap-1 bg-muted/50 rounded-lg">
          <Button
            v-for="section in sections"
            :key="section.id"
            variant="ghost"
            size="sm"
            :class="[
              'w-full justify-start h-10 text-sm',
              activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
            ]"
            @click="activeSection = section.id"
          >
            <component :is="section.icon" class="w-5 h-5 mr-2 shrink-0" />
            {{ section.label }}
          </Button>
        </div>

        <!-- Section Content -->
        <ScrollArea class="options-section-scroll flex-1 min-h-0 min-w-0 border rounded-lg">
          <div class="p-4 min-w-0 overflow-hidden">
            <GeneralSection
              v-if="activeSection === 'general'"
              :settings="settings"
              :selected-item-id="selectedItem?.type === 'saved-file' ? selectedItem.id : null"
              @import="handleImport"
              @export="handleExport"
              @reset="handleReset"
              @select="onSelectItem"
            />
            <NetworkSection
              v-else-if="activeSection === 'network'"
              :settings="settings"
              :selected-item-id="selectedItem?.type === 'breakpoint' || selectedItem?.type === 'mock' ? selectedItem.id : null"
              @select="onSelectItem"
              @edit-breakpoint="handleEditBreakpoint"
              @edit-mock="handleEditMock"
            />
            <PropsSection
              v-else-if="activeSection === 'props'"
              :settings="settings"
              :selected-item-id="selectedItem?.type === 'blacklist' || selectedItem?.type === 'favorite' ? selectedItem.id : null"
              @select="onSelectItem"
            />
            <PiniaSection
              v-else-if="activeSection === 'pinia'"
              :settings="settings"
              :selected-item-id="selectedItem?.type === 'pinia-favorite' ? selectedItem.id : null"
              @select="onSelectItem"
              @edit="handleEditPiniaFavorite"
            />
            <AboutSection
              v-else-if="activeSection === 'about'"
              :settings="settings"
              @show-release="handleShowRelease"
            />
          </div>
        </ScrollArea>
      </div>

      <!-- Right: Details Panel / Edit Forms -->
      <div class="h-full min-h-0 overflow-hidden border rounded-lg details-panel" :class="{
        'ring-2 ring-amber-500': editMode === 'breakpoint',
        'ring-2 ring-purple-500': editMode === 'mock',
        'details-active': optionsDetailsActive
      }">
        <BreakpointForm
          v-if="editMode === 'breakpoint' && editEntry"
          :entry="editEntry"
          :existing-breakpoint="editExistingBreakpoint ?? undefined"
          @back="handleEditFormBack"
          @confirm="handleBreakpointEditConfirm"
        />

        <MockForm
          v-else-if="editMode === 'mock' && editEntry"
          :entry="editEntry"
          :existing-mock="editExistingMock ?? undefined"
          @back="handleEditFormBack"
          @confirm="handleMockEditConfirm"
        />

        <SettingsDetails
          v-else
          :settings="settings"
          :selected-item="selectedItem"
          :release-info="activeSection === 'about' ? releaseInfo : null"
          :pinia-favorite-edit-mode="piniaFavoriteEditMode"
          @close="selectedItem = null; piniaFavoriteEditMode = false"
          @close-release="handleCloseRelease"
          @ignore-version="handleIgnoreVersion"
          @download-update="handleDownloadUpdate"
          @edit="handleEditFromDetails"
          @pinia-favorite-edit-done="handlePiniaFavoriteEditDone"
        />
      </div>
    </div>

    <!-- Alert Dialog -->
    <AlertDialog :open="alertDialog.open" @update:open="(open: boolean) => alertDialog.open = open">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ alertDialog.title }}</AlertDialogTitle>
          <AlertDialogDescription>{{ alertDialog.description }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="justify-center">
          <AlertDialogAction @click="alertDialog.open = false">OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped>
.options-hamburger {
  display: none;
}

@media (max-width: 1200px) {
  .options-hamburger {
    display: inline-flex;
  }
  .options-sidebar {
    display: none;
  }
}

/* Allow section content to shrink so long filenames truncate */
.options-section-scroll :deep([data-reka-scroll-area-viewport] > div) {
  min-width: 0;
}
</style>
