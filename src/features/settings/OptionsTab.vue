<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useInspectorSettings, resetInspectorSettings, exportSettings, importSettings } from '@/settings/useInspectorSettings'
import { defaultInspectorSettings } from '@/settings/inspectorSettings'
import { Button } from '@/components/ui/button'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Power,
  Trash,
  Download,
  Upload,
  RotateCcw,
  Settings,
} from 'lucide-vue-next'
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
import type { InspectorSettings, FavoriteItem, BreakpointItem, MockRule } from '@/settings/inspectorSettings'

// -------------------- STATE --------------------
const settings = ref<InspectorSettings | null>(null)
const isLoading = ref(true)

// -------------------- NETWORK SYNC --------------------
/**
 * Send command to injected network module via content script
 * This allows OptionsTab to sync breakpoints/mocks directly
 */
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

/**
 * Sync breakpoints to injected script
 */
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

/**
 * Sync mocks to injected script
 */
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

// локальные значения для UI
const debounceValue = ref(300)
const minLengthValue = ref(2)

// import / export
const importError = ref<string | null>(null)

// alert dialog state
const alertDialog = ref({
  open: false,
  title: '',
  description: '',
  type: 'info' as 'info' | 'success' | 'error'
})

// show alert dialog instead of browser alert
function showAlert(title: string, description: string, type: 'info' | 'success' | 'error' = 'info') {
  alertDialog.value = {
    open: true,
    title,
    description,
    type
  }
}

// -------------------- SAFE COMPUTED --------------------

watch(debounceValue, val => {
  if (settings.value?.search) settings.value.search.debounce = val
})
watch(minLengthValue, val => {
  if (settings.value?.search) settings.value.search.minLength = val
})

// -------------------- MOUNT --------------------
onMounted(async () => {
  try {
    const loadedSettings = await useInspectorSettings()
    settings.value = loadedSettings

    // Инициализируем локальные значения из загруженных настроек или значений по умолчанию
    if (loadedSettings?.search) {
      debounceValue.value = loadedSettings.search.debounce ?? defaultInspectorSettings.search.debounce ?? 300
      minLengthValue.value = loadedSettings.search.minLength ?? defaultInspectorSettings.search.minLength ?? 2
    } else {
      debounceValue.value = defaultInspectorSettings.search.debounce ?? 300
      minLengthValue.value = defaultInspectorSettings.search.minLength ?? 2
    }

    // Убеждаемся, что все значения search инициализированы
    if (loadedSettings && !loadedSettings.search) {
      loadedSettings.search = { ...defaultInspectorSettings.search }
    } else if (loadedSettings?.search) {
      // Заполняем отсутствующие значения значениями по умолчанию
      const defaultSearch = defaultInspectorSettings.search
      if (loadedSettings.search.byName === undefined) loadedSettings.search.byName = defaultSearch.byName
      if (loadedSettings.search.byLabel === undefined) loadedSettings.search.byLabel = defaultSearch.byLabel
      if (loadedSettings.search.byRootElement === undefined) loadedSettings.search.byRootElement = defaultSearch.byRootElement
      if (loadedSettings.search.byKey === undefined) loadedSettings.search.byKey = defaultSearch.byKey
      if (loadedSettings.search.byValue === undefined) loadedSettings.search.byValue = defaultSearch.byValue
      if (loadedSettings.search.debounce === undefined) loadedSettings.search.debounce = defaultSearch.debounce
      if (loadedSettings.search.minLength === undefined) loadedSettings.search.minLength = defaultSearch.minLength
    }

    // Инициализируем json настройки
    if (loadedSettings && !loadedSettings.json) {
      loadedSettings.json = { ...defaultInspectorSettings.json }
    }

    // Инициализируем breakpoints настройки
    if (loadedSettings && !loadedSettings.breakpoints) {
      loadedSettings.breakpoints = { ...defaultInspectorSettings.breakpoints }
    }

    // Инициализируем mocks настройки
    if (loadedSettings && !loadedSettings.mocks) {
      loadedSettings.mocks = { ...defaultInspectorSettings.mocks }
    }

  } catch (error) {
  } finally {
    nextTick(() => {
      isLoading.value = false
    })
  }
})

