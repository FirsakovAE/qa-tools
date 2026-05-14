<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { createJSONEditor, expandAll, expandNone, Mode } from 'vanilla-jsoneditor'
import type {
  Content,
  ContextMenuItem,
  JSONEditorPropsOptional,
  MenuItem,
  RenderContextMenuContext,
  RenderMenuContext,
} from 'vanilla-jsoneditor'
import type { JSONPatchDocument } from 'immutable-json-patch'
import {
  AlignLeft,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Minimize2,
  Search,
} from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import JsonClipboardHelpDialog from '@/components/ui/JsonEditor/JsonClipboardHelpDialog.vue'
import JsonTreeContextMenu from '@/components/ui/JsonEditor/JsonTreeContextMenu.vue'
import {
  findSortRootPath,
  resolveSortItemPathForQuickApply,
  sortJson,
} from '@/utils/jsonEditorSort'
import { reorganizeJsonTreeContextMenu, treeContextMenuEditMainTarget } from '@/utils/jsonTreeContextMenuReorganize'
import { copyToClipboard } from '@/utils/networkUtils'
import {
  activateClipboardHelpEscDismiss,
  deactivateClipboardHelpEscDismiss,
} from '@/utils/clipboardHelpEscGate'
import { inspectorState } from '@/settings/useInspectorSettings'
import { registerJsonEditor } from '@/composables/jsonEditorSearchRegistry'
import type { JsonEditorSearchHandle } from '@/composables/jsonEditorSearchRegistry'

import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import './jse-theme.css'

type JsonMode = 'text' | 'tree'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Toggle between code text editor and structured tree editor. */
    mode?: JsonMode
    /** Allow editing; otherwise editor is read-only. */
    editable?: boolean
    /** Show Copy action in the toolbar (read-only mode only). */
    showCopy?: boolean
    /** Stretch to fill parent flex container. */
    fullHeight?: boolean
    /** Render compact status bar at the bottom. */
    statusBar?: boolean
    /** Render breadcrumb navigation (tree mode only). */
    navigationBar?: boolean
    /** Render full main menu bar. */
    mainMenuBar?: boolean
    /** Show the slim action toolbar above the editor. */
    toolbar?: boolean
  }>(),
  {
    mode: 'text',
    editable: false,
    showCopy: false,
    fullHeight: false,
    statusBar: true,
    navigationBar: undefined,
    mainMenuBar: false,
    toolbar: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', value: JsonMode): void
}>()

/** Editor handle returned by `createJSONEditor`. */
type JSONEditorHandle = {
  get: () => Content
  set: (newContent: Content) => void
  update: (updatedContent: Content) => void
  updateProps: (partial: JSONEditorPropsOptional) => void
  destroy: () => Promise<void> | void
  expand: (path: Array<string | number>, callback?: (path: Array<string | number>) => boolean) => void
  collapse: (path: Array<string | number>, recursive?: boolean) => void
  patch: (operations: JSONPatchDocument) => unknown
  focus?: () => void
}

const wrapperRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const editorRef = shallowRef<JSONEditorHandle | null>(null)
const copied = ref(false)

/** Last chosen sort property path per tree root (for ASC/DESC quick actions). */
const sortModalState = new Map<
  string,
  { itemPathKey: string, direction: 1 | -1 }
>()

/** Tree context menu: vanilla-jsoneditor supplies items + onClick; we render with UI-kit DropdownMenu. */
const treeContextMenuOpen = ref(false)
const treeContextMenuAnchor = ref({ x: 0, y: 0 })
const treeContextMenuItems = ref<ContextMenuItem[]>([])
/** Last context menu `ctx` for sort / tree actions. */
let lastTreeContextMenuCtx: RenderContextMenuContext | null = null

function isPointerInEditorHost(clientX: number, clientY: number): boolean {
  const wrap = wrapperRef.value
  if (!wrap) return false
  const r = wrap.getBoundingClientRect()
  return (
    clientX >= r.left
    && clientX <= r.right
    && clientY >= r.top
    && clientY <= r.bottom
  )
}

