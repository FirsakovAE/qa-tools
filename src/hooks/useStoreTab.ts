import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { Ref, ComputedRef } from 'vue'
import type { PiniaStoreNode } from '@/types/store'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { likeMatch } from '@/utils/likeMatch'
import { useRuntime } from '@/runtime'

interface StoreTabOptions {
    modelValue?: string
}

interface StoreTabReturn {
    filteredStores: ComputedRef<PiniaStoreNode[]>
    storesCount: ComputedRef<number>
    searchTerm: Ref<string>
}

export function useStoreTab(
    storeData: Readonly<Ref<PiniaStoreNode[]>>,
    options: StoreTabOptions = {}
): StoreTabReturn {
    const runtime = useRuntime()
    const STORAGE_KEY_SEARCH = 'vue-inspector-store-search'

    // Восстанавливаем состояние поиска
    const savedSearchTerm = options.modelValue ?? ''

    const searchTerm = ref(savedSearchTerm)
    const debouncedTerm = ref(savedSearchTerm)

    // Загружаем сохраненное состояние при инициализации
    runtime.storage.get<string>(STORAGE_KEY_SEARCH).then(savedSearch => {
        if (savedSearch !== null && typeof savedSearch === 'string') {
            searchTerm.value = savedSearch
            debouncedTerm.value = savedSearch
        }
    })

    // Сохраняем состояние поиска при изменении
    watch(searchTerm, (value) => {
        runtime.storage.set(STORAGE_KEY_SEARCH, value)
    })

    const settingsRef = ref<any>(null)

    // Загружаем настройки
    useInspectorSettings().then(s => {
        settingsRef.value = s
    })

    const applyDebounce = useDebounceFn(() => { debouncedTerm.value = searchTerm.value }, 300)
    watch(searchTerm, applyDebounce)

    const filteredStores = computed((): PiniaStoreNode[] => {
        const q = debouncedTerm.value.trim().toLowerCase()
        const searchSettings = settingsRef.value?.search

        return storeData.value
            .map((store): PiniaStoreNode | null => {
                // Проверка поиска с учетом настроек поиска
                let searchCheck = !q
                if (q && searchSettings) {
                    searchCheck = false
                    if (searchSettings.byName === true && store.name.toLowerCase().includes(q)) {
                        searchCheck = true
                    }
                    if (!searchCheck && searchSettings.byLabel === true && store.id.toLowerCase().includes(q)) {
                        searchCheck = true
                    }
                } else if (q) {
                    // Fallback, если настройки поиска еще не загружены
                    searchCheck = Boolean(
                        store.name.toLowerCase().includes(q) ||
                        store.id.toLowerCase().includes(q)
                    )
                }

                // Если поиск активен и store не проходит проверку поиска
                if (q && !searchCheck) {
                    return null
                }

                return store
            })
            .filter((s): s is PiniaStoreNode => s !== null)
    })

    const storesCount = computed(() => {
        return filteredStores.value.length
    })

    return {
        filteredStores,
        storesCount,
        searchTerm
    }
}
