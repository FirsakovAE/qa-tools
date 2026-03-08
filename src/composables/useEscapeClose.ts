import { watch, onUnmounted, type Ref, type ComputedRef } from 'vue'

/**
 * Document-level Escape key handler. Use inside detail components
 * (with editing-first logic) or at tab level (for panel layering).
 */
export function useEscapeClose(
    isActive: Ref<boolean> | ComputedRef<boolean>,
    close: () => void,
) {
    function onKeydown(e: KeyboardEvent) {
        if (e.key !== 'Escape') return
        e.stopImmediatePropagation()
        close()
    }

    watch(isActive, (active) => {
        if (active) {
            document.addEventListener('keydown', onKeydown)
        } else {
            document.removeEventListener('keydown', onKeydown)
        }
    }, { immediate: true })

    onUnmounted(() => document.removeEventListener('keydown', onKeydown))
}