function onTreeContextMenuCapture(e: MouseEvent) {
  if (props.mode !== 'tree') return
  if (!isPointerInEditorHost(e.clientX, e.clientY)) return
  treeContextMenuAnchor.value = { x: e.clientX, y: e.clientY }
}

/** Tree row "▾" / context opener: opens the same menu without a contextmenu event. */
/** Tree row opener: ▾ control uses `.jse-context-menu-pointer`; older / alternate: `.jse-context-menu-button`. */
const TREE_MENU_OPENER_SELECTOR =
  '.jse-context-menu-pointer, .jse-context-menu-button'

function onTreeMenuOpenerPointerDownCapture(e: PointerEvent) {
  if (props.mode !== 'tree') return
  if (e.button !== 0) return
  if (!isPointerInEditorHost(e.clientX, e.clientY)) return
  const el = (e.target as Element | null)?.closest?.(TREE_MENU_OPENER_SELECTOR)
  if (!el || !(el instanceof HTMLElement)) return
  const r = el.getBoundingClientRect()
  treeContextMenuAnchor.value = {
    x: r.left,
    y: r.bottom,
  }
}

function parseDocumentJson(editor: JSONEditorHandle): unknown | undefined {
  const content = editor.get()
  if ('json' in content && content.json !== undefined) return content.json
  if ('text' in content && typeof content.text === 'string') {
    try {
      return JSON.parse(content.text) as unknown
    } catch {
      return undefined
    }
  }
  return undefined
}

function applyTreeContextSortDirect(direction: 1 | -1) {
  const editor = editorRef.value
  const c = lastTreeContextMenuCtx
  if (!editor || !c || !props.editable) return
  const json = parseDocumentJson(editor)
  if (json === undefined) return
  const rootPath = findSortRootPath(json, c.selection)
  const itemPath = resolveSortItemPathForQuickApply(
    json,
    rootPath,
    sortModalState,
  )
  try {
    const operations = sortJson(json, rootPath, itemPath, direction)
    if (operations.length === 0) return
    editor.patch(operations as JSONPatchDocument)
    const suffix = `:${JSON.stringify(rootPath)}`
    for (const k of [...sortModalState.keys()]) {
      if (k.endsWith(suffix)) sortModalState.delete(k)
    }
    sortModalState.set(`ctx-quick:${JSON.stringify(rootPath)}`, {
      itemPathKey: JSON.stringify(itemPath),
      direction,
    })
  } catch (e) {
    console.error('[ui/JsonEditor] tree context sort', e)
  }
  refocusEditor()
}

function onRenderMenuForSort(
  items: MenuItem[],
  _ctx: RenderMenuContext,
): MenuItem[] | undefined {
  if (!props.editable) return undefined
  return items.filter(
    (it) => !(it.type === 'button' && it.text === 'Sort'),
  )
}

/**
 * `false` suppresses the library’s Svelte context menu; we mirror the same item
 * model in {@link JsonTreeContextMenu} (DropdownMenu + items from here).
 */
function onRenderContextMenuForVue(
  items: ContextMenuItem[],
  ctx: RenderContextMenuContext,
): ContextMenuItem[] | false | undefined {
  if (ctx.mode !== Mode.tree) return undefined

  lastTreeContextMenuCtx = ctx

  const patched = items
  const laidOut = reorganizeJsonTreeContextMenu(
    patched,
    {
      onSortAsc: (e) => {
        e.preventDefault()
        e.stopPropagation()
        applyTreeContextSortDirect(1)
      },
      onSortDesc: (e) => {
        e.preventDefault()
        e.stopPropagation()
        applyTreeContextSortDirect(-1)
      },
    },
    {
      editable: props.editable,
      editMainTarget: treeContextMenuEditMainTarget(ctx.selection),
    },
  )
  treeContextMenuItems.value = laidOut
  void nextTick(() => {
    treeContextMenuOpen.value = true
  })
  return false
}

/** Replacing vanilla-jsoneditor’s clipboard-permission modal (native `<dialog>`). */
const clipboardHelpOpen = ref(false)
let clipboardModalObserver: MutationObserver | null = null
let removeNativeClipboardOverlay: (() => void) | null = null