// -------------------- SYNC UI → SETTINGS --------------------
watch(debounceValue, val => {
  if (settings.value?.search) settings.value.search.debounce = val
})

watch(minLengthValue, val => {
  if (settings.value?.search) settings.value.search.minLength = val
})

// -------------------- SYNC SETTINGS → UI --------------------
watch(() => settings.value?.search?.debounce, val => {
  if (val !== undefined && val !== debounceValue.value) debounceValue.value = val
})

watch(() => settings.value?.search?.minLength, val => {
  if (val !== undefined && val !== minLengthValue.value) minLengthValue.value = val
})

// -------------------- SEARCH OPTIONS --------------------
type SearchKey = 'byName' | 'byLabel' | 'byRootElement' | 'byKey' | 'byValue'

const searchByName = computed({
  get: () => settings.value?.search?.byName ?? defaultInspectorSettings.search.byName,
  set: (val) => { if (settings.value?.search) settings.value.search.byName = val }
})
const searchByLabel = computed({
  get: () => settings.value?.search?.byLabel ?? defaultInspectorSettings.search.byLabel,
  set: (val) => { if (settings.value?.search) settings.value.search.byLabel = val }
})
const searchByRootElement = computed({
  get: () => settings.value?.search?.byRootElement ?? defaultInspectorSettings.search.byRootElement,
  set: (val) => { if (settings.value?.search) settings.value.search.byRootElement = val }
})
const searchByKey = computed({
  get: () => settings.value?.search?.byKey ?? defaultInspectorSettings.search.byKey,
  set: (val) => { if (settings.value?.search) settings.value.search.byKey = val }
})
const searchByValue = computed({
  get: () => settings.value?.search?.byValue ?? defaultInspectorSettings.search.byValue,
  set: (val) => { if (settings.value?.search) settings.value.search.byValue = val }
})

// -------------------- JSON MODE --------------------
const jsonMode = computed({
  get: () => settings.value?.json?.mode ?? defaultInspectorSettings.json.mode,
  set: (val: 'text' | 'tree') => { if (settings.value?.json) settings.value.json.mode = val }
})

const searchMap: Record<SearchKey, ReturnType<typeof computed<boolean>>> = {
  byName: searchByName,
  byLabel: searchByLabel,
  byRootElement: searchByRootElement,
  byKey: searchByKey,
  byValue: searchByValue,
}

const searchItems = computed<Array<{ key: SearchKey; label: string }>>(() => [
  { key: 'byName' as SearchKey, label: 'Search by component name' },
  { key: 'byLabel' as SearchKey, label: 'Search by component label' },
  { key: 'byRootElement' as SearchKey, label: 'Search by root element' },
  { key: 'byKey' as SearchKey, label: 'Search by key' },
  { key: 'byValue' as SearchKey, label: 'Search by value' },
])

// -------------------- BLACKLIST --------------------
type BlacklistRow = { name: string; active: boolean }
const newBlockedName = ref('')
const blacklistError = ref<string | null>(null)

const blacklistRows = computed<BlacklistRow[]>(() => {
  if (!settings.value) return []
  return [
    ...settings.value.blacklist.active.map(name => ({ name, active: true })),
    ...settings.value.blacklist.inactive.map(name => ({ name, active: false })),
  ]
})

function addToBlacklist() {
  if (!settings.value) return

  const value = newBlockedName.value.trim()
  blacklistError.value = null

  if (!value) {
    blacklistError.value = 'Name cannot be empty'
    return
  }

  if (settings.value.blacklist.active.includes(value) || settings.value.blacklist.inactive.includes(value)) {
    blacklistError.value = 'This name is already in the blacklist'
    return
  }

  settings.value.blacklist.active.push(value)
  newBlockedName.value = ''
}

