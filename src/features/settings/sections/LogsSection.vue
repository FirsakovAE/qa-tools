<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { LogIgnoreRule, LogsExportFormat } from '@/types/logs'
import { LOG_KIND_META, LOGS_EXPORT_FORMATS, normalizeExportFormat } from '@/types/logs'
import RadioGroup from '@/components/ui/RadioGroup/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/RadioGroup/RadioGroupItem.vue'
import { TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import SearchSettingsBlock from '../components/SearchSettingsBlock.vue'
import SettingsTableSection from '../components/SettingsTableSection.vue'
import type { TableColumn } from '../components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { Eye, Trash, RotateCcw } from 'lucide-vue-next'
import { formatBytes } from '@/types/network'
import {
  DEFAULT_LOGS_LIMITS,
  DEFAULT_MASK_KEYS,
  LOG_LIMIT_BOUNDS,
  normalizeLimits,
  normalizeMasking,
  type LogLimitKey,
} from '@/injected/logs/config'
import { logsStats } from '@/features/logs/useLogs'

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

// -------------------- IGNORE LIST --------------------
const ignoreColumns: TableColumn[] = [
  { header: 'Type', width: '130px' },
  { header: 'Event', class: 'min-w-0' },
  { header: 'Added', width: '80px', class: 'text-center' },
]

const ignoreRows = computed<LogIgnoreRule[]>(() => props.settings.logsIgnoreRules ?? [])

function removeIgnoreRule(id: string) {
  props.settings.logsIgnoreRules = (props.settings.logsIgnoreRules ?? []).filter(r => r.id !== id)
}

function getIgnoreActions(rule: LogIgnoreRule): MenuAction[] {
  return [{ label: 'Log again', icon: Eye, onClick: () => removeIgnoreRule(rule.id) }]
}

// -------------------- EXPORT --------------------
const exportFormat = computed<LogsExportFormat>({
  get: () => normalizeExportFormat(props.settings.logsExportFormat),
  set: value => { props.settings.logsExportFormat = value },
})

// -------------------- LIMITS --------------------
const limitRows: Array<{ key: LogLimitKey; label: string; unit: string }> = [
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

function setCount(key: LogLimitKey, event: Event) {
  writeLimit(event, (l, v) => { l.counts[key] = v }, l => l.counts[key])
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
</script>

<template>
  <div class="space-y-6">
    <SearchSettingsBlock
      :search-settings="(settings.logsSearch ?? {}) as unknown as Record<string, boolean>"
      :search-items="searchItems"
      id-prefix="logs-search"
      @toggle="(k) => toggleSearch(k as SearchKey)"
    />

    <SettingsTableSection
      section-id="logs-ignore-section"
      title="Ignore list"
      description="Events of these groups are not logged. Add groups with the Ignore action in the Logs tab."
      :columns="ignoreColumns"
      :rows="ignoreRows"
      :row-key="(r) => (r as LogIgnoreRule).id"
      :get-actions="(row) => getIgnoreActions(row as LogIgnoreRule)"
      empty-message="No ignored events"
      @select="() => {}"
    >
      <template #after-title>
        <Button
          v-if="ignoreRows.length > 0"
          variant="outline"
          size="sm"
          class="h-7 text-xs gap-1.5"
          @click="settings.logsIgnoreRules = []"
        >
          <Eye class="h-3.5 w-3.5" />
          Log all again
        </Button>
      </template>
      <template #row="{ row }">
        <TableCell class="w-[130px] !py-2">
          <Badge
            variant="outline"
            class="text-[10px] px-1.5 py-0 whitespace-nowrap"
            :class="LOG_KIND_META[(row as LogIgnoreRule).kind]?.badgeClass"
          >
            {{ LOG_KIND_META[(row as LogIgnoreRule).kind]?.label ?? (row as LogIgnoreRule).kind }}
          </Badge>
        </TableCell>
        <TableCell class="min-w-0 overflow-hidden !py-2">
          <div class="text-sm font-mono truncate" :title="(row as LogIgnoreRule).key">
            {{ (row as LogIgnoreRule).key }}
          </div>
        </TableCell>
        <TableCell class="w-[80px] text-center !py-2">
          <div class="text-xs text-muted-foreground">
            {{ new Date((row as LogIgnoreRule).addedAt).toLocaleDateString() }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>

    <!-- Export -->
    <div id="logs-export-section" class="space-y-3 border-t pt-4">
      <div>
        <h4 class="text-sm font-semibold">Export</h4>
        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
          Format of Export Logs and of single-event exports. Both formats can be opened with Import Logs.
        </p>
      </div>
      <RadioGroup v-model="exportFormat" class="gap-3">
        <div v-for="format in LOGS_EXPORT_FORMATS" :key="format.value" class="flex flex-col gap-1">
          <div class="flex items-center space-x-2">
            <RadioGroupItem :id="`logs-export-${format.value}`" :value="format.value" />
            <Label :for="`logs-export-${format.value}`" class="text-sm font-normal cursor-pointer">{{ format.label }}</Label>
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed pl-6">{{ format.description }}</p>
        </div>
      </RadioGroup>
    </div>

    <!-- Limits -->
    <div id="logs-limits-section" class="space-y-4 border-t pt-4">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold">Logs limits</h4>
          <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
            Each type is a ring buffer: when it is full, the oldest events are overwritten.
            The memory budget applies to all types together.
          </p>
        </div>
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 shrink-0" @click="resetLimits">
          <RotateCcw class="h-3.5 w-3.5" />
          Defaults
        </Button>
      </div>

      <div class="space-y-2">
        <h5 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Events per type</h5>
        <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2">
          <template v-for="row in limitRows" :key="row.key">
            <Label :for="`logs-limit-${row.key}`" class="text-sm font-normal">{{ row.label }}</Label>
            <span class="text-xs text-muted-foreground tabular-nums text-right" title="Currently stored">
              {{ logsStats.counts[row.key] }} /
            </span>
            <div class="flex items-center gap-2">
              <Input
                :id="`logs-limit-${row.key}`"
                type="number"
                class="h-8 w-24 text-right tabular-nums"
                :min="LOG_LIMIT_BOUNDS.count.min"
                :max="LOG_LIMIT_BOUNDS.count.max"
                :model-value="limits.counts[row.key]"
                @change="setCount(row.key, $event)"
              />
              <span class="text-xs text-muted-foreground w-14">{{ row.unit }}</span>
            </div>
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
          <Label for="logs-limit-event" class="text-sm font-normal">Max event size</Label>
          <div class="flex items-center gap-2">
            <Input
              id="logs-limit-event"
              type="number"
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
            Larger parts of an event (store snapshots, arguments, results) are dropped and network bodies are cut to the max event size.
          </p>
        </div>
      </div>
    </div>

    <!-- Masking -->
    <SettingsTableSection
      section-id="logs-masking-section"
      title="Data masking"
      description="Values are masked when an event is captured, so they never reach the Logs view, exports or imports. Keys match case-insensitively, ignoring separators; words of 4 letters or fewer must match a whole word (e.g. pwd, otp)."
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
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs gap-1.5"
            @click="writeMasking({ keys: [...DEFAULT_MASK_KEYS] })"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            Default keys
          </Button>
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
  </div>
</template>