function findJseClipboardAnchor(el: Element): HTMLElement | null {
  if (el.classList.contains('jse-copy-paste') && el instanceof HTMLElement) return el
  const found = el.querySelector('.jse-copy-paste')
  return found instanceof HTMLElement ? found : null
}

function suppressNativeClipboardDialog(anchor: HTMLElement) {
  if (clipboardHelpOpen.value || removeNativeClipboardOverlay) return

  const nearestDialog = anchor.closest('dialog')
  const dialogEl =
    nearestDialog instanceof HTMLDialogElement ? nearestDialog : null
  const root: HTMLElement =
    dialogEl
    ?? (anchor.closest('[class*="jse-modal"]') as HTMLElement | null)
    ?? anchor

  /*
   * A `showModal()` <dialog> uses the browser "top layer" and stays above normal
   * stacking — including our portaled AlertDialog — so clicks and Esc appear to do
   * nothing. Close immediately (after open) so interactions reach Vue UI.
   */
  if (dialogEl?.open) {
    try {
      dialogEl.close()
    } catch {
      /* ignore */
    }
  }

  root.dataset.vueInspectorClipboardSuppressed = '1'
  root.setAttribute('inert', '')
  root.style.setProperty('visibility', 'hidden', 'important')
  root.style.setProperty('pointer-events', 'none', 'important')

  removeNativeClipboardOverlay = () => {
    delete root.dataset.vueInspectorClipboardSuppressed
    root.removeAttribute('inert')
    root.style.removeProperty('visibility')
    root.style.removeProperty('pointer-events')
    try {
      const d =
        dialogEl
        ?? (root instanceof HTMLDialogElement ? root : null)
      if (d?.isConnected) {
        d.close()
        d.remove()
      } else if (root.isConnected) {
        root.remove()
      }
    } finally {
      removeNativeClipboardOverlay = null
    }
  }

  /*
   * Open synchronously so `activateClipboardHelpEscDismiss` runs in the same
   * turn as suppression — `nextTick` left a gap where Esc hit the widget first.
   */
  clipboardHelpOpen.value = true
}

function setupClipboardHelpObserver(wrapper: HTMLElement) {
  clipboardModalObserver?.disconnect()

  clipboardModalObserver = new MutationObserver((records) => {
    for (const rec of records) {
      rec.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return
        if (n.closest('[data-vue-inspector-clipboard-suppressed]')) return
        const anchor = findJseClipboardAnchor(n)
        if (anchor) suppressNativeClipboardDialog(anchor)
      })
    }
  })

  clipboardModalObserver.observe(wrapper, { childList: true, subtree: true })

  void wrapper.querySelectorAll('.jse-copy-paste').forEach((existing) => {
    if (!(existing instanceof HTMLElement)) return
    if (existing.closest('[data-vue-inspector-clipboard-suppressed]')) return
    suppressNativeClipboardDialog(existing)
  })
}

watch(
  clipboardHelpOpen,
  (open) => {
    if (open) {
      activateClipboardHelpEscDismiss(() => {
        clipboardHelpOpen.value = false
      })
    } else {
      deactivateClipboardHelpEscDismiss()
      removeNativeClipboardOverlay?.()
      refocusEditor()
    }
  },
  { flush: 'sync' },
)

const themeClass = computed(() =>
  (inspectorState.theme ?? 'dark') === 'dark'
    ? 'jse-theme-dark'
    : 'jse-theme-default',
)

const navigationBarVisible = computed(() =>
  props.navigationBar ?? props.mode === 'tree',
)

const isTreeMode = computed(() => props.mode === 'tree')
const isTextMode = computed(() => props.mode === 'text')

function stringToContent(s: string): Content {
  // Always hand the editor raw text — it uses a memoised JSON.parse
  // internally and only materialises the parsed value when the active
  // mode actually needs it (e.g. tree mode). This avoids a multi-MB
  // synchronous parse on every prop change and keeps mode switches
  // and large-document loads snappy.
  return { text: s ?? '' }
}

function contentToString(c: Content): string {
  if ('json' in c && c.json !== undefined) {
    try {
      return JSON.stringify(c.json, null, 2)
    } catch {
      return ''
    }
  }
  if ('text' in c && typeof c.text === 'string') return c.text
  return ''
}

