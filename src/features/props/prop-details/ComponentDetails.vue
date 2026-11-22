<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { ArrowLeft, Star, X, Save, Edit, RefreshCw, Pin } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import JsonEditor from '@/components/JsonEditor.vue'

import type { TreeNodeModel } from '@/types/tree'
import type { FavoriteItem, BaseInspectorSettings } from '@/types/inspector'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { useRuntime } from '@/runtime'
import { isInFavorites, matchFavoriteIds } from '@/utils/favoritesMatcher'
import { useComponentsTab } from '@/hooks/useComponentsTab'
import { ref as createRef } from 'vue'
import { getPropsFavoriteNodeId, isPropsRowResolvedFavorite } from '../propsFavorites'
import { findPropOverrideRule, upsertPropOverrideRule } from '../propOverrides'
import type { PropOverrideRule } from '@/types/inspector'
import type { PropOverrideTarget } from '@/injected/props/overrides-engine'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isExpectedExtensionError } from '@/utils/expectedErrors'

const runtime = useRuntime()
const { t } = useI18n()

// --- Props и Emits ---
const props = withDefaults(
  defineProps<{
    node: TreeNodeModel
    /** Full Props table rows; required for correct star when names/stable ids collide */
    allRows?: TreeNodeModel[]
    refreshing?: boolean
  }>(),
  { refreshing: false, allRows: () => [] }
)
const emit = defineEmits<{ (e: 'back'): void; (e: 'refresh'): void; (e: 'openOverrides'): void }>()

// --- Settings ---
const settings = useInspectorSettingsSync()
const jsonMode = ref<'text' | 'tree'>('text')
const jsonEditorImpl = ref<'classic' | 'jsoneditor'>('jsoneditor')

watch(settings, (s) => {
  if (!s) return
  jsonMode.value = s.json?.mode ?? 'text'
  jsonEditorImpl.value = s.json?.editor ?? 'jsoneditor'
}, { immediate: true })

function persistJsonVanillaMode(m: 'text' | 'tree') {
  jsonMode.value = m
  const s = settings.value
  if (s) {
    if (!s.json) s.json = { editor: jsonEditorImpl.value, mode: m }
    else s.json.mode = m
  }
}

// --- Favorites (same resolution as PropsTab.updateFavoriteFlags when allRows is provided) ---
const isFavorite = computed(() => {
  if (!settings.value?.favorites?.length) return false
  const rows = props.allRows
  if (rows.length > 0) {
    return isPropsRowResolvedFavorite(props.node, settings.value.favorites, rows)
  }
  return isInFavorites(getPropsFavoriteNodeId(props.node), settings.value.favorites)
})

async function toggleFavorite() {
  if (!settings.value) return

  const elementId = getPropsFavoriteNodeId(props.node)

  if (isFavorite.value) {
    const stableMatches = settings.value.favorites.filter(f => matchFavoriteIds(elementId, f.id))
    const toRemove = stableMatches.find(f => f.nodeId === props.node.id) || stableMatches[0]
    if (toRemove) {
      settings.value.favorites = settings.value.favorites.filter(
        (fav: FavoriteItem) => fav !== toRemove
      )
    }
  } else {
    const favoriteItem: FavoriteItem = {
      id: elementId,
      nodeId: props.node.id,
      tagName: props.node.element?.tagName || props.node.rootElement?.tagName || 'div',
      className: props.node.element?.className || props.node.rootElement?.className,
      name: props.node.name,
      timestamp: new Date().toISOString()
    }
    settings.value.favorites.push(favoriteItem)
  }

  try {
    const settingsToSave = JSON.parse(JSON.stringify(settings.value))
    await runtime.storage.set('vue-inspector-settings', settingsToSave)
  } catch (error) {
    console.error('[props/ComponentDetails] toggleFavorite save failed:', error)
  }
}

// --- Editing Props Hook ---
const {
  startEditingProps,
  saveEditedProps,
  cancelEditing: cancelPropsEditing,
  updateEditedProp,
} = useComponentsTab(createRef<TreeNodeModel[]>([]), {})

