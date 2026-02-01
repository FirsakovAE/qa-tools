<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { ArrowLeft, Star, X, Save, Edit, RefreshCw } from 'lucide-vue-next'
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
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useRuntime } from '@/runtime'
import { isInFavorites, findMatchingFavorite } from '@/utils/favoritesMatcher'
import { useComponentsTab } from '@/hooks/useComponentsTab'
import { ref as createRef } from 'vue'

const runtime = useRuntime()

// --- Props и Emits ---
const props = defineProps<{ node: TreeNodeModel }>()
defineEmits<{ back: [] }>()

// --- Settings ---
const settings = ref<BaseInspectorSettings | null>(null)
const jsonMode = ref<'text' | 'tree'>('text')

onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
    jsonMode.value = settings.value?.json?.mode ?? 'text'
  } catch { /* use defaults */ }
})

// --- Favorites ---
const isFavorite = computed(() => {
  if (!settings.value?.favorites) return false
  const elementId = getElementIdentifier(props.node)
  return isInFavorites(elementId, settings.value.favorites)
})

function getElementIdentifier(node: TreeNodeModel): string {
  if (node.componentUid) {
    return node.componentUid
  }
  const elementInfo = getElementInfo(node)
  return `${node.name}::${elementInfo}`
}

function getElementInfo(node: TreeNodeModel): string {
  if (node.element) {
    if (node.element instanceof HTMLElement) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className ? '.' + node.element.className.trim().replace(/\s+/g, '.') : ''
      return tag + cls
    } else if (node.element.tagName) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className ? '.' + node.element.className.trim().replace(/\s+/g, '.') : ''
      const id = node.element.id ? `#${node.element.id}` : ''
      return tag + cls + id
    }
  }

  if (node.rootElement?.tagName) {
    const tag = node.rootElement.tagName.toLowerCase()
    const cls = node.rootElement.className ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.') : ''
    const id = node.rootElement.id ? `#${node.rootElement.id}` : ''
    return tag + cls + id
  }

  return 'div'
}

async function toggleFavorite() {
  if (!settings.value) return

  const elementId = getElementIdentifier(props.node)

  if (isFavorite.value) {
    const matchingFav = findMatchingFavorite(elementId, settings.value.favorites)
    if (matchingFav) {
      settings.value.favorites = settings.value.favorites.filter(
        (fav: FavoriteItem) => fav.id !== matchingFav.id
      )
    }
  } else {
    const favoriteItem: FavoriteItem = {
      id: elementId,
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
    // Ignore save errors
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

// Watch for node changes
watch(() => props.node.id, () => {
  editedJson.value = json.value.trim()
  isEditing.value = false
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

// --- Actions ---
function startEditing() {
  editedJson.value = json.value.trim()
  isEditing.value = true
  startEditingProps?.(componentUid.value)
}

function cancelEdit() {
  editedJson.value = json.value.trim()
  isEditing.value = false
  cancelPropsEditing?.()
}

async function saveChanges() {
  if (!isJsonValid.value) return

  try {
    const parsed = JSON.parse(editedJson.value)

    // Update props via hook
    Object.entries(parsed).forEach(([key, value]) => {
      updateEditedProp?.(key, value)
    })

    // Save via service
    const saveResult = await saveEditedProps?.()
    
    if (saveResult === true) {
      // Update local state
      props.node.props = { ...parsed }
      props.node.jsonProps = JSON.stringify(parsed, null, 2)
      props.node.timestamp = new Date().toISOString()
      editedJson.value = JSON.stringify(parsed, null, 2)
    }
    
    isEditing.value = false
  } catch (err) {
    // Keep editing on error
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col">
      <!-- Header (NetworkDetails style) -->
      <div class="shrink-0 flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="$emit('back')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold truncate">{{ nodeName }}</span>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge variant="outline" class="text-xs truncate max-w-[200px]">
                  {{ truncatedElementInfo }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent v-if="elementInfo.length > 40">
                {{ elementInfo }}
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="text-xs text-muted-foreground">
            Updated: {{ formattedTime }}
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="flex items-center gap-1 shrink-0">
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
              {{ isFavorite ? 'Remove from favorites' : 'Add to favorites' }}
            </TooltipContent>
          </Tooltip>
          
          <!-- Edit/Save/Cancel buttons -->
          <Tooltip v-if="!isEditing">
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
              Edit props
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
                Cancel
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
                Save changes
              </TooltipContent>
            </Tooltip>
          </template>
        </div>
      </div>

      <!-- JSON Editor -->
      <div class="flex-1 min-h-0">
        <JsonEditor
          v-model="editedJson"
          :editable="isEditing"
          :show-copy="true"
          :mode="jsonMode"
          :full-height="true"
          class="h-full"
        />
      </div>
    </div>
  </TooltipProvider>
</template>