let syncingFromParent = false
/**
 * Last value we emitted upstream. Used to drop the inevitable echo
 * `update:modelValue` -> parent re-renders -> `props.modelValue` watcher
 * loop, which would otherwise call `editor.update()` on every keystroke
 * or every parent re-render and reset tree-node expansion state.
 */
let lastEmittedValue: string | null = null

function emitValue(text: string) {
  lastEmittedValue = text
  emit('update:modelValue', text)
}

function applyContent(next: Content) {
  const editor = editorRef.value
  if (!editor) return
  syncingFromParent = true
  editor.update(next)
  emitValue(contentToString(next))
  void nextTick(() => {
    syncingFromParent = false
  })
}

// ─────────────────────────── Toolbar actions ───────────────────────────

/**
 * Return focus to the editor after any toolbar button click so that the
 * editor's own keyboard shortcuts (Ctrl+F, F3, Esc, …) keep working.
 * Buttons receive focus on click by default, which otherwise breaks the
 * widget's built-in keymap.
 */
function refocusEditor() {
  void nextTick(() => {
    editorRef.value?.focus?.()
  })
}

function expandAllNodes() {
  editorRef.value?.expand([], expandAll)
  refocusEditor()
}

function collapseAllNodes() {
  const editor = editorRef.value
  if (!editor) return
  editor.expand([], expandNone)
  editor.collapse([], true)
  refocusEditor()
}

function formatJson() {
  const editor = editorRef.value
  if (!editor) return
  try {
    const cur = editor.get()
    const text = 'json' in cur && cur.json !== undefined
      ? JSON.stringify(cur.json, null, 2)
      : 'text' in cur && typeof cur.text === 'string'
        ? JSON.stringify(JSON.parse(cur.text), null, 2)
        : ''
    if (!text) return
    applyContent({ text })
  } catch {
    /* invalid JSON — ignore */
  }
  refocusEditor()
}

function compactJson() {
  const editor = editorRef.value
  if (!editor) return
  try {
    const cur = editor.get()
    const text = 'json' in cur && cur.json !== undefined
      ? JSON.stringify(cur.json)
      : 'text' in cur && typeof cur.text === 'string'
        ? JSON.stringify(JSON.parse(cur.text))
        : ''
    if (!text) return
    applyContent({ text })
  } catch {
    /* invalid JSON — ignore */
  }
  refocusEditor()
}

async function copyJsonToolbar() {
  const editor = editorRef.value
  if (!editor) return
  const text = contentToString(editor.get())
  const ok = await copyToClipboard(text)
  if (ok) {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  }
  refocusEditor()
}

/** Opens vanilla-jsoneditor search — same path as Ctrl+F — then focuses its input. */
function openSearchFromToolbar() {
  openEditorSearch()
  void nextTick(() => {
    getSearchInput()?.focus({ preventScroll: true })
  })
}

const showToolbar = computed(() => {
  if (!props.toolbar) return false
  // Tree mode → expand/collapse + optional Copy (always at least 2 actions).
  if (isTreeMode.value) return true
  // Text mode → Format/Compact only when editable; Copy when requested.
  if (props.editable) return true
  return props.showCopy
})

// ─────────────────────────── Lifecycle ───────────────────────────

