<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue'
import SettingsTableSection from '../components/SettingsTableSection.vue'
import type { TableColumn } from '../components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { Trash, RotateCcw } from 'lucide-vue-next'
import { formatBytes } from '@/types/network'
import {
  DEFAULT_LOGS_LIMITS,
  DEFAULT_LOGS_MASKING,
  LOG_LIMIT_BOUNDS,
  normalizeLimits,
  normalizeMasking,
  type LogLimitKey,
} from '@/injected/logs/config'
import { logsStats } from '@/features/logs/useLogs'
import { canCompressReport } from '@/features/logs/report/compressSupport'

const props = defineProps<{
  settings: InspectorSettings
}>()

// -------------------- SEARCH SETTINGS --------------------
type SearchKey = 'byName' | 'byKey' | 'byValue'

const searchItems: Array<{ key: SearchKey; label: string }> = [
  { key: 'byName', label: 'Search by event name (title, component, store, URL)' },
  { key: 'byKey', label: 'Search by key (payload keys and changed paths)' },
  { key: 'byValue', label: 'Search by value (payload values)' },
]

function toggleSearch(key: SearchKey) {
  if (!props.settings.logsSearch) props.settings.logsSearch = { byName: true, byKey: false, byValue: false }
  props.settings.logsSearch[key] = !props.settings.logsSearch[key]
}

// -------------------- CAPTURE & LIMITS --------------------
const captureRows: Array<{ key: LogLimitKey; label: string; unit: string }> = [
  { key: 'network', label: 'Network', unit: 'requests' },
  { key: 'props', label: 'Props changes', unit: 'events' },
  { key: 'emit', label: 'Emits', unit: 'events' },
  { key: 'store', label: 'Pinia changes', unit: 'events' },
  { key: 'action', label: 'Store actions', unit: 'events' },
  { key: 'navigation', label: 'Navigation', unit: 'events' },
  { key: 'error', label: 'JS errors', unit: 'events' },
]

const limits = computed(() => normalizeLimits(props.settings.logsLimits))
const memoryBudget = computed(() => limits.value.maxMemoryMB * 1024 * 1024)
const memoryPercent = computed(() => Math.min(100, Math.round((logsStats.value.memoryUsed / memoryBudget.value) * 100)))

type Limits = ReturnType<typeof normalizeLimits>

/** Applies the typed value (clamped to bounds) and shows the clamped value in the input */
function writeLimit(event: Event, apply: (l: Limits, value: number) => void, read: (l: Limits) => number) {
  const input = event.target as HTMLInputElement
  const draft = normalizeLimits(props.settings.logsLimits)
  apply(draft, Number(input.value))
  const next = normalizeLimits(draft)
  props.settings.logsLimits = next
  input.value = String(read(next))
}

function setCapture(key: LogLimitKey, value: boolean) {
  const next = normalizeLimits(props.settings.logsLimits)
  next.capture[key] = value
  props.settings.logsLimits = next
}

function setLimitEventSize(value: boolean) {
  props.settings.logsLimits = { ...normalizeLimits(props.settings.logsLimits), limitEventSize: value }
}

function setMemory(event: Event) {
  writeLimit(event, (l, v) => { l.maxMemoryMB = v }, l => l.maxMemoryMB)
}

function setEventSize(event: Event) {
  writeLimit(event, (l, v) => { l.maxEventKB = v }, l => l.maxEventKB)
}

function resetLimits() {
  props.settings.logsLimits = structuredClone(DEFAULT_LOGS_LIMITS)
}

// -------------------- MASKING --------------------
const masking = computed(() => normalizeMasking(props.settings.logsMasking))

function writeMasking(patch: Partial<ReturnType<typeof normalizeMasking>>) {
  props.settings.logsMasking = { ...normalizeMasking(props.settings.logsMasking), ...patch }
}

function resetMasking() {
  props.settings.logsMasking = structuredClone(DEFAULT_LOGS_MASKING)
}

const newMaskKey = ref('')
const maskKeyError = ref<string | null>(null)

const maskKeyColumns: TableColumn[] = [{ header: 'Key contains', class: 'min-w-0' }]
const maskKeyRows = computed(() => masking.value.keys.map(k => ({ key: k })))

function addMaskKey() {
  const value = newMaskKey.value.trim()
  maskKeyError.value = null
  if (!value) {
    maskKeyError.value = 'Key cannot be empty'
    return
  }
  if (masking.value.keys.some(k => k.toLowerCase() === value.toLowerCase())) {
    maskKeyError.value = 'This key is already in the list'
    return
  }
  writeMasking({ keys: [...masking.value.keys, value] })
  newMaskKey.value = ''
}

function removeMaskKey(key: string) {
  writeMasking({ keys: masking.value.keys.filter(k => k !== key) })
}

function getMaskKeyActions(row: { key: string }): MenuAction[] {
  return [{ label: 'Delete', icon: Trash, onClick: () => removeMaskKey(row.key), destructiveText: true }]
}

// -------------------- EXPORT --------------------
const compressSupported = canCompressReport()
</script>

