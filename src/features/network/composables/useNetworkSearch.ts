/**
 * Network Search Composable
 * Handles search functionality with indexed lookups for performance
 * 
 * NOTE: State is stored at module level to persist across tab switches
 * (when NetworkTab is unmounted and remounted)
 */

import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { NetworkEntry } from '@/types/network'

export interface SearchSettings {
  byName: boolean
  byLabel: boolean // Method
  byKey: boolean
  byValue: boolean
  debounce: number
  minLength: number
}

interface SearchIndexEntry {
  entryId: string
  name: string
  method: string
  requestBodyKeys: string[]
  requestBodyValues: string[]
  responseBodyKeys: string[]
  responseBodyValues: string[]
}

// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================

const searchTerm = ref('')
const searchIndex = ref<SearchIndexEntry[]>([])
const debouncedSearchTerm = ref('')

/**
 * Extract JSON keys recursively
 */
function extractJsonKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return []
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    keys.push(fullKey.toLowerCase())
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...extractJsonKeys(obj[key], fullKey))
    }
  }
  return keys
}

/**
 * Extract JSON values recursively
 */
function extractJsonValues(obj: any): string[] {
  if (!obj || typeof obj !== 'object') return []
  const values: string[] = []
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val !== null && val !== undefined) {
      if (typeof val === 'object') {
        values.push(...extractJsonValues(val))
      } else {
        values.push(String(val).toLowerCase())
      }
    }
  }
  return values
}

/**
 * Build index entry for a network entry
 */
function buildIndexEntry(entry: NetworkEntry): SearchIndexEntry {
  let requestBodyKeys: string[] = []
  let requestBodyValues: string[] = []
  let responseBodyKeys: string[] = []
  let responseBodyValues: string[] = []
  
  try {
    if (entry.requestBody?.text) {
      const parsed = JSON.parse(entry.requestBody.text)
      requestBodyKeys = extractJsonKeys(parsed)
      requestBodyValues = extractJsonValues(parsed)
    }
  } catch { /* ignore */ }
  
  try {
    if (entry.responseBody?.text) {
      const parsed = JSON.parse(entry.responseBody.text)
      responseBodyKeys = extractJsonKeys(parsed)
      responseBodyValues = extractJsonValues(parsed)
    }
  } catch { /* ignore */ }
  
  return {
    entryId: entry.id,
    name: entry.path.toLowerCase(),
    method: entry.method.toLowerCase(),
    requestBodyKeys,
    requestBodyValues,
    responseBodyKeys,
    responseBodyValues
  }
}

/**
 * Composable for Network search functionality
 */
export function useNetworkSearch(
  entries: () => NetworkEntry[],
  getSettings: () => SearchSettings
) {
  // State is now module-level, no need to create new refs
  
  // Debounced search update
  const updateDebouncedSearch = useDebounceFn((term: string) => {
    debouncedSearchTerm.value = term
  }, getSettings().debounce)
  
  watch(searchTerm, (term) => {
    const settings = getSettings()
    if (term.length >= settings.minLength || term.length === 0) {
      updateDebouncedSearch(term)
    }
  })
  
  // Index management
  function addToIndex(entry: NetworkEntry) {
    searchIndex.value = searchIndex.value.filter(e => e.entryId !== entry.id)
    searchIndex.value.push(buildIndexEntry(entry))
  }
  
  function removeFromIndex(entryId: string) {
    searchIndex.value = searchIndex.value.filter(e => e.entryId !== entryId)
  }
  
  function clearIndex() {
    searchIndex.value = []
  }
  
  function rebuildIndex() {
    searchIndex.value = entries().map(buildIndexEntry)
  }
  
  // Filtered entries
  const filteredEntries = computed(() => {
    const q = debouncedSearchTerm.value.toLowerCase().trim()
    const allEntries = entries()
    if (!q) return allEntries
    
    const settings = getSettings()
    const matchedIds = new Set<string>()
    
    for (const idx of searchIndex.value) {
      let matched = false
      
      if (settings.byName && idx.name.includes(q)) {
        matched = true
      }
      
      if (!matched && settings.byLabel && idx.method.includes(q)) {
        matched = true
      }
      
      if (!matched && settings.byKey) {
        if (idx.requestBodyKeys.some(k => k.includes(q)) ||
            idx.responseBodyKeys.some(k => k.includes(q))) {
          matched = true
        }
      }
      
      if (!matched && settings.byValue) {
        if (idx.requestBodyValues.some(v => v.includes(q)) ||
            idx.responseBodyValues.some(v => v.includes(q))) {
          matched = true
        }
      }
      
      if (matched) {
        matchedIds.add(idx.entryId)
      }
    }
    
    return allEntries.filter(e => matchedIds.has(e.id))
  })
  
  // Active search types for badges
  const activeSearchTypes = computed(() => {
    const settings = getSettings()
    const types: string[] = []
    if (settings.byName) types.push('Name')
    if (settings.byLabel) types.push('Method')
    if (settings.byKey) types.push('Key')
    if (settings.byValue) types.push('Value')
    return types
  })
  
  return {
    searchTerm,
    filteredEntries,
    activeSearchTypes,
    addToIndex,
    removeFromIndex,
    clearIndex,
    rebuildIndex
  }
}
