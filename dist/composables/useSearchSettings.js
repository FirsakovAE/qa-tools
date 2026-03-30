/**
 * Composable for search settings pattern used in PropsTab, StoresTab, NetworkTab.
 * Provides searchSettings (from inspector settings) and selectedSearchTypes (for FacetedFilter).
 */
import { computed } from 'vue';
/**
 * Returns searchSettings (merged with debounce/minLength) and selectedSearchTypes for FacetedFilter.
 */
export function useSearchSettings(config) {
    const { settings, searchKey, typeMap } = config;
    const typeOptions = Object.keys(typeMap);
    const searchSettings = computed(() => {
        const search = settings.value?.[searchKey];
        const params = settings.value?.searchParams;
        const debounce = params?.debounce ?? 300;
        const minLength = params?.minLength ?? 2;
        if (!search) {
            const defaults = { debounce, minLength };
            for (const label of typeOptions) {
                defaults[typeMap[label]] = label === typeOptions[0];
            }
            return defaults;
        }
        return {
            ...search,
            debounce,
            minLength
        };
    });
    const selectedSearchTypes = computed({
        get() {
            const search = settings.value?.[searchKey];
            if (!search)
                return [];
            return typeOptions.filter(label => search[typeMap[label]]);
        },
        set(selected) {
            const search = settings.value?.[searchKey];
            if (!search)
                return;
            for (const label of typeOptions) {
                ;
                search[typeMap[label]] = selected.includes(label);
            }
        }
    });
    return {
        searchSettings,
        selectedSearchTypes,
        searchTypeOptions: typeOptions.slice()
    };
}
//# sourceMappingURL=useSearchSettings.js.map