onMounted(() => {
  const target = containerRef.value
  if (!target) return

  target.classList.add(themeClass.value)

  const editorProps: JSONEditorPropsOptional = {
    content: stringToContent(props.modelValue),
    mode: props.mode === 'tree' ? Mode.tree : Mode.text,
    readOnly: !props.editable,
    mainMenuBar: props.mainMenuBar,
    navigationBar: navigationBarVisible.value,
    statusBar: props.statusBar,
    // Suppress the library's "The document is compact, do you want
    // to format it?" prompt — formatting is available manually via
    // the toolbar in text mode and is not desired automatically.
    askToFormat: false,
    // Performance: in tree mode huge strings are truncated by default
    // at 1000 chars. Bump the threshold so 99% of normal payloads aren't
    // clipped but enormous blobs (e.g. base64 images) stay collapsed.
    truncateTextSize: 10_000,
    // Allow opening documents up to 32 MB in text mode without the
    // built-in "may crash your browser" warning. Above this CodeMirror
    // starts to feel sluggish; the library will then show its own
    // warning.
    maxDocumentSizeTextMode: 32 * 1024 * 1024,
    onError(err: Error) {
      console.error('[ui/JsonEditor]', err)
    },
    onChange(updated: Content) {
      if (syncingFromParent) return
      if (!props.editable) return
      emitValue(contentToString(updated))
    },
    onRenderMenu: onRenderMenuForSort,
    onRenderContextMenu: onRenderContextMenuForVue,
  }

  editorRef.value = createJSONEditor({
    target,
    props: editorProps,
  }) as unknown as JSONEditorHandle

  // Register after mount tick so `wrapperRef` is set; fall back to the host
  // container’s parent (same `.ui-json-editor` root) if a ref ever lags.
  void nextTick(() => {
    const wrapper =
      wrapperRef.value
      ?? (target.parentElement instanceof HTMLElement
        ? target.parentElement
        : target)
    document.addEventListener('contextmenu', onTreeContextMenuCapture, true)
    document.addEventListener('pointerdown', onTreeMenuOpenerPointerDownCapture, true)
    setupClipboardHelpObserver(wrapper)
    const handle: JsonEditorSearchHandle = {
      wrapperEl: wrapper,
      openSearch: openEditorSearch,
      setQuery: setSearchQuery,
      closeSearch,
      findNext,
      findPrevious,
      isSearchOpen,
    }
    unregisterSearchHandle = registerJsonEditor(handle)
  })
})

onBeforeUnmount(async () => {
  document.removeEventListener('contextmenu', onTreeContextMenuCapture, true)
  document.removeEventListener('pointerdown', onTreeMenuOpenerPointerDownCapture, true)
  clipboardModalObserver?.disconnect()
  clipboardModalObserver = null
  deactivateClipboardHelpEscDismiss()
  removeNativeClipboardOverlay?.()
  removeNativeClipboardOverlay = null

  unregisterSearchHandle?.()
  unregisterSearchHandle = null
  const inst = editorRef.value
  editorRef.value = null
  if (inst) await inst.destroy()
})

watch(themeClass, (cls, prev) => {
  const root = containerRef.value
  if (!root) return
  if (prev) root.classList.remove(prev)
  root.classList.add(cls)
})

watch(
  () => props.mode,
  (m) => {
    editorRef.value?.updateProps({
      mode: m === 'tree' ? Mode.tree : Mode.text,
      navigationBar: props.navigationBar ?? m === 'tree',
    })
  },
)

function setMode(next: JsonMode) {
  if (next === props.mode) return
  emit('update:mode', next)
}

watch(
  () => props.editable,
  (ed) => {
    editorRef.value?.updateProps({ readOnly: !ed })
  },
)

watch(
  () => props.modelValue,
  (next) => {
    const editor = editorRef.value
    if (!editor) return
    // Cheap echo guard — skip the watcher when the parent is simply
    // mirroring back the value we just emitted. This avoids calling
    // `editor.update()` (which rebuilds the tree and loses node expansion
    // state) on every keystroke or parent re-render.
    if (next === lastEmittedValue) return

    const current = contentToString(editor.get())
    if (current === next) {
      lastEmittedValue = next
      return
    }
    syncingFromParent = true
    editor.update(stringToContent(next))
    lastEmittedValue = next
    void nextTick(() => {
      syncingFromParent = false
    })
  },
)

// ─────────── Editor remote-control: search panel open/close/find ───────────
//
// All keyboard interception (Ctrl+F, Esc) and DevTools-panel search
// routing are handled centrally by `jsonEditorSearchRegistry`. The
// functions below are the implementation each registered editor
// exposes through its `JsonEditorSearchHandle`.

