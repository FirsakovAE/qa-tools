<script setup lang="ts">
import { watch, ref, computed, Ref, onMounted, onUnmounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { SearchIcon, RefreshCw } from 'lucide-vue-next'
import TreeCard from '@/features/props/TreeCard.vue'
import TreeNode from '@/features/props/prop-details/TreeNode.vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDebounceFn, useVirtualList } from '@vueuse/core'

import { useTreeData } from '@/hooks/useTreeData'
import { useComponentsTab } from '@/hooks/useComponentsTab'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import type {TreeNodeModel} from "../../types/tree.ts";

import { safeRuntime, safeTabs, safeStorage } from '@/utils/extensionBridge'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      propsOnly?: boolean
    }>(),
    {
      modelValue: '',
      propsOnly: false,
    }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:propsOnly', value: boolean): void
  (e: 'select', node: TreeNodeModel): void
}>()

const settings = ref<any>(null)
useInspectorSettings().then(s => {
  settings.value = s
})

// Отслеживаем изменения настроек в реальном времени
const storage = safeStorage()
let storageListener: ((changes: any) => void) | null = null

if (storage?.onChanged) {
  storageListener = (changes) => {
    const settingsKey = 'vue-inspector-settings'
    if (changes[settingsKey]) {
      useInspectorSettings().then(newSettings => {
        settings.value = newSettings
      }).catch(error => {
      })
    }
  }
  storage.onChanged.addListener(storageListener)
}

const { treeData, isLoading, error, refresh } = useTreeData()

// Определяем, нужно ли показывать ошибку пользователю
const shouldShowError = computed(() => {
  if (!error.value) return false

  // Не показываем ошибки подключения - это нормально для всех случаев
  if (error.value.includes('Could not establish connection') ||
      error.value.includes('Receiving end does not exist')) {
    return false
  }

  return true
})

// Auto-refresh logic
let autoRefreshTimer: number | null = null

const startAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
  }

  if (settings.value?.updates?.autoRefresh && settings.value?.updates?.autoRefreshInterval) {
    autoRefreshTimer = window.setInterval(async () => {
      if (!isLoading.value) {
        await refresh()
      }
    }, settings.value.updates.autoRefreshInterval)
  }
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

// Watch for settings changes to start/stop auto-refresh
watch(() => settings.value?.updates?.autoRefresh, (autoRefresh) => {
  if (autoRefresh) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

watch(() => settings.value?.updates?.autoRefreshInterval, () => {
  if (settings.value?.updates?.autoRefresh) {
    startAutoRefresh()
  }
})

// Initialize auto-refresh when settings are loaded
watch(settings, (newSettings) => {
  if (newSettings?.updates?.autoRefresh) {
    startAutoRefresh()
  }
})

// Слушаем изменение видимости панели (для экономии ресурсов)
let isVisible = true
const visibilityHandler = (event: MessageEvent) => {
  if (event.data?.__VUE_INSPECTOR__ && event.data.broadcast && 
      event.data.message?.type === 'VUE_INSPECTOR_VISIBILITY_CHANGED') {
    isVisible = event.data.message.visible
    if (isVisible && settings.value?.updates?.autoRefresh) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }
}
window.addEventListener('message', visibilityHandler)

// Cleanup on unmount
onUnmounted(() => {
  stopAutoRefresh()
  window.removeEventListener('message', visibilityHandler)
  if (storage?.onChanged && storageListener) {
    storage.onChanged.removeListener(storageListener)
  }
})

const {
  filteredTree,
  elementsCount,
  searchTerm,
  propsOnly: localPropsOnly,
} = useComponentsTab(treeData as Ref<TreeNodeModel[]>, {
  modelValue: props.modelValue,
  propsOnly: props.propsOnly
})

// ===== Virtual list config =====
const ROW_HEIGHT = 88 // px — реальная высота TreeNode

const {
  list: virtualList,
  containerProps,
  wrapperProps,
} = useVirtualList(filteredTree, {
  itemHeight: ROW_HEIGHT,
  overscan: 2,
})

const lastUpdatedAt = ref<Date | null>(null)

watch(isLoading, (loading, prev) => {
  if (prev && !loading) lastUpdatedAt.value = new Date()
})

const touchTimestamp = useDebounceFn(() => {
  lastUpdatedAt.value = new Date()
}, 100)

watch(searchTerm, touchTimestamp)

const formattedLastUpdated = computed(() =>
    lastUpdatedAt.value ? lastUpdatedAt.value.toISOString().replace('T', ' ').slice(0, 19) : '—'
)


// Формируем массив активных типов поиска для отображения
const activeSearchTypes = computed(() => {
  const types: string[] = []
  const searchSettings = settings.value?.search

  if (searchSettings?.byName) types.push('Name')
  if (searchSettings?.byLabel) types.push('Label')
  if (searchSettings?.byRootElement) types.push('Root Element')
  if (searchSettings?.byKey) types.push('Key')
  if (searchSettings?.byValue) types.push('Value')

  return types
})

// Функция для снятия подсветки
async function unhighlightElements() {
  try {
    const runtime = safeRuntime()
    const tabsApi = safeTabs()
    if (!runtime || !tabsApi) return

    const tabs = await tabsApi.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) return

    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT',
      tabId: tabs[0].id
    })
  } catch (error) {
  }
}

watch(searchTerm, val => {
  // Снимаем подсветку при начале нового поиска
  if (val.trim()) {
    unhighlightElements()
  }
})
watch(localPropsOnly, val => emit('update:propsOnly', val))

const handleRefresh = async () => {
  if (isLoading.value) return
  await refresh()
}
</script>

<template>
  <TreeCard :tree="filteredTree" @select="node => emit('select', node)">
    <template #list="{ onSelect }">
      <div class="flex justify-between items-start p-1">
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold mb-2">
              Available elements ({{ elementsCount }})
            </h3>
            <Button size="sm" variant="ghost" :disabled="isLoading" @click="handleRefresh">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            </Button>
          </div>
          <span class="text-sm text-muted-foreground">
            Updated: {{ formattedLastUpdated }}
          </span>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <Switch :model-value="localPropsOnly" @update:model-value="val => (localPropsOnly = val)" />
          <Label>Props only</Label>
        </div>
      </div>

      <div class="mb-2">
        <div class="relative">
          <Input v-model="searchTerm" placeholder="Search props..." class="pl-10" />
          <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        </div>

        <div v-if="activeSearchTypes.length" class="flex items-center gap-1 flex-wrap mt-2">
          <Badge v-for="item in activeSearchTypes" :key="item" variant="secondary">{{ item }}</Badge>
        </div>
      </div>

      <div class="relative border rounded h-[392px] overflow-auto" v-bind="containerProps">
        <div
          v-if="!isLoading && filteredTree.length === 0"
          class="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground z-10"
        >
          <div class="space-y-2">
            <div class="space-y-2 flex flex-col items-center">
              <SearchIcon class="w-6 h-6 text-muted-foreground/60" />
              <div class="text-sm text-muted-foreground">
                No components found
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="!(!isLoading && filteredTree.length === 0)"
          v-bind="wrapperProps"
          class="flex flex-col p-1"
        >
          <TreeNode
            v-for="item in virtualList"
            :key="item.data.id"
            :node="item.data"
            :active="true"
            @select="onSelect"
          />
        </div>
      </div>



      <div
        v-if="shouldShowError"
        class="absolute inset-0 z-10 bg-background/80 flex items-center justify-center text-destructive text-sm"
      >
        {{ error }}
      </div>
    </template>
  </TreeCard>
</template>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
</style>
