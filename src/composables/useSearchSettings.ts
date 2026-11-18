/**
 * Composable for search settings pattern used in PropsTab, StoresTab, NetworkTab.
 * Provides searchSettings (from inspector settings) and selectedSearchTypes (for FacetedFilter).
 */

import { computed, toValue, type Ref, type ComputedRef, type WritableComputedRef, type MaybeRefOrGetter } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'

export interface UseSearchSettingsConfig<T extends string> {
  /** Settings ref from useInspectorSettingsSync() */
  settings: Ref<InspectorSettings | null>
  /** Key in settings: 'propsSearch' | 'piniaSearch' | 'networkSearch' | 'logsSearch' */
  searchKey: 'propsSearch' | 'piniaSearch' | 'networkSearch' | 'logsSearch'
  /** Map display label -> settings key. A computed map follows the interface language. */
  typeMap: MaybeRefOrGetter<Record<string, T>>
}

export interface SearchSettingsWithParams {
  debounce: number
  minLength: number
  [key: string]: boolean | number | undefined
}

/**
 * Returns searchSettings (merged with debounce/minLength) and selectedSearchTypes for FacetedFilter.
 */
export function useSearchSettings<T extends string>(
  config: UseSearchSettingsConfig<T>
): {
  searchSettings: ComputedRef<SearchSettingsWithParams>
  selectedSearchTypes: WritableComputedRef<string[]>
  searchTypeOptions: ComputedRef<string[]>
} {
  const { settings, searchKey, typeMap } = config
  const typeOptions = computed(() => Object.keys(toValue(typeMap)))

  const searchSettings = computed<SearchSettingsWithParams>(() => {
    const map = toValue(typeMap)
    const options = typeOptions.value
    const search = settings.value?.[searchKey] as Record<string, boolean> | undefined
    const params = settings.value?.searchParams
    const debounce = params?.debounce ?? 300
    const minLength = params?.minLength ?? 2
    if (!search) {
      const defaults: SearchSettingsWithParams = { debounce, minLength }
      for (const label of options) {
        defaults[map[label]] = label === options[0]
      }
      return defaults
    }
    return {
      ...search,
      debounce,
      minLength
    }
  })

  const selectedSearchTypes = computed<string[]>({
    get() {
      const map = toValue(typeMap)
      const search = settings.value?.[searchKey] as Record<string, boolean> | undefined
      if (!search) return []
      return typeOptions.value.filter(label => search[map[label]] as boolean)
    },
    set(selected: string[]) {
      const map = toValue(typeMap)
      const search = settings.value?.[searchKey] as Record<string, boolean> | undefined
      if (!search) return
      for (const label of typeOptions.value) {
        ;(search as Record<string, boolean>)[map[label]] = selected.includes(label)
      }
    }
  })

  return {
    searchSettings,
    selectedSearchTypes,
    searchTypeOptions: typeOptions,
  }
}
