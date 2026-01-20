<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'

interface Props {
  remoteVersion: string
  onDownload: () => void
  onDismiss: () => void
}

const props = defineProps<Props>()

const container = ref<HTMLElement>()
const isVisible = ref(false)
const isHovered = ref(false)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

const startHideTimer = () => {
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    if (!isHovered.value) {
      hideNotification()
    }
  }, 5000)
}

const stopHideTimer = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
}

const hideNotification = () => {
  isVisible.value = false
  setTimeout(() => {
    // Компонент будет удален родителем
  }, 300)
}

const handleMouseEnter = () => {
  isHovered.value = true
  stopHideTimer()
}

const handleMouseLeave = () => {
  isHovered.value = false
  startHideTimer()
}

const handleDownload = () => {
  props.onDownload()
  hideNotification()
}

const handleDismiss = () => {
  props.onDismiss()
  hideNotification()
}

onMounted(() => {
  // Показываем с анимацией
  setTimeout(() => {
    isVisible.value = true
  }, 100)

  // Запускаем таймер скрытия
  startHideTimer()
})

onUnmounted(() => {
  stopHideTimer()
})
</script>

<template>
  <div
    ref="container"
    :class="[
      'fixed bottom-5 z-[999999] transition-all duration-300 ease-out font-sans',
      isVisible ? 'right-5' : '-right-80'
    ]"
  >
    <div
      class="bg-slate-800 text-white p-4 rounded-lg shadow-xl max-w-xs cursor-default border-l-4 border-blue-500"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <div class="font-semibold mb-1">Update Available</div>
      <div class="text-sm mb-3 opacity-90">
        Download new version {{ remoteVersion }}
      </div>
      <div class="flex gap-2">
        <Button
          size="sm"
          class="bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          @click="handleDownload"
        >
          Download
        </Button>
        <Button
          size="sm"
          variant="secondary"
          class="bg-slate-600 hover:bg-slate-500 text-white transition-colors"
          @click="handleDismiss"
        >
          Dismiss
        </Button>
      </div>
    </div>
  </div>
</template>