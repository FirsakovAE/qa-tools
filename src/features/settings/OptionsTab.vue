<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, defineAsyncComponent } from 'vue'
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
  FileText,
  Sparkles,
} from 'lucide-vue-next'

import GeneralSection from './sections/GeneralSection.vue'
import NetworkSection from './sections/NetworkSection.vue'
import PropsSection from './sections/PropsSection.vue'
import PiniaSection from './sections/PiniaSection.vue'
import LogsSection from './sections/LogsSection.vue'
import AboutSection from './sections/AboutSection.vue'
import SupportMenu from './components/SupportMenu.vue'
import SettingsDetails from './SettingsDetails.vue'
import BreakpointForm from '@/features/network/BreakpointForm.vue'
import MockForm from '@/features/network/MockForm.vue'
import type { BreakpointItem, MockRule } from '@/types/inspector'
import { useI18n, type MessageKey } from '@/i18n'
import type { NetworkEntry } from '@/types/network'

import type { GitHubRelease, ReleaseDisplayInfo } from '@/services/githubReleaseService'
import { compareVersions } from '@/services/githubReleaseService'
import { ignoreVersion } from '@/composables/useUpdateChecker'
import { useRuntime } from '@/runtime'
import { postToContentScript } from '@/utils/postToContentScript'

const AiSection = defineAsyncComponent(() => import('@/features/ai/AiSection.vue'))

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
type SettingsSection = 'general' | 'network' | 'props' | 'pinia' | 'logs' | 'ai' | 'about'
const activeSection = ref<SettingsSection>('general')
const sheetOpen = ref(false)

function selectSection(id: SettingsSection) {
  activeSection.value = id
  sheetOpen.value = false
}

const { t } = useI18n()

const sectionDefs = [
  { id: 'general' as const, labelKey: 'options.general' as MessageKey, icon: Settings },
  { id: 'network' as const, labelKey: 'options.network' as MessageKey, icon: Globe },
  { id: 'props' as const, labelKey: 'options.props' as MessageKey, icon: Box },
  { id: 'pinia' as const, labelKey: 'options.pinia' as MessageKey, icon: Database },
  { id: 'logs' as const, labelKey: 'options.logs' as MessageKey, icon: FileText },
  { id: 'ai' as const, labelKey: 'options.ai' as MessageKey, icon: Sparkles },
  { id: 'about' as const, labelKey: 'options.about' as MessageKey, icon: Info },
]

const sections = computed(() => sectionDefs.map(section => ({ ...section, label: t(section.labelKey) })))

// -------------------- SELECTED ITEM --------------------
type SelectedItemType = 'breakpoint' | 'mock' | 'header-link' | 'blacklist' | 'favorite' | 'pinia-favorite' | 'saved-file' | 'site-blacklist' | 'site-whitelist'
const selectedItem = ref<{ type: SelectedItemType; id: string } | null>(null)

watch(activeSection, () => {
  selectedItem.value = null
  piniaFavoriteEditMode.value = false
  siteListEditMode.value = false
  headerLinkEditMode.value = false
  if (activeSection.value !== 'about') {
    releaseInfo.value = null
  }
})

function onSelectItem(item: { type: SelectedItemType; id: string }) {
  selectedItem.value = item
  piniaFavoriteEditMode.value = false
  siteListEditMode.value = false
  headerLinkEditMode.value = false
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
    piniaFavoriteEditMode.value = false
    siteListEditMode.value = false
    headerLinkEditMode.value = false
    handleEditBreakpoint(selectedItem.value.id)
  } else if (selectedItem.value.type === 'mock') {
    piniaFavoriteEditMode.value = false
    siteListEditMode.value = false
    headerLinkEditMode.value = false
    handleEditMock(selectedItem.value.id)
  } else if (selectedItem.value.type === 'pinia-favorite') {
    siteListEditMode.value = false
    headerLinkEditMode.value = false
    piniaFavoriteEditMode.value = true
  } else if (selectedItem.value.type === 'header-link') {
    piniaFavoriteEditMode.value = false
    siteListEditMode.value = false
    headerLinkEditMode.value = true
  } else if (selectedItem.value.type === 'site-blacklist' || selectedItem.value.type === 'site-whitelist') {
    piniaFavoriteEditMode.value = false
    headerLinkEditMode.value = false
    siteListEditMode.value = true
  }
}

