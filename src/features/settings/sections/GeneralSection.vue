<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { InspectorSettings, DisplayMode, ImageSourceType } from '@/settings/inspectorSettings'
import { defaultCustomizeSettings } from '@/settings/inspectorSettings'
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { Info, Download, Upload, RotateCcw, Plus, MoreHorizontal, Pencil, Trash, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { getRuntimeAdapter } from '@/runtime'

const props = defineProps<{
  settings: InspectorSettings
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  (e: 'import'): void
  (e: 'export'): void
  (e: 'reset'): void
  (e: 'select', item: { type: 'saved-file'; id: string }): void
}>()

const runtime = getRuntimeAdapter()
const isRunningInDevtools = runtime?.id === 'devtools'
const isStandalone = runtime?.capabilities.mode === 'standalone'

const displayMode = computed({
  get: () => props.settings.displayMode ?? 'overlay',
  set: (val: DisplayMode) => { props.settings.displayMode = val }
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

const jsonMode = computed({
  get: () => props.settings.json?.mode ?? 'text',
  set: (val: 'text' | 'tree') => { props.settings.json.mode = val }
})

const refreshIntervals = [
  { value: 1000, label: '1 second' },
  { value: 2000, label: '2 seconds' },
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
]

// -------------------- CUSTOMIZE --------------------

const customize = computed(() => props.settings.customize)

const draftSourceType = ref<ImageSourceType>(customize.value.image.sourceType)
const draftUrl = ref(customize.value.image.url)
const draftSavedFileId = ref(customize.value.image.savedFileId)
const draftFileName = ref(customize.value.image.fileName)

const sourceTypeSelectOpen = ref(false)
const fileSelectOpen = ref(false)

watch(sourceTypeSelectOpen, v => { if (v) fileSelectOpen.value = false })
watch(fileSelectOpen, v => { if (v) sourceTypeSelectOpen.value = false })

const isDraftDirty = computed(() =>
  draftSourceType.value !== customize.value.image.sourceType ||
  draftUrl.value !== customize.value.image.url ||
  draftSavedFileId.value !== customize.value.image.savedFileId ||
  draftFileName.value !== customize.value.image.fileName
)

const savedImageFiles = computed(() =>
  (props.settings.savedFiles || []).filter(f => f.mimeType.startsWith('image/'))
)

function handleImageFileSelect(optionId: string) {
  if (!optionId || optionId === '__none__') return
  const sf = props.settings.savedFiles.find(f => f.id === optionId)
  if (sf) {
    draftSavedFileId.value = sf.id
    draftFileName.value = sf.name
  }
}

function handleImageBrowse(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const dataUri = reader.result as string
    const existing = props.settings.savedFiles.find(
      sf => sf.name === file.name && sf.size === file.size,
    )
    let fileId: string
    if (existing) {
      fileId = existing.id
    } else {
      fileId = generateId()
      props.settings.savedFiles.push({
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        dataUri,
      })
    }
    draftSavedFileId.value = fileId
    draftFileName.value = file.name
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function clearCustomizeImage() {
  draftUrl.value = ''
  draftSavedFileId.value = ''
  draftFileName.value = ''
}

function applyImageSettings() {
  customize.value.image.sourceType = draftSourceType.value
  customize.value.image.url = draftUrl.value
  customize.value.image.savedFileId = draftSavedFileId.value
  customize.value.image.fileName = draftFileName.value
}

function resetCustomize() {
  const defaults = structuredClone(defaultCustomizeSettings)
  Object.assign(customize.value, defaults)
  draftSourceType.value = defaults.image.sourceType
  draftUrl.value = defaults.image.url
  draftSavedFileId.value = defaults.image.savedFileId
  draftFileName.value = defaults.image.fileName
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

function removeSavedFile(fileId: string) {
  if (!props.settings.savedFiles) return
  props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== fileId)
}

function handleAddNewFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input?.files
  if (!files || !props.settings.savedFiles) return
  Array.from(files).forEach(file => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUri = reader.result as string
      const alreadySaved = props.settings.savedFiles.some(
        sf => sf.name === file.name && sf.size === file.size,
      )
      if (!alreadySaved) {
        props.settings.savedFiles.push({
          id: generateId(),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUri,
        })
      }
    }
    reader.readAsDataURL(file)
  })
  input.value = ''
}

function handleEditFileChange(event: Event, fileId: string) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const dataUri = reader.result as string
    const sf = props.settings.savedFiles?.find(f => f.id === fileId)
    if (sf) {
      sf.name = file.name
      sf.size = file.size
      sf.mimeType = file.type || 'application/octet-stream'
      sf.dataUri = dataUri
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- DISPLAY MODE -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold">Display Mode</h4>

      <RadioGroup v-model="displayMode" :disabled="isStandalone" class="gap-3">
        <div class="flex items-center space-x-2">
          <RadioGroupItem value="overlay" id="mode-overlay" />
          <Label for="mode-overlay" class="text-sm font-normal" :class="isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
            Overlay
          </Label>
        </div>
        <div class="flex items-center space-x-2">
          <RadioGroupItem value="devtools" id="mode-devtools" />
          <Label for="mode-devtools" class="text-sm font-normal" :class="isStandalone ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
            DevTools tab
          </Label>
        </div>
      </RadioGroup>

      <div
        v-if="isStandalone"
        class="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400"
      >
        <Info class="h-4 w-4 shrink-0 mt-0.5" />
        <p>Display Mode is only available for the browser extension version.</p>
      </div>

      <div
        v-if="showDevtoolsHint"
        class="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-400"
      >
        <Info class="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p>Reload the page to apply changes.</p>
          <p class="mt-0.5">Open DevTools (F12) to access the panel.</p>
        </div>
      </div>

      <div
        v-if="showOverlayHint"
        class="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-400"
      >
        <Info class="h-4 w-4 shrink-0 mt-0.5" />
        <p>Reload the page to apply changes.</p>
      </div>
    </div>

    <!-- CUSTOMIZE -->
    <div class="space-y-4 border-t pt-4">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold">Customize</h4>
        <div class="flex items-center gap-1">
          <Button
            v-if="isDraftDirty"
            variant="outline"
            size="sm"
            class="h-7 gap-1 text-xs"
            @click="applyImageSettings"
          >
            <Check class="h-3 w-3" />
            Apply
          </Button>
          <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs text-muted-foreground" @click="resetCustomize">
            <RotateCcw class="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      <!-- Image -->
      <div class="space-y-2">
        <Label class="text-xs font-medium text-muted-foreground">Image</Label>
        <div class="flex items-center gap-2">
          <Select v-model="draftSourceType" v-model:open="sourceTypeSelectOpen">
            <SelectTrigger class="w-[90px] h-8 shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="file" class="text-xs">File</SelectItem>
              <SelectItem value="link" class="text-xs">Link</SelectItem>
            </SelectContent>
          </Select>

          <Input
            v-if="draftSourceType === 'link'"
            v-model="draftUrl"
            placeholder="https://example.com/image.jpg"
            class="h-8 text-xs flex-1"
          />

          <template v-else>
            <Select
              :model-value="draftSavedFileId || undefined"
              @update:model-value="handleImageFileSelect(String($event))"
              v-model:open="fileSelectOpen"
            >
              <SelectTrigger class="h-8 text-xs flex-1">
                <SelectValue :placeholder="draftFileName || 'Choose file'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="sf in savedImageFiles"
                  :key="sf.id"
                  :value="sf.id"
                  class="text-xs"
                >
                  {{ sf.name }} ({{ formatFileSize(sf.size) }})
                </SelectItem>
                <SelectItem v-if="!savedImageFiles.length" value="__none__" disabled class="text-xs">
                  No saved images
                </SelectItem>
              </SelectContent>
            </Select>

            <label class="shrink-0 inline-flex items-center justify-center h-8 px-3 text-xs rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
              Browse
              <input type="file" accept="image/*" class="sr-only" @change="handleImageBrowse" />
            </label>
          </template>

          <Button
            v-if="draftUrl || draftSavedFileId"
            variant="ghost"
            size="sm"
            class="h-8 w-8 p-0 shrink-0"
            title="Clear image"
            @click="clearCustomizeImage"
          >
            <Trash class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <!-- Position X -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Position X</Label>
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
          <Label class="text-xs">Position Y</Label>
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
          <Label class="text-xs">Scale</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.scale }}%</span>
        </div>
        <Slider
          :model-value="[customize.scale]"
          @update:model-value="setSlider(v => customize.scale = v, $event)"
          :min="100" :max="200" :step="1"
        />
      </div>

      <!-- Image Opacity (Light) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Image Opacity (Light)</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.imageOpacityLight.toFixed(2) }}</span>
        </div>
        <Slider
          :model-value="[customize.imageOpacityLight]"
          @update:model-value="setSlider(v => customize.imageOpacityLight = v, $event)"
          :min="0" :max="1" :step="0.01"
        />
      </div>

      <!-- Image Opacity (Dark) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Image Opacity (Dark)</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.imageOpacityDark.toFixed(2) }}</span>
        </div>
        <Slider
          :model-value="[customize.imageOpacityDark]"
          @update:model-value="setSlider(v => customize.imageOpacityDark = v, $event)"
          :min="0" :max="1" :step="0.01"
        />
      </div>

      <!-- Blur -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Blur</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.blur }}px</span>
        </div>
        <Slider
          :model-value="[customize.blur]"
          @update:model-value="setSlider(v => customize.blur = v, $event)"
          :min="0" :max="200" :step="1"
        />
      </div>

      <!-- Noise Intensity -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Noise Intensity</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.noiseIntensity.toFixed(2) }}</span>
        </div>
        <Slider
          :model-value="[customize.noiseIntensity]"
          @update:model-value="setSlider(v => customize.noiseIntensity = v, $event)"
          :min="0" :max="1" :step="0.01"
        />
      </div>

      <!-- Noise Opacity -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Noise Opacity</Label>
          <span class="text-xs text-muted-foreground tabular-nums">{{ customize.noiseOpacity.toFixed(2) }}</span>
        </div>
        <Slider
          :model-value="[customize.noiseOpacity]"
          @update:model-value="setSlider(v => customize.noiseOpacity = v, $event)"
          :min="0" :max="1" :step="0.01"
        />
      </div>
    </div>

    <!-- SEARCH DEBOUNCE & MIN LENGTH -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">Search Parameters</h4>
      <div class="grid grid-cols-2 gap-x-6 gap-y-2">
        <Label for="search-debounce">Search Debounce (ms)</Label>
        <Label for="search-min-length">Minimum Search Length</Label>

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
      <h4 class="text-sm font-semibold">Auto Refresh</h4>

      <div class="flex items-center space-x-3">
        <Checkbox
          id="auto-refresh"
          v-model="settings.updates!.autoRefresh"
        />
        <Label for="auto-refresh" class="text-sm">Enable auto refresh</Label>
      </div>

      <div v-if="settings.updates?.autoRefresh" class="pt-2">
        <Label for="refresh-interval" class="block mb-2">Refresh Interval</Label>
        <Select v-model="settings.updates!.autoRefreshInterval">
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

    <!-- JSON EDITOR MODE -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">JSON Editor Mode</h4>

      <Tabs v-model="jsonMode">
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

    <!-- SAVED FILES -->
    <div id="saved-files-section" class="space-y-2 border-t pt-4">
      <h4 class="text-sm font-semibold">Saved Files</h4>
      <p class="text-xs text-muted-foreground">
        Files saved from breakpoint form-data editing for quick reuse.
      </p>

      <div class="flex items-center space-x-3 mb-3">
        <Checkbox
          id="auto-save-files"
          :model-value="settings.autoSaveFiles"
          @update:model-value="settings.autoSaveFiles = $event as boolean"
        />
        <Label for="auto-save-files" class="text-sm">
          Auto-save new files selected via Browse
        </Label>
      </div>

      <div class="flex flex-col border rounded-lg">
        <div class="shrink-0 border-b bg-muted/30">
          <Table class="table-fixed">
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead class="text-xs font-semibold">Name</TableHead>
                <TableHead class="text-xs font-semibold w-[80px] text-center">Size</TableHead>
                <TableHead class="w-[48px] text-center p-0" />
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <ScrollArea class="max-h-[200px]">
          <Table class="table-fixed">
            <TableBody>
              <ContextMenu v-for="file in (settings.savedFiles || [])" :key="file.id">
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
                          <DropdownMenuContent align="end" class="w-44">
                            <DropdownMenuItem as-child>
                              <label class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full">
                                <Pencil class="h-4 w-4 mr-2" />
                                Edit
                                <input type="file" class="sr-only" @change="handleEditFileChange($event, file.id)" />
                              </label>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem class="text-destructive" @click.stop="removeSavedFile(file.id)">
                              <Trash class="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent class="w-44">
                  <ContextMenuItem as-child>
                    <label class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-secondary hover:text-secondary-foreground w-full">
                      <Pencil class="h-4 w-4 mr-2" />
                      Edit
                      <input type="file" class="sr-only" @change="handleEditFileChange($event, file.id)" />
                    </label>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem class="text-destructive" @click="removeSavedFile(file.id)">
                    <Trash class="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <TableRow class="h-[41px] hover:bg-muted/50 transition-colors">
                <TableCell colspan="3" class="!p-0">
                  <label class="flex items-center justify-center gap-1.5 cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors w-full h-[41px]">
                    <Plus class="h-3.5 w-3.5" />
                    Add new file
                    <input type="file" multiple class="sr-only" @change="handleAddNewFile" />
                  </label>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>

    <!-- IMPORT / EXPORT / RESET -->
    <div class="space-y-4 border-t pt-4">
      <h4 class="text-sm font-semibold">Settings Management</h4>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="emit('import')">
          <Download class="w-3.5 h-3.5" />
          Import
        </Button>
        <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="emit('export')">
          <Upload class="w-3.5 h-3.5" />
          Export
        </Button>
        <Button size="sm" variant="destructive" class="h-8 gap-1.5" @click="emit('reset')">
          <RotateCcw class="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>
    </div>
  </div>
</template>
