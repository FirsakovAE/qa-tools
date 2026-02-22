<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { InspectorSettings, DisplayMode } from '@/settings/inspectorSettings'
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
import RadioGroup from '@/components/ui/RadioGroup/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/RadioGroup/RadioGroupItem.vue'
import { Info, Download, Upload, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { getRuntimeAdapter } from '@/runtime'

const props = defineProps<{
  settings: InspectorSettings
}>()

const emit = defineEmits<{
  (e: 'import'): void
  (e: 'export'): void
  (e: 'reset'): void
}>()

const isRunningInDevtools = getRuntimeAdapter()?.id === 'devtools'

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

// Debounce and MinLength — global search params
const debounceValue = ref(props.settings.searchParams.debounce ?? 300)
const minLengthValue = ref(props.settings.searchParams.minLength ?? 2)

watch(debounceValue, (val) => {
  props.settings.searchParams.debounce = val
})

watch(minLengthValue, (val) => {
  props.settings.searchParams.minLength = val
})

// JSON mode
const jsonMode = computed({
  get: () => props.settings.json?.mode ?? 'text',
  set: (val: 'text' | 'tree') => { props.settings.json.mode = val }
})

// Auto refresh
const refreshIntervals = [
  { value: 1000, label: '1 second' },
  { value: 2000, label: '2 seconds' },
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- DISPLAY MODE -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold">Display Mode</h4>

      <RadioGroup v-model="displayMode" class="gap-3">
        <div class="flex items-center space-x-2">
          <RadioGroupItem value="overlay" id="mode-overlay" />
          <Label for="mode-overlay" class="text-sm font-normal cursor-pointer">
            Overlay
          </Label>
        </div>
        <div class="flex items-center space-x-2">
          <RadioGroupItem value="devtools" id="mode-devtools" />
          <Label for="mode-devtools" class="text-sm font-normal cursor-pointer">
            DevTools tab
          </Label>
        </div>
      </RadioGroup>

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
