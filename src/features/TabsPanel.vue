<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PropsNavigation from '@/features/props/PropsNavigation.vue'
import OptionsTab from '@/features/settings/OptionsTab.vue'
import StoresTab from '@/features/stores/StoresTab.vue'
import { useRuntime } from '@/runtime'

const runtime = useRuntime()
const STORAGE_KEY_TAB = 'vue-inspector-active-tab'

const activeTab = ref<string>('props')

// Load from storage asynchronously
onMounted(async () => {
  const savedTab = await runtime.storage.get<string>(STORAGE_KEY_TAB)
  if (savedTab && ['props', 'stores', 'options'].includes(savedTab)) {
    activeTab.value = savedTab
  }
})

// Сохраняем активную вкладку при изменении
watch(activeTab, (tab) => {
  runtime.storage.set(STORAGE_KEY_TAB, tab)
})
</script>

<template>
  <Tabs v-model="activeTab">
    <TabsList class="w-full">
      <TabsTrigger value="props" class="flex-1">
        Props
      </TabsTrigger>
      <TabsTrigger value="stores" class="flex-1">
        Stores
      </TabsTrigger>
      <TabsTrigger value="options" class="flex-1">
        Options
      </TabsTrigger>
    </TabsList>

    <TabsContent value="props">
      <PropsNavigation />
    </TabsContent>
    <TabsContent value="stores">
      <StoresTab />
    </TabsContent>
    <TabsContent value="options">
      <OptionsTab />
    </TabsContent>
  </Tabs>
</template>
