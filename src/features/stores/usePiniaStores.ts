// src/features/stores/usePiniaStores.ts
import { ref, onUnmounted } from 'vue'
import { useRuntime } from '@/runtime'

interface PiniaStoresSummaryResponse {
  type: string
  summary?: Record<string, any>
  detected?: boolean
  error?: string
}

export function usePiniaStores() {
  const runtime = useRuntime()
  
  const storesData = ref<Record<string, any>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  function handleMessage(message: any, respond: (r: unknown) => void) {
    // Обрабатываем broadcast сообщения (для обновлений)
    if (message?.type === 'PINIA_STORES_SUMMARY_DATA') {
      if (message.error) {
        error.value = message.error
      } else {
        storesData.value = message.summary || {}
        error.value = null
      }
      loading.value = false
    }
  }

  // Добавляем listener для broadcasts (обновления)
  function ensureListener() {
    if (unsubscribe) return
    unsubscribe = runtime.onMessage(handleMessage)
  }

  async function load() {
    ensureListener()
    
    loading.value = true
    error.value = null

    try {
      // Используем возвращаемое значение sendMessage
      const response = await runtime.sendMessage<PiniaStoresSummaryResponse>({ 
        type: 'PINIA_GET_STORES_SUMMARY' 
      })
      
      if (response?.error) {
        error.value = response.error
        loading.value = false
      } else if (response?.summary) {
        storesData.value = response.summary
        error.value = null
        loading.value = false
      } else {
        // Fallback - ждём broadcast если response пустой
        setTimeout(() => {
          if (loading.value && !Object.keys(storesData.value).length) {
            error.value = 'Timeout: Pinia stores not found'
            loading.value = false
          }
        }, 3000)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stores'
      loading.value = false
    }
  }

  // НЕ вызываем load() автоматически!
  // Загрузка будет инициирована только при наличии hasPinia = true

  onUnmounted(() => {
    unsubscribe?.()
  })

  return {
    storesData,
    loading,
    error,
    load,
  }
}