const componentUid = computed(() => props.node.componentUid || '')
// Path for updateComponentProps: use uid: format when available (required for save)
const componentPath = computed(() =>
  props.node.id?.startsWith('uid:') ? props.node.id : (props.node.componentUid || props.node.id || '')
)

// --- Sections (Received / Declared, like PiniaDetails State / Getters) ---
type SectionId = 'received' | 'declared'
const activeSection = ref<SectionId>('received')

const sections = computed<Array<{ id: SectionId; label: string }>>(() => [
  { id: 'received', label: t('props.received') },
  { id: 'declared', label: t('props.declared') }
])

// --- JSON State ---
const json = computed(() => {
  if (props.node.props) return JSON.stringify(props.node.props, null, 2)
  if (props.node.jsonProps) return props.node.jsonProps
  return '{}'
})

const editedJson = ref(json.value.trim())
const isEditing = ref(false)

const isJsonValid = computed(() => {
  try { JSON.parse(editedJson.value); return true } catch { return false }
})

/** Declared section: rawProps as JSON (read-only) */
const rawPropsJson = computed(() => {
  const raw = props.node.rawProps
  if (!raw || typeof raw !== 'object') return '{}'
  return JSON.stringify(raw, null, 2)
})

// Watch for node changes
watch(() => props.node.id, () => {
  editedJson.value = json.value.trim()
  isEditing.value = false
  resetOverrideControls()
})

watch(json, (newJson) => {
  if (!isEditing.value) {
    editedJson.value = newJson.trim()
  }
})

// --- Component Info ---
const nodeName = computed(() => props.node.name || '—')

const elementInfo = computed(() => {
  if (props.node.element) {
    if (props.node.element instanceof HTMLElement) {
      const tag = props.node.element.tagName.toLowerCase()
      const cls = props.node.element.className
        ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    } else if (props.node.element.tagName) {
      const tag = props.node.element.tagName.toLowerCase()
      const cls = props.node.element.className
        ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    }
  }

  if (props.node.rootElement?.tagName) {
    const tag = props.node.rootElement.tagName.toLowerCase()
    const cls = props.node.rootElement.className
      ? '.' + props.node.rootElement.className.trim().replace(/\s+/g, '.')
      : ''
    return tag + cls
  }

  return 'div'
})

const truncatedElementInfo = computed(() => {
  const info = elementInfo.value
  return info.length > 40 ? info.substring(0, 40) + '...' : info
})

const formattedTime = computed(() => {
  if (!props.node.timestamp) return '—'
  const d = new Date(props.node.timestamp)
  return d.toISOString().replace('T', ' ').slice(0, 19)
})

