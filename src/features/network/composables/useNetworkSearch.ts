/**
 * Network Search Composable
 * Handles search functionality with indexed lookups for performance
 * 
 * NOTE: State is stored at module level to persist across tab switches
 * (when NetworkTab is unmounted and remounted)
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { NetworkEntry } from '@/types/network'
import { parseSearchTerm } from '@/utils/searchUtils'

export interface SearchSettings {
  byName: boolean
  byPath: boolean
  byMethod: boolean
  byStatus: boolean
  byKey: boolean
  byValue: boolean
  debounce: number
  minLength: number
}

interface SearchIndexEntry {
  entryId: string
  /** Lowercased `NetworkEntry.path` */
  pathLower: string
  /** Lowercased `NetworkEntry.name` (Name column) */
  displayName: string
  method: string
  status: string
  requestBodyKeys: string[]
  requestBodyValues: string[]
  responseBodyKeys: string[]
  responseBodyValues: string[]
}

// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================

const searchTerm = ref('')
const debouncedSearchTerm = ref('')

// Use a Map for O(1) lookups and incremental updates
const searchIndexMap = new Map<string, SearchIndexEntry>()
// Keep a ref counter to invalidate computed caches when index changes
const indexVersion = ref(0)

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

function buildIndexEntry(entry: NetworkEntry): SearchIndexEntry {
  let requestBodyKeys: string[] = []
  let requestBodyValues: string[] = []
  let responseBodyKeys: string[] = []
  let responseBodyValues: string[] = []
  
  try {
    if (entry.requestBody?.text) {
      const t = entry.requestBody.text.trim()
      if (t.startsWith('{') || t.startsWith('[')) {
        const parsed = JSON.parse(entry.requestBody.text)
        requestBodyKeys = extractJsonKeys(parsed)
        requestBodyValues = extractJsonValues(parsed)
      }
    }
  } catch (error) {
    console.error('[network/useNetworkSearch] buildIndexEntry requestBody parse failed:', entry.id, error)
  }
  
  try {
    if (entry.responseBody?.text) {
      const t = entry.responseBody.text.trim()
      if (t.startsWith('{') || t.startsWith('[')) {
        const parsed = JSON.parse(entry.responseBody.text)
        responseBodyKeys = extractJsonKeys(parsed)
        responseBodyValues = extractJsonValues(parsed)
      }
    }
  } catch (error) {
    console.error('[network/useNetworkSearch] buildIndexEntry responseBody parse failed:', entry.id, error)
  }
  
  return {
    entryId: entry.id,
    pathLower: entry.path.toLowerCase(),
    displayName: entry.name.toLowerCase(),
    method: entry.method.toLowerCase(),
    status: String(entry.status),
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
  getSettings: () => SearchSettings,
  entriesVersion?: Ref<number>
) {
  const updateDebouncedSearch = useDebounceFn((term: string) => {
    debouncedSearchTerm.value = term
  }, getSettings().debounce)
  
  watch(searchTerm, (term) => {
    const settings = getSettings()
    const { query } = parseSearchTerm(term)
    const effectiveLen = query.trim().length
    if (effectiveLen >= settings.minLength || term.length === 0) {
      updateDebouncedSearch(term)
    }
  })

  function addToIndex(entry: NetworkEntry) {
    searchIndexMap.set(entry.id, buildIndexEntry(entry))
    indexVersion.value++
  }
  
  function removeFromIndex(entryId: string) {
    searchIndexMap.delete(entryId)
    indexVersion.value++
  }
  
  function clearIndex() {
    searchIndexMap.clear()
    indexVersion.value++
  }

  /**
   * Incremental rebuild: only parse entries that are new or updated.
   * Removes stale entries that are no longer in the list.
   */
  function rebuildIndex() {
    const currentEntries = entries()
    const currentIds = new Set<string>()

    for (const entry of currentEntries) {
      currentIds.add(entry.id)
      const existing = searchIndexMap.get(entry.id)
      const pathLower = entry.path.toLowerCase()
      const displayName = entry.name.toLowerCase()
      if (
        !existing ||
        existing.status !== String(entry.status) ||
        existing.pathLower !== pathLower ||
        existing.displayName !== displayName
      ) {
        searchIndexMap.set(entry.id, buildIndexEntry(entry))
      }
    }

    // Remove stale entries
    for (const id of searchIndexMap.keys()) {
      if (!currentIds.has(id)) {
        searchIndexMap.delete(id)
      }
    }

    indexVersion.value++
  }
  
  const filteredEntries = computed(() => {
    void indexVersion.value
    if (entriesVersion) void entriesVersion.value

    const { query, exactMatch } = parseSearchTerm(debouncedSearchTerm.value)
    const q = query.toLowerCase().trim()
    const allEntries = entries()
    if (!q) return allEntries

    const matchField = (field: string, needle: string) =>
      exactMatch ? field === needle : field.includes(needle)

    const settings = getSettings()
    const matchedIds = new Set<string>()
    const statusNorm = (s: string) => s.toLowerCase()

    for (const idx of searchIndexMap.values()) {
      let matched = false

      if (settings.byName && matchField(idx.displayName, q)) {
        matched = true
      }

      if (!matched && settings.byPath && matchField(idx.pathLower, q)) {
        matched = true
      }

      if (!matched && settings.byMethod && matchField(idx.method, q)) {
        matched = true
      }

      if (!matched && settings.byStatus && matchField(statusNorm(idx.status), q)) {
        matched = true
      }

      if (!matched && settings.byKey) {
        const keyMatch = (k: string) => matchField(k, q)
        if (idx.requestBodyKeys.some(keyMatch) || idx.responseBodyKeys.some(keyMatch)) {
          matched = true
        }
      }

      if (!matched && settings.byValue) {
        const valMatch = (v: string) => matchField(v, q)
        if (idx.requestBodyValues.some(valMatch) || idx.responseBodyValues.some(valMatch)) {
          matched = true
        }
      }

      if (matched) {
        matchedIds.add(idx.entryId)
      }
    }

    return allEntries.filter(e => matchedIds.has(e.id))
  })
  
  const activeSearchTypes = computed(() => {
    const settings = getSettings()
    const types: string[] = []
    if (settings.byStatus) types.push('Status')
    if (settings.byMethod) types.push('Method')
    if (settings.byPath) types.push('Path')
    if (settings.byName) types.push('Name')
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
