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
    })

    // Автосохранение
    watch(state, (newValue) => {
        runtime.storage.set(key, newValue)
    }, { deep: true })

    return state
}