function handleEditFormBack() {
  editMode.value = null
  editEntry.value = null
  editExistingBreakpoint.value = null
  editExistingMock.value = null
  piniaFavoriteEditMode.value = false
  siteListEditMode.value = false
  headerLinkEditMode.value = false
}

const piniaFavoriteEditMode = ref(false)
const siteListEditMode = ref(false)
const headerLinkEditMode = ref(false)

function handleEditPiniaFavorite(item: { type: 'pinia-favorite'; id: string }) {
  selectedItem.value = item
  siteListEditMode.value = false
  headerLinkEditMode.value = false
  piniaFavoriteEditMode.value = true
}

function handleEditHeaderLink(item: { type: 'header-link'; id: string }) {
  selectedItem.value = item
  piniaFavoriteEditMode.value = false
  siteListEditMode.value = false
  headerLinkEditMode.value = true
}

function handleEditSiteList(item: { type: 'site-blacklist' | 'site-whitelist'; id: string }) {
  selectedItem.value = item
  piniaFavoriteEditMode.value = false
  headerLinkEditMode.value = false
  siteListEditMode.value = true
}

function handlePiniaFavoriteEditDone(newId?: string) {
  piniaFavoriteEditMode.value = false
  if (newId && selectedItem.value?.type === 'pinia-favorite') {
    selectedItem.value = { type: 'pinia-favorite', id: newId }
  }
}

function handleSiteListEditDone() {
  siteListEditMode.value = false
}

function handleHeaderLinkEditDone() {
  headerLinkEditMode.value = false
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
  try {
    await ignoreVersion(version)
    releaseInfo.value = null
  } catch (error) {
    console.error('[settings/OptionsTab] handleIgnoreVersion failed:', error)
  }
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
    body: release.body || t('update.noNotes'),
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
  const rulesOn = settings.value.networkBreakpointsEnabled !== false
  const breakpointsToSync = rulesOn
    ? settings.value.breakpoints.active.map(bp => ({
        id: bp.id,
        scheme: bp.scheme,
        host: bp.host,
        port: bp.port,
        path: bp.path,
        query: bp.query,
        trigger: bp.trigger,
        enabled: true
      }))
    : []
  sendNetworkCommand('NETWORK_BREAKPOINTS_SYNC', {
    breakpoints: JSON.parse(JSON.stringify(breakpointsToSync))
  })
}

