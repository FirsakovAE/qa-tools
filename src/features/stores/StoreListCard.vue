<script setup lang="ts">
import { ref, onMounted } from 'vue'
import StoreDetails from './store-details/StoreDetails.vue'
import { useRuntime } from '@/runtime'

const runtime = useRuntime()
const STORAGE_KEY_SELECTED_STORE = 'vue-inspector-selected-store'

const selectedStore = ref<any | null>(null)

// Load saved selected store on mount
onMounted(async () => {
  const savedStore = await runtime.storage.get<any>(STORAGE_KEY_SELECTED_STORE)
  if (savedStore && typeof savedStore === 'object' && savedStore.baseId) {
    selectedStore.value = savedStore
  }
})

const handleSelect = (store: any) => {
  selectedStore.value = store
  runtime.storage.set(STORAGE_KEY_SELECTED_STORE, store)
}

const handleBack = () => {
  selectedStore.value = null
  runtime.storage.remove(STORAGE_KEY_SELECTED_STORE)
}

// Export methods for use in parent component
defineExpose({
  handleSelect,
  handleBack
})
</script>

<template>
  <!-- LIST MODE -->
  <slot
    v-if="!selectedStore"
    name="list"
  />

  <!-- DETAILS MODE -->
  <StoreDetails
    v-else
    :store="selectedStore"
    @back="handleBack"
  />
</template>
