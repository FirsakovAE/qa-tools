<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ArrowLeft, Edit, X, Save } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import JsonEditor from '@/components/JsonEditor.vue'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useRuntime } from '@/runtime'

const runtime = useRuntime()

interface StoreData {
  id: string
  baseId: string
  stateKeys: number
  getterKeys: number
  lastUpdated?: number
  lastUpdatedFormatted?: string
}

const props = defineProps<{
  store: StoreData
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

// Active section - initialize based on store metadata
type SectionId = 'state' | 'getters'
const activeSection = ref<SectionId>(props.store.stateKeys > 0 ? 'state' : 'getters')

// Data from API (snapshot - not reactive to external changes)
const stateData = ref<Record<string, any> | null>(null)
const gettersData = ref<Record<string, any> | null>(null)
const isLoading = ref(true)
const lastFetched = ref<string>('')

// Editing state
const isEditingState = ref(false)
const editedStateJson = ref('{}')
const isStateJsonValid = computed(() => {
  try { JSON.parse(editedStateJson.value); return true } catch { return false }
})

// Editing getters
const isEditingGetters = ref(false)
const editedGettersJson = ref('{}')
const isGettersJsonValid = computed(() => {
  try { JSON.parse(editedGettersJson.value); return true } catch { return false }
})

// JSON Mode
const jsonMode = ref<'text' | 'tree'>('text')

// Sections definition
const sections = computed(() => {
  const list: Array<{ id: SectionId; label: string }> = []
  
  if (props.store.stateKeys > 0) {
    list.push({ id: 'state', label: 'State' })
  }
  if (props.store.getterKeys > 0) {
    list.push({ id: 'getters', label: 'Getters' })
  }
  
  return list
})

// Computed
const storeId = props.store.id // NOT reactive - this component is disposable
const displayName = computed(() => props.store.baseId || 'Unknown Store')
const hasState = computed(() => props.store.stateKeys > 0)
const hasGetters = computed(() => props.store.getterKeys > 0)

// Current editing mode
const isEditing = computed(() => {
  if (activeSection.value === 'state') return isEditingState.value
  if (activeSection.value === 'getters') return isEditingGetters.value
  return false
})

const isCurrentJsonValid = computed(() => {
  if (activeSection.value === 'state') return isStateJsonValid.value
  if (activeSection.value === 'getters') return isGettersJsonValid.value
  return true
})

const stateJson = computed(() => {
  if (!stateData.value) return '{}'
  return JSON.stringify(stateData.value, null, 2)
})

const gettersJson = computed(() => {
  if (!gettersData.value) return '{}'
  return JSON.stringify(gettersData.value, null, 2)
})

// Check if data is ready for display
const isStateDataReady = computed(() => stateData.value !== null)
const isGettersDataReady = computed(() => gettersData.value !== null)

// Load store data (called once on mount)
async function loadStoreData() {
  isLoading.value = true
  
  try {
    const response = await runtime.sendMessage<{
      type?: string
      storeId?: string
      state?: any
      getters?: any
      error?: string
    }>({
      type: 'PINIA_GET_STORE_STATE',
      storeId: storeId
    })
    
    if (response) {
      // Only set data if present in response (don't overwrite with undefined)
      if ('state' in response) {
        stateData.value = response.state ?? {}
      }
      if ('getters' in response) {
        gettersData.value = response.getters ?? {}
      }
      
      // Update edited JSON after data is loaded
      await nextTick()
      editedStateJson.value = stateJson.value
      editedGettersJson.value = gettersJson.value
    }
    
    const now = new Date()
    lastFetched.value = now.toISOString().replace('T', ' ').slice(0, 19)
  } catch (err) {
    console.error('[PiniaDetails] Error loading store data:', err)
    // Set empty objects to show "empty" state instead of loading
    stateData.value = {}
    gettersData.value = {}
  } finally {
    isLoading.value = false
  }
}

// Handle save result messages (snapshot-only: no live updates)
function handlePiniaMessage(message: any) {
  // Only handle messages for THIS store
  if (message?.storeId && message.storeId !== storeId) return
  
  // Reload data after successful save
  if (message?.type === 'PINIA_REPLACE_STATE_RESULT') {
    if (message.success) {
      loadStoreData()
    } else {
      console.warn('[PiniaDetails] Failed to replace state:', message.error)
    }
  }
  
  if (message?.type === 'PINIA_PATCH_GETTERS_RESULT') {
    if (message.success) {
      loadStoreData()
    } else {
      console.warn('[PiniaDetails] Failed to patch getters:', message.error)
    }
  }
}

// Start editing current section
function startEditing() {
  if (activeSection.value === 'state') {
    editedStateJson.value = stateJson.value
    isEditingState.value = true
  } else if (activeSection.value === 'getters') {
    editedGettersJson.value = gettersJson.value
    isEditingGetters.value = true
  }
}

// Cancel editing current section
function cancelEditing() {
  if (activeSection.value === 'state') {
    editedStateJson.value = stateJson.value
    isEditingState.value = false
  } else if (activeSection.value === 'getters') {
    editedGettersJson.value = gettersJson.value
    isEditingGetters.value = false
  }
}

// Save current section changes
async function saveChanges() {
  if (activeSection.value === 'state') {
    await saveStateChanges()
  } else if (activeSection.value === 'getters') {
    await saveGettersChanges()
  }
}

// Save state changes
async function saveStateChanges() {
  if (!isStateJsonValid.value) return
  
  try {
    const newState = JSON.parse(editedStateJson.value)
    
    const response = await runtime.sendMessage<{ success?: boolean; error?: string }>({
      type: 'PINIA_REPLACE_STATE',
      storeId: storeId,
      newState
    })
    
    if (response?.success) {
      // Update local state immediately for responsive UI
      stateData.value = newState
      isEditingState.value = false
    } else {
      console.warn('[PiniaDetails] Failed to save state:', response?.error)
    }
  } catch (err) {
    console.warn('[PiniaDetails] Error saving state:', err)
  }
}

// Save getters changes
async function saveGettersChanges() {
  if (!isGettersJsonValid.value) return
  
  try {
    const newGetters = JSON.parse(editedGettersJson.value)
    
    const response = await runtime.sendMessage<{ success?: boolean; error?: string }>({
      type: 'PINIA_PATCH_GETTERS',
      storeId: storeId,
      newGetters
    })
    
    if (response?.success) {
      // Update local state immediately for responsive UI
      gettersData.value = newGetters
      isEditingGetters.value = false
    } else {
      console.warn('[PiniaDetails] Failed to save getters:', response?.error)
    }
  } catch (err) {
    console.warn('[PiniaDetails] Error saving getters:', err)
  }
}

let unsubscribeMessage: (() => void) | null = null

// Mount - load data once
onMounted(async () => {
  unsubscribeMessage = runtime.onMessage(handlePiniaMessage)

  // Load JSON mode setting
  const settings = await useInspectorSettings()
  jsonMode.value = settings?.json?.mode ?? 'text'
  
  // Load store data
  loadStoreData()
})

// Cleanup
onUnmounted(() => {
  unsubscribeMessage?.()
})
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="shrink-0 flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('back')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold truncate">{{ displayName }}</span>
            <Badge v-if="hasState" variant="secondary" class="text-xs">
              State: {{ store.stateKeys }}
            </Badge>
            <Badge v-if="hasGetters" variant="outline" class="text-xs">
              Getters: {{ store.getterKeys }}
            </Badge>
          </div>
          <div class="text-xs text-muted-foreground">
            Updated: {{ lastFetched || 'Loading...' }}
          </div>
        </div>
        
        <!-- Edit/Save/Cancel buttons in header -->
        <div class="flex items-center gap-1 shrink-0">
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
              Edit {{ activeSection }}
            </TooltipContent>
          </Tooltip>
          
          <template v-if="isEditing">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  @click="cancelEditing"
                >
                  <X class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Cancel</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  :disabled="!isCurrentJsonValid"
                  @click="saveChanges"
                >
                  <Save class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Save</TooltipContent>
            </Tooltip>
          </template>
        </div>
      </div>
      
      <!-- Section tabs (Menubar style) -->
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
        <!-- Loading state -->
        <div v-if="isLoading" class="h-full flex items-center justify-center text-sm text-muted-foreground">
          Loading store data...
        </div>
        
        <!-- State Section -->
        <div v-else-if="activeSection === 'state'" class="h-full flex flex-col">
          <div v-if="!hasState" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No state data
          </div>
          <template v-else-if="isStateDataReady">
            <div class="flex-1 min-h-0">
              <JsonEditor
                v-model="editedStateJson"
                :editable="isEditingState"
                :show-copy="true"
                :mode="jsonMode"
                :full-height="true"
                class="h-full"
              />
            </div>
          </template>
        </div>
        
        <!-- Getters Section -->
        <div v-else-if="activeSection === 'getters'" class="h-full flex flex-col">
          <div v-if="!hasGetters" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No getters data
          </div>
          <template v-else-if="isGettersDataReady">
            <div class="flex-1 min-h-0">
              <JsonEditor
                v-model="editedGettersJson"
                :editable="isEditingGetters"
                :show-copy="true"
                :mode="jsonMode"
                :full-height="true"
                class="h-full"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
