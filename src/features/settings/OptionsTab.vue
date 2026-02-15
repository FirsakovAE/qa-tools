<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
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
import {
  Download,
  Upload,
  RotateCcw,
  Settings,
  Globe,
  Box,
  Database,
  Info,
} from 'lucide-vue-next'

import GeneralSection from './sections/GeneralSection.vue'
import NetworkSection from './sections/NetworkSection.vue'
import PropsSection from './sections/PropsSection.vue'
import PiniaSection from './sections/PiniaSection.vue'
import AboutSection from './sections/AboutSection.vue'
import SettingsDetails from './SettingsDetails.vue'

// -------------------- PROPS --------------------
const props = defineProps<{
  scrollToAnchor?: string | null
}>()

const emit = defineEmits<{
  (e: 'clearScrollAnchor'): void
}>()

// -------------------- STATE --------------------
const settings = ref<InspectorSettings | null>(null)
const isLoading = ref(true)

// -------------------- SECTIONS --------------------
type SettingsSection = 'general' | 'network' | 'props' | 'pinia' | 'about'
const activeSection = ref<SettingsSection>('general')

const sections = [
  { id: 'general' as const, label: 'General', icon: Settings },
  { id: 'network' as const, label: 'Network', icon: Globe },
  { id: 'props' as const, label: 'Props', icon: Box },
  { id: 'pinia' as const, label: 'Pinia Store', icon: Database },
  { id: 'about' as const, label: 'About', icon: Info },
]

// -------------------- SELECTED ITEM --------------------
type SelectedItemType = 'breakpoint' | 'mock' | 'blacklist' | 'favorite'
const selectedItem = ref<{ type: SelectedItemType; id: string } | null>(null)

watch(activeSection, () => {
  selectedItem.value = null
})

function onSelectItem(item: { type: SelectedItemType; id: string }) {
  selectedItem.value = item
}

// -------------------- NETWORK SYNC --------------------
function sendNetworkCommand(type: string, data: Record<string, any> = {}): void {
  window.parent?.postMessage({
    __VUE_INSPECTOR__: true,
    message: {
      type,
      __VUE_INSPECTOR__: true,
      __NETWORK_CMD__: true,
      ...data
    }
  }, '*')
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
  // Switch to 'network' section first, then scroll after render
  activeSection.value = 'network'
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
    <div class="shrink-0 flex items-center gap-2 p-2 border-b">
      <Settings class="h-5 w-5 text-muted-foreground" />
      <h3 class="text-lg font-semibold">Options</h3>

      <div class="flex-1" />

      <!-- Quick actions -->
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" @click="handleImport" :disabled="!settings" class="h-8 gap-1.5">
          <Download class="w-3.5 h-3.5" />
          Import
        </Button>
        <Button size="sm" variant="outline" @click="handleExport" :disabled="!settings" class="h-8 gap-1.5">
          <Upload class="w-3.5 h-3.5" />
          Export
        </Button>
        <Button size="sm" variant="destructive" @click="handleReset" :disabled="!settings" class="h-8 gap-1.5">
          <RotateCcw class="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p class="mt-2 text-muted-foreground">Loading settings...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="!settings" class="flex-1 flex items-center justify-center text-destructive">
      Failed to load settings
    </div>

    <!-- Content: 2-panel grid -->
    <div v-else class="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2 overflow-hidden">

      <!-- Left: Sidebar + Content -->
      <div class="h-full min-h-0 flex overflow-hidden border rounded-lg">

        <!-- Sidebar Nav -->
        <div class="shrink-0 w-[140px] border-r bg-muted/30 p-2 flex flex-col gap-1">
          <Button
            v-for="section in sections"
            :key="section.id"
            variant="ghost"
            size="sm"
            :class="[
              'justify-start h-8 text-xs',
              activeSection === section.id ? 'bg-accent text-accent-foreground' : ''
            ]"
            @click="activeSection = section.id"
          >
            <component :is="section.icon" class="w-3.5 h-3.5 mr-2 shrink-0" />
            {{ section.label }}
          </Button>
        </div>

        <!-- Section Content -->
        <ScrollArea class="flex-1 min-h-0">
          <div class="p-4">
            <GeneralSection
              v-if="activeSection === 'general'"
              :settings="settings"
            />
            <NetworkSection
              v-else-if="activeSection === 'network'"
              :settings="settings"
              :selected-item-id="selectedItem?.type === 'breakpoint' || selectedItem?.type === 'mock' ? selectedItem.id : null"
              @select="onSelectItem"
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
            />
            <AboutSection
              v-else-if="activeSection === 'about'"
              :settings="settings"
            />
          </div>
        </ScrollArea>
      </div>

      <!-- Right: Details Panel -->
      <div class="h-full min-h-0 overflow-hidden border rounded-lg">
        <SettingsDetails
          :settings="settings"
          :selected-item="selectedItem"
          @close="selectedItem = null"
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
