/**
 * Russian (and other non‑Latin) layouts break CodeMirror / vanilla-jsoneditor
 * bindings that match `Mod-v` etc. via `KeyboardEvent.key`. Synthetic keydown
 * with Latin `key` does not run the real clipboard path after we
 * `preventDefault()` on the trusted keydown.
 *
 * For **text mode** we talk to CodeMirror directly via `EditorView.findFromDOM`.
 * For **tree/table** paste we fire a synthetic `paste` with a `DataTransfer`
 * payload; copy/cut still use a Latin `keydown` on the keyboard sink.
 * Undo/redo in tree use the same latin-key idea; in text mode we call CM `undo`/`redo`.
 */

import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { redo, undo } from '@codemirror/commands'
import {
  createSyntheticClipboardKeydown,
  createSyntheticUndoRedoKeydown,
  type ClipboardLatinKey,
} from '@/utils/keyboardLayoutShortcuts'

function dispatchCodeMirror(
  view: EditorView,
  latin: ClipboardLatinKey,
): void {
  const readOnly = view.state.facet(EditorState.readOnly)

  if (latin === 'v') {
    if (readOnly) return
    void navigator.clipboard.readText().then(
      (text) => {
        view.dispatch(view.state.replaceSelection(text))
      },
      () => {},
    )
    return
  }

  if (latin === 'c') {
    const ranges = view.state.selection.ranges
    if (!ranges.some(r => !r.empty)) return
    const text = ranges.map(r => view.state.sliceDoc(r.from, r.to)).join('\n')
    void navigator.clipboard.writeText(text)
    return
  }

  if (latin === 'x') {
    if (readOnly) return
    const ranges = view.state.selection.ranges
    if (!ranges.some(r => !r.empty)) return
    const text = ranges.map(r => view.state.sliceDoc(r.from, r.to)).join('\n')
    void navigator.clipboard.writeText(text).then(() => {
      view.dispatch(view.state.replaceSelection(''))
    })
  }
}

async function dispatchTreeTablePaste(initialTarget: HTMLElement): Promise<void> {
  const root =
    initialTarget.closest('.jse-tree-mode')
    ?? initialTarget.closest('.jse-table-mode')
    ?? initialTarget

  try {
    const text = await navigator.clipboard.readText()
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    root.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      } as ClipboardEventInit),
    )
  } catch {
    /* Permissions — real paste still surfaces jsoneditor clipboard help when allowed */
  }
}

/**
 * Handle Mod+C/V/X for a JsonEditor focus sink after the global capture handler
 * has decided this event belongs to the editor (`preventDefault` already applied
 * by caller).
 */
export function dispatchRuLayoutClipboardInJsonEditor(
  sourceKeydown: KeyboardEvent,
  sink: HTMLElement,
  latin: ClipboardLatinKey,
): void {
  sink.focus({ preventScroll: true })

  const view = EditorView.findFromDOM(sink)
  if (view) {
    dispatchCodeMirror(view, latin)
    return
  }

  if (latin === 'v') {
    void dispatchTreeTablePaste(sink)
    return
  }

  const cmHost = sink.closest('.cm-editor')
  const dispatchTarget = cmHost instanceof HTMLElement ? cmHost : sink
  dispatchTarget.dispatchEvent(createSyntheticClipboardKeydown(sourceKeydown, latin))
}

/** Tree/table: `keyComboFromEvent` must be `"Ctrl+Z"` / `"Ctrl+Shift+Z"`. Text: CM APIs. */
export function dispatchRuLayoutUndoRedoInJsonEditor(
  sourceKeydown: KeyboardEvent,
  sink: HTMLElement,
  kind: 'undo' | 'redo',
): void {
  sink.focus({ preventScroll: true })

  const view = EditorView.findFromDOM(sink)
  if (view) {
    if (kind === 'undo') undo(view)
    else redo(view)
    return
  }

  const treeOrTable =
    sink.closest('.jse-tree-mode')
    ?? sink.closest('.jse-table-mode')
    ?? sink

  treeOrTable.dispatchEvent(
    createSyntheticUndoRedoKeydown(sourceKeydown, kind),
  )
}