/** Фактический размер props в байтах (честный расчёт через TextEncoder) */
const propsSizeFormatted = computed(() => {
  const str = json.value
  if (!str || str === '{}') return null
  const bytes = new TextEncoder().encode(str).length
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

// --- Save as: Once (live only), Part (changed props), Full (every current prop) ---
type PropSaveMode = 'once' | 'part' | 'full'

const liveRow = computed(() => props.allRows.find(r => r.id === props.node.id) ?? props.node)
const overriddenKeys = computed(() => liveRow.value.overriddenKeys ?? [])
const appliedRules = computed<PropOverrideRule[]>(() => {
  const ids = liveRow.value.overrideRuleIds ?? []
  return (settings.value?.propOverrides ?? []).filter(rule => ids.includes(rule.id))
})

const saveMode = ref<PropSaveMode>('once')
const overrideScope = ref<PropOverrideRule['scope']>('path')

function ruleSaveMode(rule: PropOverrideRule | undefined): PropSaveMode {
  if (!rule) return 'once'
  return rule.mode === 'part' ? 'part' : 'full'
}

function resetOverrideControls() {
  const rule = appliedRules.value.find(r => r.scope === 'path') ?? appliedRules.value[0]
  saveMode.value = ruleSaveMode(rule)
  overrideScope.value = rule?.scope ?? 'path'
}

watch(
  () => appliedRules.value.map(r => `${r.id}:${r.mode ?? ''}`).join(','),
  () => { if (!isEditing.value) resetOverrideControls() },
  { immediate: true }
)

function setSaveMode(value: unknown) {
  if (value === 'once' || value === 'part' || value === 'full') saveMode.value = value
}

/** One element keeps a single rule: drop every other rule currently applied to this row */
function dropOtherAppliedRules(keepId: string | undefined): boolean {
  if (!settings.value) return false
  const drop = appliedRules.value.map(rule => rule.id).filter(id => id !== keepId)
  if (!drop.length) return false
  settings.value.propOverrides = settings.value.propOverrides.filter(rule => !drop.includes(rule.id))
  return true
}

async function persistOverrideSettings() {
  if (!settings.value) return
  try {
    const settingsToSave = JSON.parse(JSON.stringify(settings.value))
    await runtime.storage.set('vue-inspector-settings', settingsToSave)
  } catch (error) {
    console.error('[props/ComponentDetails] save override rule failed:', error)
  }
}

async function deleteAppliedRules() {
  if (!dropOtherAppliedRules(undefined)) return
  await persistOverrideSettings()
}

async function saveOverrideRule(
  mode: 'part' | 'full',
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
  removedKeys: string[]
) {
  if (!settings.value) return
  const response = await runtime.sendMessage<{ target?: PropOverrideTarget | null }>({
    type: 'PROP_OVERRIDE_TARGET',
    componentUid: componentPath.value
  })
  const target = response?.target
  if (!target) return
  const wrote = upsertPropOverrideRule(settings.value, target, overrideScope.value, mode, original, edited, removedKeys)
  const kept = findPropOverrideRule(settings.value.propOverrides, target, overrideScope.value)
  const dropped = dropOtherAppliedRules(kept?.id)
  if (!wrote && !dropped) return
  await persistOverrideSettings()
}

// --- Actions ---
function startEditing() {
  editedJson.value = json.value.trim()
  isEditing.value = true
  startEditingProps?.(componentPath.value)
}

function cancelEdit() {
  editedJson.value = json.value.trim()
  isEditing.value = false
  resetOverrideControls()
  cancelPropsEditing?.()
}

useEscapeClose(computed(() => true), () => {
  if (isEditing.value) cancelEdit()
  else emit('back')
})

async function saveChanges() {
  if (!isJsonValid.value) return

  try {
    const parsed = JSON.parse(editedJson.value)

    // Update props via hook
    Object.entries(parsed).forEach(([key, value]) => {
      updateEditedProp?.(key, value)
    })

    const original = props.node.props ?? (() => {
      try { return JSON.parse(props.node.jsonProps ?? '{}') } catch { return {} }
    })()
    const removedKeys = Object.keys(original ?? {}).filter(key => !(key in parsed))
    const saveResult = await saveEditedProps?.(removedKeys)
    
    if (saveResult === true) {
      // Update local state
      props.node.props = { ...parsed }
      props.node.jsonProps = JSON.stringify(parsed, null, 2)
      props.node.timestamp = new Date().toISOString()
      editedJson.value = JSON.stringify(parsed, null, 2)
      if (saveMode.value === 'once') await deleteAppliedRules()
      else await saveOverrideRule(saveMode.value, original ?? {}, parsed, removedKeys)
    }
    
    isEditing.value = false
    resetOverrideControls()
  } catch (err) {
    if (!isExpectedExtensionError(err)) {
      console.error('[props/ComponentDetails] saveChanges failed:', err)
    }
    // Keep editing on error
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col">
      <!-- Header (NetworkDetails style) -->
      <div class="shrink-0 flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('back')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold truncate">{{ nodeName }}</span>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge variant="secondary" class="text-xs truncate max-w-[200px]">
                  {{ truncatedElementInfo }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent v-if="elementInfo.length > 40">
                {{ elementInfo }}
              </TooltipContent>
            </Tooltip>
            <Badge v-if="propsSizeFormatted" variant="outline" class="text-xs font-mono shrink-0">
              {{ propsSizeFormatted }}
            </Badge>
            <Tooltip v-if="overriddenKeys.length">
              <TooltipTrigger as-child>
                <Badge
                  variant="outline"
                  class="text-xs shrink-0 cursor-pointer gap-1 text-purple-500 border-purple-500/30 hover:bg-purple-500/10"
                  @click="emit('openOverrides')"
                >
                  <Pin class="h-3 w-3" />
                  {{ overriddenKeys.length }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {{ t('props.overrideApplied', { keys: overriddenKeys.join(', ') }) }}
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="text-xs text-muted-foreground">
            Updated: {{ formattedTime }}
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="flex flex-col items-end gap-1 shrink-0">
          <div class="flex items-center gap-1">
          <!-- Favorite button -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="toggleFavorite"
              >
                <Star 
                  class="h-4 w-4" 
                  :class="isFavorite ? 'text-yellow-500 fill-yellow-500' : ''"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {{ isFavorite ? t('stores.removeFav') : t('stores.addFav') }}
            </TooltipContent>
          </Tooltip>
          
          <!-- Refresh button (read-only mode) -->
          <Tooltip v-if="!isEditing">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :disabled="refreshing"
                @click="emit('refresh')"
              >
                <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': refreshing }" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {{ t('common.refreshData') }}
            </TooltipContent>
          </Tooltip>
          
          <!-- Edit/Save/Cancel buttons (only for Received section) -->
          <Tooltip v-if="!isEditing && activeSection === 'received'">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="startEditing"
              >
                <Edit class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {{ t('props.edit') }}
            </TooltipContent>
          </Tooltip>
          
          <template v-if="isEditing">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  @click="cancelEdit"
                >
                  <X class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {{ t('common.cancel') }}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  :disabled="!isJsonValid"
                  @click="saveChanges"
                >
                  <Save class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {{ t('props.save') }}
              </TooltipContent>
            </Tooltip>
          </template>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs whitespace-nowrap" :class="isEditing ? '' : 'opacity-50'">
              {{ t('props.saveAs') }}
            </span>
            <Select :model-value="saveMode" :disabled="!isEditing" @update:model-value="setSaveMode">
              <SelectTrigger class="h-7 w-[132px] text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">{{ t('props.saveOnce') }}</SelectItem>
                <SelectItem value="part">{{ t('props.savePart') }}</SelectItem>
                <SelectItem value="full">{{ t('props.saveFull') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <!-- Section tabs (Menubar style - like PiniaDetails) -->
      <div class="shrink-0 flex items-center gap-1 p-1 border-b bg-muted/30">
        <button
          v-for="section in sections"
          :key="section.id"
          class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors"
          :class="{
            'bg-secondary text-secondary-foreground': activeSection === section.id,
            'hover:bg-secondary/50 text-muted-foreground': activeSection !== section.id
          }"
          @click="activeSection = section.id"
        >
          {{ section.label }}
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <!-- Received section: current data (editable) -->
        <div v-if="activeSection === 'received'" class="h-full flex flex-col">
          <div class="flex-1 min-h-0">
            <JsonEditor
              v-model="editedJson"
              :editable="isEditing"
              :show-copy="true"
              :editor="jsonEditorImpl"
              :mode="jsonMode"
              @update:mode="persistJsonVanillaMode"
              :full-height="true"
              class="h-full"
            />
          </div>
        </div>

        <!-- Declared section: rawProps as JSON (read-only) -->
        <div v-else-if="activeSection === 'declared'" class="h-full flex flex-col">
          <div class="flex-1 min-h-0">
            <JsonEditor
              :model-value="rawPropsJson"
              :editable="false"
              :show-copy="true"
              :editor="jsonEditorImpl"
              :mode="jsonMode"
              @update:mode="persistJsonVanillaMode"
              :full-height="true"
              class="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
