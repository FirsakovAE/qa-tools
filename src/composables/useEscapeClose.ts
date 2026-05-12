import { watch, onUnmounted, type Ref, type ComputedRef } from 'vue'

/** capture + window: перехватываем Esc до обработчиков DevTools (консоль по Esc и т.п.). */
const ESC_KEYDOWN_OPTIONS: AddEventListenerOptions = { capture: true }

/**
 * Selectors for inner overlays/popups that should consume Esc themselves
 * before the surrounding details panel handles it. Order matters: the
 * first match wins (we just need any of them present in the DOM).
 *
 * Add new entries here as new Esc-consuming widgets are introduced.
 */
const INNER_ESC_CONSUMERS: readonly string[] = [
  '.jse-search-box',           // vanilla-jsoneditor Ctrl+F search
  '.jse-jsoneditor-modal',     // vanilla-jsoneditor modal dialogs
  '.jse-context-menu',         // vanilla-jsoneditor context menu
]

function hasInnerEscConsumer(): boolean {
  for (const selector of INNER_ESC_CONSUMERS) {
    if (document.querySelector(selector)) return true
  }
  return false
}

/**
 * Глобальный обработчик Escape. Для панелей в Chrome DevTools нужен capture на window
 * и preventDefault/stopPropagation — иначе Esc уходит в хост DevTools.
 *
 * Bails out (lets Esc propagate) when an inner widget has its own
 * Esc-consuming overlay open (search box, modal, context menu).
 * In that case the inner widget closes itself first; the next Esc
 * press will then close the details panel.
 */
export function useEscapeClose(
  isActive: Ref<boolean> | ComputedRef<boolean>,
  close: () => void
) {
  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (hasInnerEscConsumer()) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    close()
  }

  watch(isActive, (active) => {
    if (active) {
      window.addEventListener('keydown', onKeydown, ESC_KEYDOWN_OPTIONS)
    } else {
      window.removeEventListener('keydown', onKeydown, ESC_KEYDOWN_OPTIONS)
    }
  }, { immediate: true })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown, ESC_KEYDOWN_OPTIONS)
  })
}
