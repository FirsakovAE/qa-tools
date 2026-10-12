import { computed, shallowRef } from 'vue'

export type RowCheckState = boolean | 'indeterminate'

interface ModifierEvent {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/**
 * Checkbox selection of table rows (e.g. what to export).
 *
 * - click: toggle one row and remember it as the range anchor
 * - Shift+click: apply the anchor's state to every row between the anchor and the clicked row
 * - Ctrl/Cmd+click on a row: toggle it without opening details
 * - Ctrl/Cmd+A inside the table: select all visible rows
 *
 * Only rows present in `orderedIds` (the visible, filtered list) count as selected,
 * so hidden or evicted rows never leak into an export.
 */
export function useRowSelection(orderedIds: () => string[]) {
  const checked = shallowRef<ReadonlySet<string>>(new Set())
  let anchor: string | null = null

  const ids = computed(orderedIds)

  const checkedIds = computed(() => {
    const set = checked.value
    return set.size ? ids.value.filter(id => set.has(id)) : []
  })

  const count = computed(() => checkedIds.value.length)

  const headerState = computed<RowCheckState>(() => {
    if (count.value === 0) return false
    return count.value === ids.value.length ? true : 'indeterminate'
  })

  function toggle(id: string, event?: ModifierEvent) {
    const next = new Set(checked.value)
    if (event?.shiftKey && anchor && anchor !== id) {
      const list = ids.value
      const from = list.indexOf(anchor)
      const to = list.indexOf(id)
      if (from !== -1 && to !== -1) {
        const value = checked.value.has(anchor)
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
          if (value) next.add(list[i])
          else next.delete(list[i])
        }
        checked.value = next
        return
      }
    }
    if (next.has(id)) next.delete(id)
    else next.add(id)
    anchor = id
    checked.value = next
  }

  function selectAll() {
    checked.value = new Set(ids.value)
    anchor = null
  }

  function clear() {
    checked.value = new Set()
    anchor = null
  }

  function toggleAll() {
    if (headerState.value === true) clear()
    else selectAll()
  }

  /** Row click with Shift/Ctrl/Cmd is a selection gesture; returns false for a plain click */
  function handleRowClick(id: string, event: MouseEvent): boolean {
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) return false
    toggle(id, event)
    return true
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      selectAll()
    }
  }

  return { checked, checkedIds, count, headerState, toggle, toggleAll, selectAll, clear, handleRowClick, handleKeydown }
}
