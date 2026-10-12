/**
 * Logs search: by event name (title, subtitle, group key, URL), payload keys and payload values.
 * Search types, debounce and min length come from settings (Options > Logs / General).
 * Payload indexes are built lazily per event and released together with the event. They cover
 * the stored payload: changed values and paths of store / props diffs, full states of store
 * snapshots and checkpoints, the own half of a network entry.
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { LogEvent, LogChange } from '@/types/logs'
import { parseSearchTerm } from '@/utils/searchUtils'
import { describeLog, networkEntryOf, searchPayload, type LogsSource } from './view'

const MAX_INDEX_CHARS = 200_000
const MAX_INDEX_DEPTH = 20

interface PayloadIndex {
  keys: string
  values: string
}

const searchTerm = ref('')
const debouncedTerm = ref('')
const indexes = new WeakMap<LogEvent, PayloadIndex>()

function buildIndex(event: LogEvent, source: LogsSource): PayloadIndex {
  const keys: string[] = []
  const values: string[] = []
  let keyChars = 0
  let valueChars = 0

  const pushKey = (k: string) => {
    if (keyChars >= MAX_INDEX_CHARS) return
    const v = k.toLowerCase()
    keys.push(v)
    keyChars += v.length + 1
  }
  const pushValue = (v: unknown) => {
    if (valueChars >= MAX_INDEX_CHARS || v === null || v === undefined) return
    const s = String(v).toLowerCase().slice(0, MAX_INDEX_CHARS - valueChars)
    values.push(s)
    valueChars += s.length + 1
  }

  const walk = (value: unknown, depth: number) => {
    if (keyChars >= MAX_INDEX_CHARS && valueChars >= MAX_INDEX_CHARS) return
    if (value === null || typeof value !== 'object') {
      pushValue(value)
      return
    }
    if (depth >= MAX_INDEX_DEPTH) return
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1)
      return
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pushKey(k)
      walk(v, depth + 1)
    }
  }

  const changes = (event.data as { changes?: LogChange[] }).changes
  if (Array.isArray(changes)) for (const c of changes) pushKey(c.path)
  walk(searchPayload(event, source), 0)
  return { keys: `\n${keys.join('\n')}\n`, values: `\n${values.join('\n')}\n` }
}

function indexOf(event: LogEvent, source: LogsSource): PayloadIndex {
  let idx = indexes.get(event)
  if (!idx) {
    idx = buildIndex(event, source)
    indexes.set(event, idx)
  }
  return idx
}

export function useLogsSearch(events: Ref<LogEvent[]>, source: Ref<LogsSource>, settings: Ref<InspectorSettings | null>) {
  const options = computed(() => {
    const s = settings.value?.logsSearch
    const byName = s?.byName ?? true
    const byKey = s?.byKey ?? false
    const byValue = s?.byValue ?? false
    return {
      byName: byName || (!byKey && !byValue),
      byKey,
      byValue,
      debounce: settings.value?.searchParams?.debounce ?? 300,
      minLength: settings.value?.searchParams?.minLength ?? 2,
    }
  })

  const updateDebounced = useDebounceFn((term: string) => {
    debouncedTerm.value = term
  }, () => options.value.debounce)

  watch(searchTerm, term => {
    const { query } = parseSearchTerm(term)
    if (query.trim().length >= options.value.minLength || term.length === 0) updateDebounced(term)
  })

  function matches(event: LogEvent, q: string, exact: boolean): boolean {
    const o = options.value
    const has = (field: string | undefined) => !!field && (exact ? field.toLowerCase() === q : field.toLowerCase().includes(q))
    if (o.byName) {
      const { title, subtitle } = describeLog(event, source.value)
      if (has(title) || has(subtitle) || has(event.key) || has(networkEntryOf(event, source.value)?.url)) return true
    }
    if (o.byKey || o.byValue) {
      const idx = indexOf(event, source.value)
      const inText = (text: string) => (exact ? text.includes(`\n${q}\n`) : text.includes(q))
      if (o.byKey && inText(idx.keys)) return true
      if (o.byValue && inText(idx.values)) return true
    }
    return false
  }

  const filtered = computed(() => {
    const { query, exactMatch } = parseSearchTerm(debouncedTerm.value)
    const q = query.trim().toLowerCase()
    if (!q) return events.value
    return events.value.filter(e => matches(e, q, exactMatch))
  })

  const isSearching = computed(() => !!parseSearchTerm(debouncedTerm.value).query.trim())

  return { searchTerm, filtered, isSearching }
}