function isSearchPanelVisiblyOpen(): boolean {
  const root = containerRef.value
  if (!root) return false
  // The widget may mount `.jse-search-box` markup while closed; trusting the bare
  // selector made `Ctrl+F` a no-op (registry skips `openSearch` when “open”).
  const input =
    root.querySelector<HTMLElement>('.jse-search-box .jse-search-input')
    ?? root.querySelector<HTMLElement>('.jse-search-input')
  if (!input) return false
  const style = window.getComputedStyle(input)
  if (style.visibility === 'hidden' || style.display === 'none')
    return false
  const r = input.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function isSearchOpen(): boolean {
  return isSearchPanelVisiblyOpen()
}

function primaryShortcutModifiers(): Pick<
  KeyboardEventInit,
  'ctrlKey' | 'metaKey'
> {
  if (typeof navigator === 'undefined')
    return { ctrlKey: true, metaKey: false }
  const ua = navigator.userAgent ?? ''
  const ud = navigator.userAgentData
  const platform =
    (typeof ud?.platform === 'string' ? ud.platform : '')
    || navigator.platform
    || ''
  const apple =
    /Mac|iPhone|iPod|iPad/i.test(platform)
    || ua.includes('Mac OS')
  return apple ? { ctrlKey: false, metaKey: true } : { ctrlKey: true, metaKey: false }
}

/**
 * Prefer the embedded toolbar control (`button.jse-search`) — a real click runs the same
 * Svelte handler as the UI and works where synthetic KeyboardEvent is ignored (iframes / DevTools).
 * Fallback: synthetic Mod+F on tree hidden input / CodeMirror, etc.
 */
function openEditorSearch() {
  const root = containerRef.value
  if (!root) return

  const toolbarBtn = root.querySelector<HTMLButtonElement>('button.jse-search')
  if (toolbarBtn && !toolbarBtn.disabled) {
    const treeEarly = root.querySelector<HTMLElement>('.jse-tree-mode')
    const hiddenEarly =
      treeEarly?.querySelector<HTMLInputElement>('.jse-hidden-input')
    hiddenEarly?.focus({ preventScroll: true })
    toolbarBtn.click()
    if (isSearchPanelVisiblyOpen()) return
  }

  const candidates: Array<{ target: HTMLElement; focus: boolean }> = []
  const tree = root.querySelector<HTMLElement>('.jse-tree-mode')
  const hiddenInput = tree?.querySelector<HTMLInputElement>('.jse-hidden-input')
  // Keyboard shortcuts for tree mode are handled while focus is on the invisible sink.
  if (hiddenInput) {
    candidates.push({ target: hiddenInput, focus: true })
  }
  if (tree) {
    candidates.push({ target: tree, focus: false })
  }
  const table = root.querySelector<HTMLElement>('.jse-table-mode')
  if (table) candidates.push({ target: table, focus: false })
  const cmContent = root.querySelector<HTMLElement>('.cm-content')
  if (cmContent) candidates.push({ target: cmContent, focus: true })
  const textMode = root.querySelector<HTMLElement>('.jse-text-mode')
  if (textMode) candidates.push({ target: textMode, focus: false })

  for (const { target, focus } of candidates) {
    if (focus && typeof target.focus === 'function') {
      target.focus({ preventScroll: true })
    }
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        code: 'KeyF',
        ...primaryShortcutModifiers(),
        bubbles: true,
        cancelable: true,
        composed: true,
        view: typeof window !== 'undefined' ? window : undefined,
      }),
    )
    // As soon as the editor opens its own search panel, we're done.
    if (isSearchPanelVisiblyOpen()) break
  }
}

// ─────────────── Remote-control handle for DevTools search relay ───────────────

/**
 * Locate the editor's built-in search `<input>` (rendered inside
 * `.jse-search-box` whenever the panel is open).
 */
function getSearchInput(): HTMLInputElement | null {
  return containerRef.value?.querySelector<HTMLInputElement>(
    '.jse-search-box .jse-search-input',
  )
    ?? containerRef.value?.querySelector<HTMLInputElement>('.jse-search-input')
    ?? null
}

/**
 * Set a value on a Svelte-bound input the same way a real user would,
 * using the native `value` setter and a bubbling `input` event so the
 * editor's reactive system picks up the change.
 */