function syncMocks() {
  if (!settings.value?.mocks) return
  const rulesOn = settings.value.networkMocksEnabled !== false
  const mocksToSync = rulesOn
    ? settings.value.mocks.active.map(m => ({
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
    : []
  sendNetworkCommand('NETWORK_MOCKS_SYNC', {
    mocks: JSON.parse(JSON.stringify(mocksToSync))
  })
}

// Auto-sync when breakpoints/mocks change
watch(() => settings.value?.breakpoints, () => syncBreakpoints(), { deep: true })
watch(() => settings.value?.mocks, () => syncMocks(), { deep: true })
watch(
  () => [settings.value?.networkBreakpointsEnabled, settings.value?.networkMocksEnabled] as const,
  () => {
    syncBreakpoints()
    syncMocks()
  },
)

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
    const blob = new Blob([settingsJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vue-inspector-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showAlert(t('alert.exportOkTitle'), t('alert.exportOk'), 'success')
  } catch (error) {
    console.error('[settings/OptionsTab] handleExport failed:', error)
    showAlert(t('alert.exportFailTitle'), t('alert.exportFail'), 'error')
  }
}

async function handleImport() {
  if (!settings.value) return
  importError.value = null
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.txt,application/json'
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
      showAlert(t('alert.importOkTitle'), t('alert.importOk'), 'success')
    } catch (error) {
      console.error('[settings/OptionsTab] handleImport failed:', error)
      importError.value = error instanceof Error ? error.message : t('alert.importFail')
      showAlert(t('alert.importFailTitle'), error instanceof Error ? error.message : t('alert.importFail'), 'error')
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
    showAlert(t('alert.resetOkTitle'), t('alert.resetOk'), 'success')
  } catch (error) {
    console.error('[settings/OptionsTab] handleReset failed:', error)
    showAlert(t('alert.resetFailTitle'), t('alert.resetFail'), 'error')
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
  } else if (anchor.startsWith('ai-')) {
    activeSection.value = 'ai'
  } else if (anchor === 'logs-ignore-section') {
    activeSection.value = 'logs'
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
    if (loadedSettings && loadedSettings.networkBreakpointsEnabled === undefined) {
      loadedSettings.networkBreakpointsEnabled = true
    }
    if (loadedSettings && loadedSettings.networkMocksEnabled === undefined) {
      loadedSettings.networkMocksEnabled = true
    }
    nextTick(() => {
      syncBreakpoints()
      syncMocks()
    })
  } catch (error) {
    console.error('[settings/OptionsTab] useInspectorSettings failed:', error)
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
        <SheetContent side="left" class="flex h-full w-[240px] flex-col overflow-hidden p-4 text-foreground bg-background">
          <nav class="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
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
          <SupportMenu class="shrink-0" />
        </SheetContent>
      </Sheet>

      <Settings class="h-5 w-5 text-muted-foreground" />
      <h3 class="text-lg font-semibold">{{ t('tab.options') }}</h3>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p class="mt-2 text-muted-foreground">{{ t('options.loading') }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="!settings" class="flex-1 flex items-center justify-center text-destructive_text">
      {{ t('options.loadFailed') }}
    </div>

    <!-- Content: 2-panel grid -->
    <div v-else class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden responsive-panels">

      <!-- Left: Sidebar + Content -->
      <div class="h-full min-h-0 min-w-0 flex overflow-hidden gap-2">

        <!-- Sidebar Nav (hidden at ≤1200px) -->
        <div class="options-sidebar flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden rounded-lg bg-muted/50 p-1">
          <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
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
          <SupportMenu class="shrink-0" />
        </div>

        <!-- Section Content -->
        <ScrollArea class="options-section-scroll flex-1 min-h-0 min-w-0 border rounded-lg">
          <div class="p-4 min-w-0 overflow-hidden">
            <GeneralSection
              v-if="activeSection === 'general'"
              :settings="settings"
              :selected-item-id="selectedItem?.type === 'saved-file' ? selectedItem.id : null"
              :selected-site-list="
                selectedItem?.type === 'site-blacklist'
                  ? { kind: 'blacklist', id: selectedItem.id }
                  : selectedItem?.type === 'site-whitelist'
                    ? { kind: 'whitelist', id: selectedItem.id }
                    : null
              "
              @import="handleImport"
              @export="handleExport"
              @reset="handleReset"
              @select="onSelectItem"
              @edit="handleEditSiteList"
            />
            <NetworkSection
              v-else-if="activeSection === 'network'"
              :settings="settings"
              :selected-item-id="
                selectedItem?.type === 'breakpoint' ||
                selectedItem?.type === 'mock' ||
                selectedItem?.type === 'header-link'
                  ? selectedItem.id
                  : null
              "
              @select="onSelectItem"
              @edit-breakpoint="handleEditBreakpoint"
              @edit-mock="handleEditMock"
              @edit-header-link="handleEditHeaderLink"
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
            <LogsSection
              v-else-if="activeSection === 'logs'"
              :settings="settings"
            />
            <AiSection v-else-if="activeSection === 'ai'" />
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
          :site-list-edit-mode="siteListEditMode"
          :header-link-edit-mode="headerLinkEditMode"
          @close="selectedItem = null; piniaFavoriteEditMode = false; siteListEditMode = false; headerLinkEditMode = false"
          @close-release="handleCloseRelease"
          @ignore-version="handleIgnoreVersion"
          @download-update="handleDownloadUpdate"
          @edit="handleEditFromDetails"
          @pinia-favorite-edit-done="handlePiniaFavoriteEditDone"
          @site-list-edit-done="handleSiteListEditDone"
          @header-link-edit-done="handleHeaderLinkEditDone"
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
          <AlertDialogAction @click="alertDialog.open = false">{{ t('common.ok') }}</AlertDialogAction>
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
