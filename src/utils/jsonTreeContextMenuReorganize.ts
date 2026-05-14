import type {
  ContextMenuColumn,
  ContextMenuItem,
  MenuButton,
  MenuDropDownButton,
} from 'vanilla-jsoneditor'
import {
  isContextMenuColumn,
  isContextMenuRow,
  isMenuButton,
  isMenuDropDownButton,
  isMenuLabel,
  isMenuSeparator,
  isMenuSpace,
  isKeySelection,
  isValueSelection,
} from 'vanilla-jsoneditor'
import type { JSONEditorSelection, JSONSelection } from 'vanilla-jsoneditor'

/** Known vanilla-jsoneditor tree context labels (English). */
const TEXT = {
  editKey: 'Edit key',
  editValue: 'Edit value',
  cutFormatted: 'Cut formatted',
  cutCompacted: 'Cut compacted',
  copyFormatted: 'Copy formatted',
  copyCompacted: 'Copy compacted',
  paste: 'Paste',
  duplicate: 'Duplicate',
  structure: 'Structure',
  object: 'Object',
  array: 'Array',
  value: 'Value',
  remove: 'Remove',
} as const

export interface TreeContextMenuSortHandlers {
  onSortAsc: (e: MouseEvent) => void
  onSortDesc: (e: MouseEvent) => void
}

/**
 * When both "Edit key" and "Edit value" apply, pick the action that matches
 * the focused tree cell (value column vs key column).
 */
export function treeContextMenuEditMainTarget(
  selection: JSONEditorSelection | undefined,
): 'key' | 'value' {
  if (!selection || 'ranges' in selection) return 'key'
  const sel = selection as JSONSelection
  if (isValueSelection(sel)) return 'value'
  if (isKeySelection(sel)) return 'key'
  return 'key'
}

function collectButtons(
  items: ContextMenuItem[],
  map: Map<string, MenuButton>,
): void {
  for (const it of items) {
    if (isMenuSeparator(it) || isMenuSpace(it)) continue

    if (isMenuButton(it)) {
      if (it.text) map.set(it.text, it)
      continue
    }

    if (isMenuDropDownButton(it)) {
      if (it.main.text) map.set(it.main.text, it.main)
      for (const sub of it.items) {
        if (sub.text) map.set(sub.text, sub)
      }
      continue
    }

    if (isContextMenuRow(it)) {
      for (const cell of it.items) {
        if (isContextMenuColumn(cell)) {
          for (const c of cell.items) {
            if (isMenuLabel(c) || isMenuSeparator(c)) continue
            if (isMenuButton(c) && c.text) map.set(c.text, c)
            else if (isMenuDropDownButton(c)) {
              if (c.main.text) map.set(c.main.text, c.main)
              for (const sub of c.items) {
                if (sub.text) map.set(sub.text, sub)
              }
            }
          }
        } else if (isMenuButton(cell) && cell.text) {
          map.set(cell.text, cell)
        } else if (isMenuDropDownButton(cell)) {
          if (cell.main.text) map.set(cell.main.text, cell.main)
          for (const sub of cell.items) {
            if (sub.text) map.set(sub.text, sub)
          }
        }
      }
    }
  }
}

function noopClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

function winSub(label: string, items: MenuButton[]): MenuDropDownButton {
  return {
    type: 'dropdown-button',
    width: '14em',
    main: {
      type: 'button',
      text: label,
      onClick: noopClick,
      className: 'json-tree-ctx-submenu-root',
    },
    items,
  }
}

/** Root row click: same as first submenu line that applies (formatted / first enabled). */
function winSubWithMain(
  label: string,
  items: MenuButton[],
  onMainClick: (e: MouseEvent) => void,
): MenuDropDownButton {
  return {
    type: 'dropdown-button',
    width: '14em',
    main: {
      type: 'button',
      text: label,
      onClick: onMainClick,
      className: 'json-tree-ctx-submenu-root',
    },
    items,
  }
}

function sortSyntheticButton(
  text: string,
  onClick: (e: MouseEvent) => void,
  disabled?: boolean,
): MenuButton {
  return {
    type: 'button',
    text,
    onClick,
    disabled: !!disabled,
  }
}

/**
 * Collapse the default multi-column jsoneditor menu into a single Windows-style
 * column with nested submenus, using the same underlying MenuButton handlers.
 */
export function reorganizeJsonTreeContextMenu(
  items: ContextMenuItem[],
  sortHandlers: TreeContextMenuSortHandlers,
  options: {
    editable: boolean
    /** Root "Edit" row: when both key and value edits apply, which handler to run. */
    editMainTarget?: 'key' | 'value'
  },
): ContextMenuItem[] {
  const map = new Map<string, MenuButton>()
  collectButtons(items, map)

  const out: ContextMenuItem[] = []

  const keyBtn = map.get(TEXT.editKey)
  const valueBtn = map.get(TEXT.editValue)
  const editKids = [keyBtn, valueBtn].filter((b): b is MenuButton => !!b)
  if (editKids.length > 0) {
    const keyOk = !!keyBtn && !keyBtn.disabled
    const valueOk = !!valueBtn && !valueBtn.disabled
    out.push(
      winSubWithMain('Edit', editKids, (e) => {
        let btn: MenuButton | undefined
        if (keyOk && valueOk && keyBtn && valueBtn) {
          btn = options.editMainTarget === 'value' ? valueBtn : keyBtn
        } else {
          btn = editKids.find((b) => !b.disabled) ?? editKids[0]
        }
        if (!btn || btn.disabled) return
        e.preventDefault()
        e.stopPropagation()
        btn.onClick(e)
      }),
    )
  }

  const cutKids = [
    map.get(TEXT.cutFormatted),
    map.get(TEXT.cutCompacted),
  ].filter((b): b is MenuButton => !!b)
  if (cutKids.length > 0) {
    const formatted = cutKids[0]!
    out.push(
      winSubWithMain('Cut', cutKids, (e) => {
        if (formatted.disabled) return
        e.preventDefault()
        e.stopPropagation()
        formatted.onClick(e)
      }),
    )
  }

  const copyKids = [
    map.get(TEXT.copyFormatted),
    map.get(TEXT.copyCompacted),
  ].filter((b): b is MenuButton => !!b)
  if (copyKids.length > 0) {
    const formatted = copyKids[0]!
    out.push(
      winSubWithMain('Copy', copyKids, (e) => {
        if (formatted.disabled) return
        e.preventDefault()
        e.stopPropagation()
        formatted.onClick(e)
      }),
    )
  }

  const paste = map.get(TEXT.paste)
  if (paste)
    out.push(paste)

  const dup = map.get(TEXT.duplicate)
  if (dup)
    out.push(dup)

  if (options.editable) {
    out.push(
      winSub('Sort', [
        sortSyntheticButton('ASC', sortHandlers.onSortAsc),
        sortSyntheticButton('DESC', sortHandlers.onSortDesc),
      ]),
    )
  }

  const convKids = [
    map.get(TEXT.structure),
    map.get(TEXT.object),
    map.get(TEXT.array),
    map.get(TEXT.value),
  ].filter((b): b is MenuButton => !!b)
  if (convKids.length > 0)
    out.push(winSub('Convert to', convKids))

  const remove = map.get(TEXT.remove)
  if (remove) {
    out.push({
      ...remove,
      className: [remove.className, 'text-destructive_text']
        .filter(Boolean)
        .join(' '),
    })
  }

  return out
}
