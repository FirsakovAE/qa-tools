<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import StoreNavigation from './StoreNavigation.vue'
import { useRuntime } from '@/runtime'

const runtime = useRuntime()

const storesData = ref<Record<string, any>>({})
const isLoading = ref(false)
const error = ref<string | null>(null)
const vueDetected = ref<boolean | undefined>(undefined)
const piniaDetected = ref<boolean | undefined>(undefined)

let unsubscribe: (() => void) | null = null

// Message handler for receiving Pinia data
function handlePiniaMessage(message: any, respond: (r: unknown) => void) {
  if (message?.type === 'PINIA_STORES_SUMMARY_DATA') {
    if (message.error) {
      error.value = message.error
      // Определяем состояния на основе ошибки
      if (message.error.includes('Could not establish connection') ||
          message.error.includes('Receiving end does not exist')) {
        vueDetected.value = false
        piniaDetected.value = false
      } else if (message.error.includes('Pinia') || message.error.includes('store')) {
        vueDetected.value = true
        piniaDetected.value = false
      }
    } else if (message.summary) {
      storesData.value = message.summary
      error.value = null
      vueDetected.value = true
      piniaDetected.value = true
    }
    isLoading.value = false
  }
}

async function loadStoresSummary() {
  isLoading.value = true
  error.value = null

  try {
    // Проверяем доступность content script с помощью ping
    let contentScriptReady = false
    try {
      const pingResponse = await runtime.sendMessage<{ pong?: boolean }>({ type: 'PING' })
      if (pingResponse?.pong) {
        contentScriptReady = true
      }
    } catch (pingError: any) {
      // В standalone режиме нет возможности инжектировать скрипты
      // Content script должен быть уже загружен
      contentScriptReady = false
    }

    if (!contentScriptReady) {
      // Content script недоступен - значит Vue не найден
      vueDetected.value = false
      piniaDetected.value = false
      isLoading.value = false
      return
    }

    // Отправляем запрос через content script
    const response = await runtime.sendMessage<{
      type: string
      summary?: Record<string, any>
      detected?: boolean
      error?: string
    }>({
      type: 'PINIA_GET_STORES_SUMMARY'
    })
    
    // Обрабатываем response напрямую
    if (response?.summary) {
      storesData.value = response.summary
      piniaDetected.value = response.detected ?? true
      vueDetected.value = true
      isLoading.value = false
    } else if (response?.error) {
      error.value = response.error
      isLoading.value = false
    } else {
      // Fallback таймаут на случай если ответ пустой
      setTimeout(() => {
        if (isLoading.value) {
          isLoading.value = false
          if (Object.keys(storesData.value).length === 0) {
            error.value = 'Timeout: Pinia stores not found or not initialized'
          }
        }
      }, 3000)
    }

  } catch (err: any) {
    const errorMessage = err.message || 'Failed to load stores'

    // Определяем состояния на основе ошибки подключения
    if (errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('Receiving end does not exist')) {
      // Content script недоступен - Vue не найден
      vueDetected.value = false
      piniaDetected.value = false
      error.value = null // Не показываем ошибку подключения пользователю
    } else {
      // Другая ошибка - возможно Vue есть, но Pinia нет
      error.value = 'Failed to load Pinia stores. Make sure Pinia is installed and initialized.'
      vueDetected.value = true
      piniaDetected.value = false
    }

    isLoading.value = false
  }
}

// Загружаем данные при монтировании компонента
onMounted(() => {
  // Подписываемся на сообщения от content script
  unsubscribe = runtime.onMessage(handlePiniaMessage)
  loadStoresSummary()
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <StoreNavigation
    :stores-data="storesData"
    :is-loading="isLoading"
    :error="error"
    @refresh="loadStoresSummary"
  />
</template>
