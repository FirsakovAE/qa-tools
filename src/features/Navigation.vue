<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import {
    Braces,
    DatabaseIcon,
    GlobeIcon,
    SettingsIcon,
  } from 'lucide-vue-next'
  
  import { Button } from '@/components/ui/button'
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip'
  
import { PropsTab } from '@/features/props'
import { StoresTab, usePiniaStores } from '@/features/stores'
import { OptionsTab } from '@/features/settings'
import { NetworkTab } from '@/features/network'
  
  /* ============================================================================
   * Pinia
   * ============================================================================
   */
  
  const {
    storesData,
    loading: storesLoading,
    error: storesError,
    load: loadStoresSummary,
  } = usePiniaStores()
  
  /* ============================================================================
   * Feature Flags — РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ
   * ============================================================================
   */
  
  /**
   * Флаги, которые реально детектируются окружением
   * (ТОЛЬКО content script)
   */
  interface RemoteFeatureFlags {
    hasVue: boolean
    hasPinia: boolean
    vueVersion: 2 | 3 | null
  }
  
  /**
   * Ручные UI-фичи (dev / prod toggles)
   * НЕ ПРИХОДЯТ извне
   */
  interface UIFeatureFlags {
    hasNetwork: boolean
  }
  
  /**
   * Итоговые флаги UI
   */
  type FeatureFlags = RemoteFeatureFlags & UIFeatureFlags
  
  /* ============================================================================
   * Remote flags (content script)
   * ============================================================================
   */
  
  const DEFAULT_REMOTE_FLAGS: RemoteFeatureFlags = {
    hasVue: false,
    hasPinia: false,
    vueVersion: null,
  }
  
  const remoteFeatureFlags = ref<RemoteFeatureFlags>({
    ...DEFAULT_REMOTE_FLAGS,
  })
  
  function normalizeRemoteFlags(
    flags: Partial<RemoteFeatureFlags>,
  ): RemoteFeatureFlags {
    return {
      ...DEFAULT_REMOTE_FLAGS,
      ...flags,
    }
  }
  
  /* ============================================================================
   * UI feature flags (ручные)
   * ============================================================================
   */
  