<template>
  <div class="space-y-6">
    <SearchSettingsBlock
      :search-settings="(settings.logsSearch ?? {}) as unknown as Record<string, boolean>"
      :search-items="searchItems"
      id-prefix="logs-search"
      @toggle="(k) => toggleSearch(k as SearchKey)"
    />

    <!-- Limits -->
    <div id="logs-limits-section" class="space-y-4 border-t pt-4">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold">Logs and limits</h4>
        </div>
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 shrink-0" @click="resetLimits">
          <RotateCcw class="h-3.5 w-3.5" />
          Defaults
        </Button>
      </div>

      <div class="space-y-2">
        <h5 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Logged events</h5>
        <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2">
          <template v-for="row in captureRows" :key="row.key">
            <Label :for="`logs-capture-${row.key}`" class="text-sm font-normal cursor-pointer">{{ row.label }}</Label>
            <span class="text-xs text-muted-foreground tabular-nums text-right" title="Currently stored">
              {{ logsStats.counts[row.key] }} {{ row.unit }}
            </span>
            <Checkbox
              :id="`logs-capture-${row.key}`"
              :model-value="limits.capture[row.key]"
              @update:model-value="setCapture(row.key, !!$event)"
            />
          </template>
        </div>
      </div>

      <div class="space-y-2">
        <h5 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data size</h5>
        <div class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <Label for="logs-limit-memory" class="text-sm font-normal">Memory budget</Label>
          <div class="flex items-center gap-2">
            <Input
              id="logs-limit-memory"
              type="number"
              class="h-8 w-24 text-right tabular-nums"
              :min="LOG_LIMIT_BOUNDS.memoryMB.min"
              :max="LOG_LIMIT_BOUNDS.memoryMB.max"
              :model-value="limits.maxMemoryMB"
              @change="setMemory"
            />
            <span class="text-xs text-muted-foreground w-14">MB</span>
          </div>
          <div class="flex items-center gap-3">
            <Checkbox
              id="logs-limit-event-enabled"
              :model-value="limits.limitEventSize"
              @update:model-value="setLimitEventSize(!!$event)"
            />
            <Label for="logs-limit-event-enabled" class="text-sm font-normal cursor-pointer">Limit event size</Label>
          </div>
          <div v-if="limits.limitEventSize" class="flex items-center gap-2">
            <Input
              id="logs-limit-event"
              type="number"
              aria-label="Max event size"
              class="h-8 w-24 text-right tabular-nums"
              :min="LOG_LIMIT_BOUNDS.eventKB.min"
              :max="LOG_LIMIT_BOUNDS.eventKB.max"
              :model-value="limits.maxEventKB"
              @change="setEventSize"
            />
            <span class="text-xs text-muted-foreground w-14">KB</span>
          </div>
        </div>
        <div class="space-y-1">
          <div class="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="memoryPercent >= 90 ? 'bg-orange-500' : 'bg-primary'"
              :style="{ width: `${memoryPercent}%` }"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            Used {{ formatBytes(logsStats.memoryUsed) }} of {{ formatBytes(memoryBudget) }} (approximate serialized size).
          </p>
        </div>
      </div>
    </div>

    <!-- Masking -->
    <SettingsTableSection
      section-id="logs-masking-section"
      title="Data masking"
      description="Values are masked when an event is captured, so they never reach the Logs view or exports."
      :columns="maskKeyColumns"
      :rows="maskKeyRows"
      :row-key="(r) => (r as { key: string }).key"
      :get-actions="(row) => getMaskKeyActions(row as { key: string })"
      empty-message="No keys — only value patterns are masked"
      show-add
      add-placeholder="Key fragment, e.g. accessCode"
      v-model:add-model-value="newMaskKey"
      :add-error="maskKeyError"
      @add="addMaskKey"
      @select="() => {}"
    >
      <template #title-actions>
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 shrink-0" @click="resetMasking">
          <RotateCcw class="h-3.5 w-3.5" />
          Defaults
        </Button>
      </template>
      <template #after-title>
        <div class="space-y-2 pt-1">
          <div class="flex items-center gap-3">
            <Checkbox
              id="logs-masking-enabled"
              :model-value="masking.enabled"
              @update:model-value="writeMasking({ enabled: !!$event })"
            />
            <Label for="logs-masking-enabled" class="text-sm font-normal cursor-pointer">Mask sensitive data</Label>
          </div>
          <div class="flex items-center gap-3">
            <Checkbox
              id="logs-masking-patterns"
              :disabled="!masking.enabled"
              :model-value="masking.valuePatterns"
              @update:model-value="writeMasking({ valuePatterns: !!$event })"
            />
            <Label for="logs-masking-patterns" class="text-sm font-normal cursor-pointer">
              Mask token-like values in any text (JWT, Bearer / Basic credentials, card numbers)
            </Label>
          </div>
        </div>
      </template>
      <template #row="{ row }">
        <TableCell class="min-w-0 overflow-hidden !py-2">
          <div class="text-sm font-mono truncate" :class="{ 'opacity-50': !masking.enabled }">
            {{ (row as { key: string }).key }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>

    <!-- Export -->
    <div id="logs-export-section" class="space-y-3 border-t pt-4">
      <h4 class="text-sm font-semibold">Export</h4>
      <div class="flex items-start gap-3">
        <Checkbox
          id="logs-export-compress"
          class="mt-0.5"
          :disabled="!compressSupported"
          :model-value="compressSupported && settings.logsExport?.compress !== false"
          @update:model-value="settings.logsExport = { ...settings.logsExport, compress: !!$event }"
        />
        <div class="space-y-1" :class="{ 'opacity-50': !compressSupported }">
          <Label
            for="logs-export-compress"
            class="text-sm font-normal"
            :class="compressSupported ? 'cursor-pointer' : 'cursor-not-allowed'"
          >
            Compress report
          </Label>
          <p class="text-xs text-muted-foreground">
            <template v-if="compressSupported">
              The HTML report is several times smaller. Needs Chrome / Edge 80+, Firefox 113+ or Safari 16.4+.
            </template>
            <template v-else>
              Not supported in this browser. Needs Chrome / Edge 80+, Firefox 113+ or Safari 16.4+.
            </template>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
