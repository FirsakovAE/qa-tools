<script setup lang="ts">
/**
 * Lightweight read-only view for large JSON/text payloads.
 * Avoids Prism and tree rendering which create thousands of DOM nodes and freeze the UI.
 */
import { ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

const props = withDefaults(
  defineProps<{
    modelValue: string
    fullHeight?: boolean
  }>(),
  { fullHeight: false }
)

const copied = ref(false)

function copyToClipboard() {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = props.modelValue
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (success) {
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    }
  } catch {
    // Silently fail
  }
}
</script>

<template>
  <div :class="fullHeight ? 'h-full flex flex-col relative' : 'relative'">
    <Button
      variant="ghost"
      size="sm"
      class="absolute top-2 right-2 z-10 gap-1 text-xs pointer-events-auto bg-transparent hover:bg-transparent active:bg-transparent focus-visible:ring-0"
      @click="copyToClipboard"
    >
      <component :is="copied ? Check : Copy" class="w-4 h-4" />
      {{ copied ? 'Copied' : 'Copy' }}
    </Button>

    <ScrollArea :class="[fullHeight ? 'flex-1 min-h-0 full-height-scroll' : 'h-[330px]']">
      <div :class="['p-2', fullHeight ? 'min-h-full w-full' : '']">
        <pre
          class="json-viewer--plain font-mono text-sm leading-relaxed whitespace-pre-wrap break-words"
          :class="fullHeight ? 'min-h-full' : 'min-h-[300px]'"
        >{{ modelValue }}</pre>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  </div>
</template>

<style scoped>
.full-height-scroll :deep([data-reka-scroll-area-viewport] > div) {
  min-height: 100%;
  width: 100%;
}
</style>
