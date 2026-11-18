<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
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
import { LOG_KIND_META, type LogIgnoreRule } from '@/types/logs'
import { logKindLabel } from '@/features/logs/labels'
import { useI18n } from '@/i18n'
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

const { t } = useI18n()

// -------------------- SEARCH SETTINGS --------------------
type SearchKey = 'byName' | 'byKey' | 'byValue'

const searchItems = computed<Array<{ key: SearchKey; label: string }>>(() => [
  { key: 'byName', label: t('search.byEventName') },
  { key: 'byKey', label: t('search.byPayloadKey') },
  { key: 'byValue', label: t('search.byPayloadValue') },
])

function toggleSearch(key: SearchKey) {
  if (!props.settings.logsSearch) props.settings.logsSearch = { byName: true, byKey: false, byValue: false }
  props.settings.logsSearch[key] = !props.settings.logsSearch[key]
}

// -------------------- CAPTURE & LIMITS --------------------
const captureRows = computed<Array<{ key: LogLimitKey; label: string; unit: string }>>(() => [
  { key: 'network', label: t('logset.requests'), unit: t('logset.unitRequests') },
  { key: 'ws', label: t('logset.ws'), unit: t('logset.unitEvents') },
  { key: 'props', label: t('logset.props'), unit: t('logset.unitEvents') },
  { key: 'emit', label: t('logset.emits'), unit: t('logset.unitEvents') },
  { key: 'store', label: t('logset.pinia'), unit: t('logset.unitEvents') },
  { key: 'action', label: t('logset.actions'), unit: t('logset.unitEvents') },
  { key: 'navigation', label: t('logset.navigation'), unit: t('logset.unitEvents') },
  { key: 'click', label: t('logset.clicks'), unit: t('logset.unitEvents') },
  { key: 'error', label: t('logset.errors'), unit: t('logset.unitEvents') },
])

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

// -------------------- IGNORE LIST --------------------
const ignoreRows = computed<LogIgnoreRule[]>(() =>
  Array.isArray(props.settings.logsIgnoreRules) ? props.settings.logsIgnoreRules : [],
)

const ignoreColumns = computed<TableColumn[]>(() => [
  { header: t('log.type'), width: '180px' },
  { header: t('logset.object'), class: 'min-w-0' },
])

function ignoreKindLabel(kind: LogIgnoreRule['kind']): string {
  return logKindLabel(kind)
}

function ignoreKindClass(kind: LogIgnoreRule['kind']): string {
  return LOG_KIND_META[kind]?.badgeClass ?? ''
}

function removeIgnoreRule(id: string) {
  props.settings.logsIgnoreRules = ignoreRows.value.filter(rule => rule.id !== id)
}

function clearIgnoreRules() {
  props.settings.logsIgnoreRules = []
}

const getIgnoreActions = computed(() => {
  const label = t('logset.logAgain')
  return (row: LogIgnoreRule): MenuAction[] => [
    { label, icon: Eye, onClick: () => removeIgnoreRule(row.id) },
  ]
})

// -------------------- MASKING --------------------
const masking = computed(() => normalizeMasking(props.settings.logsMasking))

function writeMasking(patch: Partial<ReturnType<typeof normalizeMasking>>) {
  props.settings.logsMasking = { ...normalizeMasking(props.settings.logsMasking), ...patch }
}

function resetMasking() {
  props.settings.logsMasking = structuredClone(DEFAULT_LOGS_MASKING)
}

const newMaskKey = ref('')
const maskKeyErrorCode = ref<'empty' | 'exists' | null>(null)
const maskKeyError = computed(() => {
  if (maskKeyErrorCode.value === 'empty') return t('logset.keyEmpty')
  if (maskKeyErrorCode.value === 'exists') return t('logset.keyExists')
  return null
})

const maskKeyColumns = computed<TableColumn[]>(() => [{ header: t('logset.keyContains'), class: 'min-w-0' }])
const maskKeyRows = computed(() => masking.value.keys.map(k => ({ key: k })))

function addMaskKey() {
  const value = newMaskKey.value.trim()
  maskKeyErrorCode.value = null
  if (!value) {
    maskKeyErrorCode.value = 'empty'
    return
  }
  if (masking.value.keys.some(k => k.toLowerCase() === value.toLowerCase())) {
    maskKeyErrorCode.value = 'exists'
    return
  }
  writeMasking({ keys: [...masking.value.keys, value] })
  newMaskKey.value = ''
}

function removeMaskKey(key: string) {
  writeMasking({ keys: masking.value.keys.filter(k => k !== key) })
}

