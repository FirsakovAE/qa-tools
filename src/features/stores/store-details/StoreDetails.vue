<script setup lang="ts">
  import { ref, computed, onMounted, watch, nextTick } from 'vue'
  import { ChevronLeftIcon, ChevronDown, ChevronRight, Copy, Check, Edit, X, Save } from 'lucide-vue-next'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { Input } from '@/components/ui/input'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from '@/components/ui/collapsible'
  import JsonEditor from '@/components/JsonEditor.vue'
  import { useInspectorSettings } from '@/settings/useInspectorSettings'
  import { useRuntime } from '@/runtime'
  
  const runtime = useRuntime()
  
  interface StoreData {
    id: string
    baseId: string
    stateKeys: number
    getterKeys: number
    lastUpdated: number
    lastUpdatedFormatted: string
  }
  
  const props = defineProps<{
    store: StoreData
  }>()
  
  const emit = defineEmits<{
    (e: 'back'): void
  }>()
  
  // Data from API
  const stateData = ref<Record<string, any> | null>(null)
  const gettersData = ref<Record<string, any>>({})
  const isLoading = ref(false)
  const lastFetched = ref<string>('')
  
  // Collapsible states
  const stateOpen = ref(false)
  const gettersOpen = ref(false)
  
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
  
  
  
  // Computed
  const storeId = computed(() => props.store.id)
  const displayName = computed(() => props.store.baseId || 'Unknown Store')
  const hasState = computed(() => props.store.stateKeys > 0)
  const hasGetters = computed(() => props.store.getterKeys > 0)
  
  
  const stateJson = computed(() => {
    if (!stateData.value) return '{}'
    return JSON.stringify(stateData.value, null, 2)
  })
  
  const gettersJson = computed(() => {
    if (!gettersData.value || Object.keys(gettersData.value).length === 0) return '{}'
    return JSON.stringify(gettersData.value, null, 2)
  })
  
  // Load store data
  async function loadStoreData() {
    isLoading.value = true
    
    try {
      const response = await runtime.sendMessage<{
        type: string
        storeId: string
        state: any
        getters?: any
        error?: string
      }>({
        type: 'PINIA_GET_STORE_STATE',
        storeId: storeId.value
      })
      
      // Обрабатываем response напрямую
      if (response?.storeId === storeId.value) {
        stateData.value = response.state
        gettersData.value = response.getters || {}
        editedStateJson.value = stateJson.value
        editedGettersJson.value = gettersJson.value
        
        const hasStateData = Object.keys(response.state || {}).length > 0
        const hasGettersData = Object.keys(response.getters || {}).length > 0
        
        if (hasStateData && !hasGettersData) {
          stateOpen.value = true
          gettersOpen.value = false
        } else if (!hasStateData && hasGettersData) {
          stateOpen.value = false
          gettersOpen.value = true
        } else {
          stateOpen.value = false
          gettersOpen.value = false
        }
      }
      
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      lastFetched.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    } catch (err) {
    } finally {
      isLoading.value = false
    }
  }
  
  // Handle messages from content script
  function handlePiniaMessage(message: any, respond: (r: unknown) => void) {
    if (message?.type === 'PINIA_STORE_STATE_DATA' && message.storeId === storeId.value) {
      stateData.value = message.state
      gettersData.value = message.getters || {}
      editedStateJson.value = stateJson.value
      editedGettersJson.value = gettersJson.value
  
      // Set initial collapsible states based on available data
      const hasStateData = Object.keys(message.state || {}).length > 0
      const hasGettersData = Object.keys(message.getters || {}).length > 0
  
      // If only one type of data is available, expand it by default
      // If both are available, keep both collapsed
      if (hasStateData && !hasGettersData) {
        // Only state data - expand state section
        stateOpen.value = true
        gettersOpen.value = false
      } else if (!hasStateData && hasGettersData) {
        // Only getters data - expand getters section
        stateOpen.value = false
        gettersOpen.value = true
      } else {
        // Both or neither - keep both collapsed
        stateOpen.value = false
        gettersOpen.value = false
      }
  
      nextTick(() => {
        // JsonEditor handles highlighting internally
      })
    }
    
    if (message?.type === 'PINIA_REPLACE_STATE_RESULT' && message.storeId === storeId.value) {
      if (message.success) {
        loadStoreData() // Reload data
      }
    }
    
    if (message?.type === 'PINIA_PATCH_GETTERS_RESULT' && message.storeId === storeId.value) {
      if (message.success) {
        loadStoreData() // Reload data
      }
    }
    
  
  }
  
  
  // Copy to clipboard
  
  // Start editing state
  function startEditingState() {
    editedStateJson.value = stateJson.value
    isEditingState.value = true
  }
  
  // Cancel editing state
  function cancelEditingState() {
    editedStateJson.value = stateJson.value
    isEditingState.value = false
  }
  
  // Start editing getters
  function startEditingGetters() {
    editedGettersJson.value = gettersJson.value
    isEditingGetters.value = true
  }
  
  // Cancel editing getters
  function cancelEditingGetters() {
    editedGettersJson.value = gettersJson.value
    isEditingGetters.value = false
  }
  
  // Save state changes
  async function saveStateChanges() {
    if (!isStateJsonValid.value) return
    
    try {
      const newState = JSON.parse(editedStateJson.value)
      
      await runtime.sendMessage({
        type: 'PINIA_REPLACE_STATE',
        storeId: storeId.value,
        newState
      })
      
      isEditingState.value = false
    } catch (err) {
    }
  }
  
  // Save getters changes (by updating source state)
  async function saveGettersChanges() {
    if (!isGettersJsonValid.value) return
    
    try {
      const newGetters = JSON.parse(editedGettersJson.value)
      
      // Send as PINIA_PATCH_GETTERS - will update source state to change getters
      await runtime.sendMessage({
        type: 'PINIA_PATCH_GETTERS',
        storeId: storeId.value,
        newGetters
      })
      
      isEditingGetters.value = false
    } catch (err) {
    }
  }
  
  
  
  
  
  
  // Watch for data changes to update edited JSON
  watch(stateJson, (newValue) => {
    if (!isEditingState.value) {
      editedStateJson.value = newValue
    }
  })
  
  watch(gettersJson, (newValue) => {
    if (!isEditingGetters.value) {
      editedGettersJson.value = newValue
    }
  })
  
  let unsubscribeMessage: (() => void) | null = null
  
  // Mount
  onMounted(async () => {
    unsubscribeMessage = runtime.onMessage(handlePiniaMessage)
    loadStoreData()
  
    // Load JSON mode setting
    const settings = await useInspectorSettings()
    jsonMode.value = settings?.json?.mode ?? 'text'
  })
  
  // Cleanup
  import { onUnmounted } from 'vue'
  onUnmounted(() => {
    unsubscribeMessage?.()
  })
  </script>
  
  <template>
    <ScrollArea class="h-full">
      <div class="flex flex-col gap-2 pr-2">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <button class="p-2 border rounded hover:bg-accent" @click="$emit('back')">
              <ChevronLeftIcon class="w-4 h-4" />
            </button>
            <h3 class="text-lg font-semibold ml-2">Store Details</h3>
          </div>
          <div class="text-sm text-muted-foreground p-2">
            Updated: {{ lastFetched || 'Loading...' }}
          </div>
        </div>
  
  
        <!-- Store Info (like StoreTreeNode) -->
        <div>
          <div class="ml-2">
            <div class="flex items-center gap-3 mb-2">
              <div class="font-semibold text-base truncate">{{ displayName }}</div>
            </div>
        
            <div class="flex items-center gap-1 flex-wrap">
              <Badge v-if="hasState" variant="secondary" class="text-xs border">
                State
              </Badge>
              <Badge v-if="hasGetters" variant="secondary" class="text-xs border">
                Getters
              </Badge>
            </div>
          </div>
        </div>
  
        <!-- Collapsible sections -->
        <div class="flex flex-col">
  
        <!-- State Section -->
          <Collapsible v-if="hasState" v-model:open="stateOpen" class="border-b">
            <CollapsibleTrigger class="flex items-center justify-between w-full min-h-12 px-3 hover:bg-accent">
              <div class="flex items-center gap-2">
                <component :is="stateOpen ? ChevronDown : ChevronRight" class="w-4 h-4" />
                <span class="font-medium">State</span>
              </div>
              <div class="flex gap-1" @click.stop>
                <Button
                  v-if="!isEditingState"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0"
                  @click="startEditingState"
                >
                  <Edit class="w-4 h-4" />
                </Button>
                <Button
                  v-if="isEditingState"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0"
                  @click="cancelEditingState"
                >
                  <X class="w-4 h-4" />
                </Button>
                <Button
                  v-if="isEditingState"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0"
                  :disabled="!isStateJsonValid"
                  @click="saveStateChanges"
                >
                  <Save class="w-4 h-4" />
                </Button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div>
                <JsonEditor
                  v-model="editedStateJson"
                  :editable="isEditingState"
                  :show-copy="true"
                  :mode="jsonMode"
                  @edit="startEditingState"
                  @cancel="cancelEditingState"
                  @save="saveStateChanges"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
  
          <!-- Getters Section -->
          <Collapsible v-if="hasGetters" v-model:open="gettersOpen" class="border-b">
            <CollapsibleTrigger class="flex items-center justify-between w-full min-h-12 px-3 hover:bg-accent">
              <div class="flex items-center gap-2">
                <component :is="gettersOpen ? ChevronDown : ChevronRight" class="w-4 h-4" />
                <span class="font-medium">Getters</span>
              </div>
              <div class="flex gap-1" @click.stop>
                <Button
                  v-if="!isEditingGetters"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0"
                  @click="startEditingGetters"
                >
                  <Edit class="w-4 h-4" />
                </Button>
                <Button
                  v-if="isEditingGetters"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0"
                  @click="cancelEditingGetters"
                >
                  <X class="w-4 h-4" />
                </Button>
                <Button
                  v-if="isEditingGetters"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0"
                  :disabled="!isGettersJsonValid"
                  @click="saveGettersChanges"
                >
                  <Save class="w-4 h-4" />
                </Button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div>
                <JsonEditor
                  v-model="editedGettersJson"
                  :editable="isEditingGetters"
                  :show-copy="true"
                  :mode="jsonMode"
                  @edit="startEditingGetters"
                  @cancel="cancelEditingGetters"
                  @save="saveGettersChanges"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
  
        </div>
      </div>
    </ScrollArea>
  </template>
  
  <style scoped>
  .json-editor:focus {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
  </style>