function programmaticallyTypeInto(input: HTMLInputElement, value: string) {
  const proto = window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function ensureSearchOpen(): Promise<HTMLInputElement | null> {
  let input = getSearchInput()
  if (input) return input
  openEditorSearch()
  // The search box is rendered reactively — wait one frame so the
  // input is in the DOM before we touch it.
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  input = getSearchInput()
  if (input) return input
  await nextTick()
  return getSearchInput()
}

function setSearchQuery(query: string) {
  void ensureSearchOpen().then((input) => {
    if (!input) return
    programmaticallyTypeInto(input, query)
    if (typeof input.focus === 'function') {
      input.focus({ preventScroll: true })
    }
  })
}

function dispatchSearchKey(key: 'Enter', shift = false) {
  const input = getSearchInput()
  if (!input) return
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: key === 'Enter' ? 'Enter' : key,
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    }),
  )
}

function findNext() {
  dispatchSearchKey('Enter', false)
}

function findPrevious() {
  dispatchSearchKey('Enter', true)
}

function closeSearch() {
  const root = containerRef.value
  if (!root) return
  const clearBtn = root.querySelector<HTMLButtonElement>(
    '.jse-search-box .jse-search-clear',
  )
  if (clearBtn) {
    clearBtn.click()
    return
  }
  const input = getSearchInput()
  if (!input) return
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  )
}

let unregisterSearchHandle: (() => void) | null = null
</script>

<template>
  <div
    ref="wrapperRef"
    class="ui-json-editor relative flex flex-col"
    :class="fullHeight ? 'h-full min-h-0' : ''"
  >
    <!-- Action toolbar — uses UIKit Button for design-system consistency. -->
    <div
      v-if="showToolbar"
      class="ui-json-editor__toolbar shrink-0 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 py-1 border border-b-0 rounded-t-md bg-muted/40"
    >
      <div class="flex flex-wrap items-center gap-1 min-w-0">
        <div
          class="inline-flex rounded-md border border-border/80 bg-muted/40 p-0.5 gap-0.5"
          role="group"
          aria-label="Editor mode"
        >
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs rounded-sm"
            :class="isTextMode ? 'bg-background shadow-sm' : ''"
            title="Text mode"
            @click="setMode('text')"
          >
            Text
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs rounded-sm"
            :class="isTreeMode ? 'bg-background shadow-sm' : ''"
            title="Tree mode"
            @click="setMode('tree')"
          >
            Tree
          </Button>
        </div>

        <template v-if="isTreeMode">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs"
            title="Expand all"
            @click="expandAllNodes"
          >
            <ChevronsUpDown class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Expand all</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs"
            title="Collapse all"
            @click="collapseAllNodes"
          >
            <ChevronsDownUp class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Collapse all</span>
          </Button>
        </template>

        <template v-if="isTextMode && editable">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs"
            title="Format JSON"
            @click="formatJson"
          >
            <AlignLeft class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Format</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1 px-2 text-xs"
            title="Compact JSON"
            @click="compactJson"
          >
            <Minimize2 class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Compact</span>
          </Button>
        </template>
      </div>

      <div class="flex flex-wrap items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1 px-2 text-xs"
          title="Search (Ctrl+F)"
          @click="openSearchFromToolbar"
        >
          <Search class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Search</span>
        </Button>

        <Button
          v-if="showCopy"
          variant="ghost"
          size="sm"
          class="h-7 gap-1 px-2 text-xs"
          :title="copied ? 'Copied' : 'Copy to clipboard'"
          @click="copyJsonToolbar"
        >
          <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ copied ? 'Copied' : 'Copy' }}</span>
        </Button>
      </div>
    </div>

    <div
      ref="containerRef"
      class="ui-json-editor__host overflow-hidden bg-background"
      :class="[
        showToolbar ? 'rounded-b-md border border-t-0' : 'rounded-md border',
        fullHeight
          ? 'flex-1 min-h-[260px] min-w-0'
          : 'min-h-[300px] w-full',
      ]"
    />

    <JsonClipboardHelpDialog v-model="clipboardHelpOpen" />
    <JsonTreeContextMenu
      v-if="isTreeMode"
      v-model:open="treeContextMenuOpen"
      :anchor="treeContextMenuAnchor"
      :items="treeContextMenuItems"
    />
  </div>
</template>

<style scoped>
.ui-json-editor__host :deep(.jse-main),
.ui-json-editor__host :deep(.jse-root) {
  height: 100%;
  min-height: 260px;
}
</style>
