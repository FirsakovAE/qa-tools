import { watch, onUnmounted, type Ref, type ComputedRef } from 'vue'

/** capture + window: перехватываем Esc до обработчиков DevTools (консоль по Esc и т.п.). */
const ESC_KEYDOWN_OPTIONS: AddEventListenerOptions = { capture: true }

/**
 * Глобальный обработчик Escape. Для панелей в Chrome DevTools нужен capture на window
 * и preventDefault/stopPropagation — иначе Esc уходит в хост DevTools.
 */
export function useEscapeClose(
  isActive: Ref<boolean> | ComputedRef<boolean>,
  close: () => void
) {
  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
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
