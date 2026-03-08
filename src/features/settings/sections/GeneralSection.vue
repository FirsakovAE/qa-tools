<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { InspectorSettings, DisplayMode } from '@/settings/inspectorSettings'
import { addMedia, removeMedia } from '@/settings/mediaStore'
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
import { Info, Download, Upload, RotateCcw, Plus, MoreHorizontal, Pencil, Trash } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { getRuntimeAdapter } from '@/runtime'
import ImagePickerDrawer from '@/features/settings/components/ImagePickerDrawer.vue'

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
const imagePickerOpen = ref(false)

const currentImageLabel = computed(() => {
  if (customize.value.image.fileName) return customize.value.image.fileName
  if (customize.value.image.url) return customize.value.image.url
  return 'Default'
})

function handlePickerSelectFile(id: string, name: string) {
  customize.value.image.sourceType = 'file'
  customize.value.image.savedFileId = id
  customize.value.image.fileName = name
  customize.value.image.url = ''
}

function handlePickerSelectUrl(url: string) {
  customize.value.image.sourceType = 'link'
  customize.value.image.url = url
  customize.value.image.savedFileId = ''
  customize.value.image.fileName = ''
}

async function handlePickerAddFile(file: File) {
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

async function removeSavedFile(fileId: string) {
  if (!props.settings.savedFiles) return
  props.settings.savedFiles = props.settings.savedFiles.filter(f => f.id !== fileId)
  await removeMedia(fileId)
}

async function handleAddNewFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input?.files
  if (!files || !props.settings.savedFiles) return
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
}

async function handleEditFileChange(event: Event, fileId: string) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  await addMedia(fileId, file)
  const sf = props.settings.savedFiles?.find(f => f.id === fileId)
  if (sf) {
    sf.name = file.name
    sf.size = file.size
    sf.mimeType = file.type || 'application/octet-stream'
  }
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
      <h4 class="text-sm font-semibold">Customize</h4>

      <!-- Image -->
      <div class="space-y-2">
        <Label class="text-xs font-medium text-muted-foreground">Image</Label>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground flex-1 truncate" :title="currentImageLabel">{{ currentImageLabel }}</span>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-3 text-xs shrink-0"
            @click="imagePickerOpen = true"
          >
            Change background
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

      <!-- Image Opacity -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="text-xs">Image Opacity</Label>
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
          <Label class="text-xs">Blur</Label>
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

        <ScrollArea class="h-[205px]">
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
                            <DropdownMenuItem class="text-destructive_text" @click.stop="removeSavedFile(file.id)">
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
                  <ContextMenuItem class="text-destructive_text" @click="removeSavedFile(file.id)">
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

    <ImagePickerDrawer
      v-model:open="imagePickerOpen"
      :saved-files="settings.savedFiles"
      :selected-saved-file-id="customize.image.savedFileId"
      :selected-url="customize.image.url"
      @select-file="handlePickerSelectFile"
      @select-url="handlePickerSelectUrl"
      @add-file="handlePickerAddFile"
      @remove-file="handlePickerRemoveFile"
    />
  </div>
</template>
