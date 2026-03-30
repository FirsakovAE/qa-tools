import { watch } from 'vue';
import { useRuntime } from '@/runtime';
async function unhighlightElements() {
    try {
        const runtime = useRuntime();
        runtime.sendMessage({
            type: 'UNHIGHLIGHT_ELEMENT'
        }).catch(error => {
            console.error('[useAutoUnhighlight] Failed to send UNHIGHLIGHT_ELEMENT:', error);
        });
    }
    catch (error) {
        console.error('[useAutoUnhighlight] Failed to unhighlight elements:', error);
    }
}
export function useAutoUnhighlight(selectedNode) {
    if (selectedNode) {
        watch(selectedNode, (newSelectedNode, oldSelectedNode) => {
            if (oldSelectedNode && !newSelectedNode) {
                unhighlightElements();
            }
        }, { immediate: false });
    }
}
//# sourceMappingURL=useAutoUnhighlight.js.map