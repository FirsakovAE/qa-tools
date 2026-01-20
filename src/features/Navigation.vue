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
  
  import PropsNavigation from '@/features/props/PropsNavigation.vue'
  import ComponentDetails from '@/features/props/prop-details/ComponentDetails.vue'
  import StoreNavigation from '@/features/stores/StoreNavigation.vue'
  import StoreDetails from '@/features/stores/store-details/StoreDetails.vue'
  import OptionsTab from '@/features/settings/OptionsTab.vue'
  import { usePiniaStores } from '@/features/stores/usePiniaStores'
  import type { TreeNodeModel } from '@/types/tree'
  import { Toaster } from '@/components/ui/Toaster'
  
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
    hasNetwork: false, // 👈 dev ON, prod OFF
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
   * Flags lifecycle
   * ============================================================================
   */
  
  let flagsReceived = false
  let storesLoaded = false
  
  function handleFlagsMessage(event: MessageEvent) {
    if (flagsReceived) return
  
    let incomingFlags: Partial<RemoteFeatureFlags> | null = null
  
    // Новый формат
    if (
      event.data?.__VUE_INSPECTOR__ &&
      event.data.broadcast &&
      event.data.message?.type === 'VUE_INSPECTOR_FEATURE_FLAGS'
    ) {
      incomingFlags = event.data.message.flags
    }
    // Старый формат
    else if (
      event.data?.type === 'VUE_INSPECTOR_FEATURE_FLAGS' &&
      event.data.flags
    ) {
      incomingFlags = event.data.flags
    }
  
    if (!incomingFlags) return
  
    flagsReceived = true
    remoteFeatureFlags.value = normalizeRemoteFlags(incomingFlags)
  
    window.removeEventListener('message', handleFlagsMessage)
  
    if (remoteFeatureFlags.value.hasPinia && !storesLoaded) {
      storesLoaded = true
      loadStoresSummary()
    }
  }
  
  onMounted(() => {
    window.addEventListener('message', handleFlagsMessage)
  
    window.parent?.postMessage(
      {
        __VUE_INSPECTOR__: true,
        message: { type: 'VUE_INSPECTOR_GET_FLAGS' },
      },
      '*',
    )
  })
  
  onUnmounted(() => {
    if (!flagsReceived) {
      window.removeEventListener('message', handleFlagsMessage)
    }
  })
  
  /* ============================================================================
   * Tabs
   * ============================================================================
   */
  
  const allTabs = [
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
    {
      id: 'network',
      title: 'Network',
      icon: GlobeIcon,
      requiresFlag: 'hasNetwork' as const, // 👈 ТОЛЬКО UI-флаг
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
  
  const activeTab = ref<TabId>('network')
  
  const selectedNode = ref<TreeNodeModel | null>(null)
  const selectedStore = ref<any | null>(null)
  
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
  
      if (!currentAvailable && newTabs.length > 0) {
        activeTab.value = newTabs[0].id as TabId
      }
  
      if (
        newTabs.length > 0 &&
        (activeTab.value === 'network' || activeTab.value === 'options')
      ) {
        const firstMainTab = newTabs.find(
          t => t.id === 'props' || t.id === 'stores',
        )
        if (firstMainTab) {
          activeTab.value = firstMainTab.id as TabId
        }
      }
    },
    { immediate: true },
  )
  </script>
  
  
  <template>
    <!-- Toaster как настоящий overlay (вне layout) -->
    <div class="fixed inset-0 pointer-events-none z-50">
      <Toaster
        position="bottom-right"
        class="pointer-events-auto"
        :toast-options="{
          duration: 5000
        }"
      />
    </div>

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
      <main class="h-full min-h-0 overflow-hidden p-2">
        <!-- ===== Props tab ===== -->
        <div
          v-if="activeTab === 'props'"
          class="grid h-full grid-cols-3 gap-4 overflow-hidden"
        >
          <div class="col-span-1 h-full min-h-0 overflow-hidden">
            <PropsNavigation @select="node => selectedNode = node" />
          </div>

          <div class="col-span-2 h-full min-h-0 overflow-hidden">
            <ComponentDetails
              v-if="selectedNode"
              :key="selectedNode.id || selectedNode.componentUid"
              :node="selectedNode"
              @back="selectedNode = null"
            />

            <div
              v-else
              class="h-full flex items-center justify-center text-muted-foreground"
            >
              Select a component to see details
            </div>
          </div>
        </div>
  
        <div
          v-else-if="activeTab === 'stores'"
          class="grid h-full grid-cols-3 gap-4 overflow-hidden"
        >
          <!-- LEFT: list -->
          <div class="col-span-1 h-full min-h-0 overflow-hidden">
            <StoreNavigation
              :stores-data="storesData"
              :is-loading="storesLoading"
              :error="storesError"
              @select="store => selectedStore = store"
              @refresh="loadStoresSummary"
            />
          </div>

          <!-- RIGHT: details -->
          <div class="col-span-2 h-full min-h-0 overflow-hidden">
            <StoreDetails
              v-if="selectedStore"
              :key="selectedStore.id"
              :store="selectedStore"
              @back="selectedStore = null"
            />

            <div
              v-else
              class="h-full flex items-center justify-center text-muted-foreground"
            >
              Select a store to see details
            </div>
          </div>
        </div>
  
        <div v-else-if="activeTab === 'network'">
          <!-- Network content -->
        </div>
  
        <div
          v-else-if="activeTab === 'options'"
          class="grid h-full grid-cols-3 gap-4 overflow-hidden"
        >
          <div class="col-span-1 h-full min-h-0 overflow-auto">
            <OptionsTab />
          </div>
          <div class="col-span-2 h-full min-h-0">
            <!-- Reserved for future options details -->
          </div>
        </div>
      </main>
    </div>
  </template>  