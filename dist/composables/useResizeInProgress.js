/**
 * Detects when window/panel is being resized (e.g. DevTools panel resize).
 * Used to pause heavy operations (video playback, blur) during resize to avoid freezes.
 */
import { ref, onMounted, onUnmounted } from 'vue';
const RESIZE_DEBOUNCE_MS = 150;
export function useResizeInProgress() {
    const isResizing = ref(false);
    let timeoutId = null;
    function onResize() {
        isResizing.value = true;
        if (timeoutId)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            isResizing.value = false;
            timeoutId = null;
        }, RESIZE_DEBOUNCE_MS);
    }
    onMounted(() => {
        window.addEventListener('resize', onResize);
    });
    onUnmounted(() => {
        window.removeEventListener('resize', onResize);
        if (timeoutId)
            clearTimeout(timeoutId);
    });
    return { isResizing };
}
//# sourceMappingURL=useResizeInProgress.js.map