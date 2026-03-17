import { ref, watch } from 'vue'
import { useRuntime } from '@/runtime'

export function usePersistentState<T>(key: string, defaultValue: T) {
    const runtime = useRuntime()
    const state = ref<T>(defaultValue)

    // Загрузка при инициализации
    runtime.storage.get<T>(key).then(value => {
        if (value !== null) {
            state.value = value
        }
    }).catch(error => {
        console.error('[usePersistentState] Failed to load state for key:', key, error)
    })

    // Автосохранение
    watch(state, (newValue) => {
        runtime.storage.set(key, newValue).catch(error => {
            console.error('[usePersistentState] Failed to save state for key:', key, error)
        })
    }, { deep: true })

    return state
}