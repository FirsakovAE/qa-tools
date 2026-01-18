<script setup lang="ts">
import { computed, ref } from 'vue'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-vue-next'
import JsonTreeView from './JsonTreeView.vue'

const props = defineProps<{
  modelValue: string
  editable?: boolean
  showCopy?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const parsedValue = computed(() => {
  try {
    return JSON.parse(props.modelValue)
  } catch {
    return {}
  }
})

const copied = ref(false)

async function copyToClipboard() {
  await navigator.clipboard.writeText(props.modelValue)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

function emitStringified(newValue: any) {
  try {
    const stringified = JSON.stringify(newValue, null, 2)
    emit('update:modelValue', stringified)
  } catch (error) {
    console.error('Failed to stringify JSON:', error)
  }
}
</script>

<template>
  <div class="relative">
    <Button
      v-if="showCopy && !editable"
      variant="ghost"
      size="sm"
      class="absolute top-2 right-2 z-10 gap-1 text-xs pointer-events-auto bg-transparent hover:bg-transparent active:bg-transparent focus-visible:ring-0"
      @click="copyToClipboard"
    >
      <component :is="copied ? Check : Copy" class="w-4 h-4" />
      {{ copied ? 'Copied' : 'Copy' }}
    </Button>

    <ScrollArea class="h-[330px]">
      <div class="p-2">
        <div class="min-h-[300px]">
          <JsonTreeView
            :value="parsedValue"
            :editable="editable"
            @commit="emitStringified"
          />
        </div>
      </div>
      <ScrollArea orientation="vertical" />
    </ScrollArea>
  </div>
</template>
