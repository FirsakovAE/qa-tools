/**
 * Composable for search settings pattern used in PropsTab, StoresTab, NetworkTab.
 * Provides searchSettings (from inspector settings) and selectedSearchTypes (for FacetedFilter).
 */

import { computed, type Ref, type ComputedRef, type WritableComputedRef } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'

export interface UseSearchSettingsConfig<T extends string> {
  /** Settings ref from useInspectorSettingsSync() */
  settings: Ref<InspectorSettings | null>
  /** Key in settings: 'propsSearch' | 'piniaSearch' | 'networkSearch' */
  searchKey: 'propsSearch' | 'piniaSearch' | 'networkSearch'
  /** Map display label -> settings key, e.g. { 'Name': 'byName', 'Key': 'byKey' } */
  typeMap: Record<string, T>
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
  searchTypeOptions: string[]
} {
  const { settings, searchKey, typeMap } = config
  const typeOptions = Object.keys(typeMap) as string[]

  const searchSettings = computed<SearchSettingsWithParams>(() => {
    const search = settings.value?.[searchKey] as Record<string, boolean> | undefined
    const params = settings.value?.searchParams
    const debounce = params?.debounce ?? 300
    const minLength = params?.minLength ?? 2
    if (!search) {
      const defaults: SearchSettingsWithParams = { debounce, minLength }
      for (const label of typeOptions) {
        defaults[typeMap[label]] = label === typeOptions[0]
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
      const search = settings.value?.[searchKey] as Record<string, boolean> | undefined
      if (!search) return []
      return typeOptions.filter(label => search[typeMap[label]] as boolean)
    },
    set(selected: string[]) {
      const search = settings.value?.[searchKey] as Record<string, boolean> | undefined
      if (!search) return
      for (const label of typeOptions) {
        ;(search as Record<string, boolean>)[typeMap[label]] = selected.includes(label)
      }
    }
  })

  return {
    searchSettings,
    selectedSearchTypes,
    searchTypeOptions: typeOptions.slice() as string[]
  }
}
