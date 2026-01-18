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
  
  // Pinia stores composable - НЕ вызывает load() автоматически
  const { storesData, loading: storesLoading, error: storesError, load: loadStoresSummary } = usePiniaStores()
  
  // Feature flags - получаем из content script
  interface FeatureFlags {
    hasVue: boolean
    hasPinia: boolean
    vueVersion: 2 | 3 | null
  }
  
  const featureFlags = ref<FeatureFlags>({
    hasVue: false,
    hasPinia: false,
    vueVersion: null
  })
  
  // Флаги состояния
  let storesLoaded = false
  let flagsReceived = false
  
  // Обработчик сообщений с флагами - удаляется после первого получения
  function handleFlagsMessage(event: MessageEvent) {
    if (flagsReceived) return
    
    let flags: FeatureFlags | null = null
    
    // Новый формат: { __VUE_INSPECTOR__: true, broadcast: true, message: { type, flags } }
    if (event.data?.__VUE_INSPECTOR__ && event.data.broadcast && event.data.message?.type === 'VUE_INSPECTOR_FEATURE_FLAGS') {
      flags = event.data.message.flags
    }
    // Старый формат для совместимости: { type, flags }
    else if (event.data?.type === 'VUE_INSPECTOR_FEATURE_FLAGS' && event.data.flags) {
      flags = event.data.flags
    }
    
    if (!flags) return
    
    flagsReceived = true
    featureFlags.value = flags
    console.log('[Navigation] Feature flags received:', flags)
    
    // Удаляем listener - флаги получены, больше не нужен
    window.removeEventListener('message', handleFlagsMessage)
    
    // Загружаем сторы ТОЛЬКО если hasPinia = true
    if (flags.hasPinia && !storesLoaded) {
      storesLoaded = true
      loadStoresSummary()
    }
  }
  
  onMounted(() => {
    window.addEventListener('message', handleFlagsMessage)
    
    // Запрашиваем флаги у parent window (content script)
    // Используем новый формат с __VUE_INSPECTOR__ префиксом
    window.parent?.postMessage({
      __VUE_INSPECTOR__: true,
      message: { type: 'VUE_INSPECTOR_GET_FLAGS' }
    }, '*')
  })
  
  onUnmounted(() => {
    // Удаляем только если ещё не удалили ранее
    if (!flagsReceived) {
      window.removeEventListener('message', handleFlagsMessage)
    }
  })
  
  // Все возможные вкладки (порядок важен!)
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
      requiresFlag: null, // Всегда показываем
    },
  ] as const
  
  // Фильтруем вкладки на основе флагов
  const tabs = computed(() => {
    return allTabs.filter(tab => {
      if (tab.requiresFlag === null) return true
      return featureFlags.value[tab.requiresFlag]
    })
  })
  
  const optionsTab = {
    id: 'options',
    title: 'Options',
    icon: SettingsIcon,
  } as const
  
  type TabId = 'props' | 'stores' | 'network' | 'options'
  
  const activeTab = ref<TabId>('network') // По умолчанию network (всегда доступна)
  const selectedNode = ref<TreeNodeModel | null>(null)
  const selectedStore = ref<any | null>(null)

  // Следим за изменением доступных вкладок и переключаемся на первую доступную
  watch(tabs, (newTabs) => {
    // Если текущая вкладка стала недоступна - переключаемся на первую доступную
    const currentTabAvailable = newTabs.some(t => t.id === activeTab.value) || activeTab.value === 'options'
    if (!currentTabAvailable && newTabs.length > 0) {
      activeTab.value = newTabs[0].id as TabId
    }
    // Если есть доступные вкладки и мы на network/options - переключаемся на первую (props/stores)
    if (newTabs.length > 0 && (activeTab.value === 'network' || activeTab.value === 'options')) {
      const firstFeatureTab = newTabs.find(t => t.id === 'props' || t.id === 'stores')
      if (firstFeatureTab) {
        activeTab.value = firstFeatureTab.id as TabId
      }
    }
  }, { immediate: true })
  </script>
  
  
  
  <template>
    <div class="grid h-screen w-full pl-[56px]">
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
      <main class="flex-1 overflow-auto p-2">
        <!-- ===== Props tab ===== -->
        <div
          v-if="activeTab === 'props'"
          class="grid h-full grid-cols-3 gap-4"
        >
          <div class="col-span-1">
            <PropsNavigation @select="node => selectedNode = node" />
          </div>

          <div class="col-span-2">
            <ComponentDetails
              v-if="selectedNode"
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
          class="grid h-full grid-cols-3 gap-4"
        >
          <!-- LEFT: list -->
          <div class="col-span-1 h-full min-h-0">
            <StoreNavigation
              :stores-data="storesData"
              :is-loading="storesLoading"
              :error="storesError"
              @select="store => selectedStore = store"
              @refresh="loadStoresSummary"
            />
          </div>

          <!-- RIGHT: details -->
          <div class="col-span-2 h-full min-h-0">
            <StoreDetails
              v-if="selectedStore"
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
          class="grid h-full grid-cols-3 gap-4"
        >
          <div class="col-span-1 h-full overflow-auto">
            <OptionsTab />
          </div>
          <div class="col-span-2 h-full">
            <!-- Reserved for future options details -->
          </div>
        </div>
      </main>
    </div>
  </template>  