const UI_FEATURE_FLAGS: UIFeatureFlags = {
  hasNetwork: true, // 👈 Network tab enabled
}
  
  /**
   * Локальные QA / debug overrides
   */
  const localFeatureOverrides = ref<Partial<UIFeatureFlags>>({
    // hasNetwork: false,
  })
  
  /* ============================================================================
   * Финальные флаги UI
   * ============================================================================
   */
  
  const featureFlags = computed<FeatureFlags>(() => ({
    ...remoteFeatureFlags.value,   // runtime
    ...UI_FEATURE_FLAGS,           // ручные
    ...localFeatureOverrides.value // QA
  }))
  
  /* ============================================================================
   * Flags lifecycle - REACTIVE DETECTION
   * ============================================================================
   */
  
  let storesLoaded = false
  
  /**
   * Handle detection messages from injected script
   * Supports both initial flags and reactive updates
   */
  function handleDetectionMessage(event: MessageEvent) {
    if (!event.data) return
    
    let incomingFlags: Partial<RemoteFeatureFlags> | null = null
    
    // New format (broadcast)
    if (
      event.data?.__VUE_INSPECTOR__ &&
      event.data.broadcast &&
      event.data.message?.type === 'VUE_INSPECTOR_FEATURE_FLAGS'
    ) {
      incomingFlags = event.data.message.flags
    }
    // Legacy format
    else if (
      event.data?.type === 'VUE_INSPECTOR_FEATURE_FLAGS' &&
      event.data.flags
    ) {
      incomingFlags = event.data.flags
    }
    // Detection result format (from injected/main.ts)
    else if (
      event.data?.type === 'VUE_INSPECTOR_DETECTION_RESULT' &&
      event.data?.__FROM_VUE_INSPECTOR__
    ) {
      incomingFlags = {
        hasVue: event.data.hasVue ?? false,
        hasPinia: event.data.hasPinia ?? false,
        vueVersion: event.data.vueVersion ?? null
      }
    }
    // Props module ready - Vue was detected
    else if (
      event.data?.type === 'VUE_INSPECTOR_PROPS_READY' &&
      event.data?.__FROM_VUE_INSPECTOR__
    ) {
      // Update only Vue flag, keep Pinia flag as-is
      remoteFeatureFlags.value = {
        ...remoteFeatureFlags.value,
        hasVue: true
      }
      return
    }
    // Pinia module ready - Pinia was detected
    else if (
      event.data?.type === 'VUE_INSPECTOR_PINIA_READY' &&
      event.data?.__FROM_VUE_INSPECTOR__
    ) {
      // Update Pinia flag
      remoteFeatureFlags.value = {
        ...remoteFeatureFlags.value,
        hasPinia: true
      }
      
      // Load stores if not yet loaded
      if (!storesLoaded) {
        storesLoaded = true
        loadStoresSummary()
      }
      return
    }
    // Vue detected format (legacy)
    else if (
      event.data?.type === 'VUE_INSPECTOR_VUE_DETECTED' &&
      event.data?.__FROM_VUE_INSPECTOR__
    ) {
      if (event.data.detected) {
        remoteFeatureFlags.value = {
          ...remoteFeatureFlags.value,
          hasVue: true,
          vueVersion: event.data.hasVue2 ? 2 : 3
        }
      }
      return
    }
    
    if (!incomingFlags) return
    
    // Merge incoming flags with existing (don't lose already-detected flags)
    const newFlags = normalizeRemoteFlags(incomingFlags)
    
    // Only update if something changed
    const current = remoteFeatureFlags.value
    if (
      current.hasVue !== newFlags.hasVue ||
      current.hasPinia !== newFlags.hasPinia ||
      current.vueVersion !== newFlags.vueVersion
    ) {
      // Preserve already-true flags (detection is one-way: false -> true)
      remoteFeatureFlags.value = {
        hasVue: current.hasVue || newFlags.hasVue,
        hasPinia: current.hasPinia || newFlags.hasPinia,
        vueVersion: newFlags.vueVersion ?? current.vueVersion
      }
    }
    
    // Load Pinia stores when detected
    if (remoteFeatureFlags.value.hasPinia && !storesLoaded) {
      storesLoaded = true
      loadStoresSummary()
    }
  }
  
  /**
   * Handle breakpoint hit - switch to Network tab and store pending info
   */
  function handleBreakpointMessage(event: MessageEvent) {
    if (!event.data) return
    
    // Check for breakpoint hit message (from content script broadcast)
    if (
      event.data?.__VUE_INSPECTOR__ &&
      event.data.broadcast &&
      event.data.message?.type === 'NETWORK_BREAKPOINT_HIT'
    ) {
      const msg = event.data.message
      
      // Store pending breakpoint info so NetworkTab can show details on mount
      if (msg.requestId && msg.trigger) {
        pendingBreakpoint.value = {
          requestId: msg.requestId,
          trigger: msg.trigger,
          entry: msg.entry || null // Include entry data if available
        }
      }
      
      activeTab.value = 'network'
    }
  }
  
  /**
   * Clear pending breakpoint (called by NetworkTab after handling)
   */
  function clearPendingBreakpoint() {
    pendingBreakpoint.value = null
  }

  onMounted(() => {
    // Listen for detection messages (keep listening for reactive updates)
    window.addEventListener('message', handleDetectionMessage)
    
    // Listen for breakpoint hits to switch to Network tab
    window.addEventListener('message', handleBreakpointMessage)
    
    // Request initial flags
    window.parent?.postMessage(
      {
        __VUE_INSPECTOR__: true,
        message: { type: 'VUE_INSPECTOR_GET_FLAGS' },
      },
      '*',
    )
  })
  
  onUnmounted(() => {
    window.removeEventListener('message', handleDetectionMessage)
    window.removeEventListener('message', handleBreakpointMessage)
  })
  
  /* ============================================================================
   * Tabs
   * ============================================================================
   */
  
  const allTabs = [
  {
      id: 'network',
      title: 'Network',
      icon: GlobeIcon,
      requiresFlag: 'hasNetwork' as const, // 👈 ТОЛЬКО UI-флаг
    },
    {
      id: 'props',
      title: 'Props',
      icon: Braces,
      requiresFlag: 'hasVue' as const,
    },
    {
      id: 'stores',
      title: 'Pinia Stores',
      icon: DatabaseIcon,
      requiresFlag: 'hasPinia' as const,
    },
  ] as const
  
  const tabs = computed(() =>
    allTabs.filter(tab => featureFlags.value[tab.requiresFlag]),
  )
  
  /* ============================================================================
   * Navigation state
   * ============================================================================
   */
  
  const optionsTab = {
    id: 'options',
    title: 'Options',
    icon: SettingsIcon,
  } as const
  
  type TabId = 'props' | 'stores' | 'network' | 'options'
  
  const activeTab = ref<TabId>('props')
  
  // Pending breakpoint info (from breakpoint hit while on another tab)
  interface PendingBreakpointInfo {
    requestId: string
    trigger: 'request' | 'response'
    entry?: any // Raw entry data from injected script
  }
  const pendingBreakpoint = ref<PendingBreakpointInfo | null>(null)
  
  /* ============================================================================
   * Tabs watcher
   * ============================================================================
   */
  
  watch(
    tabs,
    newTabs => {
      const currentAvailable =
        newTabs.some(t => t.id === activeTab.value) ||
        activeTab.value === 'options'

      // Only switch if current tab is not available
      if (!currentAvailable && newTabs.length > 0) {
        activeTab.value = newTabs[0].id as TabId
      }
    },
    { immediate: true },
  )
  </script>
  
  
  <template>
    <div class="grid h-full w-full pl-[56px] overflow-hidden">
      <aside class="inset-y fixed left-0 z-20 flex h-full flex-col border-r">
        <!-- Main navigation -->
        <nav class="grid gap-1 p-2">
          <TooltipProvider v-for="tab in tabs" :key="tab.id">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="rounded-lg"
                  :class="{ 'bg-muted': activeTab === tab.id }"
                  :aria-label="tab.title"
                  @click="activeTab = tab.id"
                >
                  <component :is="tab.icon" class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                {{ tab.title }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
  
        <!-- Bottom navigation -->
        <nav class="mt-auto grid gap-1 p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="rounded-lg"
                  :class="{ 'bg-muted': activeTab === optionsTab.id }"
                  aria-label="Options"
                  @click="activeTab = optionsTab.id"
                >
                  <SettingsIcon class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                {{ optionsTab.title }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
      </aside>
  
      <!-- Main content -->
      <main class="h-full min-h-0 overflow-hidden">
        <!-- ===== Props tab (unified two-panel layout) ===== -->
        <div
          v-if="activeTab === 'props'"
          class="h-full overflow-hidden"
        >
          <PropsTab />
        </div>

        <!-- ===== Stores tab (unified two-panel layout) ===== -->
        <div
          v-else-if="activeTab === 'stores'"
          class="h-full overflow-hidden"
        >
          <StoresTab />
        </div>

        <!-- ===== Network tab (unified two-panel layout) ===== -->
        <div
          v-else-if="activeTab === 'network'"
          class="h-full overflow-hidden"
        >
          <NetworkTab 
            :pending-breakpoint="pendingBreakpoint"
            @clear-pending-breakpoint="clearPendingBreakpoint"
          />
        </div>

        <!-- ===== Options tab ===== -->
        <div
          v-else-if="activeTab === 'options'"
          class="h-full overflow-hidden p-2"
        >
          <OptionsTab />
        </div>
      </main>
    </div>
  </template>