function toggleBlacklist(name: string, active: boolean) {
  if (!settings.value) return
  const from = active ? settings.value.blacklist.active : settings.value.blacklist.inactive
  const to = active ? settings.value.blacklist.inactive : settings.value.blacklist.active
  const index = from.indexOf(name)
  if (index !== -1) { from.splice(index, 1); to.push(name) }
}

function removeFromBlacklist(name: string) {
  if (!settings.value) return
  settings.value.blacklist.active = settings.value.blacklist.active.filter(n => n !== name)
  settings.value.blacklist.inactive = settings.value.blacklist.inactive.filter(n => n !== name)
}

// -------------------- FAVORITES --------------------
const favoritesList = computed<FavoriteItem[]>(() => {
  return settings.value?.favorites || []
})

function removeFromFavorites(favoriteId: string) {
  if (!settings.value) return
  settings.value.favorites = settings.value.favorites.filter(fav => fav.id !== favoriteId)
}

// -------------------- BREAKPOINTS --------------------
type BreakpointRow = BreakpointItem & { active: boolean }

const breakpointRows = computed<BreakpointRow[]>(() => {
  if (!settings.value?.breakpoints) return []
  return [
    ...settings.value.breakpoints.active.map(bp => ({ ...bp, active: true })),
    ...settings.value.breakpoints.inactive.map(bp => ({ ...bp, active: false })),
  ]
})

function toggleBreakpoint(breakpointId: string, currentlyActive: boolean) {
  if (!settings.value?.breakpoints) return
  
  const from = currentlyActive ? settings.value.breakpoints.active : settings.value.breakpoints.inactive
  const to = currentlyActive ? settings.value.breakpoints.inactive : settings.value.breakpoints.active
  
  const index = from.findIndex(bp => bp.id === breakpointId)
  if (index !== -1) {
    const [breakpoint] = from.splice(index, 1)
    to.push(breakpoint)
  }
  
  // Sync to injected script immediately
  syncBreakpoints()
}

function removeBreakpoint(breakpointId: string) {
  if (!settings.value?.breakpoints) return
  settings.value.breakpoints.active = settings.value.breakpoints.active.filter(bp => bp.id !== breakpointId)
  settings.value.breakpoints.inactive = settings.value.breakpoints.inactive.filter(bp => bp.id !== breakpointId)
  
  // Sync to injected script immediately
  syncBreakpoints()
}

function formatTrigger(trigger: string): string {
  if (trigger === 'both') return 'Request & Response'
  return trigger.charAt(0).toUpperCase() + trigger.slice(1)
}

function formatBreakpointUrl(bp: BreakpointItem): string {
  let url = `${bp.scheme}://${bp.host}`
  if (bp.port) url += `:${bp.port}`
  url += bp.path
  if (bp.query) url += `?${bp.query}`
  return url
}

// -------------------- MOCKS (Map Local) --------------------
type MockRow = MockRule & { active: boolean }

const mockRows = computed<MockRow[]>(() => {
  if (!settings.value?.mocks) return []
  return [
    ...settings.value.mocks.active.map(m => ({ ...m, active: true })),
    ...settings.value.mocks.inactive.map(m => ({ ...m, active: false })),
  ]
})

function toggleMock(mockId: string, currentlyActive: boolean) {
  if (!settings.value?.mocks) return
  
  const from = currentlyActive ? settings.value.mocks.active : settings.value.mocks.inactive
  const to = currentlyActive ? settings.value.mocks.inactive : settings.value.mocks.active
  
  const index = from.findIndex(m => m.id === mockId)
  if (index !== -1) {
    const [mock] = from.splice(index, 1)
    to.push(mock)
  }
  
  // Sync to injected script immediately
  syncMocks()
}

function removeMock(mockId: string) {
  if (!settings.value?.mocks) return
  settings.value.mocks.active = settings.value.mocks.active.filter(m => m.id !== mockId)
  settings.value.mocks.inactive = settings.value.mocks.inactive.filter(m => m.id !== mockId)
  
  // Sync to injected script immediately
  syncMocks()
}