const getMaskKeyActions = computed(() => {
  const label = t('general.delete')
  return (row: { key: string }): MenuAction[] => [
    { label, icon: Trash, onClick: () => removeMaskKey(row.key), destructiveText: true },
  ]
})

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
          <h4 class="text-sm font-semibold">{{ t('logset.limits') }}</h4>
        </div>
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 shrink-0" @click="resetLimits">
          <RotateCcw class="h-3.5 w-3.5" />
          {{ t('common.defaults') }}
        </Button>
      </div>

      <div class="space-y-2">
        <h5 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">{{ t('logset.logged') }}</h5>
        <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2">
          <template v-for="row in captureRows" :key="row.key">
            <Label :for="`logs-capture-${row.key}`" class="text-sm font-normal cursor-pointer">{{ row.label }}</Label>
            <span class="text-xs text-muted-foreground tabular-nums text-right" :title="t('logset.stored')">
              {{ logsStats.counts[row.key] }} {{ row.unit }}
            </span>
            <Checkbox
              :id="`logs-capture-${row.key}`"
              :aria-label="row.label"
              :model-value="limits.capture[row.key]"
              @update:model-value="setCapture(row.key, !!$event)"
            />
          </template>
        </div>
      </div>

      <div class="space-y-2">
        <h5 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">{{ t('logset.dataSize') }}</h5>
        <div class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <Label for="logs-limit-memory" class="text-sm font-normal">{{ t('logset.memory') }}</Label>
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
              :aria-label="t('logset.limitSize')"
              :model-value="limits.limitEventSize"
              @update:model-value="setLimitEventSize(!!$event)"
            />
            <Label for="logs-limit-event-enabled" class="text-sm font-normal cursor-pointer">{{ t('logset.limitSize') }}</Label>
          </div>
          <div v-if="limits.limitEventSize" class="flex items-center gap-2">
            <Input
              id="logs-limit-event"
              type="number"
              :aria-label="t('logset.maxEvent')"
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
            {{ t('logset.used', { used: formatBytes(logsStats.memoryUsed), budget: formatBytes(memoryBudget) }) }}
          </p>
        </div>
      </div>
    </div>

    <SettingsTableSection
      section-id="logs-ignore-section"
      :title="t('logset.ignore')"
      :description="t('logset.ignoreHint')"
      :columns="ignoreColumns"
      :rows="ignoreRows"
      :row-key="(r) => (r as LogIgnoreRule).id"
      :get-actions="(row) => getIgnoreActions(row as LogIgnoreRule)"
      :empty-message="t('logset.noIgnored')"
      @select="() => {}"
    >
      <template #title-actions>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 text-xs gap-1.5 shrink-0"
          :disabled="ignoreRows.length === 0"
          @click="clearIgnoreRules"
        >
          <Eye class="h-3.5 w-3.5" />
          {{ t('logset.logAll') }}
        </Button>
      </template>
      <template #row="{ row }">
        <TableCell class="w-[180px] overflow-hidden !py-2">
          <Badge
            variant="outline"
            class="max-w-full text-[10px] px-1.5 py-0 font-medium"
            :class="ignoreKindClass((row as LogIgnoreRule).kind)"
          >
            <span class="truncate">{{ ignoreKindLabel((row as LogIgnoreRule).kind) }}</span>
          </Badge>
        </TableCell>
        <TableCell class="min-w-0 overflow-hidden !py-2">
          <div class="text-sm font-mono truncate" :title="(row as LogIgnoreRule).key">
            {{ (row as LogIgnoreRule).key }}
          </div>
        </TableCell>
      </template>
    </SettingsTableSection>

    <!-- Masking -->
    <SettingsTableSection
      section-id="logs-masking-section"
      :title="t('logset.masking')"
      :description="t('logset.maskingHint')"
      :columns="maskKeyColumns"
      :rows="maskKeyRows"
      :row-key="(r) => (r as { key: string }).key"
      :get-actions="(row) => getMaskKeyActions(row as { key: string })"
      :empty-message="t('logset.noKeys')"
      show-add
      :add-placeholder="t('logset.keyPh')"
      v-model:add-model-value="newMaskKey"
      :add-error="maskKeyError"
      @add="addMaskKey"
      @select="() => {}"
    >
      <template #title-actions>
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 shrink-0" @click="resetMasking">
          <RotateCcw class="h-3.5 w-3.5" />
          {{ t('common.defaults') }}
        </Button>
      </template>
      <template #after-title>
        <div class="space-y-2 pt-1">
          <div class="flex items-center gap-3">
            <Checkbox
              id="logs-masking-enabled"
              :aria-label="t('logset.mask')"
              :model-value="masking.enabled"
              @update:model-value="writeMasking({ enabled: !!$event, valuePatterns: !!$event })"
            />
            <Label for="logs-masking-enabled" class="text-sm font-normal cursor-pointer">{{ t('logset.mask') }}</Label>
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
      <h4 class="text-sm font-semibold">{{ t('logset.export') }}</h4>
      <div class="flex items-start gap-3">
        <Checkbox
          id="logs-export-compress"
          class="mt-0.5"
          :aria-label="t('logset.compress')"
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
            {{ t('logset.compress') }}
          </Label>
          <p class="text-xs text-muted-foreground">
            <template v-if="compressSupported">
              {{ t('logset.compressOn') }}
            </template>
            <template v-else>
              {{ t('logset.compressOff') }}
            </template>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
