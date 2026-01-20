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
    class="bg-popover border border-border rounded-lg shadow-lg p-4 max-w-xs transition-all duration-300 ease-out"
    :style="{
      position: 'relative',
      right: isVisible ? '0' : '-320px'
    }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="font-semibold text-foreground mb-1">Update Available</div>
    <div class="text-sm text-muted-foreground mb-3">
      Download new version {{ remoteVersion }}
    </div>
    <div class="flex gap-2">
      <Button
        size="sm"
        @click="handleDownload"
      >
        Download
      </Button>
      <Button
        size="sm"
        variant="secondary"
        @click="handleDismiss"
      >
        Dismiss
      </Button>
    </div>
  </div>
</template>