function formatMockUrl(mock: MockRule): string {
  let url = ''
  if (mock.method) url += `${mock.method} `
  url += `${mock.scheme || '*'}://${mock.host || '*'}`
  if (mock.port) url += `:${mock.port}`
  url += mock.path || '/*'
  if (mock.query) url += `?${mock.query}`
  return url
}

// -------------------- AUTO REFRESH --------------------
const refreshIntervals = [
  { value: 1000, label: '1 second' },
  { value: 2000, label: '2 seconds' },
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
]

// -------------------- IMPORT / EXPORT --------------------
async function handleExport() {
  if (!settings.value) return
  try {
    const settingsJson = await exportSettings()

    // Создаем и скачиваем файл .txt
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

  // Открываем диалог выбора файла
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
      if (newSettings?.search) {
        debounceValue.value = newSettings.search.debounce ?? 300
        minLengthValue.value = newSettings.search.minLength ?? 2
      }
      // Sync breakpoints and mocks after import
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
    if (newSettings?.search) {
      debounceValue.value = newSettings.search.debounce ?? 300
      minLengthValue.value = newSettings.search.minLength ?? 2
    }
    // Sync breakpoints and mocks after reset (they should now be empty)
    syncBreakpoints()
    syncMocks()
    showAlert('Reset Complete', 'All settings have been reset to defaults.', 'success')
  } catch (error) {
    showAlert('Reset Failed', 'Failed to reset settings. Please try again.', 'error')
  }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header (consistent with other tabs) -->
    <div class="shrink-0 flex items-center gap-2 p-2 border-b">
      <Settings class="h-5 w-5 text-muted-foreground" />
      <h3 class="text-lg font-semibold">
        Options
      </h3>
      
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

    <!-- Content -->
    <ScrollArea class="flex-1 min-h-0">
      <div class="space-y-6 p-4">
        <!-- Состояние загрузки -->
        <div v-if="isLoading" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p class="mt-2 text-muted-foreground">Loading settings...</p>
        </div>

        <div v-else-if="!settings" class="text-center py-8 text-destructive">
          Failed to load settings
        </div>

        <!-- Основной контент -->
        <template v-else>
          <!-- SEARCH SETTINGS -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold">Search Settings</h4>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div v-for="item in searchItems" :key="item.key" class="flex items-center space-x-3">
                <Checkbox
                    :id="`search-${item.key}`"
                    v-model="searchMap[item.key].value"
                    :disabled="!settings"
                />
                <Label :for="`search-${item.key}`" class="text-sm">
                  {{ item.label }}
                </Label>
              </div>
            </div>

            <div class="pt-4 border-t">
              <div class="grid grid-cols-2 gap-x-6 gap-y-2">
                <Label for="search-debounce">Search Debounce (ms)</Label>
                <Label for="search-min-length">Minimum Search Length</Label>

                <Input
                    v-model="debounceValue"
                    type="number"
                    class="w-24 h-8"
                    :min="100"
                    :max="1000"
                    :disabled="!settings"
                />

                <Input
                    v-model="minLengthValue"
                    type="number"
                    class="w-24 h-8"
                    :min="1"
                    :max="10"
                    :disabled="!settings"
                />
              </div>
            </div>
          </div>

          <!-- JSON EDITOR MODE -->
          <div class="space-y-4 border-t pt-5">
            <h4 class="text-sm font-semibold">JSON Editor Mode</h4>

            <Tabs v-model="jsonMode" :disabled="!settings">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="tree">Tree</TabsTrigger>
              </TabsList>

              <TabsContent value="text" class="mt-4">
                <div class="text-sm text-muted-foreground">
                  Traditional JSON text editor with syntax highlighting
                </div>
              </TabsContent>

              <TabsContent value="tree" class="mt-4">
                <div class="text-sm text-muted-foreground">
                  Visual tree editor for inline editing of values
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <!-- AUTO REFRESH -->
          <div class="space-y-4 border-t pt-5">
            <h4 class="text-sm font-semibold">Auto Refresh</h4>

            <div class="flex items-center space-x-3">
              <Checkbox
                  id="auto-refresh"
                  v-model="settings.updates!.autoRefresh"
                  :disabled="!settings"
              />
              <Label for="auto-refresh" class="text-sm">Enable auto refresh</Label>
            </div>

            <div v-if="settings.updates?.autoRefresh" class="pt-4">
              <Label for="refresh-interval" class="block mb-2">Refresh Interval</Label>
              <Select v-model="settings.updates!.autoRefreshInterval" :disabled="!settings">
                <SelectTrigger class="w-full h-8">
                  <SelectValue :placeholder="`${(settings.updates?.autoRefreshInterval ?? 5000) / 1000} seconds`" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="interval in refreshIntervals" :key="interval.value" :value="interval.value">
                    {{ interval.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- BLACKLIST -->
          <div class="space-y-4 border-t pt-5">
            <h4 class="text-sm font-semibold">Component Blacklist</h4>

            <div class="flex flex-col gap-2">
              <div class="flex gap-2">
                <Input
                    v-model="newBlockedName"
                    placeholder="Enter component name (supports wildcards: *Component*)"
                    @keydown.enter.prevent="addToBlacklist"
                    :aria-invalid="!!blacklistError"
                    class="flex-1 h-8"
                    :disabled="!settings"
                />
                <Button size="sm" @click="addToBlacklist" :disabled="!settings" class="h-8">Add</Button>
              </div>

              <p v-if="blacklistError" class="text-sm text-destructive">
                {{ blacklistError }}
              </p>
            </div>

            <div class="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[200px]">Component Name</TableHead>
                    <TableHead class="text-center w-[120px]">Status</TableHead>
                    <TableHead class="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableRow v-for="row in blacklistRows" :key="row.name">
                    <TableCell class="py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm">
                        {{ row.name }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="text-sm">
                        {{ row.active ? 'Blocked' : 'Allowed' }}
                      </div>
                    </TableCell>

                    <TableCell class="text-right py-2 px-4">
                      <div class="flex justify-end gap-2">
                        <Button
                            size="sm"
                            :variant="row.active ? 'secondary' : 'outline'"
                            @click="toggleBlacklist(row.name, row.active)"
                            :disabled="!settings"
                            class="h-7 text-xs"
                        >
                          <Power class="w-3 h-3 mr-1" />
                          {{ row.active ? 'Allow' : 'Block' }}
                        </Button>

                        <Button
                            size="sm"
                            variant="destructive"
                            @click="removeFromBlacklist(row.name)"
                            :disabled="!settings"
                            class="h-7 w-7 p-0"
                        >
                          <Trash class="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow v-if="!blacklistRows.length">
                    <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                      No components in blacklist
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- FAVORITES -->
          <div class="space-y-4 border-t pt-5">
            <h4 class="text-sm font-semibold">Favorite Components</h4>

            <div class="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[300px]">Component Name</TableHead>
                    <TableHead class="text-center w-[120px]">Added</TableHead>
                    <TableHead class="text-right w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableRow v-for="favorite in favoritesList" :key="favorite.id">
                    <TableCell class="py-2 px-4">
                      <div class="font-mono text-sm">
                        {{ favorite.name }}
                      </div>
                      <div class="text-xs text-muted-foreground mt-1 font-mono">
                        {{ favorite.tagName }}{{ favorite.className ? '.' + favorite.className : '' }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div class="text-sm text-muted-foreground">
                        {{ new Date(favorite.timestamp).toLocaleDateString() }}
                      </div>
                    </TableCell>

                    <TableCell class="text-right py-2 px-4">
                      <Button
                          size="sm"
                          variant="destructive"
                          @click="removeFromFavorites(favorite.id)"
                          :disabled="!settings"
                          class="h-7 w-7 p-0"
                      >
                        <Trash class="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  <TableRow v-if="!favoritesList.length">
                    <TableCell colspan="3" class="text-center text-muted-foreground py-8">
                      No favorite components
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- BREAKPOINTS -->
          <div class="space-y-4 border-t pt-5">
            <h4 class="text-sm font-semibold">Breakpoints Requests</h4>
            <p class="text-sm text-muted-foreground">
              Network requests matching these patterns will be paused for inspection and editing.
            </p>

            <div class="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[350px]">URL Pattern</TableHead>
                    <TableHead class="text-center w-[120px]">Trigger</TableHead>
                    <TableHead class="text-center w-[100px]">Status</TableHead>
                    <TableHead class="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableRow v-for="row in breakpointRows" :key="row.id">
                    <TableCell class="py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm truncate" :title="formatBreakpointUrl(row)">
                        {{ formatBreakpointUrl(row) }}
                      </div>
                      <div class="text-xs text-muted-foreground mt-1">
                        Added: {{ new Date(row.timestamp).toLocaleDateString() }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="text-sm">
                        {{ formatTrigger(row.trigger) }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="text-sm">
                        {{ row.active ? 'Active' : 'Disabled' }}
                      </div>
                    </TableCell>

                    <TableCell class="text-right py-2 px-4">
                      <div class="flex justify-end gap-2">
                        <Button
                            size="sm"
                            variant="destructive"
                            @click="removeBreakpoint(row.id)"
                            :disabled="!settings"
                            class="h-7 w-7 p-0"
                        >
                          <Trash class="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow v-if="!breakpointRows.length">
                    <TableCell colspan="4" class="text-center text-muted-foreground py-8">
                      No breakpoints configured. Set breakpoints from the Network tab.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- MOCKS (Map Local) -->
          <div class="space-y-4 border-t pt-5">
            <h4 class="text-sm font-semibold flex items-center gap-2">
              Mocks Responses
            </h4>
            <p class="text-sm text-muted-foreground">
              Matching requests will return fake responses without hitting the network.
            </p>

            <div class="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[350px]">URL Pattern</TableHead>
                    <TableHead class="text-center w-[80px]">Status</TableHead>
                    <TableHead class="text-center w-[80px]">Delay</TableHead>
                    <TableHead class="text-center w-[100px]">State</TableHead>
                    <TableHead class="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableRow v-for="row in mockRows" :key="row.id">
                    <TableCell class="py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="font-mono text-sm truncate" :title="formatMockUrl(row)">
                        {{ formatMockUrl(row) }}
                      </div>
                      <div class="text-xs text-muted-foreground mt-1">
                        {{ row.description || `Added: ${new Date(row.timestamp).toLocaleDateString()}` }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div 
                        :class="[
                          !row.active ? 'opacity-50' : '',
                          'text-sm font-mono',
                          row.status >= 200 && row.status < 300 ? 'text-green-500' : '',
                          row.status >= 400 && row.status < 500 ? 'text-orange-500' : '',
                          row.status >= 500 ? 'text-red-500' : ''
                        ]"
                      >
                        {{ row.status }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="text-sm text-muted-foreground">
                        {{ row.delay ? `${row.delay}ms` : '-' }}
                      </div>
                    </TableCell>

                    <TableCell class="text-center py-2 px-4">
                      <div :class="!row.active ? 'opacity-50' : ''" class="text-sm">
                        {{ row.active ? 'Active' : 'Disabled' }}
                      </div>
                    </TableCell>

                    <TableCell class="text-right py-2 px-4">
                      <div class="flex justify-end gap-2">
                        <Button
                            size="sm"
                            variant="destructive"
                            @click="removeMock(row.id)"
                            :disabled="!settings"
                            class="h-7 w-7 p-0"
                        >
                          <Trash class="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow v-if="!mockRows.length">
                    <TableCell colspan="5" class="text-center text-muted-foreground py-8">
                      No mocks configured. Click "Mock Response" on any request in the Network tab.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </template>

        <!-- Alert Dialog -->
        <AlertDialog :open="alertDialog.open" @update:open="(open) => alertDialog.open = open">
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
    </ScrollArea>
  </